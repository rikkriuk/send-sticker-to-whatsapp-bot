import dotenv from "dotenv";
dotenv.config();
import { connectDB } from "./config/db";
import "./bots/whatsapp";
import "./bots/telegram";

const start = async () => {
   await connectDB();
};
 
start();