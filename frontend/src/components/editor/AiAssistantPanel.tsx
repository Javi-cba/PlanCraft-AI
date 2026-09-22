"use client";

import { Layers, LoaderCircle, Send, Sparkles, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useApi } from "@/hooks/useApi";
import { assistPlan } from "@/lib/api/ai";
import { isApiError } from "@/lib/api/client";
import {
  PROMPT_MAX_LENGTH,
  type AiStatus,
  type Conversation,
  type CreatedFloor,
} from "@/lib/schemas/ai";
import { floorLevelLabel } from "@/lib/schemas/floor";
import { useEditorStore } from "@/lib/store/editorStore";
import { cn } from "@/lib/utils/cn";

/**
 * The chat that draws. Dibuja el piso desde cero y después lo va retocando.
 *
 * What the assistant returns is applied with `apply()`, the same entry point the
 * tools and the templates use — so an answer nobody liked is one ⌘Z away, and
 * it is saved with the Guardar button like everything else. The panel never
 * writes to the backend's floor: it only asks, applies and shows what happened.
 *
 * The layout travels with every message, read from the store at send time
 * rather than from a prop: between two messages the person moves walls by hand,
 * and the assistant has to edit what is on screen.
 */

/** Openers for an empty thread. Real capabilities, not a wishlist. */
const SUGGESTIONS = [
  "Una casa de dos dormitorios, cocina, baño y living comedor.",
  "Un monoambiente de 6x4 con baño y kitchenette.",
  "Un local a la calle de 8x12 con depósito y baño.",
] as const;

/** Offered once there is something drawn: these only make sense as edits. */
const EDIT_SUGGESTIONS = [
  "Agregale una ventana a cada dormitorio.",
  "Agrandá el baño 50 cm hacia el pasillo.",
  "Sumá una planta alta con dos dormitorios y baño.",
] as const;

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Operations the backend could not apply, verbatim. */
  skipped?: string[];
  applied?: number;
  /** Storeys the turn added to the project. Already saved, hence the links. */
  createdFloors?: CreatedFloor[];
};

type Failure = {
  message: string;
  /** Seconds to wait, when the backend answered 429. */
  retryAfter?: number;
};

export function AiAssistantPanel({
  projectId,
  floorId,
  status,
  initialConversation,
  onClose,
  onApplied,
}: {
  /** Needed to link a storey the assistant creates to its own editor. */
  projectId: string;
  floorId: string;
  status: AiStatus;
  initialConversation: Conversation | null;
  onClose: () => void;
  /** Called after a layout lands, so the editor can re-frame the canvas. */
  onApplied: () => void;
}) {
  const api = useApi();

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    toChatMessages(initialConversation),
  );
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversation?.id,
  );
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  /** Whether the reader is at the bottom. Scrolling up opts out of the pin. */
  const pinnedRef = useRef(true);

  /**
   * Keeps the newest turn in view.
   *
   * Driven by a `ResizeObserver` on the thread's content and not by the
   * message list, because the height that matters only exists after layout:
   * an effect keyed on `messages.length` scrolls to where the bottom was
   * *before* the new bubble was measured, and stops short by the height of its
   * own text. Observing the content also covers a font swapping in later.
   *
   * `scrollTop` and not `scrollTo({behavior: "smooth"})`: the smooth variant is
   * silently ignored on this container and the thread never moves.
   */
  useEffect(() => {
    const thread = threadRef.current;
    const content = contentRef.current;
    if (thread === null || content === null) return;

    const pin = () => {
      if (pinnedRef.current) thread.scrollTop = thread.scrollHeight;
    };

    // Reading back a turn means scrolling up; the next answer should not yank
    // the view away. Anything within a line of the bottom still counts as "at
    // the bottom", so a stray pixel does not turn the pin off.
    const remember = () => {
      pinnedRef.current =
        thread.scrollHeight - thread.scrollTop - thread.clientHeight < 40;
    };

    const observer = new ResizeObserver(pin);
    observer.observe(content);
    thread.addEventListener("scroll", remember, { passive: true });

    pin();

    return () => {
      observer.disconnect();
      thread.removeEventListener("scroll", remember);
    };
  }, []);

  const send = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (message.length === 0 || pending) return;

      const layout = useEditorStore.getState().layout;

      setDraft("");
      setFailure(null);
      setPending(true);
      setMessages((current) => [
        ...current,
        { id: `local-${Date.now()}`, role: "user", content: message },
      ]);

      try {
        const answer = await assistPlan(api, floorId, {
          message,
          layout,
          conversation_id: conversationId,
        });

        // Through `apply`, so the answer joins the undo stack instead of
        // replacing the drawing behind the person's back. A turn that only
        // added another storey changes nothing here, and `apply` ignores a
        // layout it was already holding.
        useEditorStore.getState().apply(() => answer.layout);
        useEditorStore.getState().select(null);
        onApplied();

        setConversationId(answer.conversation_id);
        setMessages((current) => [
          ...current,
          {
            id: answer.message_id,
            role: "assistant",
            content: answer.summary,
            skipped: answer.skipped,
            applied: answer.applied,
            createdFloors: answer.created_floors,
          },
        ]);
      } catch (cause) {
        setFailure(toFailure(cause));
        // The question goes back in the box: retyping it after a rate limit
        // would be the second annoyance in a row.
        setDraft(message);
        setMessages((current) => current.slice(0, -1));
      } finally {
        setPending(false);
        inputRef.current?.focus();
      }
    },
    [api, conversationId, floorId, onApplied, pending],
  );

  const suggestions = messages.length === 0 ? SUGGESTIONS : EDIT_SUGGESTIONS;

  return (
    <section
      aria-label="Asistente de IA"
      className={cn(
        // A drawer over the canvas on a phone, a column beside it on desktop.
        "fixed inset-x-0 bottom-0 z-30 flex max-h-[78dvh] flex-col border-t border-paper-300/70 bg-paper-100 shadow-2xl shadow-ink-900/20",
        "lg:static lg:z-auto lg:max-h-none lg:w-[22rem] lg:shrink-0 lg:border-t-0 lg:border-r lg:shadow-none xl:w-96",
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-paper-300/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-blueprint-600/10 text-blueprint-700">
            <Sparkles aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-sm font-medium text-ink-900">
              Asistente IA
            </h2>
            <p className="truncate text-[0.65rem] text-ink-700/50">
              {status.model} · hasta {status.user_requests_per_minute} pedidos por
              minuto
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-paper-300 p-1.5 text-ink-700/60 transition hover:border-blueprint-600/40 hover:text-blueprint-700"
        >
          <X aria-hidden="true" className="size-4" />
          <span className="sr-only">Cerrar el asistente</span>
        </button>
      </header>

      <div ref={threadRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {/* The observed element: its height is what the pin above reacts to. */}
        <div ref={contentRef} className="space-y-3">
          {messages.length === 0 ? <EmptyState /> : null}

          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} projectId={projectId} />
          ))}

          {pending ? (
            <p className="flex items-center gap-2 text-xs text-ink-700/60">
              <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
              Dibujando…
            </p>
          ) : null}

          {failure !== null ? <FailureNotice failure={failure} /> : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-paper-300/70 px-4 py-3">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={pending}
              onClick={() => void send(suggestion)}
              className="rounded-full border border-blueprint-600/20 px-2.5 py-1 text-left text-[0.7rem] leading-snug text-blueprint-700 transition hover:border-blueprint-600/50 hover:bg-paper-50 disabled:pointer-events-none disabled:opacity-45"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void send(draft);
          }}
          className="flex items-end gap-2"
        >
          <label className="sr-only" htmlFor="ai-prompt">
            Qué querés dibujar o cambiar
          </label>
          <textarea
            id="ai-prompt"
            ref={inputRef}
            rows={2}
            value={draft}
            maxLength={PROMPT_MAX_LENGTH}
            disabled={pending}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // ⌘/Ctrl+Enter sends; plain Enter keeps writing, because a plan
              // request is usually more than one line.
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void send(draft);
              }
            }}
            placeholder="Describí el plano o el cambio que querés…"
            className="min-h-[3.25rem] flex-1 resize-none rounded-2xl border border-paper-300 bg-paper-50 px-3 py-2 text-sm text-ink-800 placeholder:text-ink-700/35 focus:border-blueprint-600/50 focus:outline-none disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={pending || draft.trim().length === 0}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-blueprint-600 text-paper-50 shadow-sm transition hover:bg-blueprint-700 disabled:pointer-events-none disabled:opacity-40"
          >
            {pending ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Send aria-hidden="true" className="size-4" />
            )}
            <span className="sr-only">Enviar</span>
          </button>
        </form>

        <p className="mt-2 text-[0.65rem] leading-relaxed text-ink-700/45">
          Lo que dibuje se aplica al lienzo y se deshace con ⌘Z. Se guarda recién
          cuando tocás Guardar.
        </p>
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-paper-300 bg-paper-50/60 px-4 py-5">
      <p className="font-display text-sm font-medium text-ink-900">
        Contame qué hay que dibujar
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-700/65">
        Puede armar el piso entero desde cero o retocar lo que ya está: mover una
        pared, sumar una ventana, renombrar un ambiente. Trabaja siempre sobre lo
        que ves en el lienzo.
      </p>
    </div>
  );
}

