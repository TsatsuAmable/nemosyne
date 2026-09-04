import type { Server } from 'node:http';
import type { WebSocketServer } from 'ws';

export type SignallingSecurityProfile = 'Development' | 'ResearchPreview' | 'Production';

export interface SignallingServiceConfig {
  readonly host: string;
  readonly port: number;
  readonly authToken: string;
  readonly observerAuthToken: string;
  readonly allowedOrigins: string[] | undefined;
  readonly allowOpen: boolean;
  readonly securityProfile: SignallingSecurityProfile;
}

export interface SignallingServiceDiagnostic {
  readonly ok: boolean;
  readonly profile: string;
  readonly warnings: string[];
  readonly originEnforcement: boolean;
  readonly authTokenConfigured: boolean;
  readonly tokenValidatorConfigured: boolean;
}

export interface SignallingService {
  readonly diagnostic: SignallingServiceDiagnostic;
  readonly httpServer: Server;
  readonly wss: WebSocketServer;
  start(): Promise<ReturnType<Server['address']>>;
  stop(): Promise<void>;
}

export function readSignallingServiceConfig(
  args?: string[],
  env?: Readonly<Record<string, string | undefined>>,
): SignallingServiceConfig;

export function createSignallingService(config: SignallingServiceConfig): SignallingService;
