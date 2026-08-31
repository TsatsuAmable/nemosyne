import type {
  SemanticDatumInspectionResultV1,
  SemanticDetailTransition,
  SemanticDetailTransitionSnapshot,
} from './SemanticDetailTransition.ts';

export interface SemanticDatumInspectorHandle {
  readonly element: HTMLElement;
  dispose(): void;
}

function isReady(snapshot: SemanticDetailTransitionSnapshot): boolean {
  return snapshot.status === 'READY' && snapshot.observationIds.length > 0;
}

function valueText(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function appendRow(container: HTMLElement, label: string, value: string, monospace = false): void {
  const row = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:minmax(88px,0.8fr) minmax(0,1.5fr);gap:var(--nms-spacing-x8);align-items:start;';

  const key = document.createElement('span');
  key.textContent = label;
  key.style.cssText = 'color:var(--nms-color-text-secondary);font-size:var(--nms-font-size-meta);';

  const content = document.createElement('span');
  content.textContent = value;
  content.style.cssText =
    'overflow-wrap:anywhere;font-size:var(--nms-font-size-meta);color:var(--nms-color-text-primary);' +
    (monospace ? 'font-family:monospace;' : '');

  row.append(key, content);
  container.appendChild(row);
}

/**
 * Contextual desktop A4 inspector. It consumes only bounded observation IDs
 * from SemanticDetailTransition and asks that same authority owner for one
 * exact datum on demand. It never reads source rows or owns analytical state.
 */
export function mountSemanticDatumInspector(
  transition: SemanticDetailTransition,
  root: HTMLElement = document.body,
): SemanticDatumInspectorHandle {
  const panel = document.createElement('aside');
  panel.id = 'semantic-datum-inspector';
  panel.setAttribute('aria-label', 'Exact datum and provenance inspector');
  panel.style.cssText = `
    position: fixed;
    top: calc(var(--nms-spacing-x16) + 56px);
    right: var(--nms-spacing-x16);
    z-index: 33;
    width: min(360px, calc(100vw - 32px));
    max-height: calc(100vh - 112px);
    overflow: auto;
    padding: var(--nms-spacing-x16);
    border: 1px solid var(--nms-color-surface-border);
    border-radius: var(--nms-panel-border-radius);
    background: var(--nms-color-surface-base);
    color: var(--nms-color-text-primary);
    box-shadow: var(--nms-shadow-panel);
    pointer-events: auto;
  `;

  const title = document.createElement('h2');
  title.textContent = 'Exact datum';
  title.style.cssText = 'margin:0 0 var(--nms-spacing-x4);font-size:var(--nms-font-size-label);font-weight:650;';

  const context = document.createElement('p');
  context.style.cssText = 'margin:0 0 var(--nms-spacing-x12);color:var(--nms-color-text-secondary);font-size:var(--nms-font-size-meta);';

  const selectorLabel = document.createElement('label');
  selectorLabel.htmlFor = 'semantic-datum-observation-select';
  selectorLabel.textContent = 'Observation';
  selectorLabel.style.cssText = 'display:block;margin-bottom:var(--nms-spacing-x4);font-size:var(--nms-font-size-meta);color:var(--nms-color-text-secondary);';

  const selector = document.createElement('select');
  selector.id = 'semantic-datum-observation-select';
  selector.style.cssText = `
    width:100%;
    min-height:36px;
    padding:var(--nms-spacing-x8);
    border:1px solid var(--nms-color-surface-border);
    border-radius:var(--nms-control-border-radius);
    background:var(--nms-color-surface-raised);
    color:var(--nms-color-text-primary);
    font:inherit;
  `;

  const inspect = document.createElement('nms-button');
  inspect.id = 'semantic-datum-inspect';
  inspect.textContent = 'Inspect exact datum';
  inspect.setAttribute('variant', 'secondary');
  inspect.setAttribute('size', 'sm');
  inspect.style.cssText = 'width:100%;margin-top:var(--nms-spacing-x8);';

  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.style.cssText = 'margin:var(--nms-spacing-x12) 0 0;font-size:var(--nms-font-size-meta);color:var(--nms-color-text-secondary);';

  const fieldsHeading = document.createElement('h3');
  fieldsHeading.textContent = 'Values';
  fieldsHeading.style.cssText = 'margin:var(--nms-spacing-x16) 0 var(--nms-spacing-x8);font-size:var(--nms-font-size-meta);letter-spacing:.08em;text-transform:uppercase;color:var(--nms-color-interaction-focus);';

  const fields = document.createElement('div');
  fields.id = 'semantic-datum-fields';
  fields.style.cssText = 'display:grid;gap:var(--nms-spacing-x6);';

  const provenanceHeading = document.createElement('h3');
  provenanceHeading.textContent = 'Lineage';
  provenanceHeading.style.cssText = fieldsHeading.style.cssText;

  const provenance = document.createElement('div');
  provenance.id = 'semantic-datum-lineage';
  provenance.style.cssText = 'display:grid;gap:var(--nms-spacing-x6);';

  panel.append(
    title,
    context,
    selectorLabel,
    selector,
    inspect,
    status,
    fieldsHeading,
    fields,
    provenanceHeading,
    provenance,
  );
  root.appendChild(panel);

  let disposed = false;
  let inspectionToken = 0;

  const clearInspection = (): void => {
    inspectionToken += 1;
    fields.replaceChildren();
    provenance.replaceChildren();
    status.textContent = '';
  };

  const renderInspection = (result: SemanticDatumInspectionResultV1): void => {
    fields.replaceChildren();
    provenance.replaceChildren();
    if (result.status === 'REFUSED') {
      status.textContent = `Exact datum unavailable: ${result.reason}`;
      status.style.color = 'var(--nms-color-epistemic-contradiction)';
      return;
    }

    status.textContent = `Exact datum ready · ${result.observationId}`;
    status.style.color = 'var(--nms-color-interaction-commit)';
    for (const key of Object.keys(result.fields).sort()) {
      appendRow(fields, key, valueText(result.fields[key]));
    }

    appendRow(provenance, 'Observation', result.lineage.observationId, true);
    appendRow(provenance, 'Semantic target', result.lineage.semanticObjectId, true);
    appendRow(provenance, 'Decision', result.lineage.decisionId, true);
    appendRow(provenance, 'Dataset', result.lineage.datasetFingerprint, true);
    appendRow(provenance, 'Family', result.lineage.representationFamily);
    appendRow(provenance, 'Kernel', result.lineage.kernelVersion);
    appendRow(provenance, 'Algorithm', result.lineage.algorithmVersion);
    if (result.lineage.decisionModelVersion) {
      appendRow(provenance, 'Model', result.lineage.decisionModelVersion);
    }
    if (result.lineage.decisionModelArtifactHash) {
      appendRow(provenance, 'Model artifact', result.lineage.decisionModelArtifactHash, true);
    }
    if (result.sourceProvenance.status === 'AVAILABLE') {
      appendRow(provenance, 'Source provenance', valueText(result.sourceProvenance.value));
    } else {
      appendRow(provenance, 'Source provenance', `Unavailable · ${result.sourceProvenance.reason}`);
    }
  };

  const refresh = (snapshot: SemanticDetailTransitionSnapshot): void => {
    if (disposed) return;
    const ready = isReady(snapshot);
    panel.hidden = !ready;
    panel.setAttribute('aria-hidden', ready ? 'false' : 'true');
    if (!ready) {
      selector.replaceChildren();
      context.textContent = '';
      clearInspection();
      return;
    }

    const previous = selector.value;
    selector.replaceChildren(
      ...snapshot.observationIds.map((observationId) => {
        const option = document.createElement('option');
        option.value = observationId;
        option.textContent = observationId;
        return option;
      }),
    );
    if (snapshot.observationIds.includes(previous)) selector.value = previous;
    context.textContent = `${snapshot.returnedCount} of ${snapshot.totalMemberCount} observations · ${snapshot.parent?.semanticId ?? 'semantic structure'}`;
    clearInspection();
  };

  const onInspect = async (): Promise<void> => {
    const observationId = selector.value;
    if (!observationId) return;
    const token = ++inspectionToken;
    status.textContent = `Inspecting ${observationId}…`;
    status.style.color = 'var(--nms-color-text-secondary)';
    const result = await transition.inspectObservation(observationId);
    if (disposed || token !== inspectionToken || selector.value !== observationId) return;
    renderInspection(result);
  };

  const onClick = (): void => {
    void onInspect();
  };
  selector.addEventListener('change', clearInspection);
  inspect.addEventListener('click', onClick);
  const unsubscribe = transition.subscribe(refresh);

  return {
    element: panel,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      inspectionToken += 1;
      unsubscribe();
      selector.removeEventListener('change', clearInspection);
      inspect.removeEventListener('click', onClick);
      panel.remove();
    },
  };
}
