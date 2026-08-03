/**
 * Bridges controller button/gesture inputs to the same gesture vocabulary used
 * by hand tracking. Keeps the concrete mapper outside of `InputRouter` so the
 * router does not need to know gesture-recognition internals.
 */
export class ControllerGestureBridge {
  constructor() {
    this.mapper = null;
  }

  setMapper(mapper) {
    this.mapper = mapper;
  }

  /**
   * Tick the mapper with the current controllers and XR session.
   */
  update(controllers, session, time) {
    if (this.mapper && session) {
      this.mapper.update(controllers, session, time);
    }
  }
}
