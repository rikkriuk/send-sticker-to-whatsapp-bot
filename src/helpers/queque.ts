import PQueue from "p-queue";

const userQueues = new Map<number, PQueue>();

// Animated (TGS/WebM)
const animatedProcessingQueue = new PQueue({ concurrency: 5 });

// Static (WebP)
const staticProcessingQueue = new PQueue({ concurrency: 15 });

const getUserQueue = (telegramId: number): PQueue => {
   if (!userQueues.has(telegramId)) {
      userQueues.set(telegramId, new PQueue({ concurrency: 1 }));
   }
   return userQueues.get(telegramId)!;
};

export {
   getUserQueue,
   animatedProcessingQueue,
   staticProcessingQueue,
}