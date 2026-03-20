/**
 * ProfileSetup.tsx — First-time setup screen for choosing your name and avatar.
 *
 * This screen appears ONCE, on the very first visit. After the user picks a
 * name and emoji avatar, it's saved to localStorage and never shown again
 * (unless they clear browser data).
 *
 * The emoji grid gives users a fun, personal way to identify themselves in
 * the chat without uploading photos or creating accounts. The selected emoji
 * appears next to their messages in the conversation.
 *
 * DESIGN NOTES:
 * - Name input is required (can't proceed without it)
 * - Avatar defaults to the first emoji if none is selected
 * - The component reports the completed profile back to the parent via onComplete
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SettingsPanel } from './SettingsPanel';
import { saveProfile, type UserProfile } from '@/lib/profile';

interface ProfileSetupProps {
  onComplete: (profile: UserProfile) => void;  // Called when the user finishes setup
}

// ── Avatar Options ──────────────────────────────────────────────────────────
// A curated set of friendly, expressive emoji that work well as tiny avatars.
// These are grouped loosely: people, animals, nature, objects, symbols.
const AVATAR_OPTIONS = [
  '😊', '😎', '🥰', '🤓', '😄', '🙂',
  '🦊', '🐱', '🐶', '🦋', '🐼', '🦉',
  '🌸', '🌻', '🌙', '⭐', '🔥', '🌊',
  '💎', '🎯', '🎨', '🎵', '🚀', '💫',
];

export function ProfileSetup({ onComplete }: ProfileSetupProps) {
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('😊'); // Default avatar

  const handleSubmit = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    // Save to localStorage and report to parent
    const profile = saveProfile(trimmedName, selectedAvatar);
    onComplete(profile);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-background px-4">
      {/* Settings button pinned to top-right */}
      <div className="fixed top-4 right-4 z-20">
        <SettingsPanel />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm"
      >
        {/* Title */}
        <div className="text-center mb-8">
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="text-5xl font-bold tracking-tight mb-3"
          >
            S3ttle
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground"
          >
            Let's get to know you first.
          </motion.p>
        </div>

        {/* Setup Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-6"
        >
          {/* Name Input */}
          <div>
            <label className="text-sm font-medium mb-2 block">Your first name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rich, Sarah, Alex..."
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              autoFocus
              className="rounded-xl text-base h-12"
              maxLength={20}
            />
          </div>

          {/* Avatar Picker */}
          <div>
            <label className="text-sm font-medium mb-2 block">Pick your avatar</label>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_OPTIONS.map((emoji) => (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setSelectedAvatar(emoji)}
                  className={`text-2xl h-12 w-full rounded-xl transition-all ${
                    selectedAvatar === emoji
                      ? 'bg-primary/20 ring-2 ring-primary scale-110'
                      : 'bg-muted/50 hover:bg-muted'
                  }`}
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {name.trim() && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="text-center py-3 bg-muted/30 rounded-xl"
            >
              <span className="text-2xl mr-2">{selectedAvatar}</span>
              <span className="text-sm font-medium">{name.trim()}</span>
            </motion.div>
          )}

          {/* Continue Button */}
          <Button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="w-full h-14 text-base rounded-xl"
            size="lg"
          >
            Continue
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
