/**
 * routes/messages.ts — All HTTP API endpoints for S3ttle.
 *
 * WHAT ARE ROUTES?
 * Routes map HTTP requests to handler functions. When the frontend calls
 * POST /message, Express finds the matching route here and runs its handler.
 *
 * Each route has:
 * - An HTTP method (GET, POST, PUT, DELETE)
 * - A URL path (/message, /messages/:sessionId, etc.)
 * - A handler function (the async (req, res) => { ... } part)
 *
 * WHAT ARE req AND res?
 * - req (request)  — contains everything about the incoming request:
 *   body, URL parameters, headers, etc.
 * - res (response) — used to send data back to the client:
 *   res.json() sends JSON, res.status() sets the HTTP status code
 *
 * WHAT IS :sessionId IN THE URL?
 * The colon makes it a "URL parameter" — a variable part of the URL.
 * /messages/abc123 would match the /messages/:sessionId route, and
 * req.params.sessionId would be "abc123". It's like a function argument
 * but passed through the URL.
 *
 * ERROR HANDLING:
 * Each route wraps its logic in try/catch. If anything goes wrong
 * (database error, API error, etc.), we catch it and return a 500 status
 * with a generic error message. We NEVER expose internal error details
 * to the client (that would be a security risk). The actual error is
 * logged to the server console for debugging.
 */

import { Router, Request, Response } from 'express';
import { SendMessageRequest } from '../types';
import * as MessageService from '../services/MessageService';
import * as AIService from '../services/AIService';
import * as UsageService from '../services/UsageService';

// Create a Router instance. Routes are defined on this, then the router
// is mounted on the Express app in index.ts with app.use(messageRoutes).
const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /message — The core endpoint. Send a message, get an AI response.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /message
 *
 * Request body: { sessionId, author, content, topic? }
 *
 * Flow:
 * 1. Validate the request body (all required fields present, valid author)
 * 2. Save the partner's message through MessageService
 * 3. Call AIService to get Claude's response
 * 4. Return the AI's response and token usage to the frontend
 *
 * The frontend calls this every time a partner sends a message.
 * The AI response is synchronous — the frontend waits for it.
 */
router.post('/message', async (req: Request, res: Response) => {
  // `as SendMessageRequest` tells TypeScript to treat req.body as our expected type.
  // This doesn't validate at runtime — that's what the if-checks below do.
  const { sessionId, author, content, topic } = req.body as SendMessageRequest;

  // ── Input Validation ───────────────────────────────────────────────────
  // Always validate user input! Never trust data from the client.
  if (!sessionId || !author || !content) {
    res.status(400).json({ error: 'sessionId, author, and content are required' });
    return;   // Important: return after sending a response to stop execution
  }

  if (author !== 'partner_a' && author !== 'partner_b') {
    res.status(400).json({ error: 'author must be partner_a or partner_b' });
    return;
  }

  try {
    // Save the human's message (creates the session if it's the first message)
    MessageService.saveMessage(sessionId, author, content, topic);

    // Log the action WITHOUT the message content (privacy!)
    console.log(`[MSG] session=${sessionId} author=${author}`);

    // Get Claude's response. This is the slow part — typically 2-5 seconds.
    // AIService handles per-session locking internally.
    const aiResponse = await AIService.getAIResponse(sessionId);

    // Send the AI's response back to the frontend
    res.json({
      aiMessage: aiResponse.content,
      usage: {
        inputTokens: aiResponse.inputTokens,
        outputTokens: aiResponse.outputTokens,
      },
    });
  } catch (err) {
    // Log the real error for debugging (server-side only)
    console.error(`[ERR] session=${sessionId} error=${(err as Error).message}`);
    // Send a generic error to the client (don't expose internals)
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /messages/:sessionId — Fetch full conversation history
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /messages/:sessionId
 *
 * Returns the session metadata and all messages in chronological order.
 * Currently used for debugging/testing. In M2, the frontend will use
 * Supabase Realtime for live updates instead of polling this endpoint.
 *
 * The <{ sessionId: string }> generic on Request tells TypeScript that
 * req.params has a sessionId field of type string (instead of string | string[]).
 */
router.get('/messages/:sessionId', (req: Request<{ sessionId: string }>, res: Response) => {
  const { sessionId } = req.params;
  const session = MessageService.getSession(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const messages = MessageService.getConversationHistory(sessionId);

  res.json({
    session: {
      id: session.id,
      topic: session.topic,
      createdAt: session.createdAt,
    },
    // Map messages to only include fields the client needs
    // (don't leak internal fields like sessionId in every message)
    messages: messages.map((m) => ({
      id: m.id,
      author: m.author,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /usage/:sessionId — Token usage and cost tracking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /usage/:sessionId
 *
 * Returns aggregated usage stats (total tokens, API calls, estimated cost)
 * plus per-call breakdowns. Later used for:
 * - Household budget enforcement (soft monthly cap)
 * - Admin cost dashboard
 * - Identifying conversations that need summarization
 */
router.get('/usage/:sessionId', (req: Request<{ sessionId: string }>, res: Response) => {
  const { sessionId } = req.params;
  const session = MessageService.getSession(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const summary = UsageService.getSessionUsage(sessionId);
  const records = UsageService.getSessionUsageRecords(sessionId);

  res.json({
    summary,
    records: records.map((r) => ({
      inputTokens: r.inputTokens,
      outputTokens: r.outputTokens,
      model: r.model,
      createdAt: r.createdAt,
    })),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /health — Health check for deployment monitoring
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /health
 *
 * A simple endpoint that returns { status: "ok" }. Used by:
 * - Railway's health checks (ensures the server is running)
 * - Uptime monitoring services
 * - Quick manual checks during development
 *
 * The _ prefix on _req means "I'm not using this parameter." TypeScript
 * would normally warn about unused parameters; the underscore suppresses it.
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
