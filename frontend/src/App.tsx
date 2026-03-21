/**
 * App.tsx — Root component and screen router.
 *
 * State machine:
 *   1. No profile          → ProfileSetup  (first visit only)
 *   2. Profile, no session → DashboardView (home — lists sessions, start/join)
 *   3. Profile + session   → ChatView      (active conversation)
 *
 * Flow: ProfileSetup → DashboardView ↔ ChatView
 */

import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DashboardView } from '@/components/DashboardView';
import { ChatView } from '@/components/ChatView';
import { ProfileSetup } from '@/components/ProfileSetup';
import { getProfile, type UserProfile } from '@/lib/profile';

interface SessionState {
  sessionId: string;
  topic: string;
  role: 'partner_a' | 'partner_b';
}

function App() {
  const [profile, setProfile] = useState<UserProfile | null>(getProfile);
  const [session, setSession] = useState<SessionState | null>(null);

  const handleStart = (topic: string, role: 'partner_a' | 'partner_b', sessionId: string) => {
    setSession({ sessionId, topic: topic || 'Decision', role });
  };

  const handleTopicUpdate = useCallback((topic: string) => {
    setSession((prev) => prev ? { ...prev, topic } : prev);
  }, []);

  return (
    <AnimatePresence mode="wait">

      {/* Screen 1: First-time profile setup */}
      {!profile ? (
        <motion.div
          key="profile-setup"
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <ProfileSetup onComplete={setProfile} />
        </motion.div>

      /* Screen 2: Dashboard — session list + start/join */
      ) : !session ? (
        <motion.div
          key="dashboard"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.2 }}
        >
          <DashboardView
            profile={profile}
            onStart={handleStart}
            onSwitchProfile={() => setProfile(null)}
          />
        </motion.div>

      /* Screen 3: Active chat session */
      ) : (
        <motion.div
          key="chat"
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.22 }}
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
