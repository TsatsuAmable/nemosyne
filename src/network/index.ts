/**
 * Network Subsystem — Barrel Export
 */

export { NetworkManager } from './NetworkManager.ts';
export { Room } from './Room.ts';
export { SignallingChannel } from './SignallingChannel.ts';
export { BinaryPoseSerializer } from './BinaryPoseSerializer.ts';
export { SharedAnnotationManager } from './SharedAnnotationManager.ts';
export { createSignedTicket, verifySignedTicket, timingSafeEqualString, SignedTicketReplayGuard } from './SignedTicket.ts';
export { SIGNED_TICKET_VERSION, TICKET_ROLES } from './SignedTicket.ts';
export type {
  TicketClaims,
  TicketRole,
  TicketVerificationResult,
  TicketErrorKind,
} from './SignedTicket.ts';
export { PeerAvatarManager } from './PeerAvatarManager.ts';
export { CollaborativeStateSync } from './CollaborativeStateSync.ts';
export { ConnectorAuthManager } from './ConnectorAuth.ts';
export type { ConnectorCredential, ConnectorPermissionScope } from './ConnectorAuth.ts';
