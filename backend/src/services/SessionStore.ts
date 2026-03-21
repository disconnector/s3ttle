/**
 * SessionStore.ts — SQLite-backed storage for sessions, participants, and messages.
 *
 * All function signatures are IDENTICAL to the previous in-memory version.
 * Nothing above this layer (MessageService, routes) needed to change.
 *
 * Data survives server restarts because it's written to backend/data/s3ttle.db.
 *
 * UPGRADE PATH (Phase 2):
 * When we swap to Supabase, only THIS file changes. MessageService and routes
 * stay exactly as they are. That's the repository pattern in action.
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../db/database';
import { Message, Session, ParticipantInfo, SessionStatus } from '../types';

// ── Internal row types (what SQLite returns) ──────────────────────────────────

interface SessionRow {
  id: string;
  topic: string;
  status: string;
  created_at: string;
}

interface ParticipantRow {
  session_id: string;
  role: string;
  display_name: string;
  avatar: string;
  device_id: string;
}

interface MessageRow {
  id: string;
  session_id: string;
  author: string;
  content: string;
  created_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Reconstruct a Session object from DB rows (joins participants) */
function rowToSession(row: SessionRow): Session {
  const participantRows = db
    .prepare('SELECT * FROM participants WHERE session_id = ?')
    .all(row.id) as ParticipantRow[];

  const participants = new Map<string, ParticipantInfo>();
  for (const p of participantRows) {
    participants.set(p.role, {
      displayName: p.display_name,
      avatar: p.avatar,
      deviceId: p.device_id,
    });
  }

  return {
    id: row.id,
    topic: row.topic,
    status: row.status as SessionStatus,
    participants,
    createdAt: new Date(row.created_at),
  };
}

/** Convert a MessageRow to a Message */
function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    sessionId: row.session_id,
    author: row.author as Message['author'],
    content: row.content,
    createdAt: new Date(row.created_at),
  };
}

// ── Prepared statements (compiled once, reused on every call) ─────────────────

const stmtGetSession    = db.prepare<[string]>('SELECT * FROM sessions WHERE id = ?');
const stmtInsertSession = db.prepare(
  'INSERT OR IGNORE INTO sessions (id, topic, status, created_at) VALUES (?, ?, ?, ?)'
);
const stmtUpsertParticipant = db.prepare(`
  INSERT INTO participants (session_id, role, display_name, avatar, device_id)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(session_id, role) DO UPDATE SET
    display_name = excluded.display_name,
    avatar       = excluded.avatar,
    device_id    = excluded.device_id
`);
const stmtInsertMessage = db.prepare(
  'INSERT INTO messages (id, session_id, author, content, created_at) VALUES (?, ?, ?, ?, ?)'
);
const stmtGetMessages   = db.prepare<[string]>(
  'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC'
);
const stmtAllSessions   = db.prepare(`
  SELECT s.id, s.topic, s.status, s.created_at,
    (SELECT COUNT(*) FROM participants p WHERE p.session_id = s.id) AS participant_count,
    (SELECT COUNT(*) FROM messages    m WHERE m.session_id = s.id) AS message_count
  FROM sessions s
  ORDER BY s.created_at DESC
`);
const stmtUpdateStatus  = db.prepare(
  'UPDATE sessions SET status = ? WHERE id = ?'
);
const stmtSessionsForDevice = db.prepare<[string]>(`
  SELECT
    s.id, s.topic, s.status, s.created_at,
    p_self.role                                                       AS my_role,
    (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id)       AS message_count,
    (SELECT MAX(m2.created_at) FROM messages m2 WHERE m2.session_id = s.id) AS last_message_at
  FROM sessions s
  JOIN participants p_self ON p_self.session_id = s.id AND p_self.device_id = ?
  ORDER BY COALESCE(last_message_at, s.created_at) DESC
`);

// ── Public Functions ──────────────────────────────────────────────────────────

/** Look up a session by its ID. Returns undefined if it doesn't exist. */
export function getSession(sessionId: string): Session | undefined {
  const row = stmtGetSession.get(sessionId) as SessionRow | undefined;
  return row ? rowToSession(row) : undefined;
}

/**
 * Create a new session with the given ID and topic.
 * Uses INSERT OR IGNORE — safe to call multiple times with the same ID.
 */
export function createSession(sessionId: string, topic: string): Session {
  stmtInsertSession.run(sessionId, topic, 'discussing', new Date().toISOString());
  return getSession(sessionId)!;
}

/**
 * Register or update a participant's display info in a session.
 * Uses UPSERT — creates if new, updates if the same role re-joins.
 */
export function setParticipant(
  sessionId: string,
  role: string,
  info: ParticipantInfo
): void {
  stmtUpsertParticipant.run(sessionId, role, info.displayName, info.avatar, info.deviceId);
}

/**
 * Add a message to a session's conversation.
 * Throws if the session doesn't exist.
 */
export function addMessage(sessionId: string, message: Message): void {
  const session = stmtGetSession.get(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found`);
  stmtInsertMessage.run(
    message.id,
    message.sessionId,
    message.author,
    message.content,
    message.createdAt.toISOString()
  );
}

/** Get all messages for a session in chronological order. */
export function getMessages(sessionId: string): Message[] {
  const rows = stmtGetMessages.all(sessionId) as MessageRow[];
  return rows.map(rowToMessage);
}

/** Update the status of a session (state machine transitions). */
export function setSessionStatus(sessionId: string, status: SessionStatus): void {
  stmtUpdateStatus.run(status, sessionId);
}

/**
 * Get all sessions a device has participated in, with summary data for the Dashboard.
 * Returns sessions ordered by most recent activity first.
 */
export function getSessionsForDevice(deviceId: string): Array<{
  id: string;
  topic: string;
  status: string;
  myRole: string;
  participants: Record<string, ParticipantInfo>;
  messageCount: number;
  lastActivityAt: string | null;
  createdAt: string;
}> {
  const rows = stmtSessionsForDevice.all(deviceId) as Array<{
    id: string;
    topic: string;
    status: string;
    my_role: string;
    message_count: number;
    last_message_at: string | null;
    created_at: string;
  }>;

  return rows.map((r) => {
    const participantRows = db
      .prepare('SELECT * FROM participants WHERE session_id = ?')
      .all(r.id) as ParticipantRow[];

    const participants: Record<string, ParticipantInfo> = {};
    for (const p of participantRows) {
      participants[p.role] = { displayName: p.display_name, avatar: p.avatar, deviceId: p.device_id };
    }

    return {
      id: r.id,
      topic: r.topic,
      status: r.status,
      myRole: r.my_role,
      participants,
      messageCount: r.message_count,
      lastActivityAt: r.last_message_at,
      createdAt: r.created_at,
    };
  });
}

/**
 * Get all sessions with summary counts — used by the Dashboard.
 */
export function getAllSessions(): Array<{
  id: string;
  topic: string;
  status: string;
  participantCount: number;
  messageCount: number;
  createdAt: Date;
}> {
  const rows = stmtAllSessions.all() as Array<{
    id: string;
    topic: string;
    status: string;
    created_at: string;
    participant_count: number;
    message_count: number;
  }>;

  return rows.map((r) => ({
    id: r.id,
    topic: r.topic,
    status: r.status,
    participantCount: r.participant_count,
    messageCount: r.message_count,
    createdAt: new Date(r.created_at),
  }));
}
