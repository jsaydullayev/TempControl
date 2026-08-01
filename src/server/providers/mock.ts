import type { Reading } from "@/lib/types";
import type { ProviderDevice, SensorProvider } from "@/server/providers/types";

/**
 * Deterministic demo data. Every value is a pure function of (device, timestamp),
 * so charts do not jitter between renders and screenshots stay stable — the
 * whole point is that the UI looks like real instrumentation before any Tuya
 * credentials exist.
 *
 * Baselines are keyed by device id rather than by database row, so the mock
 * keeps working no matter how the structure is edited in the admin panel.
 */

/** Devices report on this cadence; matches the planned 5-minute poll interval. */
export const REPORT_INTERVAL_MS = 5 * 60 * 1000;

type Demo = "offline" | "breach-high" | "breach-low" | "low-battery";

interface Profile {
  baseTemp: number;
  baseHum: number;
  demo?: Demo;
}

/** Curated profiles so every UI state is visible on a fresh install. */
const PROFILES: Record<string, Profile> = {
  "mock-01": { baseTemp: 23.1, baseHum: 42 },
  "mock-02": { baseTemp: 22.7, baseHum: 45 },
  "mock-03": { baseTemp: 22.4, baseHum: 44 },
  "mock-04": { baseTemp: 23.8, baseHum: 41 },
  "mock-05": { baseTemp: 21.2, baseHum: 47, demo: "low-battery" },
  "mock-06": { baseTemp: 6.5, baseHum: 52, demo: "breach-low" },
  "mock-07": { baseTemp: 23.4, baseHum: 43 },
  "mock-08": { baseTemp: 22.9, baseHum: 46 },
  "mock-09": { baseTemp: 21.5, baseHum: 51 },
  "mock-10": { baseTemp: 20.8, baseHum: 54, demo: "offline" },
  "mock-11": { baseTemp: 27.8, baseHum: 33, demo: "breach-high" },
  "mock-12": { baseTemp: 24.6, baseHum: 36 },
  "mock-13": { baseTemp: 25.9, baseHum: 38 },
  "mock-14": { baseTemp: 19.6, baseHum: 55 },
  "mock-15": { baseTemp: 24.1, baseHum: 49 },
  "mock-16": { baseTemp: 8.2, baseHum: 63, demo: "breach-low" },
  "mock-17": { baseTemp: 20.3, baseHum: 58, demo: "offline" },
  "mock-18": { baseTemp: 26.4, baseHum: 39 },
  "mock-19": { baseTemp: 29.7, baseHum: 28, demo: "breach-high" },
  "mock-20": { baseTemp: 23.6, baseHum: 44, demo: "low-battery" },
};

/** Deterministic [0,1) noise from a string key — a small xorshift over an FNV hash. */
function noise(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h << 13;
  h ^= h >>> 17;
  h ^= h << 5;
  return ((h >>> 0) % 100000) / 100000;
}

/** A device with no curated profile still gets a plausible, stable one. */
function profileOf(externalId: string): Profile {
  const known = PROFILES[externalId];
  if (known) return known;
  return {
    baseTemp: 20 + noise(externalId + ":t") * 5,
    baseHum: 38 + noise(externalId + ":h") * 16,
  };
}

/** Smooth pseudo-random walk: blends noise from adjacent buckets. */
function drift(id: string, bucket: number, scale: number): number {
  const a = noise(`${id}:${bucket}`);
  const b = noise(`${id}:${bucket + 1}`);
  const t = 0.5 - Math.cos(Math.PI * ((bucket % 1) + 0.5)) / 2;
  return ((a * (1 - t) + b * t) * 2 - 1) * scale;
}

function hourOfDay(ts: number): number {
  const d = new Date(ts);
  return d.getHours() + d.getMinutes() / 60;
}

function readingAt(externalId: string, ts: number): Reading {
  const p = profileOf(externalId);
  const bucket = Math.floor(ts / REPORT_INTERVAL_MS);
  const hour = hourOfDay(ts);

  // Diurnal curve: coolest around 05:00, warmest around 15:00.
  const diurnal = Math.sin(((hour - 9) / 24) * 2 * Math.PI);
  const amplitude = p.baseTemp > 15 ? 2.6 : 0.9; // fridges swing far less

  let tempC = p.baseTemp + diurnal * amplitude + drift(externalId + "t", bucket / 6, 0.35);
  if (p.demo === "breach-high") tempC += 3.2;

  // Humidity moves against temperature, with its own slower wobble.
  let humidity =
    p.baseHum - diurnal * 4.5 - (tempC - p.baseTemp) * 1.4 + drift(externalId + "h", bucket / 9, 1.6);
  humidity = Math.min(95, Math.max(5, humidity));

  const daysSinceEpoch = ts / 86_400_000;
  const offset = noise(externalId + "b") * 40;
  let battery = Math.round(100 - ((daysSinceEpoch + offset) % 700) / 7);
  if (p.demo === "low-battery") battery = 11;

  return {
    sensorId: externalId,
    ts,
    tempC: Math.round(tempC * 10) / 10,
    humidity: Math.round(humidity),
    battery: Math.max(1, Math.min(100, battery)),
  };
}

/** When a device last reported. The `offline` demo devices went quiet hours ago. */
function lastReportTs(externalId: string, now: number): number {
  const aligned = Math.floor(now / REPORT_INTERVAL_MS) * REPORT_INTERVAL_MS;
  if (profileOf(externalId).demo === "offline") return aligned - 3.4 * 60 * 60 * 1000;
  // Stagger devices so they do not all report on the same tick.
  const stagger = Math.floor(noise(externalId + "s") * 5) * 60 * 1000;
  return aligned - stagger;
}

export class MockProvider implements SensorProvider {
  readonly name = "mock";

  async listDevices(): Promise<ProviderDevice[]> {
    const now = Date.now();
    return Object.keys(PROFILES).map((externalId) => ({
      externalId,
      name: externalId,
      online: now - lastReportTs(externalId, now) < 30 * 60 * 1000,
    }));
  }

  async getStatus(externalIds: string[]): Promise<Reading[]> {
    const now = Date.now();
    return externalIds.map((externalId) => readingAt(externalId, lastReportTs(externalId, now)));
  }

  async getHistory(externalId: string, fromMs: number, toMs: number): Promise<Reading[]> {
    const last = lastReportTs(externalId, Date.now());
    const start = Math.ceil(fromMs / REPORT_INTERVAL_MS) * REPORT_INTERVAL_MS;
    const out: Reading[] = [];

    for (let ts = start; ts <= Math.min(toMs, last); ts += REPORT_INTERVAL_MS) {
      // A battery device drops the occasional report; the chart must show a gap,
      // not a straight line through it.
      if (noise(`${externalId}:gap:${ts}`) < 0.03) continue;
      out.push(readingAt(externalId, ts));
    }
    return out;
  }
}

export const mockProvider = new MockProvider();
