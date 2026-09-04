const ROOM_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;
const SIGNED_TICKET_RE = /^[A-Za-z0-9_-]+\.[0-9a-fA-F]{64}$/;
const MAX_TICKET_CHARS = 4096;

export const COLLABORATION_INVITE_TICKET_FRAGMENT_KEY = 'nemosyne-collab-ticket';
export const COLLABORATION_INVITE_ROOM_FRAGMENT_KEY = 'nemosyne-collab-room';
export const COLLABORATION_TOKEN_STORAGE_KEY = 'nemosyne.collabToken';
export const COLLABORATION_ROOM_STORAGE_KEY = 'nemosyne.collabRoom';

export interface CollaborationStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface CollaborationInviteConsumptionResult {
  consumed: boolean;
  room?: string;
  error?: 'invalid-room' | 'invalid-ticket' | 'incomplete-invite' | 'storage-unavailable';
}

export function isValidCollaborationRoom(room: string): boolean {
  return ROOM_ID_RE.test(room);
}

export function isCanonicalSignedCollaborationTicket(ticket: string): boolean {
  return ticket.length <= MAX_TICKET_CHARS && SIGNED_TICKET_RE.test(ticket);
}

function fragmentParams(url: URL): URLSearchParams {
  return new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
}

/**
 * Consume a private-preview collaboration invite from the URL fragment.
 *
 * Fragments are not sent in HTTP requests, so the one-use signed ticket stays
 * out of origin/proxy access logs. The fragment is stripped before validation
 * and the credential is kept only in session storage for the imminent join.
 * A present-but-invalid invite clears any older ephemeral credential so a stale
 * ticket cannot be used accidentally when the investigator intended a new one.
 */
export function consumeCollaborationInvite(
  urlText: string,
  storage: CollaborationStorageLike,
  replaceUrl: (url: string) => void
): CollaborationInviteConsumptionResult {
  const url = new URL(urlText);
  const params = fragmentParams(url);
  const hasTicket = params.has(COLLABORATION_INVITE_TICKET_FRAGMENT_KEY);
  const hasRoom = params.has(COLLABORATION_INVITE_ROOM_FRAGMENT_KEY);
  if (!hasTicket && !hasRoom) return { consumed: false };

  const ticket = params.get(COLLABORATION_INVITE_TICKET_FRAGMENT_KEY) ?? '';
  const room = params.get(COLLABORATION_INVITE_ROOM_FRAGMENT_KEY) ?? '';

  params.delete(COLLABORATION_INVITE_TICKET_FRAGMENT_KEY);
  params.delete(COLLABORATION_INVITE_ROOM_FRAGMENT_KEY);
  url.hash = params.toString();
  replaceUrl(url.toString());

  try {
    storage.removeItem(COLLABORATION_TOKEN_STORAGE_KEY);
    storage.removeItem(COLLABORATION_ROOM_STORAGE_KEY);
  } catch {
    return { consumed: false, error: 'storage-unavailable' };
  }

  if (!hasTicket || !hasRoom) return { consumed: false, error: 'incomplete-invite' };
  if (!isValidCollaborationRoom(room)) return { consumed: false, error: 'invalid-room' };
  if (!isCanonicalSignedCollaborationTicket(ticket)) {
    return { consumed: false, error: 'invalid-ticket' };
  }

  try {
    storage.setItem(COLLABORATION_TOKEN_STORAGE_KEY, ticket);
    storage.setItem(COLLABORATION_ROOM_STORAGE_KEY, room);
  } catch {
    try {
      storage.removeItem(COLLABORATION_TOKEN_STORAGE_KEY);
      storage.removeItem(COLLABORATION_ROOM_STORAGE_KEY);
    } catch {
      // The storage boundary is already unavailable; nothing further is safe to assume.
    }
    return { consumed: false, error: 'storage-unavailable' };
  }
  return { consumed: true, room };
}

/** Return the invite-scoped room while its one-use credential is pending. */
export function readStoredCollaborationRoom(
  storage?: CollaborationStorageLike
): string | undefined {
  try {
    const resolvedStorage =
      storage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
    const room = resolvedStorage?.getItem(COLLABORATION_ROOM_STORAGE_KEY) ?? '';
    return isValidCollaborationRoom(room) ? room : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Clear the ephemeral invite only after the exact signed ticket has been
 * admitted. Failed admission deliberately leaves it available for one explicit
 * retry instead of silently destroying an unconsumed credential.
 */
export function clearStoredCollaborationInviteCredential(
  admittedTicket: string,
  storage?: CollaborationStorageLike
): void {
  try {
    const resolvedStorage =
      storage ?? (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined);
    if (!resolvedStorage) return;
    if (resolvedStorage.getItem(COLLABORATION_TOKEN_STORAGE_KEY) !== admittedTicket) return;
    resolvedStorage.removeItem(COLLABORATION_TOKEN_STORAGE_KEY);
    resolvedStorage.removeItem(COLLABORATION_ROOM_STORAGE_KEY);
  } catch {
    // Credential cleanup is best effort; the server-side one-use nonce remains authoritative.
  }
}
