const boundaryRules = [
  {
    name: 'no-production-draco-imports',
    comment: 'Draco is compatibility-only; production code imports Moneta directly.',
    severity: 'error',
    from: { path: '^src/', pathNot: '^src/draco/' },
    to: { path: '^src/draco/' },
  },
  {
    name: 'investigation-domain-is-presentation-independent',
    comment: 'Investigation and persistence meaning must not depend on VR/UI presentation state.',
    severity: 'error',
    from: { path: '^src/(atlas/domain|investigation|session)/' },
    to: { path: '^src/(vr|ui)/' },
  },
  {
    name: 'moneta-is-presentation-independent',
    comment: 'Moneta representation reasoning must not depend on VR/UI presentation modules.',
    severity: 'error',
    from: { path: '^src/moneta/' },
    to: { path: '^src/(vr|ui)/' },
  },
  {
    name: 'world-is-composition-root',
    comment:
      'RF-062: World may compose the runtime, but feature/domain modules must not depend back on World.',
    severity: 'error',
    from: {
      path: '^src/',
      pathNot:
        '^src/(?:vr/World\\.(?:ts|js)|app/(?:bootstrap|diagnostics|browserEnvelopeDiagnostics|resourceEnvelopeDiagnostics)\\.(?:ts|js))$',
    },
    to: { path: '^src/vr/World\\.(?:ts|js)$' },
  },
];

const options = {
  includeOnly: { path: '^src/' },
  doNotFollow: { path: 'node_modules' },
  tsConfig: { fileName: 'tsconfig.json' },
  tsPreCompilationDeps: true,
};

module.exports = { forbidden: boundaryRules, options };
