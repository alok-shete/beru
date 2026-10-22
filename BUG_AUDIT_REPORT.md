# Beru State Management Library Bug Audit

## Executive summary

The original audit fixed B-01 through B-11 and B-13; B-12 was not reproduced.
Follow-up review confirmed and fixed persistence lifecycle defects, including
disposal during pending hydration and clearing while hydration is pending.
B-14 was not reproduced on the current PR branch: cleanup already calls
DevTools unsubscribe once, guards repeated calls, and removes the store
listener in `finally`. The regression tests pass without a DevTools production
change. Latest reviewed commit: `61e4ea0e345aaecfc7cf9e898bfcad07ca105747`.
Final local validation passes 13 test files and 169 tests, TypeScript
compilation, the production build, and packed-package consumer checks.

No release was performed. No physical React Native runtime was available, so
React Native compatibility remains unverified; the no-DOM subscription test
does not establish it. ESLint could not run because its executable is absent
and the offline npm cache lacks it. The broad Prettier check reported
formatting differences in nine reviewed/modified files; they were left
unchanged to avoid broad formatting churn.

## Findings and disposition

| ID | Status | Reproduction and remediation |
| --- | --- | --- |
| B-01 | FIXED | No-DOM React subscriptions were not updating. Source: `src/core/hooks.ts:56-66`; regression: `test/unit/react-native-subscription.test.tsx:1-65`. The baseline failed and the current test passes. This is not physical React Native verification. |
| B-02 | FIXED | Selector callback retained a stale selector prop. Source: `src/core/hooks.ts:26-56`; regression: `test/unit/selector-behavior.test.ts:340-363`. Baseline failed; current regression passes. |
| B-03 | FIXED | Independent asynchronous writes could finish out of order. Source: `src/middleware/persistence/core/persist.ts:92-126`; regression: `test/unit/concurrent-race-conditions.test.ts:127-177`. Baseline failed; current regression passes. |
| B-04 | FIXED | Pending or active writes could restore data after clear. Source: `src/middleware/persistence/core/persist.ts:252-270`; regressions: `test/unit/persistence-advanced.test.ts:419-473`. Baseline failed; current regressions pass. |
| B-05 | FIXED | Async hydration overwrote updates made while storage was pending. Source: `src/middleware/persistence/core/persist.ts:157-187`; regression: `test/unit/persistence-advanced.test.ts:41-68`. Baseline failed; current regression passes. |
| B-06 | FIXED | Read errors could interrupt subscription setup or leave tracking incomplete. Source: `src/middleware/persistence/core/persist.ts:183-224`; regressions: `test/unit/persistence-advanced.test.ts:602-650`. Baseline failed; current regressions pass. |
| B-07 | FIXED | `flush()` did not reliably wait for prior persistence work. Source: `src/middleware/persistence/core/persist.ts:278-288`; regression: `test/unit/persistence-advanced.test.ts:611-659`. Baseline failed; current regression passes. |
| B-08 | FIXED | `waitForPersistence()` did not consistently include active hydration and queued work. Source: `src/middleware/persistence/core/persist.ts:293-303`; regressions: `test/unit/persistence-advanced.test.ts:151-169,305-346,573-609`. Baseline failed; current regressions pass. |
| B-09 | FIXED | Default merge altered non-object shapes and falsey state. Source: `src/middleware/persistence/core/persist.ts:15-19,43-47`; regressions: `test/unit/persist.test.ts:269-307`. Baseline failed; current regressions pass. Persisted `null` remains the established skip-migration sentinel. |
| B-10 | FIXED | DevTools cleanup left listeners subscribed or was not idempotent. Source: `src/middleware/devtools/index.ts:147-157`; regression: `test/unit/devtools.test.ts`. Baseline failed; current regression passes. |
| B-11 | FIXED | Enumerable state/action collisions made selection ambiguous. Source: `src/core/hooks.ts:42-50`; regression: `test/unit/create.test.ts`; documented in `README.md`. Baseline failed; current regression passes. |
| B-12 | NOT REPRODUCED | No specific contract violation was established; no production change was made. Source and regression: N/A. |
| B-13 | FIXED | Built ESM imports lacked resolvable extensions and prebuild relied on Unix `rm`. Source: `post-build.js:23-81`, `package.json:39`; regressions: `test/package-consumer-smoke.js`, `test/prebuild-smoke.js`. Baseline failed; current package checks pass. |
| B-14 | NOT REPRODUCED | Current cleanup at `src/middleware/devtools/index.ts:147-157` guards first, sets the flag, calls DevTools unsubscribe once, and unsubscribes the store in `finally`. Tests at `test/unit/devtools.test.ts:11-79` cover exact-once calls, repeated cleanup, a thrown DevTools unsubscribe, removal of the store listener, and normal update reporting. `npm.cmd test -- --run test/unit/devtools.test.ts`: 1 file and 2 tests passed on current code. No production change. |
| B-15 | FIXED | Async hydration completion reinstated persistence subscription after `dispose()`. Regression: `test/unit/persistence-advanced.test.ts:388-415`. Before: `npm.cmd test -- --run test/unit/persistence-advanced.test.ts -t "should not restore the persistence subscription after disposal during hydration"` failed because `setItem` was called after disposal. `src/middleware/persistence/core/persist.ts:58,157-160,232-250` now tracks disposal and only initializes a subscription for the active hydration generation. After: the same command passed (1 test). |
| B-16 | FIXED | `clear()` invalidated the pending read generation without establishing a replacement persistence subscription, so a later successful or rejected read left future store updates unpersisted. Tests: `test/unit/persistence-advanced.test.ts:199-236,239-284`. Before: the successful-read regression failed with `JSON.parse(undefined)` because no state was written; the rejecting-read regression failed with 0 active listeners instead of 1. `src/middleware/persistence/core/persist.ts:232-265` now establishes one subscription only while async hydration is active, unless disposed or already subscribed. After: the resolve, reject, and `skipHydrate` guard tests pass (3/3). The resolve test confirms old data is not restored and new state is persisted; rejection reports the error, retains exactly one listener until dispose, and does not leak or lose the subscription. |

