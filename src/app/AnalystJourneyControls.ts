import type { World } from '../vr/World.ts';

export interface AnalystJourneyControlsHandle {
  dispose(): void;
}

function downloadPackage(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function mountAnalystJourneyControls(world: World): AnalystJourneyControlsHandle {
  const root = document.createElement('section');
  root.id = 'analyst-journey-controls';
  root.setAttribute('aria-label', 'Analyst journey controls');

  const title = document.createElement('h2');
  title.textContent = 'ANALYST JOURNEY';
  root.append(title);

  const status = document.createElement('p');
  status.id = 'analyst-journey-status';
  status.setAttribute('role', 'status');
  status.textContent = 'Ready';
  root.append(status);

  const button = (id: string, label: string, action: () => void | Promise<void>) => {
    const element = document.createElement('button');
    element.id = id;
    element.type = 'button';
    element.textContent = label;
    element.addEventListener('click', () => {
      Promise.resolve(action()).catch((error: unknown) => {
        status.textContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
      });
    });
    root.append(element);
  };

  button('analyst-load-sample', 'Load sample', () => {
    world._cycleDataset(1);
    status.textContent = `Loaded ${world.currentEntry?.name ?? 'sample dataset'}`;
  });
  button('analyst-run-analysis', 'Run analysis', () => {
    world.dataOperationController.apply('anomaly');
    status.textContent = `Evidence ready (${world.atlas.results.length} result)`;
  });
  button('analyst-mark-moment', 'Record observation', () => {
    const observation = world.markMoment('Recorded from desktop analyst controls');
    status.textContent = `Observation recorded: ${observation.id}`;
  });
  button('analyst-export-package', 'Export investigation', async () => {
    const bytes = await world.session.exportPortablePackage({
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      webxrSupported: 'xr' in navigator,
    });
    downloadPackage(bytes, 'nemosyne-investigation.nemosyne');
    status.textContent = `Investigation exported (${bytes.byteLength} bytes)`;
  });

  document.body.append(root);
  return { dispose: () => root.remove() };
}
