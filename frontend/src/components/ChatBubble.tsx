/**
 * ChatBubble.tsx — A single message bubble in the chat conversation.
 *
 * Each message is styled with a DISTINCT COLOR based on who sent it:
 *
 * - Partner A messages: Blue background (right-aligned if you, left if partner)
 * - Partner B messages: Green background (right-aligned if you, left if partner)
 * - AI messages:        Subtle muted background with a border, always left-aligned
 *
 * The colors are FIXED per author — Partner A is ALWAYS blue, Partner B is
 * ALWAYS green, regardless of whose screen you're looking at.
 *
 * REAL NAMES + AVATARS:
 * Instead of "Partner A" / "Partner B", bubbles now show the person's real name
 * and emoji avatar (e.g. "😎 Rich"). This data comes from:
 * - `ownProfile` — your own name/avatar (from localStorage)
 * - `participants` — the other partner's name/avatar (from the backend)
 *
 * Your own messages are right-aligned, other people's are left-aligned.
 */

import { motion } from 'framer-motion';
import type { ChatMessage, ParticipantInfo } from '@/lib/api';
import type { UserProfile } from '@/lib/profile';

interface ChatBubbleProps {
  message: ChatMessage;
  currentUser: 'partner_a' | 'partner_b';
  participants: Record<string, ParticipantInfo>;  // From the backend
  ownProfile: UserProfile;                         // From localStorage
}

export function ChatBubble({ message, currentUser, participants, ownProfile }: ChatBubbleProps) {
  const isOwn = message.author === currentUser;
  const isAI = message.author === 'ai';
  const isPartnerA = message.author === 'partner_a';
  const isPartnerB = message.author === 'partner_b';

  // ── Resolve Display Name + Avatar ────────────────────────────────────────
  // For your own messages: use your local profile
  // For the other partner: use the participant info from the backend
  // For AI: use the S3ttle label
  // Fallback to "Partner A/B" if we don't have names yet
  const getAuthorDisplay = (): { name: string; avatar: string } => {
    if (isAI) return { name: 'S3ttle', avatar: '🤖' };

    if (isOwn) {
      return { name: 'You', avatar: ownProfile.avatar };
    }

    // Other partner — look up from backend participants
    const info = participants[message.author];
    if (info) {
      return { name: info.displayName, avatar: info.avatar };
    }

    // Fallback if participant info hasn't loaded yet
    return {
      name: message.author === 'partner_a' ? 'Partner A' : 'Partner B',
      avatar: '👤',
    };
  };

  const { name: authorName, avatar: authorAvatar } = getAuthorDisplay();

  // ── Color Scheme ──────────────────────────────────────────────────────────
  const getBubbleClasses = () => {
    if (isAI) {
      return 'bg-muted text-foreground border border-border';
    }
    if (isPartnerA) {
      return 'bg-[oklch(0.55_0.15_250)] text-white dark:bg-[oklch(0.45_0.18_250)]';
    }
    if (isPartnerB) {
      return 'bg-[oklch(0.55_0.15_155)] text-white dark:bg-[oklch(0.42_0.15_155)]';
    }
    return 'bg-primary text-primary-foreground';
  };

  const getLabelClasses = () => {
    if (isAI) return 'text-muted-foreground';
    return 'text-white/70';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-3`}
    >
      <div className={`max-w-[82%] rounded-2xl px-4 py-3 ${getBubbleClasses()}`}>
        <p className={`text-xs font-medium mb-1.5 ${getLabelClasses()}`}>
          {authorAvatar} {authorName}
        </p>
        {/* line-height 1.6 from body, whitespace-pre-wrap for multi-line messages */}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </motion.div>
  );
}
