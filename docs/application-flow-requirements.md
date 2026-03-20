# S3ttle Application Flow Requirements

## Recovery Context

This document was created on March 20, 2026 to capture the current product direction for S3ttle as a web app for couples and small groups making decisions with AI facilitation.

If work resumes after a disconnect, use these assumptions unless explicitly changed:
- Product scope: web app first
- Primary use case: 2-4 participants in beta, with the initiator inviting up to 3 additional participants
- Core value proposition: AI-facilitated consensus, not AI-made decisions
- Default decision method: `Needs -> Wants -> Wishes`
- Default settlement rule in beta: unanimous confirmation by all active participants
- Key trust feature: per-input privacy controls that govern what the AI may share, summarize, or keep confidential
- Related background docs: `plan.md` and `CLAUDE.md`

## Purpose

S3ttle helps couples and small groups move from a vague or emotionally loaded decision to a clearly documented outcome. The application should reduce circular discussion, surface non-negotiables early, and help the group reach a fair, explicit resolution.

The AI's role is to facilitate, clarify, summarize, and propose options. The AI does not make the decision for the group.

## Product Principles

- The app must optimize for trust before speed.
- The app must make privacy rules explicit before collecting sensitive input.
- The app must support asynchronous participation.
- The app must treat "not settled" as a valid outcome.
- The app must preserve a clear record of what was decided and why.

## Primary Actors

- Initiator: creates the session, drafts the initial question, sends invites, and manages the session setup
- Participant: invited collaborator in the decision session
- AI facilitator: guides question refinement, gathers structured input, summarizes conflict, and helps the group converge

## Session Model

Each decision session moves through explicit states:

1. `draft`
2. `inviting`
3. `question_alignment`
4. `individual_intake`
5. `group_discussion`
6. `proposal_review`
7. `settled`
8. `paused`
9. `unresolved`
10. `archived`

The product should not advance between major states silently. Users should always know the current phase and the action required to continue.

## Privacy Model

Every user contribution must be assigned a visibility level at creation or review time:

- `shared`: visible to all participants
- `ai_summary_only`: the AI may incorporate the content into summaries or proposals without exposing it verbatim or attributing it directly
- `private_to_ai`: visible only to the AI and unavailable to other participants unless the author later changes the setting

System requirements:
- The app must explain these levels in plain language before intake begins.
- The AI must honor privacy settings in live discussion, summaries, post-session Q&A, and exported records.
- The app should allow a participant to reclassify their own prior input from more private to more open, but not the reverse if content has already been shared outward.

## Primary Application Flow

### 1. Account Access and Session Creation

1. The initiator signs up or logs in.
2. In beta, payment is skipped. The flow should still reserve a place for future subscription gating.
3. The initiator selects `Start a decision`.
4. The initiator enters a draft question in natural language.
5. The AI opens a short 1:1 refinement chat to make the question specific, decidable, and bounded.
6. The initiator approves the refined question and creates the session.
7. The new session enters `inviting`.

Functional requirements:
- The AI should challenge questions that are too broad, not actionable, or not actually decisions.
- The app should store both the original draft and the approved refined version.
- The initiator must be able to manually edit the AI-proposed wording before sending invites.

### 2. Invite and Join Flow

1. The initiator invites up to three additional participants in beta by email.
2. Each invite email includes the initiator's name, the proposed question, a short explanation of S3ttle, and a magic link.
3. The invitee clicks the magic link and either logs in or creates a lightweight account.
4. The invitee is attached to the session and shown the current question, the process overview, and the privacy model.
5. The initiator can monitor who has joined, resend invites, and remove pending invites before the discussion starts.

Functional requirements:
- Magic links must expire and be renewable.
- The system must support late joiners before the question is locked.
- The app must define what happens if an invited user never joins. Beta default: the initiator may proceed after removing that invitee.

### 3. Group Question Alignment

1. Each joined participant reviews the proposed question.
2. Each participant either accepts the wording or suggests a revision with rationale.
3. The AI synthesizes feedback and proposes revised wording when needed.
4. The app repeats this loop until the approval rule is met or the maximum revision limit is reached.
5. Once approved, the question is locked and the session enters `individual_intake`.

Recommended beta rule:
- All joined participants should approve the final wording.
- To avoid deadlock, cap revision rounds at three and then let the initiator choose whether to adopt the latest AI revision, manually edit, or pause the session.

Functional requirements:
- The system must keep a revision history of the question.
- The product should distinguish between question clarity disputes and substantive disagreement about the outcome.

### 4. Individual Intake Using Needs, Wants, Wishes

1. Each participant completes a private guided intake with the AI.
2. The AI helps the participant identify:
- `Needs`: non-negotiables or hard constraints
- `Wants`: strong preferences with meaningful weight
- `Wishes`: nice-to-have outcomes that are not required
3. The AI also asks for relevant constraints, risks, timeline issues, and tradeoffs.
4. The participant assigns a visibility level to each important point.
5. The session remains in `individual_intake` until all required participants complete intake or are explicitly marked inactive or removed.

Functional requirements:
- The intake should feel conversational but produce structured output.
- The system should store both raw user input and normalized AI-structured output.
- The app should allow participants to save progress and return later.
- The system should detect contradictory inputs and ask follow-up questions.

### 5. AI Synthesis and Shared Context

1. After intake, the AI creates a living context document for the session.
2. The document summarizes:
- the agreed question
- each participant's shared or shareable priorities
- areas of alignment
- areas of tension
- open questions
- early candidate paths to resolution
3. The living context document is visible to participants in read-only form.
4. The AI continuously updates the document as the discussion evolves.

Functional requirements:
- The living context document is the canonical session context for the AI.
- The document must respect privacy settings at all times.
- The document should be versioned so users can understand how the group moved over time.

### 6. Group Discussion and Facilitation

1. The session enters `group_discussion`.
2. Participants discuss in a shared thread while the AI acts as facilitator.
3. The AI surfaces common ground, highlights unresolved conflicts, asks clarifying questions, and proposes tradeoffs.
4. Participants may continue to message the AI privately during the shared discussion.
5. If a participant updates a prior position, the AI updates the living context document and informs the group when appropriate.

Functional requirements:
- The AI must not reveal `private_to_ai` content.
- The AI should avoid overstating agreement when only partial alignment exists.
- The app should support asynchronous use with notifications and digest summaries.
- The AI should be able to suggest a pause if the discussion becomes repetitive or unproductive.

### 7. Proposal Review and Settlement

1. When the AI detects sufficient convergence, it generates a proposed settlement.
2. The proposed settlement should explain:
- the recommended decision
- how it addresses the group's stated needs
- which wants or wishes were prioritized or deferred
- any explicit concessions or unresolved caveats
3. Each participant responds with one of:
- `S3ttled`
- `Almost`
- `Not yet`
4. If every active participant selects `S3ttled`, the session enters `settled`.
5. If any participant selects `Almost`, the AI revises the proposal and another review round begins.
6. If any participant selects `Not yet`, the session returns to `group_discussion`.

Functional requirements:
- Beta default consensus rule is unanimity among active participants.
- The AI must make it clear that acceptance is voluntary and should not be driven by pressure.
- The product should allow a session to end as `paused` or `unresolved` if consensus does not emerge.

### 8. Closure, Review, and Post-Session Q&A

1. When the session is closed, the app creates a decision record.
2. The decision record includes:
- final question
- final outcome or status
- key reasons behind the outcome
- major agreements and disagreements
- participant list
- timestamps
3. Participants can revisit the record later.
4. Participants can ask post-session questions to the AI about the decision history.
5. The AI answers using the stored session context while continuing to enforce privacy rules.

Functional requirements:
- Post-session Q&A must not expose restricted content.
- The app should support export of the decision record in a later version.
- The system should define retention and deletion rules before production launch.

## Edge Cases and Failure Modes

The application flow must explicitly handle the following:

- An invitee never joins
- A participant joins but never completes intake
- A participant wants to leave the session
- The initiator wants to replace or remove a participant
- The group cannot agree on question wording
- The group cannot reach consensus after several proposal rounds
- The AI detects emotionally unsafe dynamics, coercion, or a topic outside acceptable product scope
- A user asks the AI to reveal confidential input from another user
- A user wants to reopen a previously settled session

Recommended beta behaviors:
- Allow the initiator to remove non-joining invitees before question lock
- Allow pause and resume at any stage before settlement
- Preserve an immutable record once a decision is settled
- Create a new linked session for reopen rather than rewriting the old one

## Guardrails

- The AI must identify itself as a facilitator, not a therapist, lawyer, doctor, or arbitrator.
- The AI should refuse or redirect high-risk requests where facilitation is inappropriate.
- The app should avoid framing compromise as success if a participant's stated need is being overridden.
- The product should be transparent when the AI is inferring a summary rather than quoting a user directly.

## Open Product Decisions

These items still need founder decisions before implementation is complete:

- Whether beta is strictly couples plus small groups, or whether one of those is the primary go-to-market story
- Whether the initiator alone can finalize question wording after the revision cap, or whether a majority rule is allowed
- Whether private AI-only inputs are kept permanently or deleted after session close
- Whether post-session Q&A is available to all participants by default
- Whether reopened sessions require unanimous approval or majority approval
- Whether the app should support alternative decision rules beyond unanimity in later versions

## Recommended Next PRD Sections

The next sections to write after this document are:

1. `Functional Requirements`
2. `Non-Functional Requirements`
3. `Data Model`
4. `Safety and Privacy Policy`
5. `Beta Scope and Deferred Features`
