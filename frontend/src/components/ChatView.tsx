/**
 * ChatView.tsx — The main conversation screen where the magic happens.
 *
 * This component renders:
 * 1. A header bar showing the decision topic, your name, a back button, and theme toggle
 * 2. A scrollable message area with animated chat bubbles showing real names + avatars
 * 3. An auto-expanding text input area at the bottom
 *
 * How the message flow works:
 * - User types a message and presses Enter (or the send button)
 * - The message is immediately added to the local `messages` state so the user
 *   sees it appear instantly (this is called "optimistic UI")
 * - An API call is made to POST /message on the backend, including profile data
 * - The backend saves the message, registers the participant, sends history to Claude
 * - Claude responds using the partner's real name
 * - The AI response is added to the local `messages` state
 *
 * REAL-TIME SYNC (Milestone 1 approach):
 * Since we don't have Supabase Realtime yet, we use polling — the frontend
 * asks the backend for the latest messages every 2 seconds. Polling also
 * fetches participant info so each partner sees the other's name and avatar.
 *
 * The text input is a <textarea> that auto-expands as you type (up to 5 lines).
 * Enter sends the message; Shift+Enter adds a new line.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { SettingsPanel } from './SettingsPanel';
import { sendMessage, getMessages, createSession } from '@/lib/api';
import type { ChatMessage, ParticipantInfo } from '@/lib/api';
import type { UserProfile } from '@/lib/profile';

interface ChatViewProps {
  sessionId: string;     // The 6-character session code
  topic: string;         // What the decision is about (e.g. "Moving to Austin")
  currentUser: 'partner_a' | 'partner_b';  // Which partner this browser tab represents
  profile: UserProfile;  // This user's profile (name, avatar, deviceId)
  onBack: () => void;    // Called when user clicks the back arrow to return to setup
  onTopicUpdate: (topic: string) => void; // Called when we learn the topic from the server
}

export function ChatView({ sessionId, topic, currentUser, profile, onBack, onTopicUpdate }: ChatViewProps) {
  // ──────────────────────────────────────────────────────────────────────────
  // STATE
  // ──────────────────────────────────────────────────────────────────────────

  // All messages in this conversation, synced from the backend via polling.
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // The text currently in the input field
  const [input, setInput] = useState('');

  // True while waiting for the AI to respond — disables input and shows typing indicator
  const [isLoading, setIsLoading] = useState(false);

  // Participant info from the backend — maps role → { displayName, avatar }
  // This lets us show the other partner's real name and avatar in chat bubbles.
  const [participants, setParticipants] = useState<Record<string, ParticipantInfo>>({});

  // Tracks whether the session was not found on the backend (e.g. after a server restart)
  const [sessionNotFound, setSessionNotFound] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  // REFS
  // ──────────────────────────────────────────────────────────────────────────

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ──────────────────────────────────────────────────────────────────────────
  // AUTO-RESIZE TEXTAREA
  // ──────────────────────────────────────────────────────────────────────────
  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  // ──────────────────────────────────────────────────────────────────────────
  // CREATE SESSION ON MOUNT (Partner A only)
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (currentUser === 'partner_a') {
      createSession(sessionId, topic, profile.displayName, profile.avatar, profile.deviceId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // POLLING FOR NEW MESSAGES + PARTICIPANT INFO
  // ──────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let notFoundCount = 0;
    const fetchMessages = async () => {
      try {
        const data = await getMessages(sessionId);
        notFoundCount = 0;
        setSessionNotFound(false);
        // Update topic if the server has one
        if (data.session?.topic && data.session.topic !== 'Untitled Decision') {
          onTopicUpdate(data.session.topic);
        }
        // Update participant info (names + avatars from the other partner)
        if (data.session?.participants) {
          setParticipants(data.session.participants);
        }
        // Only update if server has more messages than we have locally
        setMessages((prev) => {
          if (data.messages.length > prev.length) {
            return data.messages;
          }
          return prev;
        });
      } catch {
        // If Partner B joins before Partner A sends the first message,
        // the session won't exist yet. Show an error after several failed attempts.
        // Only show "session not found" for Partner B (Partner A creates the session)
        notFoundCount++;
        if (notFoundCount >= 3 && currentUser === 'partner_b') {
          setSessionNotFound(true);
        }
      }
    };

    fetchMessages();

    const interval = setInterval(() => {
      if (!isLoading) {
        fetchMessages();
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [sessionId, isLoading, onTopicUpdate]);

  // ──────────────────────────────────────────────────────────────────────────
  // MESSAGE SENDING
  // ──────────────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      author: currentUser,
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Send message WITH profile data so the backend registers our identity
      const isFirst = messages.length === 0;
      const response = await sendMessage(
        sessionId,
        currentUser,
        trimmed,
        isFirst ? topic : undefined,
        profile.displayName,
        profile.avatar,
        profile.deviceId
      );

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        author: 'ai',
        content: response.aiMessage,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        author: 'ai',
        content: 'Something went wrong. Please try again.',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // HELPER: Get the other partner's name for the header
  // ──────────────────────────────────────────────────────────────────────────
  const otherRole = currentUser === 'partner_a' ? 'partner_b' : 'partner_a';
  const otherPartner = participants[otherRole];

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-dvh bg-background">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10"
      >
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
          &larr;
        </Button>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">{topic}</h1>
          <p className="text-xs text-muted-foreground">
            {profile.avatar} {profile.displayName}
            {otherPartner
              ? ` & ${otherPartner.avatar} ${otherPartner.displayName}`
              : ' — waiting for partner...'}
            {' · '}<span className="font-mono">{sessionId}</span>
          </p>
        </div>

        <SettingsPanel />
      </motion.header>

      {/* ── Message Area ────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 overscroll-contain">

        {messages.length === 0 && sessionNotFound && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center justify-center h-full text-center px-8"
          >
            <div className="text-4xl mb-4">🔍</div>
            <h2 className="text-lg font-semibold mb-2">Session Not Found</h2>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              Code &ldquo;{sessionId}&rdquo; doesn&apos;t match an active session.
              The server may have restarted, or the code might be wrong.
            </p>
            <Button variant="outline" onClick={onBack} className="rounded-xl">
              Go Back
            </Button>
          </motion.div>
        )}

        {messages.length === 0 && !sessionNotFound && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center justify-center h-full text-center px-8"
          >
            <div className="text-4xl mb-4">💬</div>
            <h2 className="text-lg font-semibold mb-2">Start the Conversation</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Share your thoughts on &ldquo;{topic}&rdquo; and the AI facilitator
              will help guide your discussion.
            </p>
          </motion.div>
        )}

        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              currentUser={currentUser}
              participants={participants}
              ownProfile={profile}
            />
          ))}
          {isLoading && <TypingIndicator key="typing" />}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ──────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-t border-border bg-background/80 backdrop-blur-sm px-4 py-3 sticky bottom-0"
      >
        <div className="flex gap-2 max-w-2xl mx-auto items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={isLoading}
            rows={1}
            className="flex-1 rounded-2xl bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-ring px-4 py-2.5 text-sm resize-none overflow-hidden leading-relaxed outline-none"
          />

          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="rounded-full shrink-0 mb-0.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
