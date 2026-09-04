/**
 * Network Subsystem — browser-safe production barrel export.
 *
 * Server-only signalling admission authority lives in `./server.ts`. Legacy
 * collaboration state/annotation prototypes stay direct-import test fixtures
 * rather than appearing as production authorities.
 */

export { NetworkManager } from './NetworkManager.ts';
export { Room } from './Room.ts';
export { SignallingChannel } from './SignallingChannel.ts';
export { BinaryPoseSerializer } from './BinaryPoseSerializer.ts';
export { PeerAvatarManager } from './PeerAvatarManager.ts';
