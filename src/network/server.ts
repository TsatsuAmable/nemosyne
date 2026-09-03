/**
 * SERVER-ONLY network authority barrel.
 *
 * This module is intentionally excluded from browser-reachable source graphs by
 * the repository architecture policy. It may depend on Node runtime modules.
 */

export {
  createSignedTicket,
  verifySignedTicket,
  timingSafeEqualString,
  SignedTicketReplayGuard,
  SIGNED_TICKET_VERSION,
  TICKET_ROLES,
} from './SignedTicket.ts';
export type {
  TicketClaims,
  TicketRole,
  TicketVerificationResult,
  TicketErrorKind,
} from './SignedTicket.ts';
export {
  createRoomRegistry,
  WS_MAX_PAYLOAD_BYTES,
} from './SignallingServerCore.ts';
export type { SignallingSocket } from './SignallingServerCore.ts';
