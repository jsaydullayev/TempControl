import { mockProvider } from "@/server/providers/mock";
import { TuyaProvider } from "@/server/providers/tuya";
import { tuyaConfigFromEnv } from "@/server/providers/tuya/client";
import type { SensorProvider } from "@/server/providers/types";

/**
 * Single place that decides where measurements come from.
 *
 * `PROVIDER=tuya` switches the whole app to live data with no UI change — the
 * seam is the SensorProvider interface, and everything above it works in °C,
 * %RH and epoch-ms regardless of the source.
 */
export function getProvider(): SensorProvider {
  if (process.env.PROVIDER !== "tuya") return mockProvider;

  const config = tuyaConfigFromEnv();
  if (!config) {
    // Falling back keeps the app usable rather than crashing every page while
    // credentials are still being set up.
    console.warn("[provider] PROVIDER=tuya but Tuya credentials are missing — using mock data");
    return mockProvider;
  }

  return new TuyaProvider(config);
}

export function isTuyaConfigured(): boolean {
  return tuyaConfigFromEnv() !== null;
}
