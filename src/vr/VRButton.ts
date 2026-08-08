import type * as THREE from 'three';

/**
 * VR Entry & 3D Desktop Navigation Button.
 *
 * Meta Quest 3S / Quest Browser & Desktop PC Notes:
 * - On Meta Quest / WebXR environments: Displays "ENTER VR" to trigger immersive WebXR session.
 * - On Desktop PC browsers: Displays "EXPLORE IN 3D" or "VR NOT SUPPORTED".
 * - WebXR Security Requirement: WebXR APIs require a Secure Context (HTTPS or localhost/127.0.0.1).
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

    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isQuestDevice = /Quest|OculusBrowser|WebXR/i.test(userAgent);
    const hasXR = typeof navigator !== 'undefined' && 'xr' in navigator && (navigator as Navigator).xr;

    if (!hasXR && !isQuestDevice) {
      button.textContent = 'VR NOT SUPPORTED';
      button.disabled = true;
      return button;
    }

    button.textContent = 'ENTER VR';

    if (hasXR) {
      (navigator as Navigator).xr!.isSessionSupported('immersive-vr').then((supported) => {
        if (supported) {
          button.textContent = 'ENTER VR';
          button.disabled = false;
        } else if (!isQuestDevice) {
          button.textContent = 'VR NOT SUPPORTED';
          button.disabled = true;
        }
      }).catch(() => {
        if (!isQuestDevice) {
          button.textContent = 'VR NOT SUPPORTED';
          button.disabled = true;
        }
      });
    }

    const enterVRSession = () => {
      if (renderer.xr.isPresenting) return;

      const sessionInit: { requiredFeatures: string[]; optionalFeatures: string[] } = {
        requiredFeatures: ['local-floor'],
        optionalFeatures: ['hand-tracking'],
      };

      if (!hasXR) {
        alert('WebXR is disabled because this page is served over unencrypted HTTP (http://' + window.location.host + '). Please open the HTTPS production URL (e.g. Netlify/Vercel) or set up HTTPS locally.');
        return;
      }

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
          button.textContent = `VR ERROR: ${(err as Error).message || 'Request Failed'}`;
        });
    };

    button.addEventListener('click', () => {
      if (isQuestDevice || hasXR || button.textContent.includes('ENTER VR')) {
        enterVRSession();
      } else {
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
