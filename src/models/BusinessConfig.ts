import mongoose, { Schema } from "mongoose";

const BusinessConfigSchema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  qrisImage: {
    type: Buffer,
    required: false,
  },
});

export const BusinessConfig = mongoose.model("BusinessConfig", BusinessConfigSchema);
