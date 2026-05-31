import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const migrate = async () => {
  await mongoose.connect(process.env.MONGO_URI as string);
  console.log("✅ Connected");

  const db = mongoose.connection.db;

  if (!db) return;

  await db.collection("users").updateMany(
    {},
    {
      $set: {
        stickerLimit: 10,
        isProcessing: false,
      },
      $setOnInsert: {
        whatsappNumber: null,
        userName: null,
      }
    }
  );

  console.log("✅ Migration done");
  await mongoose.disconnect();
};

migrate().catch(console.error);