# Squeek Beat-the-AI Predictor

Squeek Beat-the-AI Predictor is a community project for the Squeekchain Buildooooor badge.

An original, free browser game: make a call on Squeektoshi’s next settled round and duel Professor Whiskers, a transparent deterministic AI rival. No account, wallet, server, database, payments, prizes, tokens or transactions. Scores are local points, not a global leaderboard. No Genesis approval is claimed.

Built through the **IdentityMD contributor network** ([imd.fun](https://imd.fun/)), task `bc3c2de3-1707-4fe2-9049-517d093591bb`. Preserve this attribution in redistributed source and the published site.

## Play

1. Choose **Live** for real Sepolia wheel data, or **Practice** for an immediate game with fixed simulated rounds.
2. Call **Nap** if the settlement will add zero work, or **Sprint** if it will add positive work.
3. For Sprint, also choose the completed Squeek block bracket: **1–10**, **11–30**, **31–60**, or **61+**.
4. Lock before the round closes. Both your call and the Professor’s inputs are saved. Neither can be edited after locking.
5. Live predictions wait for a confirmed settlement whose range covers the predicted round. The result reveals points, streak, rival comparison and a collectible artwork. No clock, wheel speed or optimistic block projection can resolve a live call.

The open round is `builder.anchor.settledThroughRound + 1`. It may already have closed while Ethereum settlement catches up. In that case, the board says **waiting for settlement** and offers Practice. Round timing comes from the documented `mining.nextRound` window in the settlement response; an absent timing window prevents live calls instead of inventing a deadline. The expected settlement countdown uses the median recent spacing, bounded to 10–15 minutes, and is explicitly an estimate.

In Practice, lock a prediction, then press **Reveal practice round**. The fixed cycle is Nap (0 work, 0 blocks), a small Sprint (44 work, 6 blocks), and a large Sprint (880 work, 78 blocks). It repeats. Practice has separate scores, history, AI training, art and achievements. It is always labelled PRACTICE and never fills gaps in the live feed.

## The Professor’s formula

The Professor uses only confirmed settlement history from the rolling last seven days. The rule in `src/game.ts` is deterministic for the same history and decision time. He does not read your choice, live RPM, or an external AI service.

Let `H` be the sprint share of usable rounds with the same **UTC settlement hour** as the decision time. Let `M` be the sprint share of the last three usable rounds in round order:

```text
H = hour_sprints / hour_samples
    or all_sprints / all_samples when this hour has no samples
    or 0.5 when no history is available

M = last_three_sprints / last_three_samples
    or H when no recent samples are available

P(sprint) = 0.7 × H + 0.3 × M
call = SPRINT if P(sprint) >= 0.5, otherwise NAP
```

For Sprint, his bracket is the most frequent observed positive-block sprint bracket in this UTC hour. If this hour has no sprint samples, he uses all available hours. Ties prefer the smaller bracket. With no bracket samples, he uses the disclosed `1–10` prior. His call, percentages, sample counts, last three known outcomes and fallback state are visible under **Show the Professor’s thinking**, then frozen when you lock.

Single-round settlements provide exact training outcomes. A zero-work batch establishes Nap for every covered round; those observations use the batch’s UTC settlement hour. A positive multi-round batch cannot identify individual round outcomes, so it is excluded from AI training. “Last three” means last three **usable, known** rounds; missing activity is never converted into naps. The site makes no real accuracy claim.

## Scoring and achievements

Player and Professor use the same function:

| Condition | Points |
| --- | ---: |
| Correct Nap/Sprint call | +10 |
| Correct Sprint block bracket | +15 |
| Current consecutive correct-call streak of length `n` | +5 × `n` |

The first correct call earns a +5 streak bonus, the second +10, the third +15, and so on. A missed call resets that side’s streak; a skipped round does not change it. An incorrect bracket does not break a correct Nap/Sprint streak. Positive work with zero completed blocks earns call points but no bracket points. Unresolved calls settle in round order so later arrivals cannot jump a streak.

Weekly scores use Monday 00:00 UTC through the following Monday, attributed by settlement timestamp. All-time scores remain in this browser. The nine local achievements are:

| Achievement | Unlock |
| --- | --- |
| First Call | Lock a prediction |
| Night Owl | Correct call settled at 00:00 ≤ UTC time < 05:00 |
| Hat Trick | Three correct calls in a row |
| Ten Streak | Ten correct calls in a row |
| Bracket Master | Five exact Sprint brackets |
| Beat the Professor | Finish a completed UTC calendar week with more points than the AI |
| Duelist | Win a shared friend duel |
| Collector | Collect ten distinct settlement artworks |
| Sleep Whisperer | Correctly predict five naps |

Unlocks announce in a dismissible toast. Practice unlocks are labelled and stored separately. These are game achievements only; they confer no Genesis badge, whitelist, airdrop or reward.

## Friend duels and local art

After locking a live call, **Duel a friend** creates a shareable URL hash carrying the round, calls, installation and closing time. A friend opens it and makes their own call for that same still-open round. Their browser compares both predictions when a confirmed settlement arrives. Both friend-duel streaks start at zero; the player’s main score keeps its own streak. Expired, malformed and different-installation challenges cannot be used to call a closed round.

This is a one-way, unauthenticated challenge. Links can be edited. No identity or earlier lock time is proved, and no score or result syncs back to the sender. The clipboard has a selectable-link fallback.

Every displayed settlement generates canvas art using a seeded PRNG derived from its transaction hash. Work controls density; completed blocks control colour and energy. Naps produce calm night skies and sprints produce swirls. Played settlements are collected automatically, and older pieces can be collected from **Show more settled art**. Open a piece to inspect its full seed or download a 1080 × 1080 PNG. A batch shares its hash and aggregate artwork across the covered rounds.

## Verified feed and honest limits

Facts and wire contracts were checked on **2026-11-08** against the [official API reference](https://docs.squeekchain.com/developers/api/), [rounds and Squeek blocks](https://docs.squeekchain.com/system/rounds-and-blocks/), and [Genesis /code](https://squeekchain.com/genesis/code). Rounds last 600 seconds; one accepted wheel-magnet passage is one work unit; verified work settles on Ethereum and completes Squeek blocks.

The app makes public GET requests only:

| Endpoint | Cadence | Expected schemaVersion |
| --- | --- | ---: |
| `https://api.squeekchain.com/v1/status` | Every 10 seconds | 1 |
| `https://api.squeekchain.com/v1/settlements?range=24h` | Every 60 seconds | 3 |
| `https://api.squeekchain.com/v1/settlements?range=7d` | Every 60 seconds | 3 |
| `https://api.squeekchain.com/v1/events?category=protocol&limit=100` and its documented cursor | Initial seven-day backfill, then incremental every 60 seconds | 4 |

Recent-settlement lists omit settlements that completed zero blocks. The documented protocol event feed is therefore needed for naps and zero-block sprints; mining checkpoint events are not substituted for work settlements. Only safe Sepolia chain settlement events, eventVersion 2, can resolve calls. Downloaded official JSON Schemas are bundled locally in `src/schemas/` and checked with Ajv 2020, date/time/UUID formats and unsigned decimal-string bounds. No runtime schema download is needed.

Requests have an eight-second timeout, no overlapping same-channel polls, exponential backoff capped at 16 times the normal interval, and a shared cooldown honouring `Retry-After` on HTTP 429/503. New calls require fresh, hardware-origin measurements, a complete history scan, matching installation IDs, a known closing time and an unclosed round. Changed schemas, network mismatch, unavailable responses, stale timestamps and malformed data fail closed.

The visible LIVE label includes the reading’s UTC timestamp. Offline or stale means OFFLINE/UNKNOWN, never “asleep.” Only a fresh IDLE reading shows the sleeping hamster and Zs. ACTIVE animation follows `rpmMilli / 1000`, with a pause control and reduced-motion support. Raw reported RPM can remain nonzero in an IDLE snapshot; the idle wheel animation still stops.

Two API limits are explicitly reflected in the UI:

- `distanceMm` is daily distance, not round distance. The game shows the measured delta **this round, since visit**, starting at its first fresh reading in that round. Before-visit distance is not invented. A counter/day reset makes that delta unknown until the next round.
- Seven-day buckets span six hours, not one hour. The 24-hour strip repeats the actual six-hour totals across the corresponding hours. Colour is relative to the busiest window; selected cells state active-round counts and the coarse resolution. It is not an hourly probability.

If a confirmed settlement covers multiple rounds, predictions for those rounds resolve using that settlement’s aggregate work and completed blocks. The reveal explains this; individual positive-round work cannot be recovered from a batch. The history backfill is bounded to 40 pages and seven days. Missing or older pending evidence stays waiting rather than being guessed. Live availability and settlement latency depend on the public API; Practice remains available whenever the app itself has loaded.

**Sepolia testnet only, November 2026. $SQK has not launched on mainnet.** No mainnet transactions, price chart, price/return/earnings forecast or financial promises are part of this project.

## Install, run, preview and rebuild

Requires Node.js 22 and npm. All runtime assets, fonts and schemas are local; only public feed reads need the network after deployment.

```sh
npm ci
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
```

Open the local URL printed by Vite. `dev` and `preview` bind to localhost. Production files are already included in **`dist/`**; rebuilding replaces them. Vite’s `base: './'`, relative asset URLs, one HTML entry and hash-based duel links support IPFS gateway subpaths without server rewrites. Serve through HTTP(S), not `file://`. No secrets or environment file is needed.

`npm test` runs the Node test runner through the TypeScript loader. It is network independent. Optional browser interaction/accessibility tests use a caller-provided Playwright module and installed Chromium:

```sh
IMD_PLAYWRIGHT=/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs PLAYWRIGHT_BROWSERS_PATH=/opt/imd-tools/ms-playwright npm run test:browser
```

Outside IMD, set `IMD_PLAYWRIGHT` to your own Playwright `index.mjs` and `PLAYWRIGHT_BROWSERS_PATH` to your installed browser directory. The suite serves the built export, blocks real feed access with explicit test fixtures, and uses a virtual clock; it does not wait ten real minutes. It writes only under `test/scratch/`, which is not a build input or submitted deliverable.

## Validation

Actual checks, fixed findings and limitations are recorded in [VALIDATION.md](VALIDATION.md). The production build and TypeScript check pass. Unit tests cover AI determinism/formula, scoring and streaks, NAP/small/large settlement resolution, open-round arithmetic, closure/queue guards, stale/offline/simulated handling, Retry-After, schema/network rejection, duels, achievements, art seeds and counter resets. Chromium interaction tests cover the complete practice game, persistence, collection/downloads, two-browser live duels with mocked confirmed settlements, unknown schemas, and 320/390/1440 layouts. Axe audits reported zero violations in the tested board and result states. Safari remains unverified because WebKit was unavailable.

An additional check fetched and schema-validated the actual public endpoints, including a complete seven-day event scan with naps. A Chromium inspection forwarded those real public HTTPS response bodies unchanged through the test runner and showed a timestamped LIVE wheel, real Professor inputs and real settlement art with no uncaught JavaScript errors. Mocked-feed interaction tests are not claimed as observed real-world duel outcomes.

## Hosting and public source handoff

The complete source, package manifest, lockfile, local runtime assets and finished static export are included. IMD’s delivery plane publishes the submitted `dist/` to IPFS/IMD after review; the worker does not run a separate publishing command. Hosting and the public repository URL are post-review handoffs, not fabricated URLs in this tree. No independently created public GitHub repository or live deployment URL is claimed here. Publish the full source and `dist/` together to the allocated public GitHub repository, preserving attribution.

## Genesis /code verification

Verification is a project-owner step after the final site and public GitHub repository exist. The game itself never asks players for a wallet or account.

1. Open [Genesis /code](https://squeekchain.com/genesis/code) and add the project from the owner’s Genesis profile. For the IMD route, use the wallet verified on that profile that paid for the project’s first job; the team still reviews the submission.
2. For **direct verification**, use a domain you own. Point it to the final hosted site using your hosting provider’s domain setup.
3. Add the **exact DNS TXT name and value issued by Genesis** at your DNS provider. Wait for that actual record to propagate; do not invent a verification token or record name.
4. Copy the **exact page tag issued by Genesis** into the source `index.html` head, then rebuild and publish `dist/`.
5. Add the **exact repository verification line issued by Genesis** to this README in the project’s **public GitHub repository**. The community-project sentence above is attribution, not a replacement for that owner-specific verification line.
6. Return to Genesis /code and press **Verify**. Keep the TXT record, page tag and README line in place for rechecks. A successful ownership check is not a claim of Genesis approval; team approval is separate.

The domain, owner-issued verification strings and final repository URL were not supplied for this build. None were guessed or installed as stand-ins. The source is ready for the owner to add the issued values after the publishing handoff.

## Source map, privacy and submission budget

- `src/App.tsx`: arena, views, local flow, dialogs, duels and activity strip.
- `src/game.ts`: pure AI, scoring, resolution, round timing, achievements, encoding and distance rules.
- `src/api.ts`, `src/useFeed.ts`, `src/schemas/`: versioned public reads, validation and polling.
- `src/Characters.tsx`, `src/art.ts`, `src/ArtCanvas.tsx`: original pixel characters and deterministic artwork.
- `src/storage.ts`: local save under `squeek.predictor.v1`. Clearing site data removes progress. Restricted storage or quota failure shows a warning; memory-only play remains possible. Local state can be edited and is not authenticated.
- `src/*.test.ts`, `test/browser.mjs`, `test/fixtures/`: reproducible tests and clearly identified fixtures, excluded from the runtime export.
- `public/`: local font, original favicon/share artwork and font licence.
- `DESIGN.md`: implemented visual tokens and responsive component rules.

The explicit ignore-file path budget is **`.gitignore`: at most 256 bytes**, containing only `**/node_modules/`, `/.cache/`, `/test/scratch/` and `*.tsbuildinfo`. These exclude generated dependencies, the task-local npm cache, scratch checks and compiler caches. **`dist/` is deliberately not ignored.** No nested dependency directory, package archive, source map or vendored registry is required. The finished submission is checked against the 8 MiB limit; measurements are in VALIDATION.md.

Design guidance attribution: Jakub Krehel’s Better Interface (MIT), pinned commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`; design documentation guidance adapted from Paul Bakaus’s Impeccable (Apache-2.0), commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`. Preserved licence texts are in `docs/design-guide-LICENSE.txt`. Outfit is bundled under the SIL Open Font License in `public/FONT-LICENSE.txt`. Lucide icons retain their package licence. The pixel characters, game interface and generative artwork code were made for this project.
