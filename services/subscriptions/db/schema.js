// const { pgTable, text, timestamp } = require("drizzle-orm/pg-core");

// const subscriptions = pgTable("subscriptions", {
//   id: text("id").primaryKey(),
//   userId: text("user_id").notNull().unique(), // One active sub per user
//   planId: text("plan_id").notNull().default("free"), // 'free' or 'pro'
//   status: text("status").notNull().default("active"),
//   updatedAt: timestamp("updated_at").defaultNow().notNull(),
// });

// module.exports = { subscriptions };
const { pgSchema, text, timestamp } = require("drizzle-orm/pg-core");

const mySchema = pgSchema("subscriptions_service");

const subscriptions = mySchema.table("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  planId: text("plan_id").notNull().default("free"),
  status: text("status").notNull().default("active"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

module.exports = { subscriptions, mySchema };