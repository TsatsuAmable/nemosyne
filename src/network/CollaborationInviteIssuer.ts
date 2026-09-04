/**
 * SERVER-ONLY private-preview collaboration invite issuer.
 *
 * The browser consumes only the opaque signed ticket. HMAC material remains on
 * the operator/server side and is never embedded in the production bundle.
 */
import { createSignedTicket } from './SignedTicket.ts';
import {
  COLLABORATION_INVITE_ROOM_FRAGMENT_KEY,
  COLLABORATION_INVITE_TICKET_FRAGMENT_KEY,
  isValidCollaborationRoom,
} from './CollaborationInvite.ts';

export const DEFAULT_COLLABORATION_INVITE_TTL_MS = 15 * 60 * 1000;
export const MAX_COLLABORATION_INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export interface CollaborationInviteIssueOptions {
  baseUrl: string;
  room: string;
  ttlMs?: number;
  now?: number;
}

export function buildCollaborationInviteUrl(
  { baseUrl, room, ttlMs = DEFAULT_COLLABORATION_INVITE_TTL_MS, now = Date.now() }:
    CollaborationInviteIssueOptions,
  secret: string
): string {
  if (!secret) throw new Error('collaboration invite secret is required');
  if (!isValidCollaborationRoom(room)) {
    throw new Error('collaboration invite room must use the canonical room-id alphabet');
  }
  if (!Number.isFinite(ttlMs) || ttlMs <= 0 || ttlMs > MAX_COLLABORATION_INVITE_TTL_MS) {
    throw new Error('collaboration invite TTL must be greater than zero and no more than 24 hours');
  }

  const url = new URL(baseUrl);
  if (url.protocol !== 'https:') {
    throw new Error('collaboration invite base URL must use https');
  }
  if (url.username || url.password) {
    throw new Error('collaboration invite base URL must not contain credentials');
  }
  if (url.hash) {
    throw new Error('collaboration invite base URL must not contain a fragment');
  }

  const ticket = createSignedTicket(
    {
      room,
      role: 'participant',
      issuedAt: now,
      exp: now + ttlMs,
    },
    secret
  );
  const fragment = new URLSearchParams();
  fragment.set(COLLABORATION_INVITE_TICKET_FRAGMENT_KEY, ticket);
  fragment.set(COLLABORATION_INVITE_ROOM_FRAGMENT_KEY, room);
  url.hash = fragment.toString();
  return url.toString();
}
