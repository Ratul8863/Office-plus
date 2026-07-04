import mongoose, { Schema, Document, Model } from "mongoose";

export interface DeviceDoc extends Document {
  deviceId: string;
  name: string;
  type: "fan" | "light";
  roomId: "drawing" | "work1" | "work2";
  roomName: string;
  status: "on" | "off";
  ratedWatt: number;
  currentWatt: number;
  source: "wokwi" | "simulator";
  lastChanged: Date;
  onSince: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const DeviceSchema = new Schema<DeviceDoc>(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["fan", "light"], required: true },
    roomId: { type: String, enum: ["drawing", "work1", "work2"], required: true, index: true },
    roomName: { type: String, required: true },
    status: { type: String, enum: ["on", "off"], required: true },
    ratedWatt: { type: Number, required: true },
    currentWatt: { type: Number, required: true, default: 0 },
    source: { type: String, enum: ["wokwi", "simulator"], required: true },
    lastChanged: { type: Date, required: true },
    onSince: { type: Date, default: null },
  },
  { timestamps: true, collection: "devices" }
);

export const DeviceModel: Model<DeviceDoc> =
  (mongoose.models.Device as Model<DeviceDoc>) ||
  mongoose.model<DeviceDoc>("Device", DeviceSchema);