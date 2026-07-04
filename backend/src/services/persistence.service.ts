import { DeviceState } from "./officeState.service";
import { Alert } from "./alert.service";
import { DeviceModel } from "../models/device.model";
import { DeviceEventModel } from "../models/deviceEvent.model";
import { AlertModel } from "../models/alert.model";
import { UsageSnapshotModel, UsageRoomWatts } from "../models/usageSnapshot.model";
import {
  isMongoConnected,
  isMongoConfigured,
  disconnectMongo,
} from "../db/connectMongo";
import { seedDevicesIfEmpty } from "../db/seedDevices";

/**
 * Persistence facade. Every method returns immediately and silently when
 * MongoDB is not configured or not connected, so the rest of the code path is
 * unchanged regardless of storage mode.
 */
class PersistenceService {
  // ----- Lifecycle / wiring -----

  /** Hydrate the in-memory store from MongoDB. Returns the persisted devices
   *  (or null when storage isn't reachable — caller should keep defaults). */
  public async hydrateDevicesFromDb(): Promise<DeviceState[] | null> {
    if (!isMongoConnected()) return null;
    try {
      const docs = await DeviceModel.find({}).sort({ deviceId: 1 }).lean();
      const mapped: DeviceState[] = docs.map((d: any) => ({
        deviceId: d.deviceId,
        name: d.name,
        type: d.type,
        roomId: d.roomId,
        roomName: d.roomName,
        ratedWatt: d.ratedWatt,
        source: d.source,
        status: d.status,
        currentWatt: d.currentWatt,
        lastChanged:
          d.lastChanged instanceof Date
            ? d.lastChanged.toISOString()
            : new Date(d.lastChanged).toISOString(),
        onSince:
          d.onSince
            ? (d.onSince instanceof Date
                ? d.onSince.toISOString()
                : new Date(d.onSince).toISOString())
            : null,
      }));
      console.log(`[Persistence] Hydrated ${mapped.length} devices from MongoDB.`);
      return mapped;
    } catch (err: any) {
      console.error(`[Persistence] Hydrate failed: ${err?.message ?? err}`);
      return null;
    }
  }

  /** Seeds the devices collection if empty. Safe no-op when DB not connected. */
  public async seedDevicesIfEmpty(): Promise<void> {
    if (!isMongoConnected()) return;
    await seedDevicesIfEmpty();
  }

  // ----- Save methods (all fire-and-forget safe) -----

  public async saveDeviceState(device: DeviceState): Promise<void> {
    if (!isMongoConnected()) return;
    try {
      await DeviceModel.updateOne(
        { deviceId: device.deviceId },
        {
          $set: {
            status: device.status,
            currentWatt: device.currentWatt,
            lastChanged: new Date(device.lastChanged),
            onSince: device.onSince ? new Date(device.onSince) : null,
          },
        }
      );
    } catch (err: any) {
      console.error(
        `[Persistence] saveDeviceState(${device.deviceId}) failed: ${err?.message ?? err}`
      );
    }
  }

  public async saveManyDeviceStates(devices: DeviceState[]): Promise<void> {
    if (!isMongoConnected() || devices.length === 0) return;
    try {
      const ops = devices.map((d) => ({
        updateOne: {
          filter: { deviceId: d.deviceId },
          update: {
            $set: {
              status: d.status,
              currentWatt: d.currentWatt,
              lastChanged: new Date(d.lastChanged),
              onSince: d.onSince ? new Date(d.onSince) : null,
            },
          },
        },
      }));
      await DeviceModel.bulkWrite(ops, { ordered: false });
    } catch (err: any) {
      console.error(
        `[Persistence] saveManyDeviceStates failed: ${err?.message ?? err}`
      );
    }
  }

  public async saveDeviceEvent(event: {
    deviceId: string;
    roomId: string;
    roomName: string;
    deviceName: string;
    type: "fan" | "light";
    previousStatus: "on" | "off";
    newStatus: "on" | "off";
    ratedWatt: number;
    currentWatt: number;
    source: "wokwi" | "simulator";
    timestamp?: Date;
  }): Promise<void> {
    if (!isMongoConnected()) return;
    try {
      await DeviceEventModel.create({
        ...event,
        timestamp: event.timestamp ?? new Date(),
      });
    } catch (err: any) {
      console.error(
        `[Persistence] saveDeviceEvent(${event.deviceId}) failed: ${err?.message ?? err}`
      );
    }
  }

