require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const PORT = Number(process.env.PORT || 3003);
const TRANSACTIONS_SERVICE_URL = process.env.TRANSACTIONS_SERVICE_URL || "http://localhost:3002";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy_key");
const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ service: "summary-service", status: "ok" });
});

app.get("/summary", async (req, res) => {
  const accountId = req.query.accountId;

  if (!accountId) {
    return res.status(400).json({ error: "accountId is required" });
  }

  try {
    // 1. Fetch the user's transactions from the internal microservice
    const txResponse = await fetch(`${TRANSACTIONS_SERVICE_URL}/transactions?accountId=${accountId}`);
    const txData = await txResponse.json();

    if (!txResponse.ok) {
      throw new Error(txData.error || "Failed to fetch transactions");
    }

    const transactions = txData.transactions || [];

    if (transactions.length === 0) {
      return res.json({ 
        insights: "Not enough transaction data to generate insights yet. Start adding some expenses!" 
      });
    }

    // 2. Format the data for the AI
    const txSummary = transactions.map(t => 
      `${t.date.split('T')[0]}: ${t.category} - $${(t.amountCents / 100).toFixed(2)} (${t.description || 'N/A'})`
    ).join("\n");

    const prompt = `
      You are an expert financial advisor. Review the following transaction history and provide a short, 
      insightful summary of the user's spending habits. Highlight any trends and give one actionable tip 
      to save money. Keep the tone professional but encouraging. Maximum 4 sentences.

      Transactions:
      ${txSummary}
    `;

    // 3. Call Google Gemini
    if (!process.env.GEMINI_API_KEY) {
       return res.json({ insights: "AI insights disabled. Provide a GEMINI_API_KEY in the .env file." });
    }

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    res.json({ insights: responseText });

  } catch (error) {
    console.error("Summary Service Error:", error);
    res.status(500).json({ error: "Failed to generate AI insights" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Summary service listening on ${PORT}`);
});