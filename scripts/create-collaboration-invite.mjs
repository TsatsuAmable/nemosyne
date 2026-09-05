import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  COLLABORATION_INVITE_ROOM_FRAGMENT_KEY,
  COLLABORATION_INVITE_TICKET_FRAGMENT_KEY,
  isValidCollaborationRoom,
} from '../src/network/CollaborationInvite.ts';
import { createSignedTicket } from '../src/network/server.ts';

export const DEFAULT_COLLABORATION_INVITE_TTL_MS = 15 * 60 * 1000;
export const MAX_COLLABORATION_INVITE_TTL_MS = 24 * 60 * 60 * 1000;

function optionValue(args, name) {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

/**
 * Build an operator-issued private-preview collaboration invite.
 *
 * The HMAC authority stays in this Node/operator boundary. Browser code only
 * receives the opaque, room-scoped one-use ticket in the URL fragment.
 */
export function buildCollaborationInviteUrl(
  { baseUrl, room, ttlMs = DEFAULT_COLLABORATION_INVITE_TTL_MS, now = Date.now() },
  secret,
) {
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
    secret,
  );
  const fragment = new URLSearchParams();
  fragment.set(COLLABORATION_INVITE_TICKET_FRAGMENT_KEY, ticket);
  fragment.set(COLLABORATION_INVITE_ROOM_FRAGMENT_KEY, room);
  url.hash = fragment.toString();
  return url.toString();
}

export function createInviteFromCli(args = process.argv.slice(2), env = process.env) {
  const baseUrl = optionValue(args, 'base-url') || env.NEMOSYNE_PUBLIC_URL || '';
  const room = optionValue(args, 'room') || '';
  const ttlSecondsText = optionValue(args, 'ttl-seconds');
  const ttlMs = ttlSecondsText === undefined ? undefined : Number(ttlSecondsText) * 1000;
  const secret = env.NEMOSYNE_SIGNAL_TOKEN || '';

  if (!baseUrl || !room || !secret) {
    throw new Error(
      'usage: NEMOSYNE_SIGNAL_TOKEN=... npm run collaboration:invite -- --base-url=https://nemosyne.world --room=<room> [--ttl-seconds=900]',
    );
  }

  return buildCollaborationInviteUrl({ baseUrl, room, ttlMs }, secret);
}

const invokedAsScript =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedAsScript) {
  try {
    process.stdout.write(`${createInviteFromCli()}\n`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
