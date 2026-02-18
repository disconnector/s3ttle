/**
 * SetupView.tsx — The landing/home screen of S3ttle.
 *
 * This is the first thing users see when they open the app. It has two flows:
 *
 * 1. "Start a New Decision" — Partner A creates a session by typing a topic.
 *    A random 6-character session code is generated. Partner A shares this code
 *    with Partner B (via text, iMessage, etc.).
 *
 * 2. "Join Partner's Session" — Partner B enters the session code to join the
 *    same conversation as Partner B.
 *
 * The component uses a simple state machine via the `mode` variable:
 *   null    → show the two main buttons
 *   'new'   → show the "create decision" card
 *   'join'  → show the "enter code" card
 *
 * When the user completes either flow, it calls `onStart()` which the parent
 * (App.tsx) uses to switch to the ChatView.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from './ThemeToggle';

interface SetupViewProps {
  onStart: (topic: string, role: 'partner_a' | 'partner_b', sessionId: string) => void;
}

export function SetupView({ onStart }: SetupViewProps) {
  const [topic, setTopic] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [mode, setMode] = useState<'new' | 'join' | null>(null);

  const handleNew = () => {
    if (!topic.trim()) return;
    // Generate a simple session ID for now
    const id = Math.random().toString(36).substring(2, 8);
    onStart(topic.trim(), 'partner_a', id);
  };

  const handleJoin = () => {
    if (!sessionId.trim()) return;
    onStart('', 'partner_b', sessionId.trim());
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-background px-4">
      {/* Theme toggle pinned to top-right corner */}
      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-4xl font-bold tracking-tight mb-2"
          >
            S3ttle
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground text-sm"
          >
            Big decisions. Both of you. Together.
          </motion.p>
        </div>

        {!mode && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-3"
          >
            <Button
              onClick={() => setMode('new')}
              className="w-full h-14 text-base rounded-xl"
              size="lg"
            >
              Start a New Decision
            </Button>
            <Button
              onClick={() => setMode('join')}
              variant="outline"
              className="w-full h-14 text-base rounded-xl"
              size="lg"
            >
              Join Partner's Session
            </Button>
          </motion.div>
        )}

        {mode === 'new' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>What's the Decision?</CardTitle>
                <CardDescription>
                  Describe what you and your partner need to decide on.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Should we move to Austin?"
                  onKeyDown={(e) => e.key === 'Enter' && handleNew()}
                  autoFocus
                  className="rounded-xl"
                />
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setMode(null)} className="flex-1">
                    Back
                  </Button>
                  <Button
                    onClick={handleNew}
                    disabled={!topic.trim()}
                    className="flex-1 rounded-xl"
                  >
                    Start as Partner A
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {mode === 'join' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Join a Session</CardTitle>
                <CardDescription>
                  Enter the session code your partner shared with you.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="Session code (e.g. a1b2c3)"
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  autoFocus
                  className="rounded-xl font-mono text-center tracking-widest"
                />
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setMode(null)} className="flex-1">
                    Back
                  </Button>
                  <Button
                    onClick={handleJoin}
                    disabled={!sessionId.trim()}
                    className="flex-1 rounded-xl"
                  >
                    Join as Partner B
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
