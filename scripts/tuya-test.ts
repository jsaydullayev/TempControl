/**
 * Checks Tuya credentials end to end and prints what the account exposes.
 *
 *   npm run tuya:test
 *
 * Reads TUYA_ACCESS_ID / TUYA_ACCESS_SECRET / TUYA_BASE_URL from .env.local.
 */
import { tuyaConfigFromEnv, TuyaError } from "../src/server/providers/tuya/client";
import { TuyaProvider } from "../src/server/providers/tuya";
import { fetchDeviceSpec, decodeTemperature, decodeHumidity } from "../src/server/providers/tuya/spec";

async function main() {
  const config = tuyaConfigFromEnv();
  if (!config) {
    console.error("TUYA_ACCESS_ID / TUYA_ACCESS_SECRET / TUYA_BASE_URL are not set in .env.local");
    process.exit(1);
  }

  console.log(`Region: ${config.baseUrl}`);
  console.log(`Access ID: ${config.clientId.slice(0, 6)}…\n`);

  const provider = new TuyaProvider(config);

  const devices = await provider.listDevices();
  console.log(`Devices linked to this project: ${devices.length}`);
  if (devices.length === 0) {
    console.log(
      "\nNo devices. The Smart Life app account must be linked to the cloud project\n" +
        "(Cloud → Devices → Link Tuya App Account → scan the QR code).",
    );
    return;
  }

  for (const device of devices.slice(0, 10)) {
    console.log(`  ${device.externalId}  ${device.online ? "online " : "offline"}  ${device.name}`);
  }
  if (devices.length > 10) console.log(`  … and ${devices.length - 10} more`);

  // The specification is what makes the raw integers meaningful.
  const first = devices[0];
  const spec = await fetchDeviceSpec(config, first.externalId);
  console.log(`\nSpecification of ${first.name} (category ${spec.category}):`);
  console.log(`  temperature: ${spec.temp ? `${spec.temp.code} scale=${spec.temp.scale} unit="${spec.temp.unit}"` : "not found"}`);
  console.log(`  humidity:    ${spec.hum ? `${spec.hum.code} scale=${spec.hum.scale} unit="${spec.hum.unit}"` : "not found"}`);
  console.log(`  battery:     ${spec.battery ? spec.battery.code : "not found"}`);

  if (spec.temp) {
    console.log(
      `  → raw 235 decodes to ${decodeTemperature(235, spec.temp).toFixed(1)} °C` +
        (spec.hum ? `, raw 52 decodes to ${decodeHumidity(52, spec.hum).toFixed(0)} %` : ""),
    );
  }

  const readings = await provider.getStatus(devices.slice(0, 5).map((d) => d.externalId));
  console.log(`\nCurrent readings (${readings.length}):`);
  for (const r of readings) {
    console.log(`  ${r.sensorId}  ${r.tempC.toFixed(1)} °C  ${r.humidity} %  battery ${r.battery} %`);
  }

  console.log(
    "\nSanity check: temperatures should look like room values (e.g. 23.5),\n" +
      "not 235 or 2.35 — a wrong scale is the classic Tuya bug.",
  );
}

main().catch((error) => {
  if (error instanceof TuyaError) {
    console.error(`\nTuya error ${error.code}: ${error.message}`);
    if (error.hint) console.error(`Hint: ${error.hint}`);
  } else {
    console.error(error);
  }
  process.exit(1);
});
