/**
 * Observability & Telemetry Subsystem — production barrel export.
 *
 * RemoteDebugStreamer is DEV-gated and must be imported directly by the
 * development composition rather than appearing as a production authority.
 */

export { TelemetryCollector } from '../utils/Telemetry.ts';
