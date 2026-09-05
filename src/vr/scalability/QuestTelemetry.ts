import { readBrowserValidationContext } from '../../validation/browser-validation-session.ts';
import { percentile } from './LoadTestThresholds.ts';

export type QuestDeviceTarget =
  | 'META_QUEST_3S'
  | 'META_QUEST_3'
  | 'APPLE_VISION_PRO'
  | 'OTHER_WEBXR_HEADSET'
  | 'UNDECLARED';

export interface QuestRuntimeEnvironment {
  buildId: string;
  declaredDeviceTarget: QuestDeviceTarget;
  identityBasis: 'adb-system-property' | 'investigator-declared' | 'unavailable';
  investigatorRunLabel: string | null;
  declaredFirmwareVersion: string | null;
  userAgent: string;
  platform: string | null;
  mobile: boolean | null;
  brands: string[];
  logicalCpuCount: number | null;
  deviceMemoryGiB: number | null;
  screen: {
    width: number | null;
    height: number | null;
    devicePixelRatio: number | null;
  };
  webgl: {
    vendor: string | null;
    renderer: string | null;
    version: string | null;
  };
  xr: {
    active: boolean;
    visibilityState: string | null;
    environmentBlendMode: string | null;
    interactionMode: string | null;
    nominalFrameRateHz: number | null;
    supportedFrameRatesHz: number[];
    framebufferWidth: number | null;
    framebufferHeight: number | null;
  };
}

export interface QuestVisibilityTelemetry {
  interruptionCount: number;
  interruptedDurationMs: number;
  finalVisibilityState: string | null;
}

export interface SustainedPerformanceProxy {
  kind: 'sustained-frame-time-drift';
  temperatureSensorAvailable: false;
  signal: 'xr-frame-interval' | 'render-duration';
  sampleCount: number;
  firstWindowP50Ms: number | null;
  firstWindowP95Ms: number | null;
  lastWindowP50Ms: number | null;
  lastWindowP95Ms: number | null;
  p95DriftPercent: number | null;
  governorThrottleEvents: number;
  classification: 'insufficient-data' | 'stable' | 'watch' | 'degrading';
}

export interface QuestTelemetryEngineLike {
  renderer: {
    xr: { getSession(): unknown };
    getContext?: () => unknown;
  };
}

interface SessionShape {
  visibilityState?: string;
  environmentBlendMode?: string;
  interactionMode?: string;
  frameRate?: number;
  supportedFrameRates?: ArrayLike<number>;
  renderState?: {
    baseLayer?: {
      framebufferWidth?: number;
      framebufferHeight?: number;
    } | null;
  };
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

interface GlShape {
  getExtension?: (name: string) => unknown;
  getParameter?: (parameter: unknown) => unknown;
  VENDOR?: unknown;
  RENDERER?: unknown;
  VERSION?: unknown;
}

interface DebugRendererInfo {
  UNMASKED_VENDOR_WEBGL?: unknown;
  UNMASKED_RENDERER_WEBGL?: unknown;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, 256) : null;
}

function queryValue(name: string): string | null {
  if (typeof location === 'undefined') return null;
  try {
    return textValue(new URLSearchParams(location.search).get(name));
  } catch {
    return null;
  }
}

function glParameter(gl: GlShape | null, parameter: unknown): string | null {
  if (!gl?.getParameter || parameter === undefined) return null;
  try {
    return textValue(gl.getParameter(parameter));
  } catch {
    return null;
  }
}

export function captureQuestRuntimeEnvironment(
  engine: QuestTelemetryEngineLike,
  declaredDeviceTarget: QuestDeviceTarget
): QuestRuntimeEnvironment {
  const session = (engine.renderer.xr.getSession() ?? null) as SessionShape | null;
  const nav = typeof navigator === 'undefined'
    ? null
    : (navigator as Navigator & {
      deviceMemory?: number;
      userAgentData?: {
        platform?: string;
        mobile?: boolean;
        brands?: Array<{ brand?: string; version?: string }>;
      };
    });
  const gl = (engine.renderer.getContext?.() ?? null) as GlShape | null;
  let debugInfo: DebugRendererInfo | null = null;
  try {
    debugInfo = (gl?.getExtension?.('WEBGL_debug_renderer_info') ?? null) as DebugRendererInfo | null;
  } catch {
    debugInfo = null;
  }
  const baseLayer = session?.renderState?.baseLayer ?? null;
  const rates = session?.supportedFrameRates
    ? Array.from(session.supportedFrameRates).filter((value) => Number.isFinite(value))
    : [];
  const brands = nav?.userAgentData?.brands
    ?.map((item) => [item.brand, item.version].filter(Boolean).join('/'))
    .filter(Boolean) ?? [];
  const validation = readBrowserValidationContext(import.meta.env);
  const validationDevice = validation?.manifest.deviceIdentity ?? null;
  const fallbackRunLabel = queryValue('questRun');
  const fallbackFirmware = queryValue('questFirmware');
  const identityBasis: QuestRuntimeEnvironment['identityBasis'] = validationDevice
    ? 'adb-system-property'
    : fallbackRunLabel || fallbackFirmware
      ? 'investigator-declared'
      : 'unavailable';

  return {
    buildId:
      validation?.manifest.buildId ||
      import.meta.env.VITE_NEMOSYNE_BUILD_ID ||
      'unversioned-local-build',
    declaredDeviceTarget,
    identityBasis,
    investigatorRunLabel: validation?.session.label ?? fallbackRunLabel,
    declaredFirmwareVersion:
      validationDevice?.buildIncremental ??
      validation?.manifest.declaredFirmwareVersion ??
      fallbackFirmware,
    userAgent: nav?.userAgent ?? 'unknown',
    platform: textValue(nav?.userAgentData?.platform),
    mobile: typeof nav?.userAgentData?.mobile === 'boolean' ? nav.userAgentData.mobile : null,
    brands,
    logicalCpuCount: finiteNumber(nav?.hardwareConcurrency),
    deviceMemoryGiB: finiteNumber(nav?.deviceMemory),
    screen: {
      width: finiteNumber(typeof screen === 'undefined' ? null : screen.width),
      height: finiteNumber(typeof screen === 'undefined' ? null : screen.height),
      devicePixelRatio: finiteNumber(typeof window === 'undefined' ? null : window.devicePixelRatio),
    },
    webgl: {
      vendor: glParameter(gl, debugInfo?.UNMASKED_VENDOR_WEBGL ?? gl?.VENDOR),
      renderer: glParameter(gl, debugInfo?.UNMASKED_RENDERER_WEBGL ?? gl?.RENDERER),
      version: glParameter(gl, gl?.VERSION),
    },
    xr: {
      active: session !== null,
      visibilityState: textValue(session?.visibilityState),
      environmentBlendMode: textValue(session?.environmentBlendMode),
      interactionMode: textValue(session?.interactionMode),
      nominalFrameRateHz: finiteNumber(session?.frameRate),
      supportedFrameRatesHz: rates,
      framebufferWidth: finiteNumber(baseLayer?.framebufferWidth),
      framebufferHeight: finiteNumber(baseLayer?.framebufferHeight),
    },
  };
}

export function computeSustainedPerformanceProxy(
  frameIntervalsMs: number[],
  renderDurationsMs: number[],
  governorThrottleEvents: number
): SustainedPerformanceProxy {
  const useIntervals = frameIntervalsMs.length >= 120;
  const samples = useIntervals ? frameIntervalsMs : renderDurationsMs;
  const signal = useIntervals ? 'xr-frame-interval' : 'render-duration';
  if (samples.length < 120) {
    return {
      kind: 'sustained-frame-time-drift',
      temperatureSensorAvailable: false,
      signal,
      sampleCount: samples.length,
      firstWindowP50Ms: null,
      firstWindowP95Ms: null,
      lastWindowP50Ms: null,
      lastWindowP95Ms: null,
      p95DriftPercent: null,
      governorThrottleEvents,
      classification: 'insufficient-data',
    };
  }
  const windowSize = Math.max(60, Math.floor(samples.length * 0.2));
  const first = samples.slice(0, windowSize);
  const last = samples.slice(samples.length - windowSize);
  const firstP50 = percentile(first, 50);
  const firstP95 = percentile(first, 95);
  const lastP50 = percentile(last, 50);
  const lastP95 = percentile(last, 95);
  const drift = firstP95 > 0 ? ((lastP95 - firstP95) / firstP95) * 100 : 0;
  const classification = drift >= 20 || governorThrottleEvents >= 10
    ? 'degrading'
    : drift >= 10 || governorThrottleEvents > 0
      ? 'watch'
      : 'stable';
  return {
    kind: 'sustained-frame-time-drift',
    temperatureSensorAvailable: false,
    signal,
    sampleCount: samples.length,
    firstWindowP50Ms: firstP50,
    firstWindowP95Ms: firstP95,
    lastWindowP50Ms: lastP50,
    lastWindowP95Ms: lastP95,
    p95DriftPercent: drift,
    governorThrottleEvents,
    classification,
  };
}

export class QuestVisibilityTracker {
  private readonly _session: SessionShape | null;
  private _interruptionCount = 0;
  private _interruptedDurationMs = 0;
  private _interruptionStartedAt: number | null = null;
  private readonly _listener: () => void;

  constructor(session: unknown) {
    this._session = (session ?? null) as SessionShape | null;
    this._listener = () => this._handleVisibilityChange();
    this._session?.addEventListener?.('visibilitychange', this._listener);
    this._handleVisibilityChange();
  }

  finish(): QuestVisibilityTelemetry {
    this._closeInterruption();
    this._session?.removeEventListener?.('visibilitychange', this._listener);
    return {
      interruptionCount: this._interruptionCount,
      interruptedDurationMs: this._interruptedDurationMs,
      finalVisibilityState: textValue(this._session?.visibilityState),
    };
  }

  private _handleVisibilityChange(): void {
    if (!this._session) return;
    if (this._session?.visibilityState === 'visible') {
      this._closeInterruption();
      return;
    }
    if (this._interruptionStartedAt === null) {
      this._interruptionCount++;
      this._interruptionStartedAt = performance.now();
    }
  }

  private _closeInterruption(): void {
    if (this._interruptionStartedAt === null) return;
    this._interruptedDurationMs += performance.now() - this._interruptionStartedAt;
    this._interruptionStartedAt = null;
  }
}
