/**
 * profile.ts — Persistent user profile stored in the browser's localStorage.
 *
 * WHAT THIS DOES:
 * On first visit, the app asks for your display name and lets you pick an
 * emoji avatar. This info is saved to localStorage so you never have to
 * enter it again (unless you clear browser data).
 *
 * WHY LOCALSTORAGE?
 * localStorage is a browser API that stores key-value pairs persistently —
 * the data survives page refreshes, browser restarts, and even device reboots.
 * It's scoped to the domain, so each device/browser gets its own profile.
 * This is perfect for M1: zero-friction identity without a database.
 *
 * THE DEVICE ID:
 * We also generate a random "device ID" (UUID) that uniquely identifies this
 * browser. This lets the backend tell apart two devices even if they have
 * the same display name. In M2, the device ID gets replaced by a real
 * Supabase Auth user ID.
 *
 * UPGRADE PATH (M2):
 * When we add Supabase Auth + passkeys, the display name migrates to the
 * user's auth profile. The localStorage profile becomes a cache/fallback.
 */

// ── Type Definition ──────────────────────────────────────────────────────────

export interface UserProfile {
  displayName: string;   // e.g. "Rich" or "Sarah"
  avatar: string;        // An emoji like "😎" or "🌸"
  deviceId: string;      // Random UUID, generated once per browser
}

// ── localStorage Key ──────────────────────────────────────────────────────────
// All profile data is stored under this single key as a JSON string.
const STORAGE_KEY = 's3ttle-profile';

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get the saved profile from localStorage.
 * Returns null if the user hasn't set up their profile yet (first visit).
 */
export function getProfile(): UserProfile | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    // Validate that all required fields exist
    if (parsed.displayName && parsed.avatar && parsed.deviceId) {
      return parsed as UserProfile;
    }
    return null;
  } catch {
    // If localStorage is corrupted or JSON parsing fails, treat as no profile
    return null;
  }
}

/**
 * Save a new profile to localStorage.
 * Generates a device ID automatically if this is a new profile.
 *
 * @param displayName - The user's chosen name
 * @param avatar      - The user's chosen emoji avatar
 * @returns The complete profile (including generated deviceId)
 */
export function saveProfile(displayName: string, avatar: string): UserProfile {
  // Reuse existing deviceId if updating, or generate a new one
  const existing = getProfile();
  const deviceId = existing?.deviceId ?? generateDeviceId();

  const profile: UserProfile = { displayName, avatar, deviceId };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

/**
 * Clear the saved profile. Used if the user wants to "reset" their identity.
 * Mostly useful for testing during development.
 */
export function clearProfile(): void {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Internal Helpers ──────────────────────────────────────────────────────────

/**
 * Generate a random device ID (UUID v4 format).
 * Uses crypto.randomUUID() which is available in all modern browsers.
 * Falls back to a timestamp-based ID if somehow unavailable.
 */
function generateDeviceId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: not truly a UUID but unique enough for our purposes
  return `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
