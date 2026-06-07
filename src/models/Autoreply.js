import mongoose from "mongoose";

const AutoreplySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    keyword: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    replyType: {
      type: String,
      enum: ["text", "list"],
      default: "text",
    },

    replyContent: String,

    listData: {
      buttonText: String,
      sections: [
        {
          title: String,
          rows: [
            {
              title: String,
              description: String,
              rowId: String,
            },
          ],
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model(
  "Autoreply",
  AutoreplySchema
);