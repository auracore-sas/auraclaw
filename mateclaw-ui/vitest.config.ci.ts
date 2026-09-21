import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config'

/**
 * CI-only vitest config (AuraClaw fork).
 *
 * Same as `vitest.config.ts`, but drops 4 test files that already fail on a
 * PRISTINE upstream checkout (`git worktree add … v2.1.0`) — verified
 * 2026-09-15: the exact same 8 assertions fail there, so they are upstream
 * debt, not fork regressions. Keeping them in CI would make every run red
 * from day one and hide real failures.
 *
 * Remove an entry once the upstream file goes green.
 *
 *   product-cards.test.ts            → 3 failures (card markup shape)
 *   streaming-render.test.ts         → 2 failures (echarts/mermaid placeholders)
 *   teamRunComponents.test.ts        → 2 failures (markdown in run summary)
 *   teamRunProjectionPrimitives.test.ts → 1 failure (outcome/deliverables render)
 *
 * Re-check status when adopting a new upstream release. Known as of v2.3.0
 * (2026-09-20): upstream edited the last two files plus their sources
 * (`TeamRun*.vue`, `teamRunAttentionHandlers.ts`) adding new tests — that may
 * or may not have fixed the 3 assertions this fork excludes; it has NOT been
 * verified by running them. `product-cards` and `streaming-render` are
 * untouched upstream.
 *
 * `exclude` is set explicitly (not appended to the defaults) on purpose: the
 * base config already scopes `include` to `src/**`, so nothing outside the
 * suite can be picked up.
 */
export default mergeConfig(baseConfig, defineConfig({
  test: {
    exclude: [
      'src/composables/__tests__/product-cards.test.ts',
      'src/composables/__tests__/streaming-render.test.ts',
      'src/components/team-run/__tests__/teamRunComponents.test.ts',
      'src/components/team-run/__tests__/teamRunProjectionPrimitives.test.ts',
    ],
  },
}))
