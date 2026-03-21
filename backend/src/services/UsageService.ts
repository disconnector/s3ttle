/**
 * UsageService.ts — Tracks Claude API token usage, persisted to SQLite.
 *
 * All function signatures are identical to the previous in-memory version.
 * Usage records now survive server restarts.
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../db/database';
import { UsageRecord, UsageSummary } from '../types';

// ── Pricing Constants ─────────────────────────────────────────────────────────
const COST_PER_INPUT_TOKEN  = 3.0  / 1_000_000;  // $3.00 per 1M input tokens
const COST_PER_OUTPUT_TOKEN = 15.0 / 1_000_000;  // $15.00 per 1M output tokens

// ── Prepared statements ───────────────────────────────────────────────────────

const stmtInsert = db.prepare(
  'INSERT INTO usage_records (id, session_id, input_tokens, output_tokens, model, created_at) VALUES (?, ?, ?, ?, ?, ?)'
);
const stmtGetBySession = db.prepare<[string]>(
  'SELECT * FROM usage_records WHERE session_id = ? ORDER BY created_at ASC'
);
const stmtAggregate = db.prepare<[string]>(`
  SELECT
    COUNT(*)          AS api_calls,
    SUM(input_tokens) AS total_input,
    SUM(output_tokens)AS total_output
  FROM usage_records
  WHERE session_id = ?
`);

// ── Public Functions ──────────────────────────────────────────────────────────

/**
 * Record token usage from a single Claude API call.
 * Called by AIService after every successful API response.
 */
export function recordUsage(
  sessionId: string,
  inputTokens: number,
  outputTokens: number,
  model: string
): void {
  stmtInsert.run(uuidv4(), sessionId, inputTokens, outputTokens, model, new Date().toISOString());
}

/**
 * Get aggregated usage stats for a session.
 */
export function getSessionUsage(sessionId: string): UsageSummary {
  const row = stmtAggregate.get(sessionId) as {
    api_calls: number;
    total_input: number | null;
    total_output: number | null;
  };

  const totalInputTokens  = row.total_input  ?? 0;
  const totalOutputTokens = row.total_output ?? 0;

  return {
    sessionId,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    apiCalls: row.api_calls ?? 0,
    estimatedCostUsd: parseFloat(
      (totalInputTokens * COST_PER_INPUT_TOKEN + totalOutputTokens * COST_PER_OUTPUT_TOKEN).toFixed(6)
    ),
  };
}

/**
 * Get per-call usage records for a session (for detailed breakdowns).
 */
export function getSessionUsageRecords(sessionId: string): UsageRecord[] {
  const rows = stmtGetBySession.all(sessionId) as Array<{
    id: string;
    session_id: string;
    input_tokens: number;
    output_tokens: number;
    model: string;
    created_at: string;
  }>;

  return rows.map((r) => ({
    sessionId: r.session_id,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    model: r.model,
    createdAt: new Date(r.created_at),
  }));
}
