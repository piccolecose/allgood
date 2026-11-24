# CI gates

Every pull request runs, in the `unit` job of `.github/workflows/main.yml`:

- `pnpm run workflow:check`: Biome format and lint check.
- `pnpm run lint`: oxlint, warnings are errors.
- `pnpm run typecheck` and `pnpm run build`.
- `pnpm run test:coverage`: unit tests with v8 coverage. Jest fails the run if
  total line coverage drops below the `coverageThreshold` in `jest.config.js`
  (75%). The totals are written to the job summary.

The `integration` job runs the same tests against real services from
`compose.yaml`; it is not part of the coverage figure.

Design: https://github.com/piccolecose/allgood/issues/194
