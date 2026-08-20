/** Wordmark: a floor-plan corner drawn next to the name. */
export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const isDark = tone === "dark";

  return (
    <span className="flex items-center gap-2.5">
      <svg
        viewBox="0 0 32 32"
        aria-hidden="true"
        className={isDark ? "size-8 text-blueprint-600" : "size-8 text-timber-300"}
      >
        <rect x="3" y="3" width="26" height="26" rx="5" className="fill-current opacity-12" />
        <path
          d="M9 23V12l7-4 7 4v11"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M9 18h14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="16" cy="18" r="2" className="fill-current" />
      </svg>
      <span
        className={`font-display text-lg font-semibold tracking-tight ${
          isDark ? "text-ink-900" : "text-paper-50"
        }`}
      >
        PlanCraft <span className="text-timber-500">AI</span>
      </span>
    </span>
  );
}
