import { createClient } from "redis";
import env from "./env.js";

let redisClient = null;
let connectPromise = null;
let loggedDisabled = false;

const getRedisUrl = () => {
    const url = String(env.REDIS_URL || "").trim();
    return url || null;
};

const createRedisClientIfNeeded = () => {
    if (redisClient) return redisClient;

    const url = getRedisUrl();
    if (!url) {
        if (!loggedDisabled) {
            console.log("[Redis] REDIS_URL not set; Redis cache disabled");
            loggedDisabled = true;
        }
        return null;
    }

    redisClient = createClient({ url });
    redisClient.on("error", (err) => {
        console.error("[Redis] Client error:", err?.message || err);
    });
    redisClient.on("connect", () => {
        console.log("[Redis] Connected");
    });
    redisClient.on("reconnecting", () => {
        console.log("[Redis] Reconnecting...");
    });
    redisClient.on("end", () => {
        console.log("[Redis] Connection closed");
    });

    return redisClient;
};

export const getRedisClient = async () => {
    const client = createRedisClientIfNeeded();
    if (!client) return null;

    if (client.isOpen) return client;
    if (connectPromise) return connectPromise;

    connectPromise = client
        .connect()
        .then(() => client)
        .catch((error) => {
            console.error("[Redis] Failed to connect:", error?.message || error);
            return null;
        })
        .finally(() => {
            connectPromise = null;
        });

    return connectPromise;
};

export const isRedisEnabled = () => {
    const url = getRedisUrl();
    return Boolean(url);
};

const redis = {
    get: async (key) => {
        const client = await getRedisClient();
        if (!client) return null;
        return client.get(key);
    },
    set: async (key, value, options) => {
        const client = await getRedisClient();
        if (!client) return null;
        return client.set(key, value, options);
    },
    del: async (key) => {
        const client = await getRedisClient();
        if (!client) return null;
        return client.del(key);
    },
};

export default redis;

