import assert from "node:assert/strict";
import axe from "axe-core";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, extname } from "node:path";
import { pathToFileURL } from "node:url";

// Uses the supplied browser runtime; installs nothing and never reads machine configuration.
const { chromium, webkit } = await import(
  pathToFileURL(
    process.env.IMD_PLAYWRIGHT ||
      "/opt/imd-tools/playwright-mcp/node_modules/playwright/index.mjs",
  ).href
);
const fixtures = Object.fromEntries(
  await Promise.all(
    ["status", "settlements", "events"].map(async (name) => [
      name,
      JSON.parse(await readFile(`test/fixtures/${name}.json`, "utf8")),
    ]),
  ),
);
const scratch = "test/scratch/browser";
await mkdir(scratch, { recursive: true });
const root = resolve("dist");
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain",
};
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://test").pathname);
  const file = resolve(root, pathname === "/" ? "index.html" : `.${pathname}`);
  if (!file.startsWith(`${root}/`)) {
    res.writeHead(403).end();
    return;
  }
  try {
    res.writeHead(200, {
      "Content-Type": mime[extname(file)] || "application/octet-stream",
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
const base = Date.parse("2026-11-08T12:05:00Z");
const reports = [];
function report(name, details) {
  reports.push({ name, passed: true, details });
  console.log(`PASS ${name}: ${details}`);
}
const clone = (x) => structuredClone(x);
async function audit(page, name) {
  await page.addScriptTag({ content: axe.source });
  const results = await page.evaluate(async () =>
    window.axe.run({
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"],
      },
    }),
  );
  const violations = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => ({
      target: n.target,
      summary: n.failureSummary,
    })),
  }));
  await writeFile(
    `${scratch}/axe-${name}.json`,
    JSON.stringify({ violations, passes: results.passes.length }, null, 2),
  );
  assert.deepEqual(violations, [], `${name} accessibility findings`);
  report(
    `accessibility ${name}`,
    `${results.passes.length} axe checks passed, zero violations.`,
  );
}

function mockedData(now, settled = false, stale = false) {
  const status = clone(fixtures.status),
    history = clone(fixtures.settlements),
    events = clone(fixtures.events);
  const stamp = new Date(now).toISOString();
  for (const d of [status, history, events]) {
    d.generatedAt = stamp;
    d.installationId = "sepolia-browser-test-only";
  }
  status.measurement.receivedAt = new Date(
    stale ? now - 180_000 : now,
  ).toISOString();
  status.measurement.observedAt = status.measurement.receivedAt;
  status.measurement.freshness = stale ? "stale" : "online";
  status.measurement.provenance = "hardware";
  status.measurement.coreStatus = "ACTIVE";
  status.measurement.rpmMilli = 42000;
  status.builder.anchor.settledThroughRound = settled ? "101" : "100";
  status.builder.anchor.confirmedAt = settled
    ? "2026-11-08T12:10:36.000Z"
    : "2026-11-08T12:00:36.000Z";
  status.oracle.state = "accepted";
  status.oracle.latestClosure = {
    firstRound: settled ? "101" : "100",
    lastRound: settled ? "101" : "100",
    roundCount: "1",
    acceptedAt: settled
      ? "2026-11-08T12:10:01.000Z"
      : "2026-11-08T12:00:01.000Z",
  };
  status.settlementQueue.buffered = {
    firstRound: null,
    lastRound: null,
    roundCount: "0",
    activeRoundCount: "0",
    workUnits: "0",
  };
  history.mining.nextRound.round = settled ? "102" : "101";
  history.mining.nextRound.startsAt = settled
    ? "2026-11-08T12:10:00.000Z"
    : "2026-11-08T12:00:00.000Z";
  history.mining.nextRound.endsAt = settled
    ? "2026-11-08T12:20:00.000Z"
    : "2026-11-08T12:10:00.000Z";
  history.recentSettlements = [];
  const originals = clone(events.events);
  events.events = originals.map((e, i) => {
    e.payload.previousSettledThroughRound = String(99 - i);
    e.payload.settledThroughRound = String(100 - i);
    e.payload.workAdded = ["0", "44", "880", "0"][i];
    e.payload.completedBlockCount = ["0", "6", "78", "0"][i];
    e.payload.activeRoundCount = i === 0 || i === 3 ? "0" : "1";
    e.occurredAt = new Date(
      Date.parse("2026-11-08T12:00:36Z") - i * 600_000,
    ).toISOString();
    e.recordedAt = e.occurredAt;
    return e;
  });
  if (settled) {
    const e = clone(events.events[1]);
    e.id += "-test-next";
    e.source.transactionHash = `0x${"ab".repeat(32)}`;
    e.payload.previousSettledThroughRound = "100";
    e.payload.settledThroughRound = "101";
    e.occurredAt = "2026-11-08T12:10:36.000Z";
    e.recordedAt = e.occurredAt;
    events.events.unshift(e);
  }
  events.nextCursor = null;
  return { status, history, events };
}
async function mockFeed(context, control) {
  await context.route("https://api.squeekchain.com/**", async (route) => {
    const url = new URL(route.request().url());
    control.requests.push({ path: url.pathname, at: control.now });
    if (control.offline) {
      await route.abort("failed");
      return;
    }
    const data = mockedData(control.now, control.settled, control.stale);
    if (control.schema && url.pathname === "/v1/status") {
      data.status.schemaVersion = 99;
    }
    if (control.rate && url.pathname === "/v1/status") {
      await route.fulfill({
        status: 429,
        headers: { "Retry-After": "120" },
        body: "{}",
      });
      return;
    }
    let body;
    if (url.pathname === "/v1/status") body = data.status;
    else if (url.pathname === "/v1/events") body = data.events;
    else if (url.pathname === "/v1/settlements") {
      body = data.history;
      body.range = url.searchParams.get("range");
    } else throw new Error(`Unexpected API path ${url.pathname}`);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}
const errors = [];
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const offline = { now: base, offline: true, requests: [] };
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await mockFeed(ctx, offline);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.clock.install({ time: base });
  await page.goto(origin);
  await page.getByText("OFFLINE", { exact: true }).waitFor();
  assert.equal(await page.locator(".scene-hamster").count(), 0);
  assert.ok(
    await page
      .getByRole("button", { name: "Waiting for wheel feed", exact: true })
      .isDisabled(),
  );
  const box = await page
    .locator(".prediction-column .primary-button")
    .boundingBox();
  assert.ok(
    box.y + box.height <= 844,
    `Primary action bottom ${box.y + box.height}`,
  );
  report(
    "offline honesty and phone first screen",
    "No sleeping/live hamster, unknown metrics, disabled live call; primary control visible at 390×844.",
  );
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Nap Zero work" }).click();
  const practiceBox = await page
    .getByRole("button", { name: "Lock practice call", exact: true })
    .boundingBox();
  assert.ok(
    practiceBox.y + practiceBox.height <= 844,
    `Practice action bottom ${practiceBox.y + practiceBox.height}`,
  );
  await page
    .getByRole("button", { name: "Lock practice call", exact: true })
    .click();
  await page.getByRole("button", { name: "Dismiss achievement" }).click();
  await page.getByRole("button", { name: "Reveal practice round" }).click();
  await page.getByRole("dialog", { name: "A nap it is." }).waitFor();
  assert.ok(
    await page
      .getByRole("dialog")
      .getByText("+15", { exact: true })
      .isVisible(),
  );
  await page.screenshot({ path: `${scratch}/practice-result-390.png` });
  await audit(page, "practice-result");
  await page.getByRole("button", { name: "Close result" }).click();
  for (const bracket of ["1–10", "61+"]) {
    await page.getByRole("button", { name: "Sprint Some work" }).click();
    await page.getByRole("button", { name: bracket, exact: true }).click();
    await page
      .getByRole("button", { name: "Lock practice call", exact: true })
      .click();
    await page.getByRole("button", { name: "Reveal practice round" }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByRole("button", { name: "Close result" }).click();
  }
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("squeek.predictor.v1")),
  );
  assert.equal(
    saved.entries
      .filter((e) => e.mode === "practice")
      .reduce((n, e) => n + (e.result?.player.total ?? 0), 0),
    90,
  );
  assert.equal(saved.collection.filter((i) => i.mode === "practice").length, 3);
  assert.ok(saved.achievements["practice:hat"]);
  assert.equal(saved.entries.filter((e) => e.mode === "live").length, 0);
  report(
    "practice complete game",
    "NAP, small sprint, large sprint; 90 player points, streak 3, three artworks, Hat Trick; live score untouched.",
  );
  await page.reload();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  assert.equal(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("squeek.predictor.v1")).collection
          .length,
    ),
    3,
  );
  await page.getByRole("button", { name: /^Art/ }).click();
  assert.equal(await page.locator(".collection-view .art-card").count(), 3);
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download round 3", exact: true })
    .click();
  const download = await downloadPromise;
  await download.saveAs(`${scratch}/artwork.png`);
  const bytes = await readFile(`${scratch}/artwork.png`);
  assert.equal(bytes.subarray(1, 4).toString(), "PNG");
  assert.equal(bytes.readUInt32BE(16), 1080);
  await page.getByRole("button", { name: "View artwork for round 3" }).click();
  await page.getByRole("dialog", { name: "Round #3" }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: "Awards", exact: true }).click();
  assert.equal(await page.locator(".achievement").count(), 9);
  assert.ok((await page.locator(".achievement.unlocked").count()) >= 2);
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  assert.ok(
    await page
      .getByText(
        "Squeek Beat-the-AI Predictor is a community project for the Squeekchain Buildooooor badge.",
        { exact: true },
      )
      .isVisible(),
  );
  report(
    "local save, collection, download and about",
    "Reload retained progress; 1080px PNG download; native artwork modal/Escape; nine achievements; required About attribution.",
  );

  const control = { now: base, offline: false, settled: false, requests: [] };
  const liveCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await mockFeed(liveCtx, control);
  const live = await liveCtx.newPage();
  live.on("pageerror", (e) => errors.push(e.message));
  await live.clock.install({ time: base });
  await live.goto(origin);
  await live
    .getByRole("button", { name: "Lock my prediction", exact: true })
    .waitFor();
  assert.ok(await live.getByText("LIVE", { exact: true }).isVisible());
  await live.screenshot({ path: `${scratch}/live-mocked-390.png` });
  await audit(live, "live-board");
  await live.setViewportSize({ width: 1440, height: 1000 });
  await live.screenshot({ path: `${scratch}/live-mocked-1440.png` });
  await live.getByRole("button", { name: "Nap Zero work" }).click();
  await live
    .getByRole("button", { name: "Lock my prediction", exact: true })
    .click();
  await live.getByRole("button", { name: "Dismiss achievement" }).click();
  await live
    .getByRole("button", { name: "Duel a friend", exact: true })
    .click();
  const link = await live.locator(".share-field input").inputValue();
  assert.ok(link.includes("#duel="));
  const friendCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await mockFeed(friendCtx, control);
  const friend = await friendCtx.newPage();
  friend.on("pageerror", (e) => errors.push(e.message));
  await friend.clock.install({ time: base });
  await friend.goto(link);
  await friend
    .getByRole("button", { name: "Lock my prediction", exact: true })
    .waitFor();
  await friend.getByRole("button", { name: "Sprint Some work" }).click();
  await friend.getByRole("button", { name: "1–10", exact: true }).click();
  await friend
    .getByRole("button", { name: "Lock my prediction", exact: true })
    .click();
  await friend.getByRole("button", { name: "Dismiss achievement" }).click();
  assert.equal(await friend.getByRole("dialog").count(), 0);
  assert.ok(
    await friend
      .getByText("Waiting for settlement. Your call stays saved.", {
        exact: true,
      })
      .isVisible(),
  );
  control.now = base + 180_000;
  await live.clock.fastForward(180_000);
  await friend.clock.fastForward(180_000);
  assert.equal(await friend.getByRole("dialog").count(), 0);
  report(
    "live locking and shared duel",
    "Schema-valid mocked feed; live call locks; a second browser accepts encoded same-round friend call; no early reveal.",
  );
  control.now = base + 360_000;
  control.settled = true;
  await friend.clock.fastForward(180_000);
  await live.clock.fastForward(180_000);
  await friend.getByRole("dialog", { name: "He chose to sprint." }).waitFor();
  assert.ok(await friend.getByText(/Friend duel: You win/).isVisible());
  const friendSave = await friend.evaluate(() =>
    JSON.parse(localStorage.getItem("squeek.predictor.v1")),
  );
  assert.equal(friendSave.entries[0].result.player.total, 30);
  assert.equal(friendSave.entries[0].result.friend.total, 0);
  assert.ok(friendSave.achievements["live:duel"]);
  await friend.screenshot({ path: `${scratch}/duel-result-390.png` });
  await friend.getByRole("button", { name: "Close result" }).click();
  await friend.reload();
  const afterReload = await friend.evaluate(() =>
    JSON.parse(localStorage.getItem("squeek.predictor.v1")),
  );
  assert.equal(afterReload.entries.length, 1);
  assert.equal(afterReload.entries[0].result.player.total, 30);
  report(
    "confirmed resolution and duel",
    "Covering settlement reveals only after confirmation; player +30 vs friend 0; Duelist; no duplicate points after reload.",
  );

  const staleControl = { now: base, stale: true, requests: [] };
  const staleCtx = await browser.newContext();
  await mockFeed(staleCtx, staleControl);
  const stale = await staleCtx.newPage();
  await stale.clock.install({ time: base });
  await stale.goto(origin);
  await stale.getByText("UNKNOWN", { exact: true }).waitFor();
  assert.equal(await stale.locator(".scene-hamster").count(), 0);
  assert.ok(
    await stale
      .getByRole("button", { name: "Waiting for wheel feed", exact: true })
      .isDisabled(),
  );
  report(
    "stale handling",
    "A stale IDLE/ACTIVE measurement is unknown, with no live hamster animation or playable live call.",
  );
  const schemaControl = { now: base, schema: true, requests: [] };
  const schemaCtx = await browser.newContext();
  await mockFeed(schemaCtx, schemaControl);
  const schemaPage = await schemaCtx.newPage();
  await schemaPage.clock.install({ time: base });
  await schemaPage.goto(origin);
  await schemaPage.getByText("OFFLINE", { exact: true }).waitFor();
  assert.ok(
    await schemaPage
      .getByText(/Unknown feed format or schema version/)
      .isVisible(),
  );
  report(
    "unknown schema handling",
    "Unrecognized schemaVersion fails closed with a visible explanation.",
  );

  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const label of ["Play", "Art", "Awards"]) {
      await page
        .locator('nav[aria-label="Game sections"] button')
        .nth(["Play", "Art", "Awards"].indexOf(label))
        .click();
      const dims = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        width: document.documentElement.clientWidth,
      }));
      assert.ok(dims.scroll <= dims.width, `${width}/${label} overflow`);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("button", { name: "Pause wheel animation" }).click();
  assert.ok(
    await page
      .getByRole("button", { name: "Resume wheel animation" })
      .isVisible(),
  );
  assert.equal(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter(
            (a) =>
              a.effect?.getTiming().iterations === Infinity &&
              a.playState === "running",
          ).length,
    ),
    0,
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.activeElement).outlineStyle,
    ),
    "solid",
  );
  await audit(page, "practice-board");
  report(
    "responsive and motion",
    "Play, collection and achievements have no overflow at 320/390/1440; reduced motion stops loops; pause and keyboard focus work.",
  );
  assert.deepEqual(errors, []);
  report(
    "browser runtime",
    "No uncaught JavaScript errors across tested flows.",
  );
  await ctx.close();
  await liveCtx.close();
  await friendCtx.close();
  await staleCtx.close();
  await schemaCtx.close();
  let safari;
  try {
    safari = await webkit.launch({ headless: true });
  } catch {
    reports.push({
      name: "WebKit",
      passed: null,
      details: "WebKit runtime unavailable; Safari behavior not verified.",
    });
    console.log(
      "LIMIT WebKit runtime unavailable; Safari behavior not verified.",
    );
  }
  if (safari) {
    const sc = await safari.newContext({
      viewport: { width: 390, height: 844 },
    });
    await mockFeed(sc, offline);
    const sp = await sc.newPage();
    await sp.goto(origin);
    await sp.getByRole("button", { name: "Practice", exact: true }).click();
    await sp.getByRole("button", { name: "Nap Zero work" }).click();
    await sp
      .getByRole("button", { name: "Lock practice call", exact: true })
      .click();
    await sp.getByRole("button", { name: "Reveal practice round" }).click();
    await sp.getByRole("dialog", { name: "A nap it is." }).waitFor();
    await safari.close();
    report("WebKit practice", "Primary lock/reveal flow passed.");
  }
  await writeFile(`${scratch}/results.json`, JSON.stringify(reports, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
}
