/**
 * index.ts — The entry point of the S3ttle backend server.
 *
 * This file does four things:
 * 1. Loads environment variables from .env (API keys, port number)
 * 2. Creates an Express web server
 * 3. Configures middleware (CORS, JSON parsing)
 * 4. Mounts the API routes and starts listening for requests
 *
 * WHAT IS EXPRESS?
 * Express is a web framework for Node.js. It handles incoming HTTP requests
 * (like POST /message from the frontend) and routes them to the right handler
 * functions. Think of it as a traffic controller for your API.
 *
 * WHAT IS MIDDLEWARE?
 * Middleware are functions that run on every request BEFORE your route handlers.
 * They sit in the "middle" of the request pipeline. We use two:
 * - cors()        → Allows the frontend (different origin) to make API calls
 * - express.json() → Parses JSON request bodies so we can read req.body
 *
 * WHAT IS DOTENV?
 * The .env file contains secrets (like your Anthropic API key) that shouldn't
 * be in your code. dotenv reads that file and puts the values into
 * process.env so your code can access them as process.env.ANTHROPIC_API_KEY.
 * The `override: true` flag ensures .env values take precedence even if
 * the same variable is already set in the shell environment.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env', override: true });

import express from 'express';
import cors from 'cors';
import messageRoutes from './routes/messages';

// Create the Express application
const app = express();

// Port to listen on — Railway sets this automatically in production.
// Falls back to 3000 for local development.
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────

// CORS: Allow the frontend (running on a different port in dev) to call this API.
// Without this, the browser would block cross-origin requests.
app.use(cors());

// JSON body parser: Converts incoming JSON request bodies (like { sessionId: "abc" })
// into JavaScript objects that we can access via req.body in our route handlers.
app.use(express.json());

// ── Routes ───────────────────────────────────────────────────────────────────

// Mount all API routes. The routes are defined in routes/messages.ts.
// No prefix here — routes are mounted at the root (POST /message, GET /health, etc.)
app.use(messageRoutes);

// ── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[S3ttle] Server running on port ${PORT}`);
});
