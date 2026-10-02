import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { strFromU8 } from 'fflate';
import { AtlasCore } from '../src/atlas/AtlasCore.ts';
import { NemosyneSession } from '../src/session/NemosyneSession.ts';
import { NemosynePackageManager } from '../src/session/NemosynePackage.ts';
import { composeGovernedEvidenceReceiptSnapshot } from '../src/atlas/MonetaEvidenceAuthority.ts';
import { parsePersistedEvidenceReceiptsV1 } from '../src/data/evidence/PersistedEvidenceReceipts.ts';
import { parseEvidenceReceiptBundleV1 } from '../src/data/evidence/EvidenceReceipt.ts';
import {
  DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
  parseGovernedConsumerAttestationV1,
} from '../src/data/evidence/GovernedConsumerAttestation.ts';
import { DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1 } from '../src/data/evidence/EvidenceRequirementProfile.ts';
import { sha256Hex } from '../src/security/CryptoHash.ts';
import { ColumnType, Dataset } from '../src/data/Dataset.ts';
import type {
  AnalyticalDatasetRegistration,
  AnalyticalExecutionPort,
  AnalyticalExecutionResult,
  GovernedEvidenceCaptureRequest,
  GovernedEvidenceCaptureV1,
} from '../src/atlas/ports/AnalyticalExecutionPort.ts';
import * as bridge from '../src/wasm/RuntimeBridge.ts';

/**
 * Issue #834 falsifiers: governed evidence is acquired from the analytical
 * execution authority that is injected right now, or the export refuses.
 *
 * Every refusal case here runs against a **live, capable** module-global
 * runtime: the dataset is loaded, the module-global producer returns real
 * bytes, and each test asserts that before expecting the refusal. That is what
 * makes these falsifying rather than decorative — with the pre-#834
 * module-global capture path restored in AtlasCore or the session, every
 * refusal below would instead succeed.
 */
