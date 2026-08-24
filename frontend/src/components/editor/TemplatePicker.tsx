"use client";

import { LayoutThumbnail } from "@/components/editor/LayoutThumbnail";
import { formatArea } from "@/lib/geometry/layout";
import { PLAN_TEMPLATES, templateArea } from "@/lib/plans/templates";
import { cn } from "@/lib/utils/cn";

/**
 * The pre-built floors. Each card previews the real layout — the thumbnail is
 * generated from the same walls the template applies, so what you pick is what
 * you get.
 */
export function TemplatePicker({
  value,
  onChange,
  disabled = false,
  columns = "sm:grid-cols-2",
}: {
  value: string;
  onChange: (templateId: string) => void;
  disabled?: boolean;
  /** Tailwind column classes, so the picker fits both a form and a panel. */
  columns?: string;
}) {
  return (
    <ul className={cn("grid gap-2", columns)}>
      {PLAN_TEMPLATES.map((template) => {
        const selected = template.id === value;
        const area = templateArea(template);

        return (
          <li key={template.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(template.id)}
              aria-pressed={selected}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-60",
                selected
                  ? "border-blueprint-600/60 bg-blueprint-400/10 shadow-sm"
                  : "border-paper-300/70 bg-paper-50 hover:border-blueprint-600/35 hover:bg-paper-100",
              )}
            >
              <LayoutThumbnail
                layout={template.layout}
                className={cn(
                  "size-14 shrink-0 rounded-xl bg-paper-100 p-1",
                  selected ? "text-blueprint-600" : "text-ink-700/60",
                )}
              />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink-900">
                  {template.name}
                </span>
                <span className="mt-0.5 block line-clamp-2 text-xs leading-relaxed text-ink-700/65">
                  {template.description}
                </span>
                {area > 0 ? (
                  <span className="mt-1 block text-[0.7rem] tracking-[0.08em] text-timber-600 uppercase">
                    {formatArea(area)} · {template.layout.rooms.length} ambientes
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
