import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import statusSchema from "./schemas/status.json";
import historySchema from "./schemas/settlements.json";
import eventSchema from "./schemas/events.json";
import { mergeSettlements, WEEK_MS } from "./game";
import type { History, Settlement, Status } from "./types";

const ajv = new Ajv2020({ strict: false, allErrors: false });
addFormats(ajv);
for (const bits of [64, 96, 256])
  ajv.addFormat(`uint${bits}-decimal`, {
    type: "string",
    validate: (s: string) =>
      /^(0|[1-9]\d*)$/.test(s) &&
      s.length <= 78 &&
      BigInt(s) < 2n ** BigInt(bits),
  });
const validators = {
  status: ajv.compile(statusSchema),
  history: ajv.compile(historySchema),
  events: ajv.compile(eventSchema),
};
export const API = "https://api.squeekchain.com";
export class FeedError extends Error {
  retryAt: number;
  constructor(message: string, retryAt = 0) {
    super(message);
    this.retryAt = retryAt;
  }
}
export function retryAfterMs(value: string | null, now: number) {
  if (!value) return 0;
  const seconds = Number(value);
  return Number.isFinite(seconds)
    ? Math.max(0, seconds * 1000)
    : Math.max(0, Date.parse(value) - now) || 0;
}
let cooldown = 0;
export const cooldownUntil = () => cooldown;
export async function readApi(
  path: string,
  kind: keyof typeof validators,
): Promise<any> {
  if (Date.now() < cooldown)
    throw new FeedError("Feed is resting after a rate limit.", cooldown);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(`${API}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (response.status === 429 || response.status === 503) {
      cooldown = Math.max(
        cooldown,
        Date.now() +
          Math.max(
            10_000,
            retryAfterMs(response.headers.get("Retry-After"), Date.now()),
          ),
      );
      throw new FeedError(
        `Feed unavailable (HTTP ${response.status}). Retrying after its requested pause.`,
        cooldown,
      );
    }
    if (!response.ok)
      throw new FeedError(`Feed unavailable (HTTP ${response.status}).`);
    const data = await response.json();
    const valid: boolean = Boolean(validators[kind](data));
    if (!valid)
      throw new FeedError(
        "Unknown feed format or schema version. Waiting for a compatible response.",
      );
    if (kind !== "status" && data.status !== "available")
      throw new FeedError(`History unavailable: ${data.reason ?? "unknown"}.`);
    if (
      kind !== "status" &&
      (data.chain?.chainId !== "11155111" || data.chain?.target !== "sepolia")
    )
      throw new FeedError("Unexpected network. This game only reads Sepolia.");
    if (
      Date.parse(data.generatedAt) > Date.now() + 30_000 ||
      Date.now() - Date.parse(data.generatedAt) > 120_000
    )
      throw new FeedError("Feed snapshot is stale.");
    return data;
  } catch (error) {
    if (error instanceof FeedError) throw error;
    throw new FeedError(
      error instanceof Error && error.name === "AbortError"
        ? "Feed timed out. Retrying automatically."
        : "Wheel feed offline. Retrying automatically.",
    );
  } finally {
    clearTimeout(timer);
  }
}
function uint(value: unknown): number {
  const n = Number(value);
  if (
    typeof value !== "string" ||
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(n) ||
    n < 0
  )
    throw new FeedError("Settlement contains an unsupported number.");
  return n;
}
export function normalizeSettlement(
  raw: any,
  transactionHash = raw.transactionHash,
  blockTimestamp = raw.blockTimestamp,
): Settlement {
  const s: Settlement = {
    transactionHash,
    blockTimestamp,
    previousSettledThroughRound: uint(raw.previousSettledThroughRound),
    settledThroughRound: uint(raw.settledThroughRound),
    workAdded: raw.workAdded,
    completedBlockCount: uint(raw.completedBlockCount),
    activeRoundCount: uint(raw.activeRoundCount),
  };
  if (
    !/^0x[0-9a-f]{64}$/.test(s.transactionHash) ||
    !Number.isFinite(Date.parse(s.blockTimestamp)) ||
    typeof s.workAdded !== "string" ||
    !/^\d+$/.test(s.workAdded) ||
    s.settledThroughRound <= s.previousSettledThroughRound
  )
    throw new FeedError("Incomplete settlement.");
  return s;
}
export async function fetchStatus(): Promise<Status> {
  return readApi("/v1/status", "status");
}
export async function fetchHistory(range: "24h" | "7d"): Promise<History> {
  const data = await readApi(`/v1/settlements?range=${range}`, "history");
  return {
    installationId: data.installationId,
    generatedAt: data.generatedAt,
    range,
    buckets: data.buckets,
    recentSettlements: data.recentSettlements.map((s: any) =>
      normalizeSettlement(s),
    ),
    nextRound:
      data.mining?.status === "available" ? data.mining.nextRound : undefined,
  };
}
export async function fetchEvents(
  existing: Settlement[],
  installationId: string | null,
  progress: (rows: Settlement[]) => void,
): Promise<{ rows: Settlement[]; complete: boolean; installationId: string }> {
  let cursor: string | null = null;
  let rows: Settlement[] = [];
  const known = new Set(existing.map((s) => s.transactionHash));
  const cutoff = Date.now() - WEEK_MS;
  let feedInstallation = installationId;
  for (let page = 0; page < 40; page++) {
    const data = await readApi(
      `/v1/events?category=protocol&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
      "events",
    );
    if (feedInstallation && data.installationId !== feedInstallation)
      throw new FeedError(
        "Feed installation changed. Reload to start on the new installation.",
      );
    feedInstallation = data.installationId;
    let overlap = false;
    for (const event of data.events) {
      if (event.type !== "system.settlement_completed") continue;
      if (
        event.eventVersion !== 2 ||
        event.source.kind !== "chain" ||
        event.source.chainId !== "11155111" ||
        event.source.confirmationStatus !== "safe"
      )
        throw new FeedError("Unsupported settlement event.");
      const s = normalizeSettlement(
        event.payload,
        event.source.transactionHash,
        event.occurredAt,
      );
      rows.push(s);
      if (known.has(s.transactionHash)) overlap = true;
    }
    rows = mergeSettlements(existing, rows).filter(
      (s) => Date.parse(s.blockTimestamp) >= cutoff,
    );
    progress(rows);
    const reachedPast = data.events.some(
      (e: any) => Date.parse(e.occurredAt) < cutoff,
    );
    if (!data.nextCursor || reachedPast || overlap)
      return { rows, complete: true, installationId: feedInstallation! };
    cursor = data.nextCursor;
  }
  throw new FeedError(
    "Seven-day history is incomplete. Try again when the feed catches up.",
  );
}
