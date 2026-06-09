require("dotenv").config();
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const { db } = require("./db");
const { subscriptions } = require("./db/schema");
const { eq } = require("drizzle-orm");

const PORT = Number(process.env.PORT || 3004);
const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ service: "subscriptions-service", status: "ok" });
});

// GET: Check a user's current subscription status
app.get("/subscriptions", async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ error: "userId is required" });

  try {
    const result = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    
    if (result.length === 0) {
      // Default to free if no record exists
      return res.json({ subscription: { planId: "free", status: "active" } });
    }

    res.json({ subscription: result[0] });
  } catch (error) {
    console.error("DB Error:", error);
    res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

// POST: Mock Checkout/Billing Endpoint
app.post("/billing", async (req, res) => {
  const { userId, action } = req.body; // action can be 'upgrade' or 'cancel'

  if (!userId || !action) {
    return res.status(400).json({ error: "userId and action are required" });
  }

  try {
    const newPlanId = action === 'upgrade' ? 'pro' : 'free';
    const subId = `sub_${crypto.randomUUID().slice(0, 8)}`;

    // Upsert the subscription record
    const result = await db.insert(subscriptions)
      .values({ id: subId, userId, planId: newPlanId })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: { planId: newPlanId, updatedAt: new Date() }
      })
      .returning();

    res.json({ 
      status: "success", 
      message: `User successfully changed to ${newPlanId} plan.`,
      subscription: result[0] 
    });
  } catch (error) {
    console.error("DB Error:", error);
    res.status(500).json({ error: "Billing process failed" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Subscriptions service listening on ${PORT}`);
});