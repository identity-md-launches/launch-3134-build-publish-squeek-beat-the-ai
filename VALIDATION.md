# Validation record

Checked on 2026-11-08 against the built static export. These are worker-run checks, not an independent certification or Genesis approval. No deployment or public repository URL is claimed before the IMD publishing handoff.

## Revision: pending calls older than seven days

Finding `dfbadd458610d9c97744e87c3c8668a30f6a297160e1694c9d42aa2145caa9b3` reproduced before the fix. The new test in `src/events.test.ts` supplied schema-valid safe settlements for #101 on November 8 and #1253 on November 16. The original loader returned only `[1253]` with `complete=true`, and its assertion failed because #101 was absent. These dates and outcomes are synthetic review fixtures, not real-world observations.

Fixed at `src/api.ts:195`: pending live calls from the matching installation extend evidence retention through their oldest lock time. Cached overlap cannot end a scan while an older settled call still lacks evidence. Forty pages is now a per-poll budget with a continuation, rather than a permanent scan limit. Page checkpoints survive transient failures; documented HTTP 400/409 cursor invalidation starts a fresh scan. `src/useFeed.ts:27` receives saved entries from `src/App.tsx:94` through a ref, preserving the existing polling loops. Scoring order and the seven-day AI filter in `src/game.ts` are preserved.

Actual revision checks:

| Check | Result |
| --- | --- |
| `npm ci --cache .cache/npm --no-audit --no-fund` | Installed the existing lockfile; root manifest/lockfile unchanged |
| `npm run typecheck` | Passed, no diagnostics |
| `npm test` | **61 passed, 0 failed**, including 8 new evidence/backfill regressions |
| `npm run build` | Passed; final export rebuilt after the last source change |
| `npm run test:browser` with the supplied Playwright/Chromium paths | All Chromium flows passed, including the return scenario below; no uncaught JavaScript errors |
| Pinned taste@1 command below | **16/16 passed**; no overflow, overlap or clipped text at 320/390/1440 |
| Axe audits | Zero violations: 44 checks each on live/practice boards; 19 each on practice/recovered result dialogs |
| WebKit | Runtime unavailable; Safari remains unverified |

The browser regression in `test/browser.mjs:410` locks #101, reloads eight virtual days later and locks #1253 while both remain unresolved. A first page supplies #1253, cached recent rows and a record past the training cutoff; the needed #101 is behind an older cursor. An injected 409 error keeps both calls waiting and shows the feed error. After the virtual backoff, the restarted scan retrieves the old evidence, then resolves #101 for **30** and #1253 for **35** points, with streak **2**, **two live artworks**, **35 weekly points** and **65 all-time points**. Reloading does not duplicate points or reveal an old result again. The unit suite separately verifies 41-page resumption and transient network failure checkpoints.

Screenshots inspected: `test/scratch/browser/live-mocked-390.png`, `return-pending-390.png`, `return-result-390.png`, and `test/scratch/taste/shots/390.png`. The primary controls fit the 390×844 screen; the recovered result shows +35 with +10 call, +15 bracket and +10 streak, without clipped text. All browser feed fixtures are isolated from production.

The pinned Better Interface guide was applied to the changed states across all six domains: accessibility (native controls/dialog, visible error, keyboard/reduced-motion checks and zero axe violations); layout (390px result/first-screen inspection, automated 320/390/1440 checks); writing (existing explicit waiting/error copy, no fabricated result); typography (existing Outfit scale/weights, probe passed); colors (existing rendered pairs pass the probe); UI (pending, cursor error, recovered result, collection, score switching and reload). No visual source change was required. Existing limitations below still apply, including human screen-reader use, RTL/200% zoom, Safari and animation-panel replay. Live API retention and availability cannot be guaranteed; genuinely absent evidence remains waiting. The revision uses only the documented event endpoint/cursor, rechecked against the [official API reference](https://docs.squeekchain.com/developers/api/) on 2026-11-08; actual public gameplay was not observed anew in this revision.

Revision integrity audit: **47 eligible files, about 1.41 MiB**, including **9 files / 657,909 bytes** in `dist/`, below the 8 MiB limit. Local HTML/CSS/module asset references resolve; the export is not ignored. The root package manifest, lockfile and ignore file are unchanged. No symlink, dependency/cache directory, source map or package archive is included. `.imd-responses.json` contains the exact finding ID and `fixed` verdict; the worker consumes that response separately.

Complete for this revision’s scope. The following original-build record is preserved as historical evidence; its direct public-feed observations were not re-run for the revision.

## Results

| Check | Actual result |
| --- | --- |
| Production build: `npm run build` | Passed; Vite 6.4.1, relative static assets, no chunk-size warning after splitting API schemas |
| TypeScript: `npm run typecheck` | Passed, no diagnostics |
| Unit tests: `npm test` | 53 passed, 0 failed; Node test runner, no network required |
| Interaction suite: `PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright npm run test:browser` | Chromium passed; virtual clock and clearly mocked, schema-valid feed fixtures |
| Axe: practice result dialog | 19 checks passed, zero violations |
| Axe: live board and practice board | 44 checks passed in each state, zero violations |
| Pinned taste@1 probe | 16/16 checks passed on final export |
| Responsive views | Play, Collection and Achievements had no horizontal overflow at 320, 390 and 1440px |
| First screen | Both live and practice primary controls measured within 390 × 844; screenshots inspected |
| Public source schemas | Real status v1, settlements v3 and events v4 responses passed the downloaded official schemas |
| Actual feed inspection | Complete seven-day public event scan; real data displayed in Chromium through unchanged-response transport forwarding; no uncaught JS errors |
| WebKit | Runtime unavailable; Safari behaviour not verified |
| Hosting/public GitHub | After-review IMD handoff; not executed or invented by this worker |

The exact final probe command was:

```sh
IMD_PLAYWRIGHT=/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright node .imd/reads/skills/design-critic/scripts/taste.mjs --out test/scratch/taste
```

Probe categories passed: render, layout, targets, contrast, casing, tracking, eyebrows, type sizes, typefaces, glyphs, slogans, repetition, copy budget, chrome, motion and share. It measured no horizontal scrolling, text overlap, floating-control obstruction or clipped text at 320/390/1440. On the tested initial phone screen it counted 16 words of prose, below its 60-word bar. It found one font family and three weights. Its minimum 24px/spacing target check passed; many secondary controls are smaller than the preferred 44px comfort size. Main lock/reveal actions are at least 46px tall.

## Meaningful game checks

The unit suite covers the actual source functions, including:

- AI formula, deterministic replay with identical/reordered history, seven-day and future-time filtering, empty-hour/history priors, bracket tie-breaking, and honest treatment of zero-work and mixed positive batches.
- Both sides’ identical scoring; exact bracket edges; the first +5 and growing streak bonus; reset on a wrong call; positive work with zero completed blocks.
- Confirmed NAP, small Sprint and large Sprint resolution; range coverage; future/pre-lock rejection; waiting with no settlement; idempotence; ordered streak resolution; live/practice separation; fair friend-duel streaks.
- Open-round plus-one arithmetic, unavailable anchors and safe-integer limits; exact closing windows; closed/oracle/buffer guards; settlement spacing bounds.
- Hardware freshness, absent/offline/stale/simulated/replay/fault/future data; malformed and unknown-version responses; wrong-network and stale history rejection; Retry-After seconds/date parsing and cooldown.
- Weekly UTC boundaries, settlement-time scoring, achievement separation and week completion, collection thresholds, UTF-8 duel encoding and malformed links, stable artwork RNG, fixed practice outcomes and counter/day-reset handling.

The browser suite performed the complete primary flows on the built export:

1. Offline live game: no fake hamster or sleeping state, unknown metrics, blocked live lock, Practice accessible on the first phone screen.
2. Three practice rounds: Nap, six-block Sprint, 78-block Sprint. The player earned **90 points**, reached streak **3**, collected **3 artworks** and unlocked Hat Trick. Live score/history remained empty.
3. Reload persistence, collection navigation, native art modal/Escape, a verified **1080px PNG** download, nine achievement cards and the required About attribution.
4. Schema-valid mocked live feed: lock a call, generate its duel link, open it in a second independent browser context, and make a same-round friend call. No reveal occurred before a settlement was supplied.
5. Advance the virtual clock and supply a covering confirmed settlement: reveal, **player +30 vs friend 0**, Duelist unlock and no duplicated points after reload.
6. Stale and unknown-schema paths, visible explanations, responsive view switching, pause/resume control, reduced-motion loop suppression and visible keyboard focus. No uncaught JavaScript errors were recorded across these flows.

Mocked tests never enter the production build. `test/fixtures/README.md` identifies their source and in-memory rewrites; the test script intercepts requests only in its own browser contexts. Test clocks are advanced programmatically, with no real ten-minute wait.

## Real endpoint evidence and limits

An additional direct check used the production `fetchStatus`, `fetchHistory`, `fetchEvents`, `feedHealth`, `roundTiming` and `predict` functions against the actual public HTTPS endpoints. It completed successfully with **24 day buckets, 28 week buckets, 420 settlement events and 350 zero-work events**, a complete scan, known closing schedule and LIVE hardware health at that observation. These are historical validation counts, not constants in the site.

A separate Chromium inspection displayed real **open round #609** and a **01:16:21 UTC** LIVE reading on 2026-11-08. Its Professor inputs showed 14% sprint for that UTC hour, last three known outcomes all Sprint, and a blended 40% Sprint probability, yielding Nap. The browser test runner forwarded the public HTTPS response bodies **unchanged**, without replacing dates, work, hashes or installation IDs. This transport bridge was needed because direct browser external-network access was unavailable in this check environment. It is a scratch-only check, not a deployed proxy or backend. No uncaught JavaScript error was recorded.

Observed real-world live results are not claimed for the mocked duel test. API uptime, actual long-term accuracy, multi-day user retention, and a real friend opening a published URL remain outside this local validation. The app’s browser network access after publishing depends on the documented public CORS service.

## Better Interface review across all six domains

| Domain | Coverage and fixes | Remaining limits |
| --- | --- | --- |
| Accessibility | Native buttons/disclosures/dialogs, explicit names and pressed states, labels, skip link, 3px focus ring, keyboard/Escape, reduced motion, manual pause, polite status/toasts; axe and probe checks passed | No human screen-reader or switch-device session; real iPhone/Safari unavailable |
| Layout | Real export inspected at 320/390/1440; main controls moved up on phones; 24-hour targets changed to three rows of eight; open galleries and shared alignment; no measured overflow/overlap/clipping | RTL, OS text scaling and actual browser 200% zoom not verified |
| Writing | Plain adjacent directions, explicit unknown/waiting/practice/local labels, no accuracy or financial promise; removed redundant two-part slogans; required community attribution present in About/README | About intentionally contains detailed rules below the game; does not fit in one screen |
| Typography | Local Outfit WOFF2, three used weights, six semantic size roles, tabular metrics, readable input sizes, wrapping full hashes; probe counted five repeated sizes at both sampled widths | Platform rasterisation and font fallback differences not exhaustively tested |
| Colors | One orange action, separate Nap/saved states, neutral paper surfaces; secondary text darkened after measured contrast failures; final probe/axe passed | Canvas artwork is decorative and has no text contrast claim; no dark mode |
| UI details | Selected/check states, locked/pending/result/error/empty flows, saved art, native modal containment/focus return, no border-plus-shadow cards, reduced-motion and pause paths | Safari rendering and animation-panel 10% replay not verified |

### Fixed findings

| Finding | Source and disposition | Evidence |
| --- | --- | --- |
| Secondary text contrast on scoreboard/activity surfaces | `src/style.css:17`, `--muted` changed from `#746f66` to `#686258` | Initial probe reported 4.16:1 and 4.3:1; corrected token pairs compute to **5.03:1** on `#eeeae1` and **5.20:1** on `#f0eee7`; final rendered checks pass |
| Narrow, crowded phone hour-strip targets | Final mobile `.hour-strip` rule in `src/style.css:2444` | Initial 24-column phone targets were 13px wide. Three rows of eight with hour labels now meet the probe’s target/spacing check |
| Main prediction pushed toward/below the phone fold | Final `.mobile-nav`, `.site-header`, `.wheel-scene` and `.game-board` mobile overrides in `src/style.css:2503`; nav in `src/App.tsx:521` | Shorter nav and scene bring both practice and live lock actions within 390 × 844; browser assertions and inspected screenshots confirm |
| Repeated two-beat slogans | `src/App.tsx:484` intro, Professor line, scoreboard empty state and gallery heading | Initial probe counted six; final probe counted two, including a data row false-positive, below its limit |
| Unnamed phone help control and dialogs | `src/App.tsx:472`, `aria-label="How to play"`, result/art `aria-labelledby`, `restoreFocus` | Explicit accessible names and native modal focus paths; tested states have zero axe violations |
| Historical pattern implied a percentage unsupported by bucket totals | `src/App.tsx:1433`, `ActivityStrip` | Now displays active-round counts and intensity relative to the busiest six-hour window; UI states the coarse resolution |
| Counter resets could misstate a since-visit distance | `src/game.ts:24`, `observeDistance`; use in `src/App.tsx` | Reset or epoch change makes the current delta unknown; both reset paths covered by tests |
| Feed installation transition could mix history with a different current status | `src/useFeed.ts:102`, `eventsInstallationId`; guards in `src/App.tsx:173` | Both the lock state and live reconciliation require matching event/status installation IDs; ordinary matching-feed flows pass |

Other measured solid token pairs: ink `#302d29` on page `#f7f6f2` **12.67:1**; action text `#fffefa` on `#be4729` **5.05:1**; focus `#246d99` against `#fffefa` **5.59:1**. These ratios were calculated using WCAG sRGB luminance for the identified source pairs; they are not claims about text placed over artwork.

## Requirement coverage

| Brief requirement | Delivery |
| --- | --- |
| Original browser game, immediately playable, no account or wallet | Arena with explicit live/practice switch; fixed, separately labelled instant practice |
| Nap/Sprint and four Sprint brackets | Interactive grouped choices, validation, immutable local lock |
| Professor with deterministic rule and visible inputs | Pure tested formula, disclosure, no accuracy claim |
| Weekly/all-time head-to-head and streak scoring | Separate local player/AI totals and result breakdown |
| Resolve only on covering settlements | Safe protocol settlement events and range/date checks; waiting state |
| Live wheel with speed, sleep and honest unknown states | Timestamped LIVE/UNKNOWN/OFFLINE strip and original pixel scene |
| Open-round distance | Scoped, measured since-visit delta; complete pre-visit distance unavailable from the supplied status API and never invented |
| 24-hour activity from seven-day buckets | Relative activity strip; actual six-hour resolution disclosed |
| Deterministic art and local collection | Transaction-hash seeds, NAP skies, work/block-driven swirls, collect and PNG download |
| Nine local achievements and toast | All nine named unlock rules present; separate practice/live storage |
| Shareable friend duel | UTF-8 URL hash, same-round/installation/deadline checks, second-context resolution; editable/local nature disclosed |
| Points only, Sepolia only, no mainnet/financial/promotional promise | Explicit UI/About/footer/README disclaimers; no wallet or write API paths |
| Required project attribution and Genesis instructions | README first paragraph, About, IMD footer/meta attribution, exact-value owner verification steps |
| Source, manifest/lock, relative static export | Root React/TypeScript source and configuration, package lock, `dist/index.html` and local assets |
| Title/favicon/description/OG metadata | Exact requested title, original SVG favicon, local 1200 × 630 PNG social image |
| Six-domain review and design documentation | This review plus final-source `DESIGN.md` |
| Hosted site and public GitHub URL | IMD post-review publication/source handoff; no fabricated destination, no local publishing command |

## Submission integrity and budget

The submission was enumerated using read-only `git ls-files --cached --others --exclude-standard`. An intermediate audit before this validation document and the final installation guard contained **45 files / 1,434,131 bytes**, including a **9-file / 656,894-byte** static export, with **zero symlinks**. The final source and this document remain well below the **8,388,608-byte** cap; the final audit is recorded below.

The ignore file is **55 bytes**, within its explicit 256-byte path budget. `git check-ignore -v dist/index.html` prints nothing: the export is eligible for the worker’s commit. Generated `node_modules` directories, task-local npm caches and scratch outputs are ignored. No package archive, vendored registry, source map, nested Git checkout or environment file is part of the deliverable. The worker, not this agent, stages and commits the final tree.

Scratch screenshots and automated reports exist only under `test/scratch/` during checking and are removed by the job pipeline. Durable evidence here is the check description and actual result, not a claim that those scratch files are submitted. The pinned `.imd/reads/` inputs are likewise not runtime or build dependencies.

Final integrity audit: **46 files / 1449637 bytes** in the submission bundle; **9 files / 657145 bytes** in `dist/`. Both are below the 8 MiB submission cap. All local HTML/CSS asset references resolved, the share PNG is 1200 × 630, test fixtures are absent from runtime bundles, and the export is not ignored.
