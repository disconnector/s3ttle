/**
 * preferences.ts — Persistent user preferences stored in localStorage.
 *
 * Manages three settings:
 *   - theme: 'light' | 'dark'
 *   - fontFamily: one of five curated options
 *   - fontSize: 'compact' | 'default' | 'large'
 *
 * applyPreferences() mutates the DOM directly (sets CSS custom properties on
 * :root and toggles the 'dark' class on <html>). It must be called before the
 * first React render (in main.tsx) to prevent a flash of unstyled content.
 *
 * Google Fonts are loaded on-demand — only the selected font's stylesheet is
 * injected. Subsequent calls for the same font are no-ops (checks for existing
 * <link> tags before injecting).
 */

// ── Types ────────────────────────────────────────────────────────────────────

export type FontFamily = 'system' | 'inter' | 'dm-sans' | 'lora' | 'jetbrains-mono';
export type FontSize   = 'compact' | 'default' | 'large';
export type Theme      = 'light' | 'dark';

export interface UserPreferences {
  theme:      Theme;
  fontFamily: FontFamily;
  fontSize:   FontSize;
}

// ── Font Metadata ─────────────────────────────────────────────────────────────

export const FONT_OPTIONS: { id: FontFamily; label: string; preview: string }[] = [
  { id: 'system',         label: 'System Default',  preview: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { id: 'inter',          label: 'Inter',            preview: '"Inter", sans-serif' },
  { id: 'dm-sans',        label: 'DM Sans',          preview: '"DM Sans", sans-serif' },
  { id: 'lora',           label: 'Lora',             preview: '"Lora", serif' },
  { id: 'jetbrains-mono', label: 'JetBrains Mono',   preview: '"JetBrains Mono", monospace' },
];

export const SIZE_OPTIONS: { id: FontSize; label: string; scale: number }[] = [
  { id: 'compact', label: 'Compact', scale: 0.925 },
  { id: 'default', label: 'Default', scale: 1     },
  { id: 'large',   label: 'Large',   scale: 1.1   },
];

// CSS font-family strings indexed by FontFamily id
const FONT_FAMILIES: Record<FontFamily, string> = {
  'system':         '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  'inter':          '"Inter", sans-serif',
  'dm-sans':        '"DM Sans", sans-serif',
  'lora':           '"Lora", serif',
  'jetbrains-mono': '"JetBrains Mono", monospace',
};

// Google Fonts URLs indexed by FontFamily id (system has none)
const FONT_URLS: Partial<Record<FontFamily, string>> = {
  'inter':          'https://fonts.googleapis.com/css2?family=Inter:wght@300..700&display=swap',
  'dm-sans':        'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300..700&display=swap',
  'lora':           'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&display=swap',
  'jetbrains-mono': 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300..700&display=swap',
};

// ── localStorage Key ──────────────────────────────────────────────────────────

const STORAGE_KEY = 's3ttle-preferences';

// ── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULTS: UserPreferences = {
  theme:      'dark',   // Default to dark — bright white is jarring
  fontFamily: 'inter',  // Inter is clean and reads well at all sizes
  fontSize:   'default',
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get saved preferences from localStorage. Returns defaults if nothing is saved
 * or if the stored data is malformed.
 */
export function getPreferences(): UserPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULTS };
    const parsed = JSON.parse(stored);
    // Merge with defaults so newly added preference keys always have a value
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS };
  }
}

/**
 * Save preferences to localStorage.
 */
export function savePreferences(prefs: UserPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/**
 * Apply preferences to the DOM. Safe to call before React mounts.
 * - Sets/removes the 'dark' class on <html>
 * - Sets --font-scale and --font-family CSS custom properties on :root
 * - Injects a Google Fonts <link> for the selected font (once per font)
 */
export function applyPreferences(prefs: UserPreferences): void {
  const root = document.documentElement;

  // 1. Theme
  if (prefs.theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // 2. Font scale
  const scale = SIZE_OPTIONS.find((o) => o.id === prefs.fontSize)?.scale ?? 1;
  root.style.setProperty('--font-scale', String(scale));

  // 3. Font family
  root.style.setProperty('--font-family', FONT_FAMILIES[prefs.fontFamily]);

  // 4. Load Google Font on demand
  if (prefs.fontFamily !== 'system') {
    loadGoogleFont(prefs.fontFamily);
  }
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

/**
 * Inject a Google Fonts <link> tag if it hasn't been loaded yet.
 * Checks for an existing <link> with a matching href before injecting.
 */
function loadGoogleFont(font: FontFamily): void {
  const url = FONT_URLS[font];
  if (!url) return;

  // Don't inject if already present
  const exists = document.head.querySelector(`link[href="${url}"]`);
  if (exists) return;

  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);
}
