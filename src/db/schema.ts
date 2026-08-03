import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * A building is the tenant. Access is granted per building, not per person:
 * whoever knows a building's credentials sees everything inside it.
 */
export const buildings = pgTable(
  "buildings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    login: text("login").notNull(),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("buildings_login_key").on(t.login), uniqueIndex("buildings_slug_key").on(t.slug)],
);

/** Separate credential that manages every building. */
export const admins = pgTable(
  "admins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    login: text("login").notNull(),
    passwordHash: text("password_hash").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("admins_login_key").on(t.login)],
);

export const floors = pgTable(
  "floors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    buildingId: uuid("building_id")
      .notNull()
      .references(() => buildings.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    level: smallint("level").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [index("floors_building_idx").on(t.buildingId)],
);

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    buildingId: uuid("building_id")
      .notNull()
      .references(() => buildings.id, { onDelete: "cascade" }),
    floorId: uuid("floor_id")
      .notNull()
      .references(() => floors.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    /** Position on the plan canvas, 0–100 % of the box. Null until arranged. */
    posX: doublePrecision("pos_x"),
    posY: doublePrecision("pos_y"),
  },
  (t) => [index("departments_building_idx").on(t.buildingId), index("departments_floor_idx").on(t.floorId)],
);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    posX: doublePrecision("pos_x"),
    posY: doublePrecision("pos_y"),
  },
  (t) => [index("rooms_department_idx").on(t.departmentId)],
);

export const sensors = pgTable(
  "sensors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    buildingId: uuid("building_id")
      .notNull()
      .references(() => buildings.id, { onDelete: "cascade" }),
    /** Room is nullable so a device can be registered before it is placed. */
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
    /** Tuya device id, or a mock id while no credentials exist. */
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    provider: text("provider").notNull().default("mock"),
    isActive: boolean("is_active").notNull().default(true),


    /**
     * Cached Tuya device specification. The scale is an EXPONENT and differs per
     * device and per data point — hardcoding /10 is the classic 10×-wrong bug.
     */
    tempDpCode: text("temp_dp_code"),
    humDpCode: text("hum_dp_code"),
    tempScale: smallint("temp_scale"),
    humScale: smallint("hum_scale"),
    tempUnit: text("temp_unit"),

    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sensors_external_key").on(t.externalId),
    index("sensors_building_idx").on(t.buildingId),
    index("sensors_room_idx").on(t.roomId),
  ],
);

/** Time series. Retention is 90 days; a daily job trims anything older. */
export const readings = pgTable(
  "readings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sensorId: uuid("sensor_id")
      .notNull()
      .references(() => sensors.id, { onDelete: "cascade" }),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    tempC: doublePrecision("temp_c"),
    humidity: doublePrecision("humidity"),
    battery: smallint("battery"),
  },
  /*
   * UNIQUE, not a plain index. One sensor cannot have two different readings at
   * the same instant, and enforcing that in the database is what makes a second
   * poller process harmless: it can only re-write rows that already exist
   * instead of silently doubling the history.
   */
  (t) => [uniqueIndex("readings_sensor_ts_key").on(t.sensorId, t.ts)],
);

/**
 * Comfort limits. A row here overrides the application defaults; a sensor row
 * overrides its building's row. Absent means "use the default".
 */
export const thresholds = pgTable(
  "thresholds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** 'building' or 'sensor' — the level this rule applies at. */
    scope: text("scope").notNull(),
    scopeId: uuid("scope_id").notNull(),
    /** 'temp' or 'hum'. */
    metric: text("metric").notNull(),
    minValue: doublePrecision("min_value").notNull(),
    maxValue: doublePrecision("max_value").notNull(),
    /*
     * Both default to ZERO: a reading outside min/max raises the alert on the
     * spot. Medicine and vaccine storage is the use case here — an excursion
     * that is real for one reading is still an excursion, and a delay that
     * hides it is worse than an alert that reopens.
     */
    hysteresis: doublePrecision("hysteresis").notNull().default(0),
    sustainMinutes: smallint("sustain_minutes").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("thresholds_scope_key").on(t.scope, t.scopeId, t.metric)],
);

/**
 * One open alert per (sensor, kind) at a time — that is what stops a flapping
 * sensor from producing a hundred rows and a hundred notifications.
 */
export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sensorId: uuid("sensor_id")
      .notNull()
      .references(() => sensors.id, { onDelete: "cascade" }),
    buildingId: uuid("building_id")
      .notNull()
      .references(() => buildings.id, { onDelete: "cascade" }),

    /** 'temp' | 'hum' | 'offline' | 'battery' */
    kind: text("kind").notNull(),
    /** 'open' | 'ack' | 'resolved' */
    state: text("state").notNull().default("open"),
    /** Severity at the moment it opened. */
    severity: text("severity").notNull(),
    /** 'below' | 'above' for a threshold breach, null otherwise. */
    direction: text("direction"),

    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    valueAtOpen: doublePrecision("value_at_open"),
    lastValue: doublePrecision("last_value"),

    ackedAt: timestamp("acked_at", { withTimezone: true }),
    ackedBy: text("acked_by"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    /** Null while the bell has not been opened since this alert appeared. */
    seenAt: timestamp("seen_at", { withTimezone: true }),
  },
  (t) => [
    index("alerts_building_state_idx").on(t.buildingId, t.state),
    index("alerts_sensor_idx").on(t.sensorId),
    index("alerts_opened_idx").on(t.openedAt),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorKind: text("actor_kind").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    meta: jsonb("meta"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_at_idx").on(t.at)],
);
