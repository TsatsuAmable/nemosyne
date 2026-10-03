/**
 * Network Subsystem — browser-safe production barrel export.
 *
 * Server-only signalling admission authority lives in `./server.ts`. The
 * superseded legacy collaboration synchronizer and network-barrel annotation
 * prototypes were deleted (CMS-4); the live VR interaction annotation
 * authority lives in `src/vr/interactions/SharedAnnotationManager.ts`.
 */

export { NetworkManager } from './NetworkManager.ts';
export { Room } from './Room.ts';
export { SignallingChannel } from './SignallingChannel.ts';
export { BinaryPoseSerializer } from './BinaryPoseSerializer.ts';
export { PeerAvatarManager } from './PeerAvatarManager.ts';
