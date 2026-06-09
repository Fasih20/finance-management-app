// const { pgTable, text, integer, timestamp } = require("drizzle-orm/pg-core");

// const transactions = pgTable("transactions", {
//   id: text("id").primaryKey(),
//   accountId: text("account_id").notNull(),
//   amountCents: integer("amount_cents").notNull(), // Positive = Income, Negative = Expense
//   category: text("category").notNull(), // e.g., "Food", "Rent", "Salary"
//   description: text("description"),
//   date: timestamp("date").defaultNow().notNull(),
// });

// module.exports = { transactions };

const { pgSchema, text, integer, timestamp } = require("drizzle-orm/pg-core");

const mySchema = pgSchema("transactions_service");

const transactions = mySchema.table("transactions", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  amountCents: integer("amount_cents").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  date: timestamp("date").defaultNow().notNull(),
});

module.exports = { transactions, mySchema };