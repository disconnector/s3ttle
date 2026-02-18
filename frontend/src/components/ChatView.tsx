/**
 * ChatView.tsx — The main conversation screen where the magic happens.
 *
 * This component renders:
 * 1. A header bar showing the decision topic, your role, a back button, and theme toggle
 * 2. A scrollable message area with animated chat bubbles
 * 3. An auto-expanding text input area at the bottom
 *
 * How the message flow works:
 * - User types a message and presses Enter (or the send button)
 * - The message is immediately added to the local `messages` state so the user
 *   sees it appear instantly (this is called "optimistic UI")
 * - An API call is made to POST /message on the backend
 * - The backend saves the message, sends the full conversation history to Claude,
 *   and returns the AI's response
 * - The AI response is added to the local `messages` state
 *
 * Note: In Milestone 1, each browser tab has its own local message state.
 * Partner A and Partner B don't see each other's messages in real-time yet —
 * that requires Supabase Realtime (Milestone 2). But the backend IS maintaining
 * the full shared conversation, so the AI always sees everything both partners said.
 *
 * The text input is a <textarea> that auto-expands as you type (up to 5 lines).
 * Enter sends the message; Shift+Enter adds a new line.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import { ThemeToggle } from './ThemeToggle';
import { sendMessage } from '@/lib/api';
import type { ChatMessage } from '@/lib/api';

interface ChatViewProps {
  sessionId: string;     // The 6-character session code
  topic: string;         // What the decision is about (e.g. "Moving to Austin")
  currentUser: 'partner_a' | 'partner_b';  // Which partner this browser tab represents
  onBack: () => void;    // Called when user clicks the back arrow to return to setup
}

export function ChatView({ sessionId, topic, currentUser, onBack }: ChatViewProps) {
  // ──────────────────────────────────────────────────────────────────────────
  // STATE
  // ──────────────────────────────────────────────────────────────────────────

  // All messages in this conversation (local state only for M1)
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // The text currently in the input field
  const [input, setInput] = useState('');

  // True while waiting for the AI to respond — disables input and shows typing indicator
  const [isLoading, setIsLoading] = useState(false);

  // ──────────────────────────────────────────────────────────────────────────
  // REFS
  // Refs are like "pointers" to DOM elements. They let us interact with the
  // actual HTML elements directly (for scrolling, focusing, resizing, etc.)
  // without going through React's normal render cycle.
  // ──────────────────────────────────────────────────────────────────────────

  // Points to an invisible div at the bottom of the message list.
  // We call scrollIntoView() on this to auto-scroll when new messages arrive.
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Points to the textarea so we can focus it and resize it
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ──────────────────────────────────────────────────────────────────────────
  // AUTO-RESIZE TEXTAREA
  // This function resets the textarea height to "auto" (collapses it), then
  // sets it to scrollHeight (the height of the actual content). This makes
  // the textarea grow and shrink as the user types. Capped at ~5 lines (120px).
  // ──────────────────────────────────────────────────────────────────────────
  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';                           // Reset first
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`; // Then expand to content
  }, []);

  // ──────────────────────────────────────────────────────────────────────────
  // EFFECTS
  // useEffect hooks run "side effects" after React renders. They're how you
  // sync React state with the outside world (DOM, APIs, timers, etc.).
  // ──────────────────────────────────────────────────────────────────────────

  // Auto-scroll to the bottom whenever messages change or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Focus the textarea when the component first appears
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Resize textarea whenever the input text changes
  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  // ──────────────────────────────────────────────────────────────────────────
  // MESSAGE SENDING
  // ──────────────────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    // Step 1: Add the user's message to the UI immediately ("optimistic update").
    // We don't wait for the server — it feels snappier this way.
    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,       // Temporary ID (backend assigns real UUIDs)
      author: currentUser,
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');           // Clear the input field
    setIsLoading(true);     // Show typing indicator, disable input

    try {
      // Step 2: Send to backend. On the first message, include the topic
      // so the backend knows what this decision session is about.
      const isFirst = messages.length === 0;
      const response = await sendMessage(
        sessionId,
        currentUser,
        trimmed,
        isFirst ? topic : undefined
      );

      // Step 3: Add the AI's response to the UI
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        author: 'ai',
        content: response.aiMessage,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      // If something goes wrong, show an error in the chat itself
      // (rather than a generic error page or alert)
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        author: 'ai',
        content: 'Something went wrong. Please try again.',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      // Step 4: Re-enable the input regardless of success/failure
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  // Handle keyboard events in the textarea:
  // - Enter alone = send the message
  // - Shift+Enter = add a new line (default textarea behavior)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();  // Prevent the Enter from adding a newline
      handleSend();
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // The layout uses flexbox: header (fixed) + messages (scrollable) + input (fixed).
  // h-dvh = full viewport height using the "dynamic viewport height" unit,
  // which accounts for mobile browser chrome (address bar, etc.)
  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-dvh bg-background">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-10"
      >
        {/* Back button to return to the setup screen */}
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
          &larr;
        </Button>

        {/* Topic and role indicator */}
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold truncate">{topic}</h1>
          <p className="text-xs text-muted-foreground">
            You are {currentUser === 'partner_a' ? 'Partner A' : 'Partner B'}
            {' · '} Code: <span className="font-mono">{sessionId}</span>
          </p>
        </div>

        {/* Dark/light mode toggle */}
        <ThemeToggle />
      </motion.header>

      {/* ── Message Area ────────────────────────────────────────────────── */}
      {/* overflow-y-auto makes this section scrollable when messages exceed the height.
          overscroll-contain prevents the whole page from scrolling when you hit the top/bottom. */}
      <div className="flex-1 overflow-y-auto px-4 py-4 overscroll-contain">

        {/* Empty state — shown before any messages are sent */}
        {messages.length === 0 && (
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

        {/* AnimatePresence enables exit animations on removed elements.
            mode="popLayout" makes new elements animate in smoothly alongside
            elements that are animating out. */}
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} currentUser={currentUser} />
          ))}
          {isLoading && <TypingIndicator key="typing" />}
        </AnimatePresence>

        {/* Invisible anchor element for auto-scrolling */}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Input Area ──────────────────────────────────────────────────── */}
      {/* sticky bottom-0 keeps this pinned to the bottom of the screen.
          backdrop-blur-sm gives it a subtle frosted glass effect. */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-t border-border bg-background/80 backdrop-blur-sm px-4 py-3 sticky bottom-0"
      >
        <div className="flex gap-2 max-w-2xl mx-auto items-end">
          {/* Auto-expanding textarea instead of a single-line input.
              rows={1} starts it at one line; the resizeTextarea function
              grows it up to ~5 lines as the user types.
              "resize-none" prevents the manual drag-to-resize handle. */}
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

          {/* Send button — disabled when input is empty or AI is thinking */}
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="rounded-full shrink-0 mb-0.5"
          >
            {/* Paper airplane icon (from Heroicons) */}
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
