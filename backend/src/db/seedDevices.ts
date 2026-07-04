import { INITIAL_DEVICES } from "../config/device.config";
import { DeviceModel } from "../models/device.model";
import { isMongoConnected } from "../db/connectMongo";

/**
 * Seed the devices collection with exactly 15 devices from device.config.ts.
 * Idempotent: if any device document already exists, do nothing.
 *
 * Safe no-op when MongoDB is not connected.
 */
export async function seedDevicesIfEmpty(): Promise<{
  seeded: boolean;
  total: number;
}> {
  if (!isMongoConnected()) {
    return { seeded: false, total: 0 };
  }

  const existing = await DeviceModel.estimatedDocumentCount();
  if (existing > 0) {
    console.log(`[Seed] Skipping seed — devices collection already has ${existing} documents.`);
    return { seeded: false, total: existing };
  }

  const now = new Date();
  const docs = INITIAL_DEVICES.map((d) => ({
    deviceId: d.deviceId,
    name: d.name,
    type: d.type,
    roomId: d.roomId,
    roomName: d.roomName,
    ratedWatt: d.ratedWatt,
    source: d.source,
    status: "off" as const,
    currentWatt: 0,
    lastChanged: now,
    onSince: null,
  }));

  // insertMany with ordered:false so a single duplicate (e.g. partial prior seed)
  // doesn't abort the rest. The unique index on deviceId enforces idempotency.
  try {
    await DeviceModel.insertMany(docs, { ordered: false });
    console.log(`[Seed] Seeded ${docs.length} devices into "devices" collection.`);
    return { seeded: true, total: docs.length };
  } catch (err: any) {
    // If a duplicate-key error happens, the count may have partially succeeded.
    const total = await DeviceModel.estimatedDocumentCount();
    console.warn(
      `[Seed] Partial seed completed (total now ${total}): ${err?.message ?? err}`
    );
    return { seeded: false, total };
  }
}
