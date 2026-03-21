/**
 * DashboardView.tsx — Home screen. Shows the user's sessions and lets them
 * start a new decision or join a partner's session.
 *
 * States:
 *   'list'  — main dashboard (session list or empty state)
 *   'new'   — "Start a New Decision" sheet (enter topic)
 *   'join'  — "Join with code" sheet (enter 6-char code)
 *
 * Sessions are loaded from the backend using the device's ID so they
 * survive server restarts (persisted in SQLite).
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsPanel } from './SettingsPanel';
import { getSessions, type SessionSummary } from '@/lib/api';
import { type UserProfile } from '@/lib/profile';

interface DashboardViewProps {
  profile: UserProfile;
  onStart: (topic: string, role: 'partner_a' | 'partner_b', sessionId: string) => void;
  onSwitchProfile: () => void;
}

// ── Status badge config ────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; classes: string; dot: string }> = {
  inviting:   { label: 'Waiting for partner', classes: 'text-amber-500 bg-amber-500/10',  dot: 'bg-amber-400' },
  refining:   { label: 'Refining question',   classes: 'text-blue-500 bg-blue-500/10',    dot: 'bg-blue-400' },
  discussing: { label: 'In discussion',        classes: 'text-primary bg-primary/10',      dot: 'bg-primary animate-pulse' },
  converging: { label: 'Reaching consensus',  classes: 'text-purple-500 bg-purple-500/10',dot: 'bg-purple-400' },
  settled:    { label: 'Settled',             classes: 'text-green-600 bg-green-500/10',   dot: 'bg-green-500' },
  unresolved: { label: 'Unresolved',          classes: 'text-muted-foreground bg-muted',   dot: 'bg-muted-foreground/40' },
};

// ── Relative time helper ───────────────────────────────────────────────────────

function timeAgo(isoString: string | null): string {
  if (!isoString) return '';
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60)   return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400)return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ─────────────────────────────────────────────────────────────────────────────

export function DashboardView({ profile, onStart, onSwitchProfile }: DashboardViewProps) {
  const [mode, setSessions_mode] = useState<'list' | 'new' | 'join'>('list');
  const [sessions, setSessions]  = useState<SessionSummary[]>([]);
  const [topic, setTopic]        = useState('');
  const [code, setCode]          = useState('');
  const [loading, setLoading]    = useState(true);
  const shouldReduce             = useReducedMotion();
  const dur                      = shouldReduce ? 0 : 0.3;

  // Load sessions for this device on mount
  useEffect(() => {
    getSessions(profile.deviceId)
      .then(setSessions)
      .finally(() => setLoading(false));
  }, [profile.deviceId]);

  const handleNew = () => {
    if (!topic.trim()) return;
    const id = Math.random().toString(36).substring(2, 8);
    onStart(topic.trim(), 'partner_a', id);
  };

  const handleJoin = () => {
    if (!code.trim()) return;
    onStart('', 'partner_b', code.trim().toLowerCase());
  };

  const handleResume = (s: SessionSummary) => {
    onStart(s.topic, s.myRole, s.id);
  };

  return (
    <div className="flex flex-col min-h-dvh bg-background">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 pt-12 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">S3ttle</h1>
          <button
            onClick={() => { onSwitchProfile(); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5"
          >
            {profile.avatar} {profile.displayName}
          </button>
        </div>
        <SettingsPanel />
      </header>

      {/* ── Session list / empty state ───────────────────────────────────── */}
      <main className="flex-1 px-5 pb-32 overflow-y-auto">

        {loading ? (
          <div className="flex flex-col gap-3 mt-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-muted/50 animate-pulse" />
            ))}
          </div>

        ) : sessions.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: dur, delay: 0.1 }}
            className="flex flex-col items-center justify-center text-center pt-20 px-6"
          >
            <p className="text-5xl mb-6">🤝</p>
            <h2 className="text-xl font-semibold mb-2">No decisions yet</h2>
            <p className="text-muted-foreground leading-relaxed max-w-xs">
              Start a new decision or join your partner's session with their code.
            </p>
          </motion.div>

        ) : (
          /* Session cards */
          <div className="flex flex-col gap-3 mt-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
              Your Decisions
            </p>
            <AnimatePresence initial={false}>
              {sessions.map((s, i) => (
                <SessionCard
                  key={s.id}
                  session={s}
                  profile={profile}
                  index={i}
                  dur={dur}
                  onResume={handleResume}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      {/* ── Bottom action bar ────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-md border-t border-border px-5 py-4 flex gap-3">
        <Button
          onClick={() => setSessions_mode('new')}
          className="flex-1 h-12 rounded-xl gap-2"
          size="lg"
        >
          <Plus className="w-4 h-4" />
          New Decision
        </Button>
        <Button
          onClick={() => setSessions_mode('join')}
          variant="outline"
          className="flex-1 h-12 rounded-xl gap-2"
          size="lg"
        >
          <Hash className="w-4 h-4" />
          Join
        </Button>
      </div>

      {/* ── New Decision sheet ───────────────────────────────────────────── */}
      <AnimatePresence>
        {mode === 'new' && (
          <BottomSheet onClose={() => { setSessions_mode('list'); setTopic(''); }}>
            <h2 className="text-lg font-semibold mb-1">What's the Decision?</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Describe what you and your partner need to decide. Be as specific as you like — the AI will help refine it.
            </p>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Should we move to Austin? We've been going back and forth for months and need to make a decision before our lease is up in June..."
              autoFocus
              rows={5}
              maxLength={500}
              className="w-full rounded-xl bg-muted/50 border border-border px-4 py-3 text-sm leading-relaxed resize-none outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground mb-4"
            />
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => { setSessions_mode('list'); setTopic(''); }} className="flex-1 h-12 rounded-xl">
                Cancel
              </Button>
              <Button onClick={handleNew} disabled={!topic.trim()} className="flex-1 h-12 rounded-xl">
                Start
              </Button>
            </div>
          </BottomSheet>
        )}

        {/* ── Join sheet ─────────────────────────────────────────────────── */}
        {mode === 'join' && (
          <BottomSheet onClose={() => { setSessions_mode('list'); setCode(''); }}>
            <h2 className="text-lg font-semibold mb-1">Join a Session</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Enter the session code your partner shared with you.
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toLowerCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="e.g. a1b2c3"
              autoFocus
              maxLength={6}
              className="w-full rounded-xl bg-muted/50 border border-border px-4 py-3 text-sm font-mono tracking-widest text-center outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground placeholder:tracking-normal placeholder:font-sans mb-4"
            />
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => { setSessions_mode('list'); setCode(''); }} className="flex-1 h-12 rounded-xl">
                Cancel
              </Button>
              <Button onClick={handleJoin} disabled={code.trim().length < 4} className="flex-1 h-12 rounded-xl">
                Join
              </Button>
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Session card ──────────────────────────────────────────────────────────────

interface SessionCardProps {
  session: SessionSummary;
  profile: UserProfile;
  index: number;
  dur: number;
  onResume: (s: SessionSummary) => void;
}

function SessionCard({ session, profile, index, dur, onResume }: SessionCardProps) {
  const cfg = STATUS_CONFIG[session.status] ?? STATUS_CONFIG['discussing'];

  // Build participant display string
  const partnerRole = session.myRole === 'partner_a' ? 'partner_b' : 'partner_a';
  const partner     = session.participants[partnerRole];
  const self        = session.participants[session.myRole];

  const selfLabel    = `${self?.avatar ?? profile.avatar} ${self?.displayName ?? profile.displayName}`;
  const partnerLabel = partner ? `${partner.avatar} ${partner.displayName}` : 'waiting for partner…';

  const lastActivity = session.lastActivityAt ?? session.createdAt;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: dur, delay: index * 0.05 }}
      onClick={() => onResume(session)}
      className="w-full text-left bg-card border border-border rounded-2xl px-4 py-4 hover:border-primary/40 hover:bg-card/80 transition-colors active:scale-[0.99]"
    >
      {/* Topic */}
      <p className="font-medium text-sm leading-snug line-clamp-2 mb-2">
        {session.topic || 'Untitled Decision'}
      </p>

      {/* Participants */}
      <p className="text-xs text-muted-foreground mb-3 truncate">
        {selfLabel} &amp; {partnerLabel}
      </p>

      {/* Status + meta row */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${cfg.classes}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
        <span className="text-xs text-muted-foreground">
          {session.messageCount > 0 ? `${session.messageCount} msg · ` : ''}{timeAgo(lastActivity)}
        </span>
      </div>
    </motion.button>
  );
}

// ── Bottom sheet wrapper ──────────────────────────────────────────────────────

function BottomSheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="sheet-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      {/* Sheet */}
      <motion.div
        key="sheet-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border rounded-t-2xl px-5 pt-5 pb-8"
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-muted-foreground/20 rounded-full mx-auto mb-5" />
        {children}
      </motion.div>
    </>
  );
}
