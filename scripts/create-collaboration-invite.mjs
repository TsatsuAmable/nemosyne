import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildCollaborationInviteUrl } from '../src/network/CollaborationInviteIssuer.ts';

function optionValue(args, name) {
  const prefix = `--${name}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
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
