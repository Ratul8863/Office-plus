import { INITIAL_DEVICES, DeviceConfig } from "../config/device.config";
import { persistenceService } from "./persistence.service";

export interface DeviceState extends DeviceConfig {
  status: "on" | "off";
  currentWatt: number;
  lastChanged: string; // ISO string
  onSince: string | null; // ISO string or null
}

class OfficeStateService {
  private devices: DeviceState[] = [];
  private lastWokwiTelemetry: Date | null = null;
  private wokwiOnline: boolean = true; // start as true, then monitor timeouts

  constructor() {
    this.resetState();
  }

  public resetState(): void {
    const now = new Date().toISOString();
    this.devices = INITIAL_DEVICES.map((d) => ({
      ...d,
      status: "off",
      currentWatt: 0,
      lastChanged: now,
      onSince: null,
    }));
    this.lastWokwiTelemetry = null;
    this.wokwiOnline = true;
  }

  /**
   * Replace the in-memory device list with the given array.
   * Used during startup hydration from MongoDB.
   */
  public hydrate(devices: DeviceState[]): void {
    const now = new Date().toISOString();
    const persistedById = new Map(devices.map((device) => [device.deviceId, device]));
    this.devices = INITIAL_DEVICES.map((config) => {
      const persisted = persistedById.get(config.deviceId);
      return {
        ...config,
        status: persisted?.status ?? "off",
        currentWatt: persisted?.currentWatt ?? 0,
        lastChanged: persisted?.lastChanged ?? now,
        onSince: persisted?.onSince ?? null,
      };
    });
  }

  public getDevices(): DeviceState[] {
    return this.devices;
  }

  public getDevice(deviceId: string): DeviceState | undefined {
    return this.devices.find((d) => d.deviceId === deviceId);
  }

  /**
   * Called when telemetry for Wokwi is received.
   * Returns true if status transitions from offline to online.
   */
  public setWokwiTelemetryReceived(): boolean {
    this.lastWokwiTelemetry = new Date();
    if (!this.wokwiOnline) {
      this.wokwiOnline = true;
      console.log("[OfficeStateService] Wokwi Gateway is now ONLINE");
      return true; // online state changed
    }
    return false;
  }

  /**
   * Periodically called to check if Wokwi telemetry has timed out.
   * @param timeoutMs Time in milliseconds without telemetry before Wokwi is
   *                  considered offline. Defaults to 60_000 (60 seconds).
   * @returns true if the online status transitioned during this call.
   */
  public checkWokwiTimeout(timeoutMs: number = 60 * 1000): boolean {
    // If we've never received telemetry, treat the server start time as the
    // reference point so we don't immediately flag the link as offline.
    const referenceTime = this.lastWokwiTelemetry || new Date();
    const elapsed = Date.now() - referenceTime.getTime();

    if (elapsed > timeoutMs) {
      if (this.wokwiOnline) {
        this.wokwiOnline = false;
        console.log(
          `[OfficeStateService] Wokwi Gateway has timed out (${Math.round(
            timeoutMs / 1000
          )}s without telemetry) -> OFFLINE`
        );
        return true; // status changed to offline
      }
    }
    return false;
  }

  public isWokwiOnline(): boolean {
    return this.wokwiOnline;
  }

  public getLastWokwiTelemetry(): Date | null {
    return this.lastWokwiTelemetry;
  }

  /**
   * Updates the state of a specific device.
   * Returns the updated device and a boolean indicating if status actually changed.
   * On change, also writes a device_event document to MongoDB.
   */
  public updateDeviceState(
    deviceId: string,
    status: "on" | "off"
  ): { device: DeviceState; changed: boolean } {
    const device = this.devices.find((d) => d.deviceId === deviceId);
    if (!device) {
      throw new Error(`Device with ID ${deviceId} not found`);
    }

    if (device.status === status) {
      return { device, changed: false };
    }

    const now = new Date().toISOString();
    const previousStatus = device.status;
    device.status = status;
    device.currentWatt = status === "on" ? device.ratedWatt : 0;
    device.lastChanged = now;
    if (status === "on") {
      device.onSince = now;
    } else {
      device.onSince = null;
    }

    // Persist asynchronously — never block the live state mutation.
    if (persistenceService.isStorageEnabled()) {
      // Persist device state and the corresponding event.
      void persistenceService.saveDeviceState(device);
      void persistenceService.saveDeviceEvent({
        deviceId: device.deviceId,
        roomId: device.roomId,
        roomName: device.roomName,
        deviceName: device.name,
        type: device.type,
        previousStatus,
        newStatus: device.status,
        ratedWatt: device.ratedWatt,
        currentWatt: device.currentWatt,
        source: device.source,
        timestamp: new Date(),
      });
    }

    return { device, changed: true };
  }
}

export const officeStateService = new OfficeStateService();
export default officeStateService;
