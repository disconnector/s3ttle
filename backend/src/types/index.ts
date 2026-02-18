/**
 * types/index.ts — TypeScript type definitions for the entire backend.
 *
 * WHAT ARE TYPES AND INTERFACES?
 * In TypeScript, types and interfaces describe the "shape" of data. They don't
 * exist at runtime — they're erased when the code is compiled to JavaScript.
 * Their purpose is to catch bugs at compile time. For example, if a function
 * expects a Message but you pass it a string, TypeScript will flag the error
 * before you even run the code.
 *
 * Think of them as contracts: "this function promises to return an object
 * that looks like THIS, and expects to receive an object that looks like THAT."
 *
 * WHY DEFINE THEM IN ONE FILE?
 * Having all types in one place makes them easy to find and prevents duplication.
 * Any file in the backend can import what it needs: import { Message } from '../types'
 */

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Who can author a message.
 * - partner_a / partner_b: The two humans in the conversation
 * - ai: Claude's responses
 * - system_summary: Reserved for future use — when conversations get long,
 *   we'll generate a summary of earlier messages to save tokens.
 *   See the "rolling summary" discussion in CLAUDE.md.
 */
export type MessageAuthor = 'partner_a' | 'partner_b' | 'ai' | 'system_summary';

/**
 * A single message in a conversation.
 * This mirrors what will eventually be a row in the Supabase 'messages' table.
 */
export interface Message {
  id: string;           // UUID — unique identifier for this message
  sessionId: string;    // Which session/decision this message belongs to
  author: MessageAuthor;
  content: string;      // The message text. Currently plaintext; will be encrypted in M2+
  createdAt: Date;      // When the message was created
}

/**
 * A decision session — a conversation between two partners about one topic.
 * This mirrors what will eventually be a row in the Supabase 'decisions' table.
 */
export interface Session {
  id: string;           // The 6-character session code (e.g. "a1b2c3")
  topic: string;        // What the decision is about (e.g. "Should we move to Austin?")
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// API REQUEST/RESPONSE TYPES
// ─────────────────────────────────────────────────────────────────────────────

/** What the POST /message endpoint expects in the request body */
export interface SendMessageRequest {
  sessionId: string;
  author: 'partner_a' | 'partner_b';
  content: string;
  topic?: string;       // Only needed on the first message to set the decision topic
}

/** The structured data we extract from Claude's API response */
export interface AIResponse {
  content: string;      // Claude's response text
  inputTokens: number;  // How many tokens the prompt consumed
  outputTokens: number; // How many tokens Claude's response used
}

// ─────────────────────────────────────────────────────────────────────────────
// USAGE TRACKING TYPES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A record of token usage from a single Claude API call.
 * Stored per-call so we can see exactly how costs grow over a conversation.
 */
export interface UsageRecord {
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  model: string;        // Which Claude model was used (e.g. "claude-sonnet-4-5-20250929")
  createdAt: Date;
}

/**
 * Aggregated usage stats for a session.
 * This is what the GET /usage/:sessionId endpoint returns.
 * Later, we'll aggregate at the household level for billing/budget enforcement.
 */
export interface UsageSummary {
  sessionId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;      // input + output combined
  apiCalls: number;          // How many times we called Claude
  estimatedCostUsd: number;  // Estimated cost based on per-token pricing
}
