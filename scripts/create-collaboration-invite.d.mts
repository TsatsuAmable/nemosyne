export const DEFAULT_COLLABORATION_INVITE_TTL_MS: number;
export const MAX_COLLABORATION_INVITE_TTL_MS: number;

export interface CollaborationInviteIssueOptions {
  baseUrl: string;
  room: string;
  ttlMs?: number;
  now?: number;
}

export function buildCollaborationInviteUrl(
  options: CollaborationInviteIssueOptions,
  secret: string,
): string;

export function createInviteFromCli(
  args?: string[],
  env?: Readonly<Record<string, string | undefined>>,
): string;
