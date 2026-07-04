import mongoose, { Schema, Document, Model } from "mongoose";

export type AlertType =
  | "AFTER_HOURS_ON"
  | "ROOM_FULLY_ON_TOO_LONG"
  | "HIGH_USAGE"
  | "DEVICE_OFFLINE";

export type AlertStatus = "active" | "resolved";
export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertDoc extends Document {
  alertId: string;
  type: AlertType;
  status: AlertStatus;
  severity: AlertSeverity;
  roomId?: string;
  roomName?: string;
  deviceId?: string;
  message: string;
  triggeredAt: Date;
  resolvedAt?: Date | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const AlertSchema = new Schema<AlertDoc>(
  {
    alertId: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: ["AFTER_HOURS_ON", "ROOM_FULLY_ON_TOO_LONG", "HIGH_USAGE", "DEVICE_OFFLINE"],
      required: true,
      index: true,
    },
    status: { type: String, enum: ["active", "resolved"], required: true, index: true },
    severity: { type: String, enum: ["info", "warning", "critical"], required: true },
    roomId: { type: String, required: false, index: true },
    roomName: { type: String, required: false },
    deviceId: { type: String, required: false, index: true },
    message: { type: String, required: true },
    triggeredAt: { type: Date, required: true, default: () => new Date(), index: true },
    resolvedAt: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, required: false },
  },
  { timestamps: true, collection: "alerts" }
);

// Helpful compound index to find active duplicates quickly.
AlertSchema.index({ type: 1, status: 1, roomId: 1, deviceId: 1 });

export const AlertModel: Model<AlertDoc> =
  (mongoose.models.Alert as Model<AlertDoc>) ||
  mongoose.model<AlertDoc>("Alert", AlertSchema);