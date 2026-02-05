/**
 * Identity-lite: persistent userId and displayName in localStorage.
 * Dedicated keys to avoid collisions: cv_userId, cv_displayName.
 */

const userIdKey = "cv_userId";
const nameKey = "cv_displayName";

const LEGACY_USER_ID = "userId";
const LEGACY_DISPLAY_NAME = "displayName";

function isUUID(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** One-time migration from old keys to cv_* keys. */
function migrateFromLegacyKeys(): void {
  if (typeof window === "undefined") return;

  const existingUserId = localStorage.getItem(userIdKey);
  const existingName = localStorage.getItem(nameKey);

  if (!existingUserId) {
    const legacyUserId = localStorage.getItem(LEGACY_USER_ID);
    if (legacyUserId != null && isUUID(legacyUserId)) {
      localStorage.setItem(userIdKey, legacyUserId);
    }
  }

  if (!existingName) {
    const legacyName = localStorage.getItem(LEGACY_DISPLAY_NAME);
    if (legacyName != null) {
      localStorage.setItem(nameKey, legacyName);
    }
  }
}

/**
 * Returns userId (UUID); creates and stores one if missing or invalid.
 * Invalid = not a UUID (e.g. corrupted displayName stored in wrong key).
 */
export function getOrCreateUserId(): string {
  if (typeof window === "undefined") return "demo-user";

  migrateFromLegacyKeys();

  let id = localStorage.getItem(userIdKey);
  if (!id || !isUUID(id)) {
    id = crypto.randomUUID();
    localStorage.setItem(userIdKey, id);
  }
  return id;
}

/** Returns displayName or null if not set. */
export function getDisplayName(): string | null {
  if (typeof window === "undefined") return null;

  migrateFromLegacyKeys();

  return localStorage.getItem(nameKey);
}

/** Saves displayName to localStorage. */
export function setDisplayName(name: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(nameKey, (name ?? "").trim());
}
