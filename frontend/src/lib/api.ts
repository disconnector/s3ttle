/**
 * api.ts — The frontend's HTTP client for talking to the backend.
 *
 * This file contains all the functions that make API calls to our Express backend.
 * Every network request in the app goes through here, which means:
 * - If the API URL changes, you update it in one place (API_BASE)
 * - If we add auth tokens later, they go in one place
 * - The rest of the app just calls these functions without knowing about HTTP details
 *
 * HOW THE PROXY WORKS (important for understanding the URL):
 * In development, the frontend runs on localhost:5173 (Vite dev server) and the
 * backend runs on localhost:3000 (Express). Browsers normally block requests between
 * different ports (this is called CORS — Cross-Origin Resource Sharing).
 *
 * Instead of dealing with CORS headers, we set up a "proxy" in vite.config.ts:
 * any request to /api/* on the frontend gets forwarded to localhost:3000/*.
 * So when we call fetch('/api/message'), Vite intercepts it and sends it to
 * localhost:3000/message. The browser thinks it's the same server.
 *
 * In production, both frontend and backend would be on the same domain,
 * or we'd use proper CORS headers (which we've already set up with the cors package).
 */

// All API calls go through this base path.
// Vite's proxy (in vite.config.ts) rewrites /api/* → localhost:3000/*
const API_BASE = '/api';

// ─────────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// These describe the shape of data we send to and receive from the backend.
// TypeScript uses these at compile time to catch bugs — for example, if you
// try to access response.message instead of response.aiMessage, the compiler
// will flag an error before you even run the code.
// ─────────────────────────────────────────────────────────────────────────────

/** What the backend returns when you POST /message */
export interface MessageResponse {
  aiMessage: string;          // The AI facilitator's response text
  usage: {
    inputTokens: number;      // Tokens used by the prompt (your messages + history)
    outputTokens: number;     // Tokens used by the AI's response
  };
}

/**
 * A single message in the conversation.
 * Used both for messages we display in the UI and messages from the backend.
 */
export interface ChatMessage {
  id: string;                                        // Unique ID (UUID from backend, or temp local ID)
  author: 'partner_a' | 'partner_b' | 'ai';         // Who sent this message
  content: string;                                    // The actual message text
  createdAt: string;                                  // ISO timestamp string
}

/** What the backend returns when you GET /messages/:sessionId */
export interface SessionResponse {
  session: {
    id: string;
    topic: string;
    createdAt: string;
  };
  messages: ChatMessage[];    // Full conversation history in chronological order
}

// ─────────────────────────────────────────────────────────────────────────────
// API FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a message from a partner and get the AI's response.
 *
 * This is the core API call. The flow is:
 * 1. Frontend sends the partner's message to the backend
 * 2. Backend saves it to the session store
 * 3. Backend loads the full conversation history
 * 4. Backend sends everything to Claude with the facilitator system prompt
 * 5. Claude responds
 * 6. Backend saves Claude's response and returns it here
 *
 * @param sessionId - The 6-character session code (e.g. "a1b2c3")
 * @param author    - Which partner is sending ('partner_a' or 'partner_b')
 * @param content   - The message text
 * @param topic     - (Optional) The decision topic — only needed on the first message
 * @returns The AI's response text and token usage stats
 * @throws Error if the request fails (network error, server error, etc.)
 */
export async function sendMessage(
  sessionId: string,
  author: 'partner_a' | 'partner_b',
  content: string,
  topic?: string
): Promise<MessageResponse> {
  const res = await fetch(`${API_BASE}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, author, content, topic }),
  });

  if (!res.ok) {
    throw new Error('Failed to send message');
  }

  return res.json();
}

/**
 * Fetch the full conversation history for a session.
 *
 * Currently used for debugging. In Milestone 2, real-time sync will be handled
 * by Supabase Realtime subscriptions that push new messages to the frontend
 * automatically (no polling needed).
 *
 * @param sessionId - The 6-character session code
 * @returns Session metadata and all messages in chronological order
 * @throws Error if the session doesn't exist or request fails
 */
export async function getMessages(sessionId: string): Promise<SessionResponse> {
  const res = await fetch(`${API_BASE}/messages/${sessionId}`);

  if (!res.ok) {
    throw new Error('Failed to fetch messages');
  }

  return res.json();
}
