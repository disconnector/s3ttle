/**
 * AIService.ts — The bridge between S3ttle and Claude.
 *
 * WHAT THIS FILE DOES:
 * Handles all communication with the Anthropic Claude API. When a partner
 * sends a message, this service:
 * 1. Fetches the full conversation history from MessageService
 * 2. Formats it into the structure Claude's API expects
 * 3. Sends it to Claude with the Facilitator system prompt
 * 4. Saves Claude's response back through MessageService
 * 5. Records token usage for cost tracking
 *
 * HOW CLAUDE'S API WORKS:
 * Claude is stateless — it doesn't remember previous conversations. Every API
 * call must include the ENTIRE conversation history. The API expects:
 * - A "system" prompt (instructions for how Claude should behave)
 * - An array of "messages" alternating between "user" and "assistant" roles
 *
 * We map our partner messages to "user" role and AI messages to "assistant" role.
 * Partner identity (A vs B) is embedded in the message text itself:
 *   { role: "user", content: "Partner A: Should we move to Austin?" }
 *
 * CONCURRENT MESSAGE LOCKING:
 * If both partners send a message at the exact same time, we could end up with
 * two simultaneous Claude API calls for the same session — each with a different
 * view of the conversation. This would cause inconsistencies.
 *
 * To prevent this, we use a simple per-session lock (a Promise stored in a Map).
 * When a request comes in for a session that's already being processed, it waits
 * for the first request to finish before starting. This guarantees Claude always
 * sees a consistent, complete conversation history.
 *
 * LAZY CLIENT INITIALIZATION:
 * The Anthropic client reads ANTHROPIC_API_KEY from process.env when created.
 * But this module loads (via import) BEFORE dotenv runs in index.ts. If we
 * created the client at the top level, it would see an empty API key.
 * Instead, we create it lazily on first use (getClient function), by which
 * time dotenv has already populated the environment variable.
 */

import Anthropic from '@anthropic-ai/sdk';
import { Message, AIResponse } from '../types';
import * as MessageService from './MessageService';
import * as UsageService from './UsageService';
import { FACILITATOR_SYSTEM_PROMPT } from '../prompts/facilitator';

// Which Claude model to use. Change this to switch models.
// Model IDs can be found at: https://docs.anthropic.com/en/docs/about-claude/models
const AI_MODEL = 'claude-sonnet-4-5-20250929';

// ── Lazy Client Initialization ───────────────────────────────────────────────

let anthropic: Anthropic;

/** Get (or create) the Anthropic API client. Created on first use. */
function getClient(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic();  // Reads ANTHROPIC_API_KEY from process.env
  }
  return anthropic;
}

// ── Per-Session Locking ──────────────────────────────────────────────────────
// Stores a Promise for each session that currently has an in-flight API call.
// New requests for the same session will await this Promise before proceeding.

const sessionLocks = new Map<string, Promise<void>>();

// ── Message Formatting ───────────────────────────────────────────────────────

/**
 * Convert our Message[] array into the format Claude's API expects.
 *
 * Claude's API uses a simple role-based format:
 * - { role: "user", content: "..." }       ← human messages
 * - { role: "assistant", content: "..." }   ← Claude's previous responses
 *
 * Since we have TWO humans (Partner A and B), we can't use roles to distinguish
 * them (they're both "user"). Instead, we prefix partner messages with their label:
 *   "Partner A: I think we should do it"
 *   "Partner B: I'm not so sure"
 *
 * The system prompt tells Claude to expect this format.
 */
function formatMessagesForClaude(messages: Message[]): Anthropic.MessageParam[] {
  return messages.map((msg) => {
    if (msg.author === 'ai') {
      return { role: 'assistant' as const, content: msg.content };
    }

    // Label partner messages so Claude knows who's speaking
    const label = msg.author === 'partner_a' ? 'Partner A' : 'Partner B';
    return { role: 'user' as const, content: `${label}: ${msg.content}` };
  });
}

// ── Main API Function ────────────────────────────────────────────────────────

/**
 * Get an AI response for the current state of a conversation.
 *
 * This is the main function that routes call. It:
 * 1. Acquires a per-session lock (prevents concurrent API calls)
 * 2. Loads conversation history from MessageService
 * 3. Formats it for Claude's API
 * 4. Calls the Claude API with the Facilitator system prompt
 * 5. Records token usage
 * 6. Saves Claude's response through MessageService
 * 7. Returns the response and usage data
 *
 * The try/finally block ensures the lock is ALWAYS released, even if the API
 * call fails. Without this, a failed call would permanently block the session.
 *
 * @param sessionId - The session to generate a response for
 * @returns Claude's response text and token usage stats
 */
export async function getAIResponse(sessionId: string): Promise<AIResponse> {
  // ── Step 1: Acquire Lock ─────────────────────────────────────────────────
  // If there's already an in-flight request for this session, wait for it
  const existingLock = sessionLocks.get(sessionId);
  if (existingLock) {
    await existingLock;
  }

  // Create a new lock for this request.
  // The `resolve` function will be called in the `finally` block to release it.
  let resolve: () => void;
  const lock = new Promise<void>((r) => { resolve = r; });
  sessionLocks.set(sessionId, lock);

  try {
    // ── Step 2: Load Conversation History ──────────────────────────────────
    const history = MessageService.getConversationHistory(sessionId);
    const claudeMessages = formatMessagesForClaude(history);

    // ── Step 3: Call Claude API ────────────────────────────────────────────
    const response = await getClient().messages.create({
      model: AI_MODEL,
      max_tokens: 1024,                    // Max length of Claude's response
      system: FACILITATOR_SYSTEM_PROMPT,   // Instructions for how to behave
      messages: claudeMessages,            // The full conversation so far
    });

    // ── Step 4: Extract Response Text ──────────────────────────────────────
    // Claude can return multiple content blocks (text, images, etc.)
    // We find the first text block and use its content.
    const textBlock = response.content.find((block) => block.type === 'text');
    const aiContent = textBlock ? textBlock.text : '';

    // ── Step 5: Record Token Usage ─────────────────────────────────────────
    UsageService.recordUsage(
      sessionId,
      response.usage.input_tokens,
      response.usage.output_tokens,
      AI_MODEL
    );

    // Log usage to the console (never log actual message content for privacy!)
    console.log(
      `[AI] session=${sessionId} input_tokens=${response.usage.input_tokens} output_tokens=${response.usage.output_tokens}`
    );

    // ── Step 6: Save AI Response ───────────────────────────────────────────
    // Goes through MessageService (future: encrypted before storage)
    MessageService.saveMessage(sessionId, 'ai', aiContent);

    // ── Step 7: Return ─────────────────────────────────────────────────────
    return {
      content: aiContent,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };
  } finally {
    // ALWAYS release the lock, even if the API call threw an error.
    // The ! after resolve tells TypeScript "trust me, this is defined"
    // (it was assigned in the Promise constructor above).
    resolve!();
    sessionLocks.delete(sessionId);
  }
}
