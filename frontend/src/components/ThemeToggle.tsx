/**
 * ThemeToggle.tsx — A sun/moon toggle button for switching between light and dark mode.
 *
 * How it works:
 * - Reads the user's preference from localStorage on first load (key: "s3ttle-theme")
 * - If no preference is saved, defaults to dark mode (because bright white is painful)
 * - Toggles the "dark" class on the <html> element — this is how shadcn/ui's
 *   dark mode works. All the CSS variables in index.css have a `.dark` variant
 *   that activates when <html> has the "dark" class.
 * - Saves the preference to localStorage so it persists across refreshes.
 * - Uses Framer Motion to animate the sun/moon icon rotation on toggle.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  // Initialize state from localStorage, defaulting to dark mode.
  // We use a function initializer (the () => ... syntax) so this only
  // runs once on first render, not on every re-render.
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('s3ttle-theme');
    // If user has a saved preference, use it. Otherwise default to dark.
    return saved ? saved === 'dark' : true;
  });

  // useEffect runs after the component renders.
  // This one syncs the actual DOM (adding/removing the "dark" class)
  // with our React state, and saves to localStorage.
  // The [isDark] dependency array means it re-runs whenever isDark changes.
  useEffect(() => {
    const root = document.documentElement; // This is the <html> element
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('s3ttle-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setIsDark(!isDark)}
      className="rounded-full w-8 h-8"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* motion.svg animates the icon rotating when the theme changes.
          The key prop forces React to unmount/remount when isDark changes,
          which triggers the enter animation each time. */}
      <motion.svg
        key={isDark ? 'moon' : 'sun'}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-4 h-4"
      >
        {isDark ? (
          // Moon icon — shown when in dark mode (click to go light)
          <>
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
          </>
        ) : (
          // Sun icon — shown when in light mode (click to go dark)
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
          </>
        )}
      </motion.svg>
    </Button>
  );
}
