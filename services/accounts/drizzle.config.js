// require("dotenv").config();
// const { defineConfig } = require("drizzle-kit");

// module.exports = defineConfig({
//   schema: "./db/schema.js",
//   out: "./drizzle",
//   dialect: "postgresql",
//   dbCredentials: {
//     url: process.env.DATABASE_URL,
//   },
//   tablesFilter: ["accounts_service.*"],
// });
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./db/schema.js",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  schemaFilter: ["accounts_service"] // <--- The magic fix
});