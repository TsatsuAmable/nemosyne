const boundaries = require('./.dependency-cruiser.boundaries.cjs');

module.exports = {
  forbidden: [
    ...boundaries.forbidden,
    {
      name: 'production-cycles-pilot',
      comment: 'Cycle evidence is informational during Q0; classify before any future promotion.',
      severity: 'warn',
      from: { path: '^src/' },
      to: { circular: true },
    },
  ],
  options: boundaries.options,
};
