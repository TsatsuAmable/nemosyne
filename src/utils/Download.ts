/**
 * Browser download helpers for screenshots and JSON exports.
 *
 * These create a temporary anchor element with a download attribute, trigger a
 * click, and then remove the anchor. They work in both desktop and VR browsers
 * as long as the action is initiated by a user gesture.
 */

/**
 * Trigger a download of a data URL (e.g., a canvas PNG).
 */
export function downloadDataUrl(dataUrl: string, filename: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') {
      reject(new Error('downloadDataUrl requires a DOM environment'));
      return;
    }

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);

    try {
      link.click();
      resolve();
    } catch (err) {
      reject(err);
    } finally {
      document.body.removeChild(link);
    }
  });
}

/**
 * Trigger a download of a text blob.
 */
export function downloadText(text: string, filename: string, mime = 'application/json'): Promise<void> {
  if (typeof Blob === 'undefined' || typeof URL === 'undefined') {
    return Promise.reject(new Error('downloadText requires Blob and URL APIs'));
  }

  const blob = new Blob([text], { type: mime });
  const dataUrl = URL.createObjectURL(blob);

  return downloadDataUrl(dataUrl, filename).finally(() => {
    URL.revokeObjectURL(dataUrl);
  });
}
