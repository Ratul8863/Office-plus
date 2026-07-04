import { officeStateService } from "./officeState.service";
import { powerCalculatorService } from "./powerCalculator.service";
import { env } from "../config/env";
import { isAfterHours } from "../utils/time";
import { persistenceService } from "./persistence.service";
import { HARDWARE_ROOM_ID } from "../config/device.config";

export interface Alert {
  id: string;
  type: "AFTER_HOURS_ON" | "ROOM_FULLY_ON_TOO_LONG" | "HIGH_USAGE" | "DEVICE_OFFLINE";
  status: "active" | "resolved";
  severity: "info" | "warning" | "critical";
  message: string;
  roomId?: string;
  deviceId?: string;
  triggeredAt: string;
  resolvedAt: string | null;
}

class AlertService {
  private alerts: Alert[] = [];
  private onAlertTriggered?: (alert: Alert) => void;
  private onAlertResolved?: (alert: Alert) => void;

  public registerCallbacks(
    onTriggered: (alert: Alert) => void,
    onResolved: (alert: Alert) => void
  ): void {
    this.onAlertTriggered = onTriggered;
    this.onAlertResolved = onResolved;
  }

  public getAlerts(): Alert[] {
    return this.alerts;
  }

  public getActiveAlerts(): Alert[] {
    return this.alerts.filter((a) => a.status === "active");
  }

  private triggerAlert(
    type: Alert["type"],
    severity: Alert["severity"],
    message: string,
    roomId?: string,
    deviceId?: string
  ): void {
    // Check if an active alert of the same type and target already exists
    const existing = this.alerts.find(
      (a) =>
        a.type === type &&
        a.status === "active" &&
        a.roomId === roomId &&
        a.deviceId === deviceId
    );

    if (existing) return;

    const newAlert: Alert = {
      id: `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      status: "active",
      severity,
      message,
      roomId,
      deviceId,
      triggeredAt: new Date().toISOString(),
      resolvedAt: null,
    };

    this.alerts.push(newAlert);
    console.log(`[AlertService] ALERT TRIGGERED: ${type} - ${message}`);

    // Persist (no-op if MongoDB not connected).
    if (persistenceService.isStorageEnabled()) {
      void persistenceService.saveAlert(newAlert);
    }

    if (this.onAlertTriggered) {
      this.onAlertTriggered(newAlert);
    }
  }

  private resolveAlert(
    type: Alert["type"],
    roomId?: string,
    deviceId?: string
  ): void {
    const existingIndex = this.alerts.findIndex(
      (a) =>
        a.type === type &&
        a.status === "active" &&
        a.roomId === roomId &&
        a.deviceId === deviceId
    );

    if (existingIndex !== -1) {
      const alert = this.alerts[existingIndex];
      alert.status = "resolved";
      alert.resolvedAt = new Date().toISOString();
      console.log(`[AlertService] ALERT RESOLVED: ${type} (ID: ${alert.id})`);

      if (persistenceService.isStorageEnabled()) {
        void persistenceService.updateAlertResolved(
          alert.id,
          new Date(alert.resolvedAt)
        );
      }

      if (this.onAlertResolved) {
        this.onAlertResolved(alert);
      }
    }
  }

  /**
   * Evaluates all the alert rules against the current system state.
   */
  public evaluateAlerts(): void {
    const devices = officeStateService.getDevices();
    const usage = powerCalculatorService.getUsage();

    // 1. HIGH_USAGE Alert
    const threshold = env.HIGH_USAGE_THRESHOLD_WATT;
    if (usage.totalWatt > threshold) {
      this.triggerAlert(
        "HIGH_USAGE",
        "critical",
        `Office-wide power usage of ${usage.totalWatt}W exceeds the threshold of ${threshold}W`
      );
    } else {
      this.resolveAlert("HIGH_USAGE");
    }

    // 2. ROOM_FULLY_ON_TOO_LONG Alert
    const rooms = ["drawing", "work1", "work2"];
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    rooms.forEach((roomId) => {
      const roomDevices = devices.filter((d) => d.roomId === roomId);
      const allOn = roomDevices.every((d) => d.status === "on");

      if (allOn) {
        // Find the latest time a device was turned on (when the room became fully on)
        const onTimes = roomDevices.map((d) => (d.onSince ? new Date(d.onSince).getTime() : 0));
        const roomFullyOnSince = Math.max(...onTimes);

        if (Date.now() - roomFullyOnSince > TWO_HOURS_MS) {
          const roomName = roomDevices[0]?.roomName || roomId;
          this.triggerAlert(
            "ROOM_FULLY_ON_TOO_LONG",
            "warning",
            `All devices in ${roomName} have been ON for more than 2 hours`,
            roomId
          );
        }
      } else {
        this.resolveAlert("ROOM_FULLY_ON_TOO_LONG", roomId);
      }
    });

    // 3. AFTER_HOURS_ON Alert
    // We check every device: if it is ON and the time it was turned ON (lastChanged) is after hours
    devices.forEach((device) => {
      if (device.status === "on") {
        const onTime = new Date(device.lastChanged);
        if (isAfterHours(onTime)) {
          this.triggerAlert(
            "AFTER_HOURS_ON",
            "warning",
            `Device "${device.name}" in ${device.roomName} was turned ON outside office hours`,
            device.roomId,
            device.deviceId
          );
        }
      } else {
        // If device is OFF, resolve any AFTER_HOURS_ON alert for it
        this.resolveAlert("AFTER_HOURS_ON", device.roomId, device.deviceId);
      }
    });

    // 4. DEVICE_OFFLINE Alert
    // Check if Wokwi connection timeout is met using the configured threshold.
    // Note: checkWokwiTimeout returns true if there is a transition from online to offline.
    const offlineThresholdMs = env.WOKWI_OFFLINE_TIMEOUT_SECONDS * 1000;
    officeStateService.checkWokwiTimeout(offlineThresholdMs);

    if (!officeStateService.isWokwiOnline()) {
      this.triggerAlert(
        "DEVICE_OFFLINE",
        "critical",
        `Drawing Room hardware gateway is offline. No telemetry received for ${env.WOKWI_OFFLINE_TIMEOUT_SECONDS} seconds.`,
        HARDWARE_ROOM_ID
      );
    } else {
      this.resolveAlert("DEVICE_OFFLINE", HARDWARE_ROOM_ID);
    }
  }
}

export const alertService = new AlertService();
export default alertService;
