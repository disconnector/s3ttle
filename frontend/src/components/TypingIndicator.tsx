/**
 * TypingIndicator.tsx — The "S3ttle is thinking..." animation.
 *
 * Shows three bouncing dots (like iMessage typing indicators) while waiting
 * for the AI to respond. Styled to match the AI's chat bubble appearance.
 *
 * How the animation works:
 * - Each dot is a Framer Motion div with an infinite y-axis animation
 * - The `animate` prop says: "continuously move y from 0 to -6 to 0"
 * - Each dot has a slightly different `delay` (0, 0.15s, 0.3s) so they
 *   bounce in sequence rather than all at once — creating the wave effect
 * - `repeat: Infinity` means it never stops
 *
 * The whole component also has enter/exit animations:
 * - Enter: fades in and slides up (when AI starts thinking)
 * - Exit: fades out and slides up (when AI response arrives)
 * These work because the parent wraps this in <AnimatePresence>
 */

import { motion } from 'framer-motion';

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex justify-start mb-3"
    >
      <div className="bg-muted border border-border rounded-2xl px-4 py-3">
        <p className="text-xs font-medium mb-1 text-muted-foreground">S3ttle</p>
        <div className="flex gap-1.5 items-center h-5">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-2 h-2 bg-muted-foreground/50 rounded-full"
              animate={{ y: [0, -6, 0] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
