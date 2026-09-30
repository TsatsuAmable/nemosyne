import { register } from 'node:module';

register('./runtimeBridgeEnvHook.mjs', import.meta.url);
