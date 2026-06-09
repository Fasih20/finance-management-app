const express = require("express");
const cors = require("cors");

const PORT = Number(process.env.PORT || 8080);

// These map to your 4 required microservices + fallback defaults
const serviceUrls = {
  accounts: process.env.ACCOUNTS_SERVICE_URL || "http://localhost:3001",
  transactions: process.env.TRANSACTIONS_SERVICE_URL || "http://localhost:3002",
  summary: process.env.SUMMARY_SERVICE_URL || "http://localhost:3003",
  subscriptions: process.env.SUBSCRIPTIONS_SERVICE_URL || "http://localhost:3004"
};

const app = express();
app.use(cors());
app.use(express.json());

// Helper function to forward client JSON payloads upstream to microservices
async function forwardJson(method, targetUrl, body) {
  const response = await fetch(targetUrl, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload.error || `Upstream request failed: ${targetUrl}`);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function sendError(response, error) {
  response.status(error.statusCode || 500).json({
    error: error.message,
    details: error.payload || null
  });
}

// Global Health Check
app.get("/health", (_request, response) => {
  response.json({
    service: "gateway-service",
    status: "ok",
    upstreams: serviceUrls
  });
});

// --- ACCOUNTS ROUTES ---
app.get("/api/accounts", async (_req, res) => {
  try {
    const payload = await forwardJson("GET", `${serviceUrls.accounts}/accounts`);
    res.json(payload);
  } catch (error) { sendError(res, error); }
});

app.post("/api/accounts", async (req, res) => {
  try {
    const payload = await forwardJson("POST", `${serviceUrls.accounts}/accounts`, req.body);
    res.status(201).json(payload);
  } catch (error) { sendError(res, error); }
});

// --- TRANSACTIONS ROUTES ---
app.get("/api/transactions", async (_req, res) => {
  try {
    const payload = await forwardJson("GET", `${serviceUrls.transactions}/transactions`);
    res.json(payload);
  } catch (error) { sendError(res, error); }
});

app.post("/api/transactions", async (req, res) => {
  try {
    const payload = await forwardJson("POST", `${serviceUrls.transactions}/transactions`, req.body);
    res.status(201).json(payload);
  } catch (error) { sendError(res, error); }
});

// --- SUMMARY (AI INSIGHTS) ROUTES ---
app.get("/api/summary", async (_req, res) => {
  try {
    const payload = await forwardJson("GET", `${serviceUrls.summary}/summary`);
    res.json(payload);
  } catch (error) { sendError(res, error); }
});

// --- SUBSCRIPTIONS ROUTES ---
app.post("/api/subscriptions/billing", async (req, res) => {
  try {
    const payload = await forwardJson("POST", `${serviceUrls.subscriptions}/billing`, req.body);
    res.json(payload);
  } catch (error) { sendError(res, error); }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Gateway routing layer active on port ${PORT}`);
});