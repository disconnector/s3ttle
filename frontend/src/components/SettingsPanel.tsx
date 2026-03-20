/**
 * SettingsPanel.tsx — Slide-out settings panel for appearance preferences.
 *
 * Manages its own open/close state — just drop <SettingsPanel /> anywhere in
 * the header and it renders both the trigger button and the panel itself.
 *
 * Controls:
 *   - Theme:     Light / Dark toggle
 *   - Font:      5 options (System, Inter, DM Sans, Lora, JetBrains Mono)
 *   - Font Size: Compact / Default / Large
 *
 * Changes apply instantly — no save button needed. Preferences are written to
 * localStorage via savePreferences() and applied to the DOM via applyPreferences().
 *
 * Layout:
 *   - Mobile (< md):  Slides up from the bottom as a sheet
 *   - Desktop (≥ md): Slides in from the right as a side panel
 */

import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { SlidersHorizontal, X, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getPreferences,
  savePreferences,
  applyPreferences,
  FONT_OPTIONS,
  SIZE_OPTIONS,
  type UserPreferences,
} from '@/lib/preferences';

export function SettingsPanel() {
  const [isOpen, setIsOpen]   = useState(false);
  const [prefs,  setPrefs]    = useState<UserPreferences>(getPreferences);
  const shouldReduce          = useReducedMotion();

  // Update a single preference key, persist and apply immediately
  const update = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    savePreferences(next);
    applyPreferences(next);
  };

  const duration = shouldReduce ? 0 : 0.22;

  return (
    <>
      {/* ── Trigger button ───────────────────────────────────────────────── */}
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full w-8 h-8"
        onClick={() => setIsOpen(true)}
        aria-label="Open settings"
      >
        <SlidersHorizontal className="w-4 h-4" />
      </Button>

      {/* ── Overlay + Panel ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="settings-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />

            {/* Panel — bottom sheet on mobile, right sidebar on desktop */}
            <motion.div
              key="settings-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Settings"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration, ease: 'easeOut' }}
              className={[
                // Mobile: full-width sheet anchored to bottom
                'fixed bottom-0 left-0 right-0 z-50',
                'bg-background border-t border-border',
                'rounded-t-2xl',
                // Desktop: right sidebar, full height
                'md:bottom-0 md:top-0 md:left-auto md:right-0 md:w-72',
                'md:border-t-0 md:border-l',
                'md:rounded-none',
                'overflow-y-auto',
              ].join(' ')}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
                  Settings
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full w-8 h-8 -mr-1"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close settings"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="px-5 py-5 space-y-7 pb-8">

                {/* ── Theme ─────────────────────────────────────────────── */}
                <section>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                    Theme
                  </p>
                  <div className="flex gap-2">
                    <ThemeButton
                      active={prefs.theme === 'light'}
                      onClick={() => update('theme', 'light')}
                      label="Light"
                      icon={<Sun className="w-3.5 h-3.5" />}
                    />
                    <ThemeButton
                      active={prefs.theme === 'dark'}
                      onClick={() => update('theme', 'dark')}
                      label="Dark"
                      icon={<Moon className="w-3.5 h-3.5" />}
                    />
                  </div>
                </section>

                {/* ── Font Family ───────────────────────────────────────── */}
                <section>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                    Font
                  </p>
                  <div className="space-y-1.5">
                    {FONT_OPTIONS.map((font) => (
                      <button
                        key={font.id}
                        onClick={() => update('fontFamily', font.id)}
                        className={[
                          'w-full flex items-center justify-between',
                          'px-3 py-2.5 rounded-xl text-sm',
                          'transition-colors duration-150',
                          prefs.fontFamily === font.id
                            ? 'bg-primary/12 text-primary ring-1 ring-primary/30'
                            : 'text-foreground hover:bg-muted',
                        ].join(' ')}
                      >
                        <span
                          className="font-medium"
                          style={{ fontFamily: font.preview }}
                        >
                          {font.label}
                        </span>
                        <span
                          className="text-xs text-muted-foreground"
                          style={{ fontFamily: font.preview }}
                        >
                          Aa
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                {/* ── Font Size ─────────────────────────────────────────── */}
                <section>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                    Text Size
                  </p>
                  <div className="flex gap-2">
                    {SIZE_OPTIONS.map((size) => (
                      <button
                        key={size.id}
                        onClick={() => update('fontSize', size.id)}
                        className={[
                          'flex-1 py-2 rounded-xl text-sm font-medium',
                          'transition-colors duration-150',
                          prefs.fontSize === size.id
                            ? 'bg-primary/12 text-primary ring-1 ring-primary/30'
                            : 'text-foreground bg-muted/60 hover:bg-muted',
                        ].join(' ')}
                        style={{
                          fontSize: size.id === 'compact' ? '0.8rem'
                                  : size.id === 'large'   ? '1rem'
                                  : '0.875rem',
                        }}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                  {/* Live size preview */}
                  <p
                    className="mt-3 text-muted-foreground text-center leading-relaxed px-2"
                    style={{
                      fontSize: SIZE_OPTIONS.find((o) => o.id === prefs.fontSize)?.scale
                        ? `${SIZE_OPTIONS.find((o) => o.id === prefs.fontSize)!.scale * 0.875}rem`
                        : '0.875rem',
                    }}
                  >
                    The quick brown fox jumps over the lazy dog.
                  </p>
                </section>

              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Small internal component: theme toggle button ──────────────────────────

interface ThemeButtonProps {
  active:  boolean;
  onClick: () => void;
  label:   string;
  icon:    React.ReactNode;
}

function ThemeButton({ active, onClick, label, icon }: ThemeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex-1 flex items-center justify-center gap-2',
        'py-2.5 rounded-xl text-sm font-medium',
        'transition-colors duration-150',
        active
          ? 'bg-primary/12 text-primary ring-1 ring-primary/30'
          : 'text-foreground bg-muted/60 hover:bg-muted',
      ].join(' ')}
    >
      {icon}
      {label}
    </button>
  );
}
