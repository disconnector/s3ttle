# Milestone 1 — Build Plan

## Goal
Prove the core magic: a backend that accepts messages from two partners, maintains a shared conversation, and returns AI responses from Claude. In-memory storage only — no database, no auth, no billing. Just the core loop working end-to-end.

---

## Project Structure

```
s3ttle/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express app setup, server start
│   │   ├── routes/
│   │   │   └── messages.ts       # POST /message, GET /messages/:sessionId
│   │   ├── services/
│   │   │   ├── MessageService.ts # All message read/write goes through here (encryption drop-in point)
│   │   │   ├── AIService.ts      # Claude API calls — prompt assembly, response handling
│   │   │   └── SessionStore.ts   # In-memory session/message storage (replaced by Supabase in M2)
│   │   ├── prompts/
│   │   │   └── facilitator.ts    # System prompt for the Facilitator AI role
│   │   └── types/
│   │       └── index.ts          # TypeScript interfaces: Session, Message, etc.
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example              # ANTHROPIC_API_KEY placeholder
├── CLAUDE.md
└── plan.md
```

---

## What Gets Built (7 files of actual code)

### 1. Project scaffolding
- `package.json` with Express, Anthropic SDK, TypeScript, dotenv, tsx (for dev), uuid
- `tsconfig.json` targeting Node, strict mode
- `.env.example` with `ANTHROPIC_API_KEY` and `PORT`

### 2. `types/index.ts` — Data types
- `Message` interface: id, sessionId, author ('partner_a' | 'partner_b' | 'ai' | 'system_summary'), content, createdAt
- `Session` interface: id, topic, messages array, createdAt
- These mirror the CLAUDE.md data model but simplified for in-memory use

### 3. `SessionStore.ts` — In-memory storage
- A `Map<string, Session>` keyed by session ID
- `getSession(id)` — returns session or creates a new one
- `addMessage(sessionId, message)` — appends a message
- `getMessages(sessionId)` — returns all messages for a session
- This entire file gets swapped for Supabase in Milestone 2. Clean interface means nothing else changes.

### 4. `MessageService.ts` — The encryption-ready abstraction
- `saveMessage(sessionId, author, content)` — stores a message via SessionStore. Later: encrypts content before storing.
- `getConversationHistory(sessionId)` — fetches all messages. Later: decrypts content after fetching. Also the place where "load summary + recent messages instead of everything" logic lives.
- All routes and services go through this. No direct SessionStore access from anywhere else.

### 5. `prompts/facilitator.ts` — System prompt
- The Facilitator role prompt: neutral, Socratic, understands the two-partner dynamic
- Exported as a string constant
- Labels partners clearly so Claude understands it's mediating between two people

### 6. `AIService.ts` — Claude API integration
- `getAIResponse(sessionId)` — pulls conversation history from MessageService, assembles the full prompt (system + history), calls Claude API, saves the AI response via MessageService, returns it
- Uses Anthropic TypeScript SDK (`@anthropic-ai/sdk`)
- Logs token usage (input/output counts) but never logs message content
- Single place where "decrypt → call Claude → encrypt response" will live later

### 7. `routes/messages.ts` — Express routes
- **`POST /message`** — accepts `{ sessionId, author, content, topic? }`. Saves the human message, calls AIService, returns the AI response. If sessionId doesn't exist, creates a new session (topic is used on first message).
- **`GET /messages/:sessionId`** — returns full message history for a session. For testing/debugging. Later: the iOS app uses Supabase Realtime instead.
- **`GET /health`** — simple health check for Railway

### 8. `index.ts` — App entry point
- Express setup with JSON body parsing
- Route mounting
- Starts server on PORT from env
- No CORS restrictions for now (tightened in later milestones)

---

## Design Decisions Baked In

1. **MessageService as single gateway** — all content flows through one service. Encryption drops in here later without touching routes or AI logic.
2. **No message content in logs** — from day one. Session IDs and token counts only.
3. **SessionStore as swappable module** — clean interface that Supabase replaces in M2 without changing MessageService's API.
4. **Conversation history assembly in one place** — AIService builds the prompt. Summary-based truncation logic goes here later.
5. **Per-decision message queue** — AIService processes one message at a time per session using a simple lock, preventing the concurrent-message race condition from the CLAUDE.md.

---

## How to Test It

Once built, you can test with curl:

```bash
# Send a message from Partner A
curl -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-1", "author": "partner_a", "content": "Should we move to Austin?", "topic": "Moving to Austin"}'

# Send a message from Partner B
curl -X POST http://localhost:3000/message \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test-1", "author": "partner_b", "content": "I love the idea but I am worried about the heat"}'

# View full conversation
curl http://localhost:3000/messages/test-1
```

---

## What's NOT in Milestone 1
- No database (in-memory only — restarting the server clears everything)
- No auth or households
- No encryption (but the seam is ready)
- No conversation summarization (but MessageService is where it goes)
- No private input mode
- No iOS app yet
- No deployment — local only
