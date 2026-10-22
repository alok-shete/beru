# Beru State Management Library Bug Audit

## Executive summary

The audit reproduced and fixed B-01 through B-11 and B-13. B-12 was not
reproduced and was not changed. Regression tests were run before the associated
production fixes. The final validation reported 13 test files and 156 passing
tests, a successful build and TypeScript check, and a successful packed-package
consumer smoke test for CommonJS, ESM, and TypeScript imports.

No push or release was performed. The audit could not verify behavior on a
physical React Native runtime; B-01 was exercised in a Node environment without
a DOM. ESLint was unavailable in the installed dependencies. A broad Prettier
check reported existing formatting differences in modified files; the new
standalone smoke scripts passed their focused formatting check.

## Findings and disposition

| ID | Result | Reproduction and remediation |
| --- | --- | --- |
| B-01 | Reproduced; fixed | The no-DOM React subscription path did not reflect store updates. Added `test/unit/react-native-subscription.test.tsx` and changed `src/core/hooks.ts` to consistently use the existing `useSyncExternalStore`-based implementation. Node/no-DOM verification passed; a physical React Native runtime was not available. |
| B-02 | Reproduced; fixed | A selector callback could retain a stale selector prop. Added a selector-prop regression in `test/unit/selector-behavior.test.ts` and included `selector` in the callback dependencies in `src/utils/useSyncExternalStoreWithSelector.ts`. |
| B-03 | Reproduced; fixed | Concurrent asynchronous persistence writes could complete out of order. Added a regression in `test/unit/concurrent-race-conditions.test.ts` and serialized persistence operations in `src/middleware/persistence/core/persist.ts`. |
| B-04 | Reproduced; fixed | `clear()` did not prevent a pending debounced write from restoring cleared data, and did not wait for an in-flight write. Regressions in `test/unit/persistence-advanced.test.ts` reproduced both cases. `clear()` now cancels the timer and queues removal after earlier operations. |
| B-05 | Reproduced; fixed | An update made while asynchronous hydration was pending could be overwritten by the stored state. Added a hydration-race regression, tracked updates during hydration in `src/middleware/persistence/core/persist.ts`, and documented the precedence in `README.md`. |
| B-06 | Reproduced; fixed | Storage-read failures could prevent persistence subscription setup and leave hydration tracking incomplete. Added error-path regressions and ensured failures are reported and tracking is cleaned up while subscription setup continues. |
| B-07 | Reproduced; fixed | `flush()` did not reliably wait for persistence operations already in progress. Added a regression and made `flush()` join the serialized operation queue. |
| B-08 | Reproduced; fixed | `waitForPersistence()` did not consistently account for active hydration and queued writes/clears. Added regressions and updated it to wait for those operations, returning `null` when idle. |
| B-09 | Reproduced; fixed | Hydration merging mishandled non-object values, including arrays and falsey primitives. Added array and falsey-value regressions; `src/middleware/persistence/core/persist.ts` now merges only plain objects. Persisted `null` remains the established “skip migration” sentinel. |
| B-10 | Reproduced; fixed | DevTools cleanup left listeners subscribed and was not idempotent. Added `test/unit/devtools.test.ts` and updated `src/middleware/devtools/index.ts` to unsubscribe both listeners safely. |
| B-11 | Reproduced; fixed | Enumerable state/action name collisions made selector access ambiguous. Added a regression in `test/unit/create.test.ts`, now throws a clear error for collisions, and documented the behavior in `README.md`. |
| B-12 | Not reproduced; not changed | No specific contract violation was established during the audit. No production change was made. |
| B-13 | Reproduced; fixed | The release package's ESM entry could not resolve extensionless relative imports, and the build cleanup relied on the Unix-only `rm` command. Added package-consumer and prebuild smoke scripts; `post-build.js` now rewrites relative ESM specifiers and emits `dist/esm/package.json` with `"type":"module"`, and `package.json` uses Node's filesystem API for cross-platform cleanup. |

## Regression and validation results

The test-first regressions were run against the unfixed behavior for reproduced
findings. Those baseline runs reported failures for B-01 through B-11 and B-13;
after the fixes, the corresponding targeted tests passed. The audit added 13
Vitest regression cases and two standalone smoke scripts.

| Check | Result |
| --- | --- |
| `npm.cmd test -- --run` | **Passed:** 13 test files, 156 tests passed. |
| `npm.cmd run build` | **Passed** after making prebuild cleanup cross-platform and fixing generated ESM imports. |
| `.\node_modules\.bin\tsc.cmd --noEmit --project tsconfig.base.json` | **Passed.** |
| `node test\package-consumer-smoke.js` against `dist` | **Passed:** CommonJS import, ESM import, and TypeScript consumer checks. |
| `npm.cmd pack --dry-run --json` from `dist` | **Passed:** 40 package files listed, including declarations and `esm/package.json`. |
| `node test\prebuild-smoke.js` | **Passed.** |
| `git diff --check` | **Passed.** |
| Focused Prettier check of the new standalone smoke scripts | **Passed.** |
| Broad Prettier check of modified files | **Not clean:** reported formatting differences in modified files, including existing formatting. |
| ESLint | **Blocked/unverified:** no ESLint executable is installed; no lint result is claimed. |
| React Native runtime | **Blocked/unverified:** no physical/device React Native runtime was available. |

Dependency setup required `npm ci --legacy-peer-deps` because plain `npm ci`
failed with the existing React peer dependency conflict involving
`@testing-library/react-hooks@8.0.1` and React 18. Installation reported 30
dependency audit findings; dependency security remediation was outside this
bug-audit scope.
