import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { today } from "@/lib/dates";
import { STUDENT_ID } from "@/lib/auth";

export const MODEL = "claude-opus-5-5";
// On a safety decline, the API retries on Anthropic's recommended fallback model.
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[],
  fallbacks: "default" as const,
};

const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT) || 40;

let client: Anthropic | null = null;
export function claude() {
  if (!process.env.ANTHROPIC_API_KEY) throw new AiUnavailableError("ANTHROPIC_API_KEY is not set.");
  client ??= new Anthropic();
  return client;
}

export class AiUnavailableError extends Error {}
export class AiLimitError extends Error {
  constructor() {
    super(`You've used today's ${DAILY_LIMIT} AI requests. They reset at midnight.`);
  }
}

// Reserves one Claude call for today; throws once the daily limit is reached.
export async function spendAiCall() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_ai_call", { p_user: STUDENT_ID, p_day: today(), p_limit: DAILY_LIMIT });
  if (error) throw error;
  if (!data) throw new AiLimitError();
}
