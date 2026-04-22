import { Queue } from "bullmq";
import { Redis } from "ioredis";

type QueueLike = {
  add: (name: string, payload: unknown) => Promise<unknown>;
};

const queuesDisabled = process.env.NODE_ENV === "test" || process.env.DISABLE_QUEUES === "true";

export const chainWriteQueue: QueueLike = queuesDisabled
  ? {
      add: async () => ({})
    }
  : new Queue("chain-write", {
      connection: new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
        maxRetriesPerRequest: null
      })
    });
