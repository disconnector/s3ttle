/**
 * ChatBubble.tsx — A single message bubble in the chat conversation.
 *
 * Each message is styled differently based on who sent it:
 *
 * - YOUR messages:    Right-aligned, dark background (primary color)
 * - PARTNER messages: Left-aligned, light background (secondary color)
 * - AI messages:      Left-aligned, subtle background with a border
 *
 * The component figures out which style to use by comparing the message's
 * `author` field against the `currentUser` prop. This way, the same message
 * looks like "You" on Partner A's screen and "Partner" on Partner B's screen.
 *
 * Framer Motion handles the enter animation — each bubble slides up and
 * fades in when it first appears (initial → animate transition).
 *
 * Tailwind CSS classes explained:
 * - max-w-[80%]       → bubble never exceeds 80% of the chat width
 * - rounded-2xl       → very rounded corners (like iMessage)
 * - whitespace-pre-wrap → preserves line breaks in the message text
 * - text-primary-foreground/70 → the /70 means 70% opacity
 */

import { motion } from 'framer-motion';
import type { ChatMessage } from '@/lib/api';

interface ChatBubbleProps {
  message: ChatMessage;                       // The message to display
  currentUser: 'partner_a' | 'partner_b';     // Who "you" are in this session
}

export function ChatBubble({ message, currentUser }: ChatBubbleProps) {
  // Figure out the relationship between the message author and the current user
  const isOwn = message.author === currentUser;    // Did I send this?
  const isAI = message.author === 'ai';            // Did the AI send this?
  const isPartner = !isOwn && !isAI;               // Did my partner send this?

  const authorLabel = isAI
    ? 'S3ttle'
    : isOwn
      ? 'You'
      : 'Partner';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isAI
            ? 'bg-muted text-foreground border border-border'
            : isOwn
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground'
        }`}
      >
        <p className={`text-xs font-medium mb-1 ${
          isAI
            ? 'text-muted-foreground'
            : isOwn
              ? 'text-primary-foreground/70'
              : 'text-secondary-foreground/70'
        }`}>
          {authorLabel}
        </p>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
      </div>
    </motion.div>
  );
}
