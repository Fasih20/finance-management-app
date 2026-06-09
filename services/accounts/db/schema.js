// const { pgTable, text, integer, timestamp } = require("drizzle-orm/pg-core");

// const accounts = pgTable("accounts", {
//   id: text("id").primaryKey(), // We'll use random UUIDs
//   userId: text("user_id").notNull(), // This will tie to the Clerk user ID
//   name: text("name").notNull(), // e.g., "Checking", "Savings"
//   plaidId: text("plaid_id"), // Mock Plaid ID
//   mask: text("mask"), // e.g., "1234"
//   currentBalanceCents: integer("current_balance_cents").notNull().default(0),
//   createdAt: timestamp("created_at").defaultNow().notNull(),
// });

// module.exports = { accounts };
const { pgSchema, text, integer, timestamp } = require("drizzle-orm/pg-core");

// Create a fenced schema specifically for accounts
const mySchema = pgSchema("accounts_service");

const accounts = mySchema.table("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  plaidId: text("plaid_id"),
  mask: text("mask"),
  currentBalanceCents: integer("current_balance_cents").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

module.exports = { accounts, mySchema };