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
    }
  );

  await db.collection("users").updateMany(
    { isPremium: { $exists: false } },
    { $set: { isPremium: false, premiumExpiredAt: null } }
  );

  await db.collection("users").updateMany(
    { isBlocked: { $exists: false } },
    { $set: { isBlocked: false } }
  );

  console.log("✅ Migration done");
  await mongoose.disconnect();
};

migrate().catch(console.error);