# S3ttle — Project Brief for Claude Code

## What Is This?

S3ttle is an iOS app for couples to make big decisions together with AI facilitation. Both partners get the app. Both apps talk to the same AI conversation — sharing a single context. The AI acts as a neutral third party: asking the right questions, surfacing hidden disagreements, and helping couples reach genuine consensus rather than one person just caving.

Tagline candidate: *"Big decisions. Both of you. Together."*

---

## The Problem It Solves

Couples face high-stakes decisions (move cities, buy a house, have kids, change careers) and have no structured tool for thinking through them together. They either avoid the conversation, talk in circles, or one person steamrolls. S3ttle gives them a facilitated, AI-guided space to think out loud — together.

---

## Core Concept: Shared AI Context

This is the technical heart of the app. Two iPhones. One conversation thread. The AI sees everything both partners say and responds into the shared context. Neither device "owns" the session — a backend session does. Both phones are just windows into the same thread.

```
[Partner A's iPhone] ──┐
                        ├──▶ [Railway Backend] ──▶ [Anthropic Claude API]
[Partner B's iPhone] ──┘         │
                                  ▼
                         [Supabase - Shared Session]
                         (conversation history,
                          mode, decision topic,
                          household data)
```

---

## Two Conversation Modes

### 1. Shared Chat Mode
Both partners see each other's messages in real-time. The AI participates in the thread as a third voice. Think iMessage with an emotionally intelligent participant who never takes sides.

### 2. Private Input Mode
Each partner submits their perspective privately. The backend holds both until it has input from each. Then it sends a synthesizing prompt to Claude: *"Partner A privately said X. Partner B privately said Y. Surface areas of agreement, tension, and open questions without revealing verbatim what either said."* The AI synthesizes without throwing anyone under the bus. Real couples therapists do something similar.

Both modes should be selectable at the start of each decision.

---

## AI Roles (Selectable Per Decision)

The AI's behavior is controlled entirely by the system prompt, which is set based on a mode flag stored in the session:

- **Facilitator** — Neutral, Socratic. Asks probing questions. Helps both partners articulate what they actually want.
- **Devil's Advocate** — Pushes back on both sides. Surfaces assumptions and weak reasoning.
- **Structured Framework** — Guides through a formal process: pros/cons, values alignment, weighted scoring, explicit decision.

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| iOS Frontend | SwiftUI | Developer is experienced with SwiftUI |
| Backend API | Node.js + TypeScript + Express | Deployed on Railway |
| Database + Realtime | Supabase | Postgres + Realtime listeners + Auth |
| Subscription Billing | RevenueCat + StoreKit | iOS subscription management |
| AI | Anthropic Claude API | claude-sonnet model |
| DNS / CDN | Cloudflare | Free tier, DNS management |

### Why This Stack
- Node/TypeScript is ideal for AI-assisted development (vibe coding) — excellent training data coverage
- Supabase handles Postgres + realtime sync + auth in one service, avoiding websocket infrastructure build
- Railway is push-to-deploy from GitHub — minimal DevOps overhead
- RevenueCat abstracts Apple StoreKit complexity and provides churn/revenue dashboards

---

## Business Model

- **Subscription, per household** — one subscription covers both partners
- **Target price:** $7.99/month per household (or ~$59.99/year)
- **Apple's cut:** 30% (drops to 15% after year one via Small Business Program)
- **RevenueCat** manages subscription state, webhooks, and lapse handling
- Backend checks subscription status on session creation; gates access at the household level

### Unit Economics (at 1,000 active households)
| Item | Monthly |
|---|---|
| Revenue | ~$7,990 |
| Railway (API server) | ~$10 |
| Supabase | ~$25 |
| Claude API (estimated) | ~$200-400 |
| **Apple's cut (30%)** | ~$2,397 |
| **Net** | **~$5,158** |

### Usage Protection
Implement a soft monthly token budget per household to prevent runaway API costs from pathologically indecisive couples. 99% of users will never hit it.

---

## Data Model

```
households
  id                uuid primary key
  partner_a_id      uuid references auth.users
  partner_b_id      uuid references auth.users
  subscription_status  text  ('active', 'lapsed', 'trial')
  created_at        timestamptz

decisions
  id                uuid primary key
  household_id      uuid references households
  topic             text          -- "Should we buy a boat?"
  mode              text          -- 'shared' | 'private'
  ai_role           text          -- 'facilitator' | 'advocate' | 'framework'
  status            text          -- 'open' | 'resolved'
  resolution        text          -- summary of outcome
  created_at        timestamptz
  resolved_at       timestamptz

messages
  id                uuid primary key
  decision_id       uuid references decisions
  author            text          -- 'partner_a' | 'partner_b' | 'ai'
  content           text
  is_private        boolean       -- for private input mode
  visible_to_ai     boolean       -- always true; controls UI visibility only
  created_at        timestamptz
```

---

## Session Linking UX

Couples establish a permanent **household** on first setup. One partner creates it, shares an invite link or code, the other joins. All decisions live under that household automatically. No re-linking per decision.

- Deep link: `S3ttle://join/{householdId}/{inviteToken}`
- Alternatively: 6-character invite code for same-room setup

---

## Build Strategy: Vertical Slices

Build vertically (thin slices end-to-end) rather than horizontally (all backend, then all frontend).

**Milestone 1 — Core Magic**
Two phones, one shared text thread, AI responds. No auth, no billing, no private mode. Just prove the shared context works end to end.

**Milestone 2 — Auth + Households**
Supabase auth. Household creation and invite flow. Persistent sessions.

**Milestone 3 — Private Input Mode**
Backend holds private messages, synthesizing prompt logic, UI gating.

**Milestone 4 — AI Roles**
System prompt switching. Mode selection UI at decision creation.

**Milestone 5 — Billing**
RevenueCat integration. StoreKit. Subscription gating on backend.

**Milestone 6 — Polish**
Decision history. Resolution flow. Notifications. App Store submission.

---

## Key Technical Considerations

**Concurrent Message Handling**
If both partners submit simultaneously, the backend must queue messages before calling Claude to avoid two in-flight API calls with divergent contexts. Implement a simple per-decision message lock or queue early.

**Realtime Sync**
Use Supabase Realtime (Postgres LISTEN/NOTIFY) for live message delivery to both phones. The SwiftUI client subscribes to the decision's message channel on open.

**Token Usage Tracking**
Log input/output tokens per API call to the messages table or a separate usage table. Essential for cost monitoring and enforcing household budgets.

**System Prompt Assembly**
Backend assembles: [ai_role system prompt] + [conversation history as labeled turns] + [current message]. Label turns clearly: "Partner A: ..." / "Partner B: ..." so Claude understands the two-person dynamic.

---

## Developer Context

- **Primary developer:** Non-developer using Claude Code for AI-assisted (vibe) development
- **SwiftUI experience:** Comfortable — has shipped iOS apps before
- **Backend experience:** Limited — prefer generated, well-commented code with clear explanations
- **Preferred working style:** Vertical slices, working software at each milestone, explain decisions as you go

---

## First Claude Code Prompt (Suggested)

> "Read CLAUDE.md. Let's start on Milestone 1. Scaffold a Node.js TypeScript Express project structured for Railway deployment. Include a POST /message endpoint that accepts a sessionId, author, and content, appends to an in-memory session store, assembles the conversation history, calls the Anthropic API with a basic facilitator system prompt, and returns the AI response. No database yet — just prove the core loop works."

---

*Last updated from claude.ai planning session — February 2026*
