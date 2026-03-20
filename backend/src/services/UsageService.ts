/**
 * UsageService.ts — Tracks how many tokens each conversation uses.
 *
 * WHAT ARE TOKENS?
 * Tokens are the units Claude uses to measure text. Roughly:
 * - 1 token ≈ 4 characters of English text
 * - 1 token ≈ 0.75 words
 * - A typical message might be 20-100 tokens
 *
 * You pay for both INPUT tokens (the prompt you send, including conversation
 * history) and OUTPUT tokens (Claude's response). Input tokens are cheaper
 * than output tokens.
 *
 * WHY TRACK USAGE?
 * 1. Cost monitoring — see how much each conversation costs in real-time
 * 2. Budget enforcement — later, we'll cap monthly usage per household
 *    so one couple's marathon debate doesn't blow up the API bill
 * 3. Optimization — helps identify when conversations get too long and
 *    need the rolling summarization feature
 *
 * COST ESTIMATION:
 * The COST_PER_*_TOKEN constants are approximate prices from Anthropic's
 * pricing page. They may change — update them when they do. The estimated
 * cost is useful for dashboards but shouldn't be used for actual billing
 * (use Anthropic's usage API for that).
 *
 * STORAGE:
 * Like everything else in M1, this is in-memory and resets on server restart.
 * In M2, usage records will be stored in a Supabase table.
 */

import { UsageRecord, UsageSummary } from '../types';

// ── In-Memory Storage ────────────────────────────────────────────────────────
// Keyed by sessionId. Each session has an array of usage records (one per API call).
const usageStore = new Map<string, UsageRecord[]>();

// ── Pricing Constants ────────────────────────────────────────────────────────
// Claude Sonnet pricing as of February 2026.
// Source: https://www.anthropic.com/pricing
// These are PER TOKEN prices (divide Anthropic's "per million" price by 1,000,000).
const COST_PER_INPUT_TOKEN = 3.0 / 1_000_000;   // $3.00 per 1M input tokens
const COST_PER_OUTPUT_TOKEN = 15.0 / 1_000_000;  // $15.00 per 1M output tokens

/**
 * Record token usage from a single Claude API call.
 * Called by AIService after every successful API call.
 *
 * @param sessionId    - Which session this call was for
 * @param inputTokens  - Number of input tokens used (prompt + history)
 * @param outputTokens - Number of output tokens used (Claude's response)
 * @param model        - Which model was used (for tracking if we switch models)
 */
export function recordUsage(
  sessionId: string,
  inputTokens: number,
  outputTokens: number,
  model: string
): void {
  // Initialize the array for this session if it doesn't exist yet.
  // The Map.has() check prevents overwriting existing records.
  if (!usageStore.has(sessionId)) {
    usageStore.set(sessionId, []);
  }

  // The ! after .get() tells TypeScript "this won't be undefined"
  // (we just ensured it exists with the has() check above).
  usageStore.get(sessionId)!.push({
    sessionId,
    inputTokens,
    outputTokens,
    model,
    createdAt: new Date(),
  });
}

/**
 * Get aggregated usage stats for a session.
 *
 * Sums up all individual API calls into a single summary with:
 * - Total tokens (input + output)
 * - Number of API calls
 * - Estimated cost in USD
 *
 * The .reduce() method iterates through the records array and accumulates
 * a running total. It starts at 0 (the second argument) and adds each
 * record's token count to the sum.
 *
 * @param sessionId - The session to summarize
 * @returns Aggregated usage summary
 */
export function getSessionUsage(sessionId: string): UsageSummary {
  const records = usageStore.get(sessionId) ?? [];   // Default to empty array if no records

  // Sum up all input tokens across all API calls
  const totalInputTokens = records.reduce((sum, r) => sum + r.inputTokens, 0);

  // Sum up all output tokens across all API calls
  const totalOutputTokens = records.reduce((sum, r) => sum + r.outputTokens, 0);

  return {
    sessionId,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    apiCalls: records.length,
    // Calculate estimated cost and round to 6 decimal places
    estimatedCostUsd: parseFloat(
      (totalInputTokens * COST_PER_INPUT_TOKEN + totalOutputTokens * COST_PER_OUTPUT_TOKEN).toFixed(6)
    ),
  };
}

/**
 * Get the raw, per-call usage records for a session.
 * Useful for detailed cost breakdowns (showing how tokens grow per message).
 *
 * @param sessionId - The session to get records for
 * @returns Array of individual usage records, in chronological order
 */
export function getSessionUsageRecords(sessionId: string): UsageRecord[] {
  return usageStore.get(sessionId) ?? [];
}
