import mongoose, { Schema, Document, Model } from "mongoose";

export interface UsageRoomWatts {
  drawing: number;
  work1: number;
  work2: number;
}

export interface UsageSnapshotDoc extends Document {
  totalWatt: number;
  activeDeviceCount: number;
  activeFans: number;
  activeLights: number;
  estimatedKwhToday: number;
  roomWatts: UsageRoomWatts;
  timestamp: Date;
  createdAt: Date;
}

const UsageSnapshotSchema = new Schema<UsageSnapshotDoc>(
  {
    totalWatt: { type: Number, required: true },
    activeDeviceCount: { type: Number, required: true },
    activeFans: { type: Number, required: true },
    activeLights: { type: Number, required: true },
    estimatedKwhToday: { type: Number, required: true },
    roomWatts: {
      drawing: { type: Number, required: true, default: 0 },
      work1: { type: Number, required: true, default: 0 },
      work2: { type: Number, required: true, default: 0 },
    },
    timestamp: { type: Date, required: true, default: () => new Date(), index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "usage_snapshots" }
);

export const UsageSnapshotModel: Model<UsageSnapshotDoc> =
  (mongoose.models.UsageSnapshot as Model<UsageSnapshotDoc>) ||
  mongoose.model<UsageSnapshotDoc>("UsageSnapshot", UsageSnapshotSchema);