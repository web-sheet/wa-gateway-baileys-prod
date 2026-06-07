import mongoose from "mongoose";

const BroadcastSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: String,

    message: String,

    totalTarget: {
      type: Number,
      default: 0,
    },

    success: {
      type: Number,
      default: 0,
    },

    failed: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["pending", "running", "completed", "scheduled"],
      default: "pending",
    },

    repeatType: {
      type: String,
      enum: ["once", "daily", "weekly"],
      default: "once",
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Broadcast", BroadcastSchema);
