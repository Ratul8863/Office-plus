import { INITIAL_DEVICES, DeviceConfig } from "../config/device.config";

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
   * Periodically called to check if Wokwi telemetry has timed out (60 seconds).
   * Returns true if status changed.
   */
  public checkWokwiTimeout(): boolean {
    // If we've never received telemetry and the server has been running, check elapsed since startup
    // We initialized lastWokwiTelemetry to null, but let's assume we treat it as starting at current time
    const referenceTime = this.lastWokwiTelemetry || new Date();
    const elapsed = Date.now() - referenceTime.getTime();

    if (elapsed > 60 * 1000) {
      if (this.wokwiOnline) {
        this.wokwiOnline = false;
        console.log("[OfficeStateService] Wokwi Gateway has timed out (60s without telemetry) -> OFFLINE");
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
    device.status = status;
    device.currentWatt = status === "on" ? device.ratedWatt : 0;
    device.lastChanged = now;
    if (status === "on") {
      device.onSince = now;
    } else {
      device.onSince = null;
    }

    return { device, changed: true };
  }
}

export const officeStateService = new OfficeStateService();
export default officeStateService;
