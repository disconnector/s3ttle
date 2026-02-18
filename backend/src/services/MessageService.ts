/**
 * MessageService.ts — The ONLY gateway for reading and writing message content.
 *
 * WHAT THIS FILE DOES:
 * Every part of the app that needs to save or read messages goes through this
 * service. Routes don't touch SessionStore directly. AIService doesn't touch
 * SessionStore directly. Everything flows through here.
 *
 * WHY THIS MATTERS (THE ENCRYPTION STORY):
 * When we add end-to-end encryption in a later milestone, the changes happen
 * ONLY in this file:
 *
 *   saveMessage()             → encrypts content before storing
 *   getConversationHistory()  → decrypts content after fetching
 *
 * Because every other file goes through MessageService, none of them need to
 * know about encryption at all. This is the "single responsibility principle"
 * in action — this file is responsible for message I/O, and nothing else.
 *
 * FUTURE: ROLLING SUMMARIZATION
 * When conversations get long (10+ rounds), we'll generate an AI summary of
 * the earlier messages to reduce token usage. The summary gets stored as a
 * special message with author='system_summary'. getConversationHistory() will
 * then return: [summary] + [messages after the summary] instead of everything.
 * Again — this change only happens in THIS file.
 */

import { v4 as uuidv4 } from 'uuid';
import { Message, MessageAuthor } from '../types';
import * as SessionStore from './SessionStore';

/**
 * Save a message to a session.
 *
 * If the session doesn't exist yet, it creates one automatically.
 * This means the first message to a new sessionId creates the session.
 *
 * @param sessionId - The session to save to
 * @param author    - Who's sending (partner_a, partner_b, ai, or system_summary)
 * @param content   - The message text (future: will be encrypted here)
 * @param topic     - Optional topic for the decision (used when creating a new session)
 * @returns The saved Message object with its generated UUID
 */
export function saveMessage(
  sessionId: string,
  author: MessageAuthor,
  content: string,
  topic?: string
): Message {
  // Auto-create the session if it doesn't exist yet.
  // This happens on the first message from Partner A.
  if (!SessionStore.getSession(sessionId)) {
    SessionStore.createSession(sessionId, topic ?? 'Untitled Decision');
  }

  const message: Message = {
    id: uuidv4(),           // Generate a unique ID (UUID v4 = random 128-bit identifier)
    sessionId,
    author,
    content,                // Future: encrypt(content, sessionKey) here
    createdAt: new Date(),
  };

  SessionStore.addMessage(sessionId, message);
  return message;
}

/**
 * Get the conversation history for a session.
 *
 * Currently returns ALL messages. In the future, this will:
 * 1. Check for the latest system_summary message
 * 2. If one exists, return [summary] + [messages after it]
 * 3. If not, return all messages (current behavior)
 * 4. Decrypt message content before returning
 *
 * This is the function AIService calls to build the Claude prompt.
 *
 * @param sessionId - The session to fetch history for
 * @returns Array of messages in chronological order
 */
export function getConversationHistory(sessionId: string): Message[] {
  const allMessages = SessionStore.getMessages(sessionId);

  // Future: find the latest system_summary and return it + subsequent messages
  // Future: decrypt each message's content here

  return allMessages;
}

/**
 * Get session metadata (topic, creation date).
 * Used by routes to check if a session exists before returning data.
 */
export function getSession(sessionId: string) {
  return SessionStore.getSession(sessionId);
}
