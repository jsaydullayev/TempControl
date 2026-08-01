import type { Reading } from "@/lib/types";
import type { ProviderDevice, SensorProvider } from "@/server/providers/types";
import { tuyaRequest, TuyaError, type TuyaConfig } from "@/server/providers/tuya/client";
import {
  decodeHumidity,
  decodeTemperature,
  fetchDeviceSpec,
  type DeviceSpec,
} from "@/server/providers/tuya/spec";

/**
 * Real Tuya data source.
 *
 * Two constraints from Tuya shape this class:
 *  - The free IoT Core tier allows roughly 26 000 calls a month, so status is
 *    read in BULK (one call for many devices) and never per device in a loop.
 *  - Device logs are retained about seven days, and the statistics APIs are a
 *    paid add-on. Long history therefore comes from our own `readings` table,
 *    not from Tuya — `getHistory` only backfills the recent window.
 */

/** Bulk status accepts a comma-separated list; keep batches modest. */
const STATUS_BATCH = 20;

interface StatusItem {
  code: string;
  value: number | string | boolean;
}

interface DeviceStatusRow {
  id: string;
  status: StatusItem[];
}

function numeric(items: StatusItem[], code?: string): number | null {
  if (!code) return null;
  const found = items.find((i) => i.code === code);
  return typeof found?.value === "number" ? found.value : null;
}

export class TuyaProvider implements SensorProvider {
  readonly name = "tuya";

  /** Specs rarely change; caching them keeps the call budget for readings. */
  private specs = new Map<string, DeviceSpec>();

  constructor(private readonly config: TuyaConfig) {}

  async listDevices(): Promise<ProviderDevice[]> {
    const devices: ProviderDevice[] = [];
    let lastRowKey: string | undefined;

    // Paginate; the linked-app-account listing is the one that works for a
    // Smart Home project, so it is tried first.
    for (let page = 0; page < 20; page++) {
      const result = await tuyaRequest<{
        devices?: { id: string; name: string; online: boolean }[];
        has_more?: boolean;
        last_row_key?: string;
      }>(this.config, {
        method: "GET",
        path: "/v1.0/iot-01/associated-users/devices",
        query: { size: 100, last_row_key: lastRowKey },
      });

      for (const d of result.devices ?? []) {
        devices.push({ externalId: d.id, name: d.name, online: d.online });
      }

      if (!result.has_more || !result.last_row_key) break;
      lastRowKey = result.last_row_key;
    }

    return devices;
  }

  async getStatus(externalIds: string[]): Promise<Reading[]> {
    if (externalIds.length === 0) return [];

    const readings: Reading[] = [];
    const now = Date.now();

    for (let i = 0; i < externalIds.length; i += STATUS_BATCH) {
      const batch = externalIds.slice(i, i + STATUS_BATCH);

      const rows = await tuyaRequest<DeviceStatusRow[]>(this.config, {
        method: "GET",
        path: "/v1.0/iot-03/devices/status",
        query: { device_ids: batch.join(",") },
      });

      for (const row of rows ?? []) {
        const spec = await this.specOf(row.id);
        const reading = this.toReading(row.id, row.status ?? [], spec, now);
        if (reading) readings.push(reading);
      }
    }

    return readings;
  }

  /**
   * Recent history from the device log. Anything older than Tuya's retention
   * window lives in our own database, so this is a backfill, not the archive.
   */
  async getHistory(externalId: string, fromMs: number, toMs: number): Promise<Reading[]> {
    const spec = await this.specOf(externalId);
    const codes = [spec.temp?.code, spec.hum?.code, spec.battery?.code].filter(Boolean).join(",");
    if (!codes) return [];

    const result = await tuyaRequest<{
      logs?: { event_time: number; code: string; value: string }[];
    }>(this.config, {
      method: "GET",
      path: `/v1.0/devices/${externalId}/logs`,
      query: {
        // Type 7 is "data report" — the only event class that carries readings.
        type: "7",
        codes,
        start_time: Math.floor(fromMs),
        end_time: Math.floor(toMs),
        size: 100,
      },
    });

    // Log entries arrive one data point at a time; fold them into readings by timestamp.
    const byTime = new Map<number, Partial<Reading>>();
    for (const log of result.logs ?? []) {
      const raw = Number(log.value);
      if (!Number.isFinite(raw)) continue;

      const entry = byTime.get(log.event_time) ?? {};
      if (log.code === spec.temp?.code) entry.tempC = decodeTemperature(raw, spec.temp);
      else if (log.code === spec.hum?.code) entry.humidity = decodeHumidity(raw, spec.hum);
      else if (log.code === spec.battery?.code) entry.battery = raw;
      byTime.set(log.event_time, entry);
    }

    return [...byTime.entries()]
      .filter(([, v]) => v.tempC !== undefined || v.humidity !== undefined)
      .map(([ts, v]) => ({
        sensorId: externalId,
        ts,
        tempC: round1(v.tempC ?? 0),
        humidity: Math.round(v.humidity ?? 0),
        battery: Math.round(v.battery ?? 0),
      }))
      .sort((a, b) => a.ts - b.ts);
  }

  /** Reads and caches the device specification — the source of scale and unit. */
  private async specOf(deviceId: string): Promise<DeviceSpec> {
    const cached = this.specs.get(deviceId);
    if (cached) return cached;

    const spec = await fetchDeviceSpec(this.config, deviceId);
    this.specs.set(deviceId, spec);
    return spec;
  }

  private toReading(
    deviceId: string,
    items: StatusItem[],
    spec: DeviceSpec,
    now: number,
  ): Reading | null {
    const rawTemp = numeric(items, spec.temp?.code);
    const rawHum = numeric(items, spec.hum?.code);
    if (rawTemp === null && rawHum === null) return null;

    return {
      sensorId: deviceId,
      ts: now,
      tempC: rawTemp === null ? 0 : round1(decodeTemperature(rawTemp, spec.temp)),
      humidity: rawHum === null ? 0 : Math.round(decodeHumidity(rawHum, spec.hum)),
      battery: numeric(items, spec.battery?.code) ?? 100,
    };
  }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Connection check for the admin panel: token + device count, or a readable error. */
export async function testTuyaConnection(config: TuyaConfig): Promise<
  { ok: true; deviceCount: number } | { ok: false; code: string; message: string; hint?: string }
> {
  try {
    const provider = new TuyaProvider(config);
    const devices = await provider.listDevices();
    return { ok: true, deviceCount: devices.length };
  } catch (error) {
    if (error instanceof TuyaError) {
      return { ok: false, code: String(error.code), message: error.message, hint: error.hint };
    }
    return { ok: false, code: "unknown", message: String(error) };
  }
}
