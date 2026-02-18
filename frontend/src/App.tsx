/**
 * App.tsx — The root component of S3ttle's frontend.
 *
 * This is the simplest possible "router" — it switches between two screens:
 *
 * 1. SetupView (session = null) — the landing page where you create or join a session
 * 2. ChatView (session = {...}) — the actual chat conversation
 *
 * There's no React Router or URL-based routing yet. The whole app state is just
 * one variable: `session`. If it's null, show setup. If it has data, show chat.
 *
 * AnimatePresence wraps both views so that transitions between them are animated.
 * mode="wait" means: finish the exit animation before starting the enter animation.
 * The `key` prop on each motion.div tells React these are different components,
 * which is what triggers the exit/enter animations when switching.
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SetupView } from '@/components/SetupView';
import { ChatView } from '@/components/ChatView';

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
  // This single piece of state controls the entire app flow.
  // null = show setup screen, {data} = show chat screen.
  const [session, setSession] = useState<SessionState | null>(null);

  // Called by SetupView when user creates or joins a session.
  // Sets the session state, which causes React to re-render and show ChatView.
  const handleStart = (topic: string, role: 'partner_a' | 'partner_b', sessionId: string) => {
    setSession({ sessionId, topic: topic || 'Decision', role });
  };

  return (
    <AnimatePresence mode="wait">
      {!session ? (
        <motion.div
          key="setup"
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <SetupView onStart={handleStart} />
        </motion.div>
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
            onBack={() => setSession(null)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default App;