function ChatBubble({
  message,
  projectId,
}: {
  message: ChatMessage;
  projectId: string;
}) {
  if (message.role === "user") {
    return (
      <p className="ml-6 rounded-2xl rounded-br-md bg-blueprint-600 px-3.5 py-2.5 text-sm leading-relaxed text-paper-50">
        {message.content}
      </p>
    );
  }

  return (
    <div className="mr-6 rounded-2xl rounded-bl-md border border-paper-300/80 bg-paper-50 px-3.5 py-2.5">
      <p className="text-sm leading-relaxed text-ink-800">{message.content}</p>

      {message.applied !== undefined && message.applied > 0 ? (
        <p className="mt-1.5 text-[0.65rem] tracking-wide text-ink-700/45 uppercase">
          {message.applied} {message.applied === 1 ? "cambio" : "cambios"} aplicados
        </p>
      ) : null}

      {message.createdFloors !== undefined && message.createdFloors.length > 0 ? (
        <ul className="mt-2.5 space-y-1.5">
          {message.createdFloors.map((floor) => (
            <li key={floor.id}>
              {/* Already saved, unlike the drawing on the canvas — so it is a
                  link to somewhere that exists, not a pending change. */}
              <Link
                href={`/projects/${projectId}/floors/${floor.id}`}
                className="flex items-center gap-2 rounded-xl border border-blueprint-600/25 bg-paper-100/70 px-2.5 py-2 transition hover:border-blueprint-600/60 hover:bg-paper-100"
              >
                <Layers aria-hidden="true" className="size-3.5 shrink-0 text-blueprint-600" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-ink-900">
                    {floor.name}
                  </span>
                  <span className="block text-[0.65rem] text-ink-700/55">
                    {floorLevelLabel(floor.level)} · {floor.summary.rooms} amb ·{" "}
                    {floor.summary.area_m2.toLocaleString("es-AR")} m² · abrir
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {message.skipped !== undefined && message.skipped.length > 0 ? (
        <ul className="mt-2 space-y-1 border-t border-paper-300/70 pt-2">
          {message.skipped.map((reason) => (
            <li
              key={reason}
              className="flex gap-1.5 text-[0.7rem] leading-snug text-timber-600"
            >
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
              {reason}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FailureNotice({ failure }: { failure: Failure }) {
  return (
    <p
      role="alert"
      className="flex gap-2 rounded-2xl border border-timber-500/30 bg-timber-300/15 px-3.5 py-2.5 text-xs leading-relaxed text-timber-600"
    >
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {failure.message}
        {failure.retryAfter !== undefined ? (
          <span className="mt-1 block text-ink-700/55">
            Reintentá en {failure.retryAfter}{" "}
            {failure.retryAfter === 1 ? "segundo" : "segundos"}.
          </span>
        ) : null}
      </span>
    </p>
  );
}

/** The stored thread as bubbles. System turns are plumbing, not conversation. */
function toChatMessages(conversation: Conversation | null): ChatMessage[] {
  if (conversation === null) return [];

  return conversation.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      id: message.id,
      role: message.role as "user" | "assistant",
      content: message.content,
      skipped: readStringArray(message.metadata.skipped),
      applied: typeof message.metadata.applied === "number"
        ? message.metadata.applied
        : undefined,
      createdFloors: readCreatedFloors(message.metadata.created_floors),
    }));
}

/**
 * The storeys a past turn created, as the thread stored them.
 *
 * The metadata keeps only id, name and level — enough for the link — so the
 * counts come back as zero rather than as a number that has since gone stale.
 */
function readCreatedFloors(value: unknown): CreatedFloor[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const floors = value.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];

    const { id, name, level } = item as Record<string, unknown>;
    if (typeof id !== "string" || typeof name !== "string") return [];

    return [
      {
        id,
        name,
        level: typeof level === "number" ? level : 0,
        summary: { walls: 0, openings: 0, rooms: 0, area_m2: 0 },
      } satisfies CreatedFloor,
    ];
  });

  return floors.length > 0 ? floors : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * The backend's Spanish message, plus the wait when it answered 429.
 *
 * `details.retry_after` is the same number the `Retry-After` header carries;
 * reading it from the body keeps this free of header plumbing.
 */
function toFailure(cause: unknown): Failure {
  if (!isApiError(cause)) {
    return { message: "No pudimos hablar con el asistente. Probá de nuevo." };
  }

  const retryAfter =
    cause.status === 429 ? readRetryAfter(cause.details) : undefined;

  return { message: cause.message, retryAfter };
}

function readRetryAfter(details: unknown): number | undefined {
  if (typeof details !== "object" || details === null) return undefined;

  const value = (details as Record<string, unknown>).retry_after;
  return typeof value === "number" && value > 0 ? value : undefined;
}
