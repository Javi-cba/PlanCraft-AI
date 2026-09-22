import { z } from "zod";

import { layoutSchema, layoutSummarySchema } from "./layout";

/**
 * Contract of the AI assistant endpoints, mirroring `backend/app/schemas/ai.py`.
 *
 * The assistant does not save anything. It answers with the layout the edit
 * produces, and the editor applies that to its undo stack like a template or a
 * hand-drawn wall — so ⌘Z undoes an answer nobody liked, and saving stays on
 * the button it always was.
 *
 * That is also why the request carries the layout: between two messages the
 * person moves walls by hand, and the canvas is what they are talking about.
 */

export const PROMPT_MAX_LENGTH = 2_000;

export const promptSchema = z
  .string()
  .trim()
  .min(1, "Escribí qué querés que dibuje.")
  .max(
    PROMPT_MAX_LENGTH,
    `El pedido no puede tener más de ${PROMPT_MAX_LENGTH} caracteres.`,
  );

/** Body of `POST /ai/floors/{floor_id}/plan`. */
export const planAssistRequestSchema = z.object({
  message: promptSchema,
  layout: layoutSchema,
  /** Continues a thread. Omitted, the backend reuses the one of this floor. */
  conversation_id: z.uuid().optional(),
});

export type PlanAssistInput = z.input<typeof planAssistRequestSchema>;

/** What the turn cost, so the spend is visible instead of guessed at. */
export const aiUsageSchema = z.object({
  model: z.string(),
  input_tokens: z.int().min(0),
  output_tokens: z.int().min(0),
});

/**
 * A storey the turn added to the project.
 *
 * Unlike the layout, this one is already saved: a new floor cannot live on the
 * editor's undo stack, which holds the drawing of the floor that is open. The
 * panel turns it into a link.
 */
export const createdFloorSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  level: z.int(),
  summary: layoutSummarySchema,
});

export const planAssistResponseSchema = z.object({
  conversation_id: z.uuid(),
  message_id: z.uuid(),
  summary: z.string(),
  layout: layoutSchema,
  summary_of_layout: layoutSummarySchema,
  /** Operations the backend carried out on the floor that is open. */
  applied: z.int().min(0),
  created_floors: z.array(createdFloorSchema).default([]),
  /**
   * One Spanish sentence per operation that could not be applied. The panel
   * shows them: an assistant that quietly drops half a request is worse than
   * one that says what it missed.
   */
  skipped: z.array(z.string()).default([]),
  usage: aiUsageSchema,
});

export const MESSAGE_ROLES = ["user", "assistant", "system"] as const;

export const messageRoleSchema = z.enum(MESSAGE_ROLES);

export const aiMessageSchema = z.object({
  id: z.uuid(),
  role: messageRoleSchema,
  content: z.string(),
  created_at: z.iso.datetime({ offset: true }),
  /** Model, tokens and the ops of that turn. Free-form on the backend too. */
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const conversationSchema = z.object({
  id: z.uuid(),
  project_id: z.uuid(),
  floor_id: z.uuid().nullable(),
  title: z.string().nullable(),
  created_at: z.iso.datetime({ offset: true }),
  updated_at: z.iso.datetime({ offset: true }),
  messages: z.array(aiMessageSchema).default([]),
});

/** `GET /ai/status` — whether the panel should be offered at all. */
export const aiStatusSchema = z.object({
  configured: z.boolean(),
  model: z.string(),
  user_requests_per_minute: z.int().min(1),
});

export type CreatedFloor = z.infer<typeof createdFloorSchema>;
export type PlanAssistResponse = z.infer<typeof planAssistResponseSchema>;
export type AiUsage = z.infer<typeof aiUsageSchema>;
export type AiMessage = z.infer<typeof aiMessageSchema>;
export type MessageRole = z.infer<typeof messageRoleSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type AiStatus = z.infer<typeof aiStatusSchema>;
