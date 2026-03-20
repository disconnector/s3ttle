# S3ttle — Project Instructions for Claude Code

## Read This First

**`plan.md` is the single source of truth.** It contains every product decision, application flow, data model, and implementation phase. Read it fully before doing any work. The decisions documented there have been made and agreed upon — do not re-litigate them unless the user explicitly asks.

## What Is S3ttle?

S3ttle is an AI-facilitated decision-making web application that helps couples reach genuine consensus on big life decisions (where to move, whether to buy a house, career changes, etc.).

**The AI is not a passive mediator.** It is a research-informed facilitator that:
- Asks probing questions to clarify thinking
- Actively researches facts, options, and comparisons (via web search)
- Makes concrete recommendations based on both partners' inputs
- Guides the couple through a structured Needs-Wants-Wishes methodology
- Moves the couple toward genuine consensus

## Core Product Principles

1. **The AI does homework, not just facilitation.** It researches, compares, recommends.
2. **Trust is the product.** Privacy tags are permanent. Never break privacy guarantees.
3. **Structure enables progress.** Needs-Wants-Wishes gives the conversation a framework.
4. **Async is the default.** Big decisions take days or weeks, not minutes.
5. **UI is critical.** Modern, minimalistic, premium. Users choose theme, font, font size.
6. **Start simple, design for expansion.** Couples now, groups later. Data model supports N participants.

## Build Session Continuity

This project is built across multiple sessions. Before starting work:

1. Read `plan.md` — understand the full requirements and which phase we're in
2. Check `git log` — what was last built?
3. Check `git status` — any uncommitted work?
4. Check task tracking files — any in-progress tasks?

After completing work:
1. Commit with clear messages referencing the phase (e.g., "Phase 0.2: Font loading and selection system")
2. Update `plan.md` if any decisions changed
3. Leave a clear trail of what's done and what's next

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Animation | Framer Motion |
| Backend | Node.js + Express + TypeScript |
| AI | Anthropic Claude API (Sonnet) with web search tool use |
| Database (beta) | In-memory |
| Database (prod) | Supabase (Postgres + Auth + Realtime) |
| Notifications | Web Push API (PWA) |
| Hosting (beta) | Local + Tailscale |
| Hosting (prod) | AWS or Azure |
| Billing (prod) | Stripe |

## Developer Context

- **Primary developer:** Non-developer using Claude Code for AI-assisted development
- **Backend experience:** Limited — prefer well-commented code with clear explanations
- **Working style:** Vertical slices, working software at each milestone
- **UI priority:** Critical — modern minimalistic design, user-selectable fonts/sizes, dark+light mode

## Key Architecture Rules

- **Data model uses N participants**, not partner_a/partner_b. Even though beta is couples-only, the schema supports groups.
- **All storage behind service abstractions** (repository pattern). Swap in-memory for Supabase without changing business logic.
- **Never log message content.** Session IDs and token counts only.
- **Privacy is non-negotiable.** "Don't share" items must never appear in shared context, group chat, partner views, or AI recommendations that would reveal them.
- **The Living Context Document has three layers:** shared view (both see), per-partner private (backend only), full AI picture (backend only). Only the shared view is ever sent to the frontend.

## Current Implementation Phases

See `plan.md` for full details:

- **Phase 0:** UI Design System & Visual Foundation
- **Phase 1:** Security Hardening + Core Flow Rebuild + Tailscale Beta
- **Phase 2:** Authentication, Persistence & Email Invites (Supabase)
- **Phase 3:** Production Deployment (AWS/Azure + Stripe)

*Last updated 2026-03-20*
