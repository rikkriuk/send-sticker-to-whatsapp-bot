import PQueue from "p-queue";

const userQueues = new Map<number, PQueue>();

const getUserQueue = (telegramId: number): PQueue => {
   if (!userQueues.has(telegramId)) {
      userQueues.set(telegramId, new PQueue({ concurrency: 1 }));
   }
   return userQueues.get(telegramId)!;
};

export {
   getUserQueue,
}