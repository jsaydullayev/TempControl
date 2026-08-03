/** Domain types shared by server and client. Kept free of any provider/DB detail. */

export type Metric = "temp" | "hum";

/** Severity bands double as the status colour roles in the design system. */
export type Severity = "good" | "warning" | "serious" | "critical";

/**
 * A building is the tenant. Access is granted per building, not per person:
 * whoever knows a building's credentials sees everything inside it.
 */
export interface Building {
  id: string;
  slug: string;
  name: string;
}

export interface Floor {
  id: string;
  buildingId: string;
  name: string;
  /** Ground floor is 1; used for ordering the floor switcher. */
  level: number;
}

export interface Department {
  id: string;
  buildingId: string;
  floorId: string;
  name: string;
}

export interface Room {
  id: string;
  departmentId: string;
  name: string;
}

export interface Sensor {
  id: string;
  externalId: string;
  name: string;
  buildingId: string;
  roomId: string;
  isActive: boolean;
}

/** One normalised measurement. Temperature is always °C by the time it gets here. */
export interface Reading {
  sensorId: string;
  /** epoch ms */
  ts: number;
  tempC: number;
  humidity: number;
  battery: number;
}

/**
 * A sensor plus its latest state, as the UI consumes it.
 * `latest` is null when the sensor has never reported.
 */
export interface SensorState {
  sensor: Sensor;
  latest: Reading | null;
  isOnline: boolean;
  /** epoch ms of the last report, null if never */
  lastSeen: number | null;
  /** recent points for the card sparkline, oldest first */
  spark: Reading[];
}

export interface Threshold {
  metric: Metric;
  min: number;
  max: number;
  /** deadband applied outside min/max before a breach opens */
  hysteresis: number;
}

export const LOCALES = ["uz", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uz";

/** Comfort bands. Used for status chips and chart threshold bands alike. */
export const DEFAULT_THRESHOLDS: Record<Metric, Threshold> = {
  // Hysteresis 0: the limit is the limit. A tenth of a degree past it is an
  // excursion, and for medicine storage an excursion is exactly what has to be
  // seen — not smoothed away by a deadband.
  temp: { metric: "temp", min: 18, max: 26, hysteresis: 0 },
  hum: { metric: "hum", min: 30, max: 60, hysteresis: 0 },
};

/** A sensor is considered offline after this long without a report. */
export const OFFLINE_AFTER_MS = 30 * 60 * 1000;

export const LOW_BATTERY_PCT = 15;
