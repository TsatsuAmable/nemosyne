import { describe, expect, it } from 'vitest';
import {
  COLLABORATION_INVITE_ROOM_FRAGMENT_KEY,
  COLLABORATION_INVITE_TICKET_FRAGMENT_KEY,
  COLLABORATION_ROOM_STORAGE_KEY,
  COLLABORATION_TOKEN_STORAGE_KEY,
  consumeCollaborationInvite,
  readStoredCollaborationRoom,
  type CollaborationStorageLike,
} from '../src/network/CollaborationInvite.ts';
import { buildCollaborationInviteUrl } from '../scripts/create-collaboration-invite.mjs';
import { verifySignedTicket } from '../src/network/SignedTicket.ts';

class MemoryStorage implements CollaborationStorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('P1-W1 signed collaboration invites', () => {
  it('issues a room-scoped one-use ticket in the URL fragment, not the request URL', () => {
    const now = 1_788_544_000_000;
    const secret = 'preview-signalling-secret';
    const invite = buildCollaborationInviteUrl(
      {
        baseUrl: 'https://nemosyne.world/?mode=preview',
        room: 'team-a',
        ttlMs: 10 * 60 * 1000,
        now,
      },
      secret
    );
    const url = new URL(invite);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const ticket = fragment.get(COLLABORATION_INVITE_TICKET_FRAGMENT_KEY);

    expect(url.protocol).toBe('https:');
    expect(url.searchParams.get('mode')).toBe('preview');
    expect(url.searchParams.has(COLLABORATION_INVITE_TICKET_FRAGMENT_KEY)).toBe(false);
    expect(fragment.get(COLLABORATION_INVITE_ROOM_FRAGMENT_KEY)).toBe('team-a');
    expect(ticket).toMatch(/^[A-Za-z0-9_-]+\.[0-9a-f]{64}$/u);
    expect(verifySignedTicket(ticket ?? '', secret, 'team-a', now)).toMatchObject({
      valid: true,
      claims: { room: 'team-a', role: 'participant' },
    });
  });

  it('strips the fragment immediately and stages only the scoped room and ticket in session storage', () => {
    const storage = new MemoryStorage();
    const invite = buildCollaborationInviteUrl(
      { baseUrl: 'https://nemosyne.world/', room: 'lab-1', now: 1_788_544_000_000 },
      'preview-signalling-secret'
    );
    let replacedUrl = '';

    const result = consumeCollaborationInvite(invite, storage, (url) => {
      replacedUrl = url;
    });

    expect(result).toEqual({ consumed: true, room: 'lab-1' });
    expect(storage.getItem(COLLABORATION_TOKEN_STORAGE_KEY)).toMatch(/\./u);
    expect(storage.getItem(COLLABORATION_ROOM_STORAGE_KEY)).toBe('lab-1');
    expect(readStoredCollaborationRoom(storage)).toBe('lab-1');
    expect(new URL(replacedUrl).hash).toBe('');
  });

  it('removes a malformed replacement invite and clears any stale ephemeral credential', () => {
    const storage = new MemoryStorage();
    storage.setItem(COLLABORATION_TOKEN_STORAGE_KEY, 'old.ticket');
    storage.setItem(COLLABORATION_ROOM_STORAGE_KEY, 'old-room');
    let replacedUrl = '';

    const result = consumeCollaborationInvite(
      'https://nemosyne.world/#nemosyne-collab-ticket=not-a-ticket&nemosyne-collab-room=../bad',
      storage,
      (url) => {
        replacedUrl = url;
      }
    );

    expect(result.consumed).toBe(false);
    expect(result.error).toBe('invalid-room');
    expect(storage.getItem(COLLABORATION_TOKEN_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(COLLABORATION_ROOM_STORAGE_KEY)).toBeNull();
    expect(new URL(replacedUrl).hash).toBe('');
  });

  it('refuses insecure invite origins and excessive ticket lifetimes', () => {
    expect(() =>
      buildCollaborationInviteUrl(
        { baseUrl: 'http://nemosyne.world/', room: 'lab-1' },
        'preview-signalling-secret'
      )
    ).toThrow(/must use https/u);
    expect(() =>
      buildCollaborationInviteUrl(
        { baseUrl: 'https://nemosyne.world/', room: 'lab-1', ttlMs: 25 * 60 * 60 * 1000 },
        'preview-signalling-secret'
      )
    ).toThrow(/no more than 24 hours/u);
  });
});
