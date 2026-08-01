import { tuyaRequest, type TuyaConfig } from "@/server/providers/tuya/client";

/**
 * Device specification: which data points carry temperature and humidity, and
 * how their raw integers convert to real values.
 *
 * This exists because the conversion is NOT a constant. `scale` is an exponent
 * (`real = raw / 10^scale`), it differs per data point, and the unit can be
 * Fahrenheit: a real wsdcg device reports `va_temperature` as
 * `{"unit":"°F","scale":0}` with value 69 — that is 69 °F, and dividing by ten
 * gives a nonsensical 6.9. Hardcoding `/10` is the classic 10×-wrong bug.
 */

/** Two different code families describe the same physical quantity. */
const TEMP_CODES = ["va_temperature", "temp_current", "temperature", "temp_value"];
const HUM_CODES = ["va_humidity", "humidity_value", "humidity"];
const BATTERY_CODES = ["battery_percentage", "residual_electricity", "battery"];

export interface DpSpec {
  code: string;
  scale: number;
  unit: string;
}

export interface DeviceSpec {
  category: string;
  temp?: DpSpec;
  hum?: DpSpec;
  battery?: DpSpec;
}

interface RawStatus {
  code: string;
  type?: string;
  /** JSON-ENCODED STRING, not a nested object — it needs parsing a second time. */
  values?: string;
}

function parseValues(values?: string): { unit?: string; scale?: number } {
  if (!values) return {};
  try {
    const parsed = JSON.parse(values) as { unit?: string; scale?: number };
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function pick(status: RawStatus[], codes: string[]): DpSpec | undefined {
  for (const code of codes) {
    const found = status.find((s) => s.code === code);
    if (!found) continue;
    const { unit, scale } = parseValues(found.values);
    return { code: found.code, scale: scale ?? 0, unit: (unit ?? "").trim() };
  }
  return undefined;
}

export async function fetchDeviceSpec(
  config: TuyaConfig,
  deviceId: string,
): Promise<DeviceSpec> {
  const result = await tuyaRequest<{ category: string; status?: RawStatus[] }>(config, {
    method: "GET",
    path: `/v1.0/devices/${deviceId}/specifications`,
  });

  const status = result.status ?? [];
  return {
    category: result.category,
    temp: pick(status, TEMP_CODES),
    hum: pick(status, HUM_CODES),
    battery: pick(status, BATTERY_CODES),
  };
}

/**
 * True when the unit string means Fahrenheit. Tuya returns this field in
 * several forms — "°F", "F", and the Chinese "华氏度" all occur in the wild —
 * so the match is deliberately narrow rather than a substring search for "f".
 */
export function isFahrenheit(unit: string): boolean {
  const u = unit.trim().toLowerCase();
  if (!u) return false;
  if (u.includes("华氏")) return true;
  if (u.includes("摄氏")) return false;
  return /^°?\s*f$/.test(u) || u === "fahrenheit";
}

/** `real = raw / 10^scale`, then Fahrenheit converted to Celsius. */
export function decodeTemperature(raw: number, spec?: DpSpec): number {
  const scaled = raw / 10 ** (spec?.scale ?? 0);
  return spec && isFahrenheit(spec.unit) ? ((scaled - 32) * 5) / 9 : scaled;
}

export function decodeHumidity(raw: number, spec?: DpSpec): number {
  return raw / 10 ** (spec?.scale ?? 0);
}

export { TEMP_CODES, HUM_CODES, BATTERY_CODES };
