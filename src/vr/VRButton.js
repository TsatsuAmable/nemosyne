/**
 * Minimal VR entry button for Meta Quest Browser / Chrome WebXR.
 *
 * Meta Quest 3S / Quest Browser notes:
 * - `local-floor` is required so the camera starts at floor height.
 * - `hand-tracking` must be requested as an optional feature or hand joints
 *   are not exposed.
 * - `XRInputSourceArray` is array-like and may lack Array.prototype methods.
 * - The WebGL context must be made XR-compatible and the XRWebGLLayer must be
 *   created *before* three.js binds to the session; otherwise the headset
 *   presents blank while the 2D preview works.
 * - `renderer.xr.setReferenceSpace()` is NOT a three.js API; three.js
 *   requests and caches the reference space internally.
 */
export class NemosyneVRButton {
  static createButton(renderer) {
    const button = document.createElement('button');
    button.id = 'nemosyne-vr-button';
    button.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 24px;
      font-family: 'Courier New', Courier, monospace;
      font-size: 16px;
      font-weight: bold;
      color: #00ffcc;
      background: rgba(4, 10, 20, 0.9);
      border: 2px solid #00ffcc;
      border-radius: 6px;
      cursor: pointer;
      z-index: 30;
      box-shadow: 0 0 12px rgba(0, 255, 204, 0.4);
    `;
    button.textContent = 'ENTER VR';

    if ('xr' in navigator === false) {
      button.textContent = 'VR NOT SUPPORTED';
      button.disabled = true;
      return button;
    }

    navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
      if (!supported) {
        button.textContent = 'VR NOT SUPPORTED';
        button.disabled = true;
      }
    });

    button.addEventListener('click', () => {
      if (renderer.xr.isPresenting) return;

      const sessionInit = {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking'],
      };

      navigator.xr
        .requestSession('immersive-vr', sessionInit)
        .then(async (session) => {
          try {
            // 1. Make the WebGL context explicitly compatible with XR.
            const gl = renderer.getContext();
            if (gl.makeXRCompatible) {
              await gl.makeXRCompatible();
            }

            // 2. Create the WebGL layer manually. Quest Browser / Chrome do not
            // reliably infer this from setSession() alone; doing it first is
            // the safest path.
            if (typeof XRWebGLLayer === 'undefined') {
              throw new Error('XRWebGLLayer is not supported by this browser');
            }
            const xrLayer = new XRWebGLLayer(session, gl);
            await session.updateRenderState({ baseLayer: xrLayer });

            // 3. Bind three.js to the session. three.js will request its own
            // reference space internally; do NOT call renderer.xr.setReferenceSpace().
            await renderer.xr.setSession(session);

            button.textContent = 'IN VR';
            console.log('[NemosyneVRButton] session active:', {
              mode: session.mode,
              baseLayer: session.renderState?.baseLayer?.constructor?.name ?? 'none',
              layers: session.renderState?.layers?.length ?? 0,
              isPresenting: renderer.xr.isPresenting,
            });

            session.addEventListener('end', () => {
              button.textContent = 'ENTER VR';
              console.log('[NemosyneVRButton] session ended');
            });
          } catch (setupErr) {
            console.error('[NemosyneVRButton] XR setup failed:', setupErr);
            button.textContent = `VR SETUP ERROR: ${setupErr.message}`;
          }
        })
        .catch((err) => {
          console.error('[NemosyneVRButton] session request failed:', err);
          button.textContent = 'VR ERROR';
        });
    });

    return button;
  }
}