## Follow-up persistence race review

The PR review reproduced two additional hydration races and fixed them
test-first:

- `clear()` could finish while an earlier asynchronous hydration was pending;
  that hydration could then apply the data that had just been cleared. Each
  hydration now carries a generation, and clearing invalidates earlier reads.
- Overlapping forced hydrations could cause `waitForPersistence()` to stop
  waiting when the newest hydration finished even though an older one remained
  active. Active hydration promises are now tracked as a set, and the wait API
  joins every active hydration. The same generation check prevents stale
  hydration results from replacing the newest result.
- `clear()` during an active hydration invalidated the generation but did not
  establish the persistence subscription needed for subsequent updates. It now
  establishes one subscription only if hydration is active, the instance is
  not disposed, and there is no existing subscription. A pending read
  rejection cannot leak a duplicate listener or leave the store without
  persistence.

An additional check confirmed that completion of an obsolete hydration does
not lose a store update's scheduled persistence write.

The wider persistence matrix verifies these scenarios in the current code:

| Scenario | Regression coverage and result |
| --- | --- |
| Multiple async writes completing in controlled order | `test/unit/concurrent-race-conditions.test.ts:127-177` - passed; queue starts the next write only after the previous one finishes, leaving the latest state stored. |
| `clear()` with pending debounce and active write | `test/unit/persistence-advanced.test.ts:313-365` - both passed; pending timer is canceled and removal follows started writes. |
| Hydration after newer in-memory update | `test/unit/persistence-advanced.test.ts:41-63` - passed; current update wins. |
| Synchronous `getItem()` throw and asynchronous rejection | `test/unit/persistence-advanced.test.ts:708-756` - passed; errors are reported and subscription initialization recovers. |
| Rejected `setItem()` | `test/unit/persistence-advanced.test.ts:758-777` - passed; error is reported and queue drains. |
| `clear()` while an async read resolves or rejects | B-16 regressions in `test/unit/persistence-advanced.test.ts` - resolve path persists the post-clear update without restoring the stored snapshot; rejection path reports the error and retains exactly one subscription until disposal. Both fail on the pre-fix implementation and pass after the fix. |
| `skipHydrate` followed by `clear()` | `test/unit/persistence-advanced.test.ts` - passed; clear does not start persistence when no hydration was active. |
| `flush()` behind earlier writes; `waitForPersistence()` during a write | `test/unit/persistence-advanced.test.ts:573-659` - passed; callers wait for queued completion. |
| `dispose()` during a timer or active write | `test/unit/disposal-unsubscribe.test.ts:145-183` and `test/unit/persistence-advanced.test.ts:475-516` - passed; timer is canceled, an active write completes, and no subsequent update is persisted. |
| Array persistence and hydration | `test/unit/persist.test.ts:269-307` - passed; arrays retain array runtime shape. |
| Multiple instances with the same key | NOT APPLICABLE: README documents `name` as a unique storage identifier; cross-instance same-key coordination is not a supported contract. |

## Regression and validation results

The test-first regressions were run against the unfixed behavior for reproduced
findings. Follow-up persistence race tests failed against the prior
implementation and passed after the fixes. B-16's resolve and rejection
regressions failed before its fix; the combined regression command now passes
all 3 selected cases. B-14 tests pass against current code; a failing B-14
baseline was not observed because the described defect is not present. B-15's
baseline failure and passing rerun are recorded above.

The B-14 targeted command,
`npm.cmd test -- --run test/unit/devtools.test.ts`, printed
`Test Files 1 passed (1)` and `Tests 2 passed (2)`.
Before the persistence fixes, the clear/hydration regression failed with
`expected { count: 42 } to deeply equal { count: +0 }`; the overlapping
hydration wait regression failed with `expected null not to be null`. Both
passed after the fixes.

| Check | Result |
| --- | --- |
| `npm.cmd test -- --run` | **Passed:** `Test Files 13 passed (13)`; `Tests 169 passed (169)`. |
| `npm.cmd run build` | **Passed:** CJS and ESM TypeScript builds completed; `post-build.js` copied README and LICENSE. |
| `node test\prebuild-smoke.js` | **Passed:** Windows-compatible cleanup command completed. |
| `node test\package-consumer-smoke.js` | **Passed:** CommonJS, ESM, and TypeScript import smoke checks against generated `dist`. |
| `.\node_modules\.bin\tsc.cmd --noEmit --project tsconfig.base.json` | **Passed:** exit code 0, no diagnostics. |
| React subscriptions/selectors, selector prop changes, custom equality, multiple subscribers, unmount, Strict Mode | **Passed:** existing tests in `test/unit/selector-behavior.test.ts` and `test/unit/react-integration.test.tsx`. |
| Server rendering and hydration | **Passed:** added `renderToString`/`hydrateRoot` regression at `test/unit/react-integration.test.tsx:505-521`; server uses initial snapshot and client hydrates to current state. |
| React Native runtime | **BLOCKED:** Node no-DOM test `test/unit/react-native-subscription.test.tsx` passes, but no React Native runtime/device was available. |
| `npm.cmd pack --dry-run --json` from `dist` | **Passed:** 40 files, including `esm/package.json`; all generated `exports`, `main`, `module`, and `types` targets exist. |
| Temporary clean consumer install of packed tarball | **Passed with limitation:** `npm.cmd install --offline --legacy-peer-deps --no-audit --no-fund <tarball>` installed the package; CommonJS, ESM, and TypeScript declaration imports passed. React peer was supplied using a junction to the workspace copy. |
| Installing React peer from npm cache | **BLOCKED:** offline npm cache lacks `loose-envify` (`ENOTCACHED`); therefore a fully registry-independent fresh install of all peer transitive dependencies was not possible. |
| Runtime/peer dependency metadata | **Passed:** generated package declares `react` peer dependency `"*"` and no runtime dependencies; source imports React only. |
| Lint (`npm.cmd exec --offline -- eslint src test`) | **BLOCKED:** `eslint` executable is not installed; offline npm could not fetch it (`ENOTCACHED`). No lint success is claimed. `package.json` has no lint script; release workflow runs the build only. |
| Formatting (`prettier --check` on reviewed and modified source/tests) | **BLOCKED/NOT CLEAN:** Prettier reports formatting differences in 9 files; no broad autoformat was applied to avoid unrelated changes. |
| `git diff --check` | **Passed.** |

The only workflow in `.github/workflows` is `release.yml`. It installs with
`npm ci --legacy-peer-deps`, builds with `npm run build`, and publishes from
`dist` on release creation; it does not define PR test or lint jobs. The local
HEAD and current GitHub PR head at review were both
`61e4ea0e345aaecfc7cf9e898bfcad07ca105747`.

Dependency setup required `npm ci --legacy-peer-deps` because plain `npm ci`
failed with the existing React peer dependency conflict involving
`@testing-library/react-hooks@8.0.1` and React 18. Installation reported 30
dependency audit findings; dependency security remediation was outside this
bug-audit scope.
