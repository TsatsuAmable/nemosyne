/**
 * Network Subsystem — Barrel Export
 */

export { NetworkManager } from './NetworkManager.ts';
export { Room } from './Room.ts';
export { SignallingChannel } from './SignallingChannel.ts';
export { BinaryPoseSerializer } from './BinaryPoseSerializer.ts';
export { SharedAnnotationManager } from './SharedAnnotationManager.ts';
export { createSignedTicket, verifySignedTicket, timingSafeEqualString } from './SignedTicket.ts';
export type { TokenClaims } from './SignedTicket.ts';
export {
  SignedTicketVerifier,
  CryptoCapabilityError,
  timingSafeEqual,
  timingSafeEqualBytes,
  type SignedRoomTicket,
  type TicketVerificationResult,
  type TicketErrorKind,
} from './SignedTicketVerifier.ts';
export { PeerAvatarManager } from './PeerAvatarManager.ts';
export { CollaborativeStateSync } from './CollaborativeStateSync.ts';
export { ConnectorAuthManager } from './ConnectorAuth.ts';
export type { ConnectorCredential, ConnectorPermissionScope } from './ConnectorAuth.ts';