describe('TEC1 governed evidence capture authority (issue #834)', () => {
  beforeAll(async () => {
    if (!bridge.isReady()) await bridge.initRuntime('/wasm/pkg/nemosyne_wasm_bg.wasm');
    if (!bridge.isReady()) {
      throw new Error(
        'RuntimeBridge failed to initialize WASM. Run npm run wasm:dev before this integration test.'
      );
    }
  });

  function fixtureDataset(name = 'tec1-834-authority'): Dataset {
    return new Dataset(
      name,
      [
        { name: 'x', type: ColumnType.NUMERIC },
        { name: 'y', type: ColumnType.NUMERIC },
      ],
      [{ x: 1, y: 2 }, { x: 2, y: 4 }, { x: null, y: 6 }]
    );
  }

  function liveSession(dataset: Dataset = fixtureDataset()): {
    atlas: AtlasCore;
    handle: number;
    session: NemosyneSession;
  } {
    const atlas = new AtlasCore({ kernel: bridge });
    atlas.loadDataset(dataset);
    const handle = atlas.aggregate.analytical.currentHandle;
    return { atlas, handle, session: new NemosyneSession({ atlas }) };
  }

  /** A port that exists but cannot attest governed evidence. */
  function incapablePort(): AnalyticalExecutionPort {
    return {
      isAsync: false,
      execute<T>(): Promise<AnalyticalExecutionResult<T>> {
        return Promise.resolve({
          requestId: 'unused',
          generation: 1,
          datasetVersion: 1,
          datasetFingerprint: '',
          value: null,
        });
      },
      supersede(): void {},
    };
  }

  /** A port whose governed-evidence readout is supplied by the test. */
  class StubCapturePort implements AnalyticalExecutionPort {
    readonly isAsync = false;
    readonly requests: GovernedEvidenceCaptureRequest[] = [];
    constructor(
      private readonly respond: (
        req: GovernedEvidenceCaptureRequest
      ) => Promise<GovernedEvidenceCaptureV1 | null>
    ) {}
    execute<T>(): Promise<AnalyticalExecutionResult<T>> {
      return Promise.resolve({
        requestId: 'unused',
        generation: 1,
        datasetVersion: 1,
        datasetFingerprint: '',
        value: null,
      });
    }
    supersede(): void {}
    captureGovernedEvidenceReceipt(
      req: GovernedEvidenceCaptureRequest
    ): Promise<GovernedEvidenceCaptureV1 | null> {
      this.requests.push(req);
      return this.respond(req);
    }
  }

  /**
   * A port that answers coherently for whatever it was asked (echoing the
   * requested generation/version) while asserting a caller-supplied identity
   * and payload. Only the fence — or the payload identity — can then explain a
   * refusal, which is exactly what these falsifiers need.
   */
  function echoingPort(readout: {
    datasetFingerprint: string;
    kernelVersion: string;
    rawBundle: unknown;
    governedConsumers: unknown;
  }): StubCapturePort {
    return new StubCapturePort((req) =>
      Promise.resolve({
        requestId: req.requestId,
        generation: req.generation,
        datasetVersion: req.dataset.version,
        ...readout,
      })
    );
  }

  /**
   * The kernel-issued governing-consumer attestation shape the kernel would mint
   * for the given bundle identity: one consumer claiming exactly the passed
   * receipt ids. The stub port supplies the readout, so the attestation is part
   * of what the port handed over; the kernel-minted form of the same shape is
   * pinned separately in the Worker-owned capture tests below.
   */
  function stubGovernedConsumers(
    fingerprint: string,
    kernelVersion: string,
    receiptIds: readonly string[]
  ): unknown {
    return {
      schemaVersion: '1',
      datasetFingerprint: fingerprint,
      kernelVersion,
      consumers: [
        { consumerId: DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1, receiptIds: [...receiptIds] },
      ],
    };
  }

  function committedEnvelope(bytes: Uint8Array) {
    return parsePersistedEvidenceReceiptsV1(JSON.parse(strFromU8(bytes)));
  }

  it('refuses governed acquisition when the installed port cannot attest capture', async () => {
    const { atlas, handle, session } = liveSession();
    try {
      // Positive control: the module-global runtime can mint evidence for this
      // exact dataset right now, so a fallback would silently succeed.
      expect(bridge.statisticsEvidenceReceiptBundle(handle)).not.toBeNull();

      atlas.setExecutionPort(incapablePort());
      expect(await atlas.captureGovernedEvidenceReceipt()).toBeNull();
      await expect(
        session.exportPortablePackage({}, undefined, { governedEvidence: true })
      ).rejects.toThrow(/none is available for this session/);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('refuses governed acquisition when no analytical port is installed at all', async () => {
    const { atlas, handle, session } = liveSession();
    try {
      expect(bridge.statisticsEvidenceReceiptBundle(handle)).not.toBeNull();

      atlas.setExecutionPort(null);
      expect(await atlas.captureGovernedEvidenceReceipt()).toBeNull();
      await expect(
        session.exportPortablePackage({}, undefined, { governedEvidence: true })
      ).rejects.toThrow(/none is available for this session/);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('commits exactly the readout the installed port returned, once', async () => {
    const { atlas, handle, session } = liveSession();
    try {
      const fingerprint = bridge.datasetFingerprint(handle)!;
      const kernelVersion = bridge.kernelVersion()!;
      const liveBundle = parseEvidenceReceiptBundleV1(
        bridge.statisticsEvidenceReceiptBundle(handle)
      );
      expect(liveBundle.receipts.length).toBeGreaterThan(1);

      // A valid bundle the kernel would never produce for this dataset on its
      // own: the producer's answer is the only possible origin of these bytes.
      const produced = {
        ...liveBundle,
        receipts: liveBundle.receipts.slice(0, 1),
      };
      const producedConsumers = stubGovernedConsumers(
        fingerprint,
        kernelVersion,
        produced.receipts.map((receipt) => receipt.receiptId),
      );
      const port = echoingPort({
        datasetFingerprint: fingerprint,
        kernelVersion,
        rawBundle: produced,
        governedConsumers: producedConsumers,
      });
      atlas.setExecutionPort(port);

      const bytes = await session.exportPortablePackage({}, undefined, {
        governedEvidence: true,
      });
      const payload = NemosynePackageManager.unpack(bytes);

      // Acquired through the injected port, exactly once, with the inline
      // port's own handle space (transport ports must not receive this).
      expect(port.requests).toHaveLength(1);
      expect(port.requests[0]!.handle).toBe(handle);
      expect(payload.manifest.formatVersion).toBe(3);

      // The committed commitment is the composition of that readout.
      expect(sha256Hex(payload.evidenceReceiptBytes!)).toBe(
        sha256Hex(
          composeGovernedEvidenceReceiptSnapshot({
            rawBundle: produced,
            datasetFingerprint: fingerprint,
            kernelVersion,
            governedConsumers: producedConsumers,
          }).bytes
        )
      );

      const envelope = committedEnvelope(payload.evidenceReceiptBytes!);
      // RFC 0009 tranche 3 slice 2: the envelope's uses are minted from the
      // kernel-issued attestation the port handed over — one use per claimed
      // receipt, under the exact profile the authority requires — never empty,
      // never caller-authored. Each receipt resolves under its use's profile, so
      // the minted uses bind on replay rather than refusing it.
      expect(envelope.uses).toEqual([
        {
          consumerId: DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
          receiptId: envelope.bundle.receipts[0]!.receiptId,
          requirementProfileId: DESCRIPTIVE_SUMMARY_REQUIREMENT_PROFILE_V1.profileId,
        },
      ]);
      expect(envelope.bundle.receipts).toHaveLength(1);
      expect(envelope.bundle.receipts[0]).toEqual(liveBundle.receipts[0]);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  it('refuses evidence whose readout describes another analytical identity', async () => {
    const foreign = liveSession(fixtureDataset('tec1-834-foreign'));
    const { atlas, handle, session } = liveSession();
    try {
      const foreignBundle = bridge.statisticsEvidenceReceiptBundle(foreign.handle);
      expect(foreignBundle).not.toBeNull();

      atlas.setExecutionPort(
        echoingPort({
          datasetFingerprint: bridge.datasetFingerprint(foreign.handle)!,
          kernelVersion: bridge.kernelVersion()!,
          rawBundle: foreignBundle,
          governedConsumers: stubGovernedConsumers(
            bridge.datasetFingerprint(foreign.handle)!,
            bridge.kernelVersion()!,
            parseEvidenceReceiptBundleV1(foreignBundle).receipts.map((r) => r.receiptId),
          ),
        })
      );

      expect(await atlas.captureGovernedEvidenceReceipt()).toBeNull();
      await expect(
        session.exportPortablePackage({}, undefined, { governedEvidence: true })
      ).rejects.toThrow(/none is available for this session/);
    } finally {
      bridge.destroyDataset(handle);
      bridge.destroyDataset(foreign.handle);
    }
  });

  it('refuses a readout whose payload identity disagrees with the identity it claims', async () => {
    const foreign = liveSession(fixtureDataset('tec1-834-drifted-bundle'));
    const { atlas, handle } = liveSession();
    try {
      atlas.setExecutionPort(
        echoingPort({
          // Claims this session's identity while carrying the other dataset's
          // payload: the composition boundary must refuse, not re-label it.
          datasetFingerprint: bridge.datasetFingerprint(handle)!,
          kernelVersion: bridge.kernelVersion()!,
          rawBundle: bridge.statisticsEvidenceReceiptBundle(foreign.handle),
          governedConsumers: stubGovernedConsumers(
            bridge.datasetFingerprint(handle)!,
            bridge.kernelVersion()!,
            ['descriptive:x'],
          ),
        })
      );

      await expect(atlas.captureGovernedEvidenceReceipt()).rejects.toThrow(
        /bundle identity drift/
      );
    } finally {
      bridge.destroyDataset(handle);
      bridge.destroyDataset(foreign.handle);
    }
  });

  it('refuses a capture that resolves after the runtime generation moved', async () => {
    const { atlas, handle, session } = liveSession();
    try {
      const fingerprint = bridge.datasetFingerprint(handle)!;
      const kernelVersion = bridge.kernelVersion()!;
      const rawBundle = bridge.statisticsEvidenceReceiptBundle(handle);

      let release!: () => void;
      const port = new StubCapturePort(
        (req) =>
          new Promise<GovernedEvidenceCaptureV1 | null>((resolve) => {
            // A readout that is honest about the request it answers; only the
            // runtime moving underneath the await can explain the refusal.
            release = () =>
              resolve({
                requestId: req.requestId,
                generation: req.generation,
                datasetVersion: req.dataset.version,
                datasetFingerprint: fingerprint,
                kernelVersion,
                rawBundle,
                // Never read: the fence refuses this capture before composition.
                governedConsumers: { schemaVersion: '1', consumers: [] },
              });
          })
      );
      atlas.setExecutionPort(port);

      const pending = session.exportPortablePackage({}, undefined, {
        governedEvidence: true,
      });
      await vi.waitFor(() => {
        if (!release) throw new Error('governed capture was not requested yet');
      });

      atlas.setGeneration(2);
      release();

      await expect(pending).rejects.toThrow(/none is available for this session/);
    } finally {
      bridge.destroyDataset(handle);
    }
  });

  describe('Worker-owned capture (real analytical Worker handler)', () => {
    interface TestWorkerScope {
      onmessage: ((event: MessageEvent) => void | Promise<void>) | null;
      postMessage: ReturnType<typeof vi.fn>;
    }

    let scope: TestWorkerScope;
    let handler: (event: MessageEvent) => void | Promise<void>;
    let originalSelf: typeof globalThis.self;

    beforeAll(async () => {
      originalSelf = globalThis.self;
      scope = { onmessage: null, postMessage: vi.fn() };
      vi.stubGlobal('self', scope);
      // The worker module installs `self.onmessage` at import time and reads
      // `self.postMessage` per call, so the stub must stay installed while
      // these tests run (the module registry executes the import once).
      await import('../src/atlas/ports/analytical.worker.ts');
      if (!scope.onmessage) {
        throw new Error('analytical Worker did not install its message handler');
      }
      handler = scope.onmessage;
    });

    afterAll(() => {
      vi.stubGlobal('self', originalSelf);
    });

    beforeEach(() => {
      scope.postMessage.mockClear();
    });

    function message(data: unknown): MessageEvent {
      return new MessageEvent('message', { data });
    }

    function repliesOf(type: string): Array<Record<string, unknown>> {
      return scope.postMessage.mock.calls
        .map((call) => call[0] as Record<string, unknown>)
        .filter((data) => data?.type === type);
    }

    function registrationFor(dataset: Dataset, registrationId: string) {
      const registration: AnalyticalDatasetRegistration = {
        registrationId,
        dataset: { fingerprint: dataset.fingerprint, version: 1 },
        generation: 1,
        payload: { type: 'json', data: dataset.toJSON(), name: dataset.name },
      };
      return registration;
    }

    it('resolves evidence from the Worker-owned registration', async () => {
      const dataset = new Dataset(
        'tec1-834-worker-owned',
        [{ name: 'x', type: ColumnType.NUMERIC }],
        [{ x: 1 }, { x: 2 }, { x: 3 }]
      );
      await handler(message({ type: 'REGISTER', registration: registrationFor(dataset, 'areg-834') }));
      expect(repliesOf('REGISTERED')[0]?.error).toBeUndefined();

      await handler(
        message({
          type: 'CAPTURE_GOVERNED_EVIDENCE',
          captureRequest: {
            requestId: 'acap-834',
            dataset: { fingerprint: dataset.fingerprint, version: 1 },
            generation: 1,
          },
        })
      );

      const reply = repliesOf('GOVERNED_EVIDENCE')[0];
      expect(reply?.requestId).toBe('acap-834');
      const capture = reply?.capture as GovernedEvidenceCaptureV1 | null;
      expect(capture).not.toBeNull();
      expect(capture!.datasetFingerprint).toBe(dataset.fingerprint);
      expect(capture!.generation).toBe(1);
      expect(capture!.kernelVersion).toBeTruthy();
      // The transported payload is the producer's own output, unparsed.
      expect(
        parseEvidenceReceiptBundleV1(capture!.rawBundle).receipts.length
      ).toBeGreaterThan(0);

      // RFC 0009 tranche 3 slice 2: the same read carries the kernel-issued
      // governing-consumer attestation, unparsed, and the kernel's minter is the
      // only authority for the consumer identity. This is the pin that keeps the
      // TS mirror constant honest: if the kernel ever renames its consumer id,
      // this line (CI-side, where the wasm binary is fresh) fails rather than
      // letting the TS mirror drift into governing a consumer the kernel never
      // mints. It also pins coverage: one consumer claiming exactly the bundle's
      // receipt ids.
      const attestation = parseGovernedConsumerAttestationV1(capture!.governedConsumers);
      const bundle = parseEvidenceReceiptBundleV1(capture!.rawBundle);
      expect(attestation.datasetFingerprint).toBe(bundle.datasetFingerprint);
      expect(attestation.kernelVersion).toBe(bundle.kernelVersion);
      expect(
        attestation.consumers.map((consumer) => ({
          consumerId: consumer.consumerId,
          receiptIds: [...consumer.receiptIds],
        })),
      ).toEqual([
        {
          consumerId: DESCRIPTIVE_STATISTICS_CONSUMER_ID_V1,
          receiptIds: bundle.receipts.map((receipt) => receipt.receiptId),
        },
      ]);
    });

    it('refuses a main-thread handle the Worker never registered', async () => {
      // This realm can produce evidence for the dataset below, so the handle is
      // valid in the shared runtime: only the Worker's own registration map can
      // explain a refusal.
      const mainThread = liveSession(fixtureDataset('tec1-834-main-thread'));
      try {
        const fingerprint = bridge.datasetFingerprint(mainThread.handle)!;
        expect(bridge.statisticsEvidenceReceiptBundle(mainThread.handle)).not.toBeNull();

        await handler(
          message({
            type: 'CAPTURE_GOVERNED_EVIDENCE',
            captureRequest: {
              requestId: 'acap-unregistered',
              dataset: { fingerprint, version: mainThread.atlas.datasetVersion },
              generation: 1,
              handle: mainThread.handle,
            },
          })
        );

        const reply = repliesOf('GOVERNED_EVIDENCE')[0];
        expect(reply?.requestId).toBe('acap-unregistered');
        expect(reply?.capture).toBeNull();
      } finally {
        bridge.destroyDataset(mainThread.handle);
      }
    });

    it('refuses a capture superseded before it is answered', async () => {
      const dataset = new Dataset(
        'tec1-834-worker-superseded',
        [{ name: 'x', type: ColumnType.NUMERIC }],
        [{ x: 1 }, { x: 2 }]
      );
      await handler(
        message({ type: 'REGISTER', registration: registrationFor(dataset, 'areg-superseded') })
      );

      await handler(message({ type: 'SUPERSEDE', fence: { generation: 2 } }));
      await handler(
        message({
          type: 'CAPTURE_GOVERNED_EVIDENCE',
          captureRequest: {
            requestId: 'acap-stale',
            dataset: { fingerprint: dataset.fingerprint, version: 1 },
            generation: 1,
          },
        })
      );

      expect(repliesOf('GOVERNED_EVIDENCE')[0]?.capture).toBeNull();
    });
  });
});
