/**
 * Supplies the build-time constant that Vite replaces in production, so the
 * production analytical Worker module can be evaluated by Node in its own
 * thread (see governedCaptureWorkerThread.ts).
 *
 * This is not a behavioural stand-in: `import.meta.env.VITE_*` is a
 * compile-time substitution in every production build, and this hook performs
 * the same substitution at load time. Only that one expression is rewritten;
 * the module's behaviour is untouched.
 */
const ENV_GLOBAL = '(globalThis.__NEMOSYNE_WORKER_ENV__ ?? {})';

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);
  if (typeof url === 'string' && url.endsWith('.ts') && result.source) {
    const source = result.source.toString();
    if (source.includes('import.meta.env')) {
      return {
        // `module-typescript` keeps Node's own type transformation in play
        // (the module graph uses TypeScript parameter properties).
        format: 'module-typescript',
        source: source.replaceAll('import.meta.env', ENV_GLOBAL),
        shortCircuit: true,
      };
    }
  }
  return result;
}
