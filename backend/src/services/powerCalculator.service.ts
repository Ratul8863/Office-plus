import { officeStateService, DeviceState } from "./officeState.service";

class PowerCalculatorService {
  private accumulatedKwhToday: number = 0;
  private lastResetDateStr: string = "";

  constructor() {
    this.lastResetDateStr = new Date().toISOString().split("T")[0];
  }

  private checkDayRollover(): void {
    const todayStr = new Date().toISOString().split("T")[0];
    if (todayStr !== this.lastResetDateStr) {
      console.log(`[PowerCalculatorService] Day rollover detected (${this.lastResetDateStr} -> ${todayStr}). Resetting accumulated kWh.`);
      this.accumulatedKwhToday = 0;
      this.lastResetDateStr = todayStr;

      // Update onSince of all currently ON devices to start of today,
      // so their duration calculations don't bleed into yesterday's usage
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const devices = officeStateService.getDevices();
      
      devices.forEach((d) => {
        if (d.status === "on") {
          d.onSince = startOfToday;
        }
      });
    }
  }

  /**
   * Accumulates the final kWh run of a device that was turned off.
   */
  public recordDeviceTurnOff(device: DeviceState): void {
    this.checkDayRollover();
    if (device.status === "on" && device.onSince) {
      const elapsedMs = Date.now() - new Date(device.onSince).getTime();
      const hours = Math.max(0, elapsedMs) / (1000 * 60 * 60);
      const kwh = (device.ratedWatt * hours) / 1000;
      this.accumulatedKwhToday += kwh;
      console.log(`[PowerCalculatorService] Device ${device.deviceId} turned off. Added ${kwh.toFixed(5)} kWh. Total accumulated today: ${this.accumulatedKwhToday.toFixed(5)} kWh`);
    }
  }

  /**
   * Computes the total usage summaries.
   */
  public getUsage() {
    this.checkDayRollover();
    const devices = officeStateService.getDevices();
    let totalWatt = 0;
    let activeDeviceCount = 0;
    let activeFansTotal = 0;
    let activeLightsTotal = 0;

    // Room maps
    const roomMap: Record<
      string,
      {
        roomId: string;
        roomName: string;
        totalWatt: number;
        activeDeviceCount: number;
        activeFans: number;
        activeLights: number;
      }
    > = {
      drawing: { roomId: "drawing", roomName: "Drawing Room", totalWatt: 0, activeDeviceCount: 0, activeFans: 0, activeLights: 0 },
      work1: { roomId: "work1", roomName: "Work Room 1", totalWatt: 0, activeDeviceCount: 0, activeFans: 0, activeLights: 0 },
      work2: { roomId: "work2", roomName: "Work Room 2", totalWatt: 0, activeDeviceCount: 0, activeFans: 0, activeLights: 0 },
    };

    let liveKwh = 0;
    const now = Date.now();

    devices.forEach((d) => {
      const roomId = d.roomId;
      const room = roomMap[roomId];

      if (d.status === "on") {
        totalWatt += d.currentWatt;
        activeDeviceCount += 1;

        if (room) {
          room.totalWatt += d.currentWatt;
          room.activeDeviceCount += 1;
          if (d.type === "fan") {
            room.activeFans += 1;
            activeFansTotal += 1;
          } else {
            room.activeLights += 1;
            activeLightsTotal += 1;
          }
        }

        if (d.onSince) {
          const elapsedMs = now - new Date(d.onSince).getTime();
          const hours = Math.max(0, elapsedMs) / (1000 * 60 * 60);
          liveKwh += (d.ratedWatt * hours) / 1000;
        }
      }
    });

    const estimatedKwhToday = parseFloat((this.accumulatedKwhToday + liveKwh).toFixed(5));

    return {
      totalWatt,
      activeDeviceCount,
      activeFans: activeFansTotal,
      activeLights: activeLightsTotal,
      estimatedKwhToday,
      rooms: Object.values(roomMap),
    };
  }
}

export const powerCalculatorService = new PowerCalculatorService();
export default powerCalculatorService;
