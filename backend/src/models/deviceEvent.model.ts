import mongoose, { Schema, Document, Model } from "mongoose";

export interface DeviceEventDoc extends Document {
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
  timestamp: Date;
  createdAt: Date;
}

const DeviceEventSchema = new Schema<DeviceEventDoc>(
  {
    deviceId: { type: String, required: true, index: true },
    roomId: { type: String, required: true, index: true },
    roomName: { type: String, required: true },
    deviceName: { type: String, required: true },
    type: { type: String, enum: ["fan", "light"], required: true },
    previousStatus: { type: String, enum: ["on", "off"], required: true },
    newStatus: { type: String, enum: ["on", "off"], required: true },
    ratedWatt: { type: Number, required: true },
    currentWatt: { type: Number, required: true },
    source: { type: String, enum: ["wokwi", "simulator"], required: true },
    timestamp: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "device_events" }
);

export const DeviceEventModel: Model<DeviceEventDoc> =
  (mongoose.models.DeviceEvent as Model<DeviceEventDoc>) ||
  mongoose.model<DeviceEventDoc>("DeviceEvent", DeviceEventSchema);