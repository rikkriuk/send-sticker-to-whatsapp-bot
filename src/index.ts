import { connectDB } from "./config/db";
import "./bots/telegram";
import "./bots/whatsapp";

const start = async () => {
   await connectDB();
};
 
start();