import type * as THREE from 'three';

/**
 * VR Entry & 3D Desktop Navigation Button.
 *
 * Meta Quest 3S / Quest Browser & Desktop PC Notes:
 * - When in WebXR supported browser / Meta Quest: Displays "ENTER VR" to enter immersive WebXR.
 * - When in Desktop PC browser: Displays "EXPLORE IN 3D" and enables desktop orbit/drag camera controls.
 */
export class NemosyneVRButton {
  static createButton(renderer: THREE.WebGLRenderer): HTMLButtonElement {
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
      transition: all 0.2s ease;
    `;
    button.textContent = 'EXPLORE IN 3D';

    let isVRSupported = false;

    if ('xr' in navigator && (navigator as Navigator).xr) {
      (navigator as Navigator).xr!.isSessionSupported('immersive-vr').then((supported) => {
        if (supported) {
          isVRSupported = true;
          button.textContent = 'ENTER VR';
          button.style.borderColor = '#00ffcc';
          button.style.color = '#00ffcc';
        }
      });
    }

    button.addEventListener('click', () => {
      if (isVRSupported) {
        if (renderer.xr.isPresenting) return;

        const sessionInit: { requiredFeatures: string[]; optionalFeatures: string[] } = {
          requiredFeatures: ['local-floor'],
          optionalFeatures: ['hand-tracking'],
        };

        (navigator as Navigator)
          .xr!.requestSession('immersive-vr', sessionInit)
          .then(async (session) => {
            try {
              const gl = renderer.getContext();
              if (gl.makeXRCompatible) {
                await gl.makeXRCompatible();
              }

              if (typeof XRWebGLLayer === 'undefined') {
                throw new Error('XRWebGLLayer is not supported by this browser');
              }
              const xrLayer = new XRWebGLLayer(session, gl);
              await session.updateRenderState({ baseLayer: xrLayer });

              await renderer.xr.setSession(session);
              button.textContent = 'IN VR';

              session.addEventListener('end', () => {
                button.textContent = 'ENTER VR';
              });
            } catch (setupErr) {
              console.error('[NemosyneVRButton] XR setup failed:', setupErr);
              button.textContent = `VR SETUP ERROR: ${(setupErr as Error).message}`;
            }
          })
          .catch((err) => {
            console.error('[NemosyneVRButton] session request failed:', err);
            button.textContent = 'VR ERROR';
          });
      } else {
        // Desktop 3D Navigation Mode
        button.textContent = '3D MODE ACTIVE';
        button.style.background = 'rgba(0, 255, 204, 0.2)';
        setTimeout(() => {
          button.textContent = 'EXPLORE IN 3D';
          button.style.background = 'rgba(4, 10, 20, 0.9)';
        }, 1500);
      }
    });

    return button;
  }
}
