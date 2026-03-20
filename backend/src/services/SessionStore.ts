/**
 * SessionStore.ts — In-memory storage for sessions and messages.
 *
 * WHAT THIS FILE DOES:
 * Stores all sessions and messages in JavaScript Maps (think: dictionaries).
 * This is temporary storage — everything is lost when the server restarts.
 * That's fine for Milestone 1 where we're just proving the concept works.
 *
 * WHAT IS A MAP?
 * A Map is a built-in JavaScript data structure that stores key-value pairs.
 * Like a dictionary: you look up a "key" (the session ID) and get a "value"
 * (the session data or array of messages). Maps are fast — lookups are O(1),
 * meaning they take the same time whether you have 10 or 10 million entries.
 *
 * WHY THIS FILE EXISTS (ARCHITECTURE DECISION):
 * This module is the ONLY place that directly touches the storage layer.
 * Nothing else in the app should import SessionStore — they go through
 * MessageService instead. This separation means:
 *
 *   Milestone 1: SessionStore uses in-memory Maps (this file)
 *   Milestone 2: SessionStore gets replaced with Supabase queries
 *   ...and MessageService, AIService, routes — NONE of them change.
 *
 * This pattern is called "separation of concerns" or "the repository pattern."
 */

import { Message, Session, ParticipantInfo } from '../types';

// ── Storage ──────────────────────────────────────────────────────────────────
// Two Maps: one for session metadata, one for messages.
// Both are keyed by sessionId (the 6-character code like "a1b2c3").

const sessions = new Map<string, Session>();
const messages = new Map<string, Message[]>();   // Each session has an ARRAY of messages

// ── Public Functions ─────────────────────────────────────────────────────────

/** Look up a session by its ID. Returns undefined if it doesn't exist. */
export function getSession(sessionId: string): Session | undefined {
  return sessions.get(sessionId);
}

/**
 * Create a new session with the given ID and topic.
 * Also initializes an empty message array and participant map for this session.
 * Returns the created Session object.
 */
export function createSession(sessionId: string, topic: string): Session {
  const session: Session = {
    id: sessionId,
    topic,
    participants: new Map(),
    createdAt: new Date(),
  };
  sessions.set(sessionId, session);
  messages.set(sessionId, []);  // Start with an empty conversation
  return session;
}

/**
 * Register or update a participant's display info in a session.
 * Called when a partner sends their first message — records their name/avatar
 * so the other partner's frontend can display it, and so Claude can use
 * their real name in responses.
 *
 * @param sessionId - The session to update
 * @param role      - 'partner_a' or 'partner_b'
 * @param info      - Display name, avatar, and device ID
 */
export function setParticipant(
  sessionId: string,
  role: 'partner_a' | 'partner_b',
  info: ParticipantInfo
): void {
  const session = sessions.get(sessionId);
  if (session) {
    session.participants.set(role, info);
  }
}

/**
 * Add a message to a session's conversation.
 * Throws an error if the session doesn't exist (you must create it first).
 */
export function addMessage(sessionId: string, message: Message): void {
  const sessionMessages = messages.get(sessionId);
  if (!sessionMessages) {
    throw new Error(`Session ${sessionId} not found`);
  }
  sessionMessages.push(message);  // Append to the end (chronological order)
}

/**
 * Get all messages for a session, in chronological order.
 * Returns an empty array if the session doesn't exist (rather than throwing).
 * The ?? operator means "if the left side is null/undefined, use the right side."
 */
export function getMessages(sessionId: string): Message[] {
  return messages.get(sessionId) ?? [];
}

/**
 * Get all active sessions (for debug/development).
 * Returns session metadata with participant and message counts.
 */
export function getAllSessions(): Array<{
  id: string;
  topic: string;
  participantCount: number;
  messageCount: number;
  createdAt: Date;
}> {
  const result: Array<{
    id: string;
    topic: string;
    participantCount: number;
    messageCount: number;
    createdAt: Date;
  }> = [];
  for (const [id, session] of sessions) {
    result.push({
      id,
      topic: session.topic,
      participantCount: session.participants.size,
      messageCount: (messages.get(id) ?? []).length,
      createdAt: session.createdAt,
    });
  }
  return result;
}
