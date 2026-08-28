module.exports = {
  forbidden: [
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
      name: 'production-cycles-pilot',
      comment: 'Cycle evidence is informational during Q0; classify before any future promotion.',
      severity: 'warn',
      from: { path: '^src/' },
      to: { circular: true },
    },
  ],
  options: {
    includeOnly: { path: '^src/' },
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
