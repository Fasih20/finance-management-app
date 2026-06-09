require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { db } = require("./db");
const { accounts } = require("./db/schema");
const { eq } = require("drizzle-orm");

const PORT = Number(process.env.PORT || 3001);
const app = express();

app.use(cors());
app.use(express.json());

// Health check for AWS Load Balancer
app.get("/health", (_req, res) => {
  res.json({ service: "accounts-service", status: "ok" });
});

// GET all accounts for a specific user
app.get("/accounts", async (req, res) => {
  // In a real app, userId comes from the auth token passed by the Gateway
  const userId = req.query.userId || "mock_user_123"; 

  try {
    const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
    res.json({ accounts: userAccounts });
  } catch (error) {
    console.error("DB Error:", error);
    res.status(500).json({ error: "Failed to fetch accounts" });
  }
});

// MOCK PLAID CONNECTION: Create a new bank account
app.post("/accounts", async (req, res) => {
  const { userId, institutionName } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  // Simulate Plaid returning mock account data
  const mockAccountId = `acc_${crypto.randomUUID().slice(0, 8)}`;
  const mockBalanceCents = Math.floor(Math.random() * 500000) + 10000; // Random balance between $100 and $5000

  try {
    const newAccount = await db.insert(accounts).values({
      id: mockAccountId,
      userId: userId,
      name: `${institutionName || "Test Bank"} Checking`,
      plaidId: `ins_${crypto.randomUUID().slice(0, 8)}`,
      mask: Math.floor(1000 + Math.random() * 9000).toString(), // Random 4 digits
      currentBalanceCents: mockBalanceCents,
    }).returning();

    res.status(201).json({ account: newAccount[0] });
  } catch (error) {
    console.error("DB Error:", error);
    res.status(500).json({ error: "Failed to link account" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Accounts service listening on ${PORT}`);
});