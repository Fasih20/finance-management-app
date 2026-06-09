require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { createClient } = require("redis");
const { db } = require("./db");
const { transactions } = require("./db/schema");
const { eq, desc } = require("drizzle-orm");

const PORT = Number(process.env.PORT || 3002);
const REDIS_URL = process.env.REDIS_URL; // Let it be undefined locally

const app = express();
app.use(cors());
app.use(express.json());

// Fallback Cache Setup
let redisClient = null;
const memoryCache = new Map();

async function initCache() {
  if (REDIS_URL) {
    try {
      console.log(`Attempting to connect to Redis at ${REDIS_URL}`);
      redisClient = createClient({ url: REDIS_URL });
      redisClient.on('error', (err) => console.error('Redis Client Error', err));
      await redisClient.connect();
      console.log("Connected to Redis successfully.");
    } catch (error) {
      console.warn("Redis connection failed. Falling back to memory cache.");
      redisClient = null;
    }
  } else {
    console.log("No REDIS_URL provided. Using memory cache for local development.");
  }
}

// Helper functions to abstract the cache layer
async function getCache(key) {
  if (redisClient) return await redisClient.get(key);
  return memoryCache.get(key) || null;
}

async function setCache(key, value) {
  if (redisClient) {
    await redisClient.setEx(key, 3600, value);
  } else {
    memoryCache.set(key, value);
  }
}

async function clearCache(key) {
  if (redisClient) {
    await redisClient.del(key);
  } else {
    memoryCache.delete(key);
  }
}

async function start() {
  await initCache();

  app.get("/health", (_req, res) => {
    res.json({ service: "transactions-service", status: "ok" });
  });

  // GET Transactions
  app.get("/transactions", async (req, res) => {
    const accountId = req.query.accountId;
    if (!accountId) return res.status(400).json({ error: "accountId is required" });

    const cacheKey = `txns:${accountId}`;

    try {
      // 1. Check Cache
      const cached = await getCache(cacheKey);
      if (cached) {
        return res.json({ transactions: JSON.parse(cached), source: "cache" });
      }

      // 2. Cache Miss -> Query DB
      const results = await db.select()
        .from(transactions)
        .where(eq(transactions.accountId, accountId))
        .orderBy(desc(transactions.date));

      // 3. Save to Cache
      await setCache(cacheKey, JSON.stringify(results));

      res.json({ transactions: results, source: "database" });
    } catch (error) {
      console.error("DB Error:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  // POST New Transaction
  // POST New Transaction
  app.post("/transactions", async (req, res) => {
    // Add 'date' to the extracted body variables
    const { accountId, amountCents, category, description, date } = req.body;

    if (!accountId || !amountCents || !category) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const txnValues = {
        id: `txn_${crypto.randomUUID().slice(0, 8)}`,
        accountId,
        amountCents,
        category,
        description,
      };
      
      // If the frontend sends a custom date, override the database default
      if (date) {
        txnValues.date = new Date(date);
      }

      const newTxn = await db.insert(transactions).values(txnValues).returning();

      // Invalidate the cache
      await clearCache(`txns:${accountId}`);

      res.status(201).json({ transaction: newTxn[0] });
    } catch (error) {
      console.error("DB Error:", error);
      res.status(500).json({ error: "Failed to create transaction" });
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Transactions service listening on ${PORT}`);
  });
}

start().catch(console.error);