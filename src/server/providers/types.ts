import type { Reading } from "@/lib/types";

/**
 * The seam between the app and wherever measurements come from.
 *
 * Everything above this interface works in °C / % RH and epoch-ms. Provider
 * implementations own all vendor quirks — Tuya's per-device `scale` exponent,
 * °F units, DP code families (`va_temperature` vs `temp_current`), and the
 * seconds-vs-milliseconds timestamp mess all stop here.
 */
export interface SensorProvider {
  readonly name: string;

  listDevices(): Promise<ProviderDevice[]>;

  /** Bulk on purpose: the Tuya free tier allows ~26k calls/month. */
  getStatus(externalIds: string[]): Promise<Reading[]>;

  getHistory(externalId: string, fromMs: number, toMs: number): Promise<Reading[]>;
}

export interface ProviderDevice {
  externalId: string;
  name: string;
  online: boolean;
}