  public async saveAlert(alert: Alert): Promise<void> {
    if (!isMongoConnected()) return;
    try {
      await AlertModel.updateOne(
        { alertId: alert.id },
        {
          $set: {
            alertId: alert.id,
            type: alert.type,
            status: alert.status,
            severity: alert.severity,
            roomId: alert.roomId,
            deviceId: alert.deviceId,
            message: alert.message,
            triggeredAt: new Date(alert.triggeredAt),
            resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt) : null,
          },
        },
        { upsert: true }
      );
    } catch (err: any) {
      console.error(
        `[Persistence] saveAlert(${alert.id}) failed: ${err?.message ?? err}`
      );
    }
  }

  public async updateAlertResolved(alertId: string, resolvedAt: Date): Promise<void> {
    if (!isMongoConnected()) return;
    try {
      await AlertModel.updateOne(
        { alertId },
        { $set: { status: "resolved", resolvedAt } }
      );
    } catch (err: any) {
      console.error(
        `[Persistence] updateAlertResolved(${alertId}) failed: ${err?.message ?? err}`
      );
    }
  }

  public async saveUsageSnapshot(snapshot: {
    totalWatt: number;
    activeDeviceCount: number;
    activeFans: number;
    activeLights: number;
    estimatedKwhToday: number;
    roomWatts: UsageRoomWatts;
    timestamp?: Date;
  }): Promise<void> {
    if (!isMongoConnected()) return;
    try {
      await UsageSnapshotModel.create({
        ...snapshot,
        timestamp: snapshot.timestamp ?? new Date(),
      });
    } catch (err: any) {
      console.error(`[Persistence] saveUsageSnapshot failed: ${err?.message ?? err}`);
    }
  }

  // ----- Read helpers (for callers that want DB-sourced truth) -----

  public async getLatestDevices(): Promise<DeviceState[] | null> {
    if (!isMongoConnected()) return null;
    try {
      const docs = await DeviceModel.find({}).sort({ deviceId: 1 }).lean();
      return docs.map((d: any) => ({
        deviceId: d.deviceId,
        name: d.name,
        type: d.type,
        roomId: d.roomId,
        roomName: d.roomName,
        ratedWatt: d.ratedWatt,
        source: d.source,
        status: d.status,
        currentWatt: d.currentWatt,
        lastChanged:
          d.lastChanged instanceof Date
            ? d.lastChanged.toISOString()
            : new Date(d.lastChanged).toISOString(),
        onSince: d.onSince
          ? (d.onSince instanceof Date
              ? d.onSince.toISOString()
              : new Date(d.onSince).toISOString())
          : null,
      }));
    } catch (err: any) {
      console.error(`[Persistence] getLatestDevices failed: ${err?.message ?? err}`);
      return null;
    }
  }

  public async getActiveAlertsFromDb(): Promise<Alert[] | null> {
    if (!isMongoConnected()) return null;
    try {
      const docs = await AlertModel.find({ status: "active" })
        .sort({ triggeredAt: -1 })
        .lean();
      return docs.map((d: any) => ({
        id: d.alertId,
        type: d.type,
        status: d.status,
        severity: d.severity,
        message: d.message,
        roomId: d.roomId,
        deviceId: d.deviceId,
        triggeredAt:
          d.triggeredAt instanceof Date
            ? d.triggeredAt.toISOString()
            : new Date(d.triggeredAt).toISOString(),
        resolvedAt: d.resolvedAt
          ? (d.resolvedAt instanceof Date
              ? d.resolvedAt.toISOString()
              : new Date(d.resolvedAt).toISOString())
          : null,
      }));
    } catch (err: any) {
      console.error(
        `[Persistence] getActiveAlertsFromDb failed: ${err?.message ?? err}`
      );
      return null;
    }
  }

  public async getRecentUsageSnapshots(limit = 60): Promise<any[] | null> {
    if (!isMongoConnected()) return null;
    try {
      const docs = await UsageSnapshotModel.find({})
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
      return docs;
    } catch (err: any) {
      console.error(
        `[Persistence] getRecentUsageSnapshots failed: ${err?.message ?? err}`
      );
      return null;
    }
  }

  // ----- Diagnostics -----

  public isStorageEnabled(): boolean {
    return isMongoConfigured() && isMongoConnected();
  }

  public async shutdown(): Promise<void> {
    if (!isMongoConfigured()) return;
    await disconnectMongo();
  }
}

export const persistenceService = new PersistenceService();
export default persistenceService;
