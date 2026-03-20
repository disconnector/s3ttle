/**
 * App.tsx — The root component of S3ttle's frontend.
 *
 * This is a simple state-machine "router" that switches between three screens:
 *
 * 1. ProfileSetup (profile = null) — first-time setup: name + avatar
 * 2. SetupView (session = null) — create or join a decision session
 * 3. ChatView (session = {...}) — the actual chat conversation
 *
 * The flow is: ProfileSetup → SetupView → ChatView → (back to SetupView)
 *
 * Profile data (name, avatar, deviceId) is saved to localStorage, so
 * ProfileSetup only appears on the very first visit. On subsequent visits,
 * the profile is loaded from localStorage and we skip straight to SetupView.
 *
 * AnimatePresence wraps all views so transitions are animated.
 * mode="wait" means: finish the exit animation before starting the enter.
 */

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SetupView } from '@/components/SetupView';
import { ChatView } from '@/components/ChatView';
import { ProfileSetup } from '@/components/ProfileSetup';
import { getProfile, type UserProfile } from '@/lib/profile';

/**
 * SessionState — tracks which session we're in.
 * When null, we're on the setup screen. When populated, we're in a chat.
 */
interface SessionState {
  sessionId: string;                    // The 6-char code shared between partners
  topic: string;                        // What the decision is about
  role: 'partner_a' | 'partner_b';     // Which partner this browser tab represents
}

function App() {
  // ── Profile State ───────────────────────────────────────────────────────
  // Loaded from localStorage on first render. If null, show ProfileSetup.
  // Once set (either from localStorage or from the setup screen), this
  // persists for the entire session and is passed down to child components.
  const [profile, setProfile] = useState<UserProfile | null>(getProfile);

  // ── Session State ───────────────────────────────────────────────────────
  // null = show setup screen, {data} = show chat screen.
  const [session, setSession] = useState<SessionState | null>(null);

  // Called by SetupView when user creates or joins a session.
  const handleStart = (topic: string, role: 'partner_a' | 'partner_b', sessionId: string) => {
    setSession({ sessionId, topic: topic || 'Decision', role });
  };

  // Called by ChatView when it learns the real topic from the server.
  // useCallback keeps the function identity stable to prevent polling restarts.
  const handleTopicUpdate = useCallback((topic: string) => {
    setSession((prev) => prev ? { ...prev, topic } : prev);
  }, []);

  return (
    <AnimatePresence mode="wait">
      {/* Screen 1: First-time profile setup (name + avatar) */}
      {!profile ? (
        <motion.div
          key="profile-setup"
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <ProfileSetup onComplete={setProfile} />
        </motion.div>

      /* Screen 2: Create or join a session */
      ) : !session ? (
        <motion.div
          key="setup"
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <SetupView onStart={handleStart} profile={profile} onSwitchProfile={() => setProfile(null)} />
        </motion.div>

      /* Screen 3: The chat conversation */
      ) : (
        <motion.div
          key="chat"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="h-dvh"
        >
          <ChatView
            sessionId={session.sessionId}
            topic={session.topic}
            currentUser={session.role}
            profile={profile}
            onBack={() => setSession(null)}
            onTopicUpdate={handleTopicUpdate}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default App;
