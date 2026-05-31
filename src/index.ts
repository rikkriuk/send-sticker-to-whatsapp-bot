import dotenv from "dotenv";
dotenv.config();
import { connectDB } from "./config/db";
import "./bots/whatsapp";
import "./bots/telegram";
import ffmpegStatic from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import { User } from "./models/User";

ffmpeg.setFfmpegPath(ffmpegStatic as string);

const start = async () => {
   await connectDB();

   await User.updateMany({}, { $set: { isProcessing: false } });
};
 
start();