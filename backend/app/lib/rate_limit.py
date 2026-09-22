"""
Fixed-window request limiter, in memory.

The AI routes are the only ones in this API that cost money per call, so they
get an allowance: N requests per minute per user, and N per minute for the
whole process. Going over answers 429 with a `Retry-After` instead of forwarding
the request to the gateway.

**Scope: one process.** The counters live in this module's memory, so two
uvicorn workers each get the full allowance. That is deliberate — it keeps the
first version free of Redis while still capping a single runaway client, which
is what a per-user quota is for. When the API runs on more than one worker, swap
`_Window.hit` for a Redis `INCR`/`EXPIRE` on the same key and nothing else
changes.

Not business logic and not tied to the AI domain: `lib/` is the right home.
"""

import threading
import time
from dataclasses import dataclass, field

# A minute. Named because the window and the "per minute" in the settings have
# to be the same number or the limit means something else.
WINDOW_SECONDS = 60.0


@dataclass(frozen=True)
class RateLimitVerdict:
    """The outcome of one `check`: allowed, or how long until it would be."""

    allowed: bool
    # Seconds until the window rolls over. Always >= 1 when denied, so a client
    # that sleeps on it never retries into the very same window.
    retry_after: int = 0
    # Which allowance ran out: the caller's own, or the whole process's.
    scope: str = ""


@dataclass
class _Window:
    """Counters keyed by subject, each valid until its own `expires_at`."""

    counts: dict[str, int] = field(default_factory=dict)
    expires_at: dict[str, float] = field(default_factory=dict)

    def hit(self, key: str, limit: int, now: float) -> float | None:
        """
        Records a request. Returns `None` when it fits in the window, or the
        instant the window rolls over when it does not.
        """
        expiry = self.expires_at.get(key)

        if expiry is None or expiry <= now:
            self.counts[key] = 1
            self.expires_at[key] = now + WINDOW_SECONDS
            return None

        if self.counts.get(key, 0) >= limit:
            return expiry

        self.counts[key] = self.counts.get(key, 0) + 1
        return None

    def purge(self, now: float) -> None:
        """Drops windows that already rolled over, so keys do not accumulate."""
        stale = [key for key, expiry in self.expires_at.items() if expiry <= now]
        for key in stale:
            self.counts.pop(key, None)
            self.expires_at.pop(key, None)


class RateLimiter:
    """
    Two windows checked together: the caller's, then the process's.

    The order matters. The per-user window is checked first so a single client
    burning through the shared allowance reads its own limit in the error,
    instead of a global message that makes it look like the service is down.
    """

    # Cleaning on every call would be O(users) per request; every 200 keeps the
    # dictionaries bounded without doing it in the hot path.
    _PURGE_EVERY = 200

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._per_subject = _Window()
        self._global = _Window()
        self._since_purge = 0

    def check(
        self,
        subject: str,
        *,
        per_subject_limit: int,
        global_limit: int,
    ) -> RateLimitVerdict:
        """
        Counts one request against both windows.

        A denial by the process window does **not** consume the caller's
        allowance: the request never reached the gateway, so it should not be
        held against the person who made it.
        """
        now = time.monotonic()

        with self._lock:
            self._since_purge += 1
            if self._since_purge >= self._PURGE_EVERY:
                self._since_purge = 0
                self._per_subject.purge(now)
                self._global.purge(now)

            blocked_until = self._per_subject.hit(subject, per_subject_limit, now)
            if blocked_until is not None:
                return _denied(blocked_until, now, "user")

            blocked_until = self._global.hit("*", global_limit, now)
            if blocked_until is not None:
                # Give the slot back: this request is not the caller's fault.
                self._per_subject.counts[subject] -= 1
                return _denied(blocked_until, now, "service")

        return RateLimitVerdict(allowed=True)

    def reset(self) -> None:
        """Clears every window. For tests."""
        with self._lock:
            self._per_subject = _Window()
            self._global = _Window()
            self._since_purge = 0


def _denied(blocked_until: float, now: float, scope: str) -> RateLimitVerdict:
    # Rounded up and never zero: `Retry-After: 0` invites an instant retry.
    return RateLimitVerdict(
        allowed=False,
        retry_after=max(1, int(blocked_until - now) + 1),
        scope=scope,
    )


# One limiter for the AI endpoints, shared by every request in the process.
ai_rate_limiter = RateLimiter()
