/**
 * Bridges controller button/gesture inputs to the same gesture vocabulary used
 * by hand tracking. Keeps the concrete mapper outside of `InputRouter` so the
 * router does not need to know gesture-recognition internals.
 */

import type { ControllerGestureMapperLike, PointerLike } from '../coordinators/types.ts';

export class ControllerGestureBridge {
  mapper: ControllerGestureMapperLike | null = null;

  setMapper(mapper: ControllerGestureMapperLike | null) {
    this.mapper = mapper;
  }

  /**
   * Tick the mapper with the current controllers and XR session.
   */
  update(controllers: unknown, session: XRSession | null, time: number) {
    if (this.mapper && session) {
      this.mapper.update(controllers as PointerLike[], session, time);
    }
  }
}
