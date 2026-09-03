/**
 * Network Subsystem — browser-safe barrel export.
 *
 * Server-only signalling admission authority lives in `./server.ts`. Keeping it
 * out of this barrel prevents Node `crypto` from becoming reachable from a
 * browser bundle through an otherwise-innocent network import.
 */

export { NetworkManager } from './NetworkManager.ts';
export { Room } from './Room.ts';
export { SignallingChannel } from './SignallingChannel.ts';
export { BinaryPoseSerializer } from './BinaryPoseSerializer.ts';
export { SharedAnnotationManager } from './SharedAnnotationManager.ts';
export { PeerAvatarManager } from './PeerAvatarManager.ts';
export { CollaborativeStateSync } from './CollaborativeStateSync.ts';
