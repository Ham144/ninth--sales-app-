import express from "express";
import "dotenv/config";
import fs from "fs";
import { connectDB } from "./utils/connectDB.js";
import { seedHubKnowledgeIfEmpty } from "./utils/seedHubKnowledge.js";
import { scheduleKnowledgeReindex } from "./utils/knowledgeIndex.js";
import cors from "cors";
import auhtRoutes from "./routes/auth.route.js";
import authenticate from "./middlewares/authenticate.js";
import cookieParser from "cookie-parser";
import path from "path";
import configRoutes from "./routes/config.route.js";
import orgRoutes from "./routes/org.routes.js";
import fileRoutes from "./routes/file.route.js";
import authorize from "./middlewares/authorize.js";
import bulkRoutes from "./routes/bulk.route.js";
import productRoutes from "./routes/product.route.js";
import customerRoutes from "./routes/customer.route.js";
import startCronCustomer from "./utils/cron-customer.js";
import startCronProduct from "./utils/cron-product.js";
import salesOrderRoutes from "./routes/salesOrder.route.js";
import startCronOverdue from "./utils/cron-overdue.js";
import overdueRoutes from "./routes/overdue.route.js";
import locationRoutes from "./routes/Location.route.js";
// import authorizeSupertenant from "./middlewares/authoririzeSupertenant.js";
import integrationRoutes from "./routes/integration.route.js";
import apiKeyAuth, { publicCatalogKeyAuth } from "./middlewares/apiKeyAuth.js";
import userRoutes from "./routes/user.routes.js";
import organizationRoutes from "./routes/organization.route.js";
import salesOrderNav from "./routes/SalesOrderNav.route.js";
import inventoryRoutes from "./routes/inventory.route.js";
import hubRoutes from "./routes/hub.route.js";
import publicCatalogRoutes from "./routes/publicCatalog.route.js";
import { createAgentRouter } from "./agent/routes/chat.route.js";
import { createRedisLimiter } from "./agent/limits.js";
import redisService from "./utils/redisService.js";

const isProduction = process.env.NODE_ENV === "production";
// Same-origin hub (API + static on one PORT) needs no CORS.
// Keep list for separate frontends still hitting this API.
const corsOrigin = isProduction
  ? ["https://s-bit2.muara.co.id"]
  : [
      "http://192.168.169.12:1991",
      "http://192.168.169.12:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      "http://192.168.169.12:7047",
      "http://127.0.0.1:7047",
      "http://localhost:7047",
    ];

const app = express();

//midlerwares
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  }),
);

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

//database
connectDB().then(() =>
  seedHubKnowledgeIfEmpty()
    .then(() => scheduleKnowledgeReindex())
    .catch((error) => console.warn("[rag] seed/index gagal:", error.message)),
);

//routes reusable (jangan dihapus)
app.use("/api/auth", auhtRoutes);
app.use("/api/config", authenticate, authorize, configRoutes);
app.use("/api/org", orgRoutes);
app.use("/api/file", authenticate, fileRoutes);
app.use("/api/bulk", authenticate, authorize, bulkRoutes);
app.use(
  "/api/asThirdParty",
  authenticate,
  // authorizeSupertenant,
  integrationRoutes,
);

//routes project utama
app.use("/api/v1/product", authenticate, productRoutes);
app.use("/api/v1/customer", authenticate, customerRoutes);
// app.use("/api/v1/customer", authenticate, customerDetailExternalRoutes);
app.use("/api/v1/salesOrder", authenticate, salesOrderRoutes);
app.use("/api/v1/salesOrder", authenticate, salesOrderNav);
app.use("/api/v1/overdue", authenticate, overdueRoutes);
app.use("/api/v1/location", authenticate, locationRoutes);
// source of truth endpoint (pakai x-api-key krn Backend to Backend)
app.use("/api/v1/sot/user", apiKeyAuth, userRoutes);
app.use("/api/v1/sot/organization", apiKeyAuth, organizationRoutes);
app.use("/api/v1/inventory", authenticate, inventoryRoutes);
// Katalog read-only untuk chatbot B2C. Harga B2B dan angka stok tidak ikut.
app.use("/api/v1/public", publicCatalogKeyAuth, publicCatalogRoutes);
// System Hub: updates + knowledge docs (public read, auth write)
app.use("/api/v1/hub", hubRoutes);
app.use("/api/v1/agent", createAgentRouter({ limiter: createRedisLimiter(redisService) }));

/**
 * Serve System Hub SPA from ./public (vite build outDir).
 * No nginx required: API + static on the same PORT.
 * Build: `cd frontend && pnpm build` → backend/public
 */
const publicDir = path.join(process.cwd(), "public");
const hubIndex = path.join(publicDir, "index.html");
if (fs.existsSync(hubIndex)) {
  app.use(express.static(publicDir, { index: false, maxAge: isProduction ? "1d" : 0 }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      return next();
    }
    return res.sendFile(hubIndex);
  });
  console.log("System Hub static UI: enabled (backend/public)");
} else {
  console.log(
    "System Hub static UI: skipped (run `cd frontend && pnpm build` first)",
  );
}

if (process.env.NODE_ENV === "production") {
  startCronCustomer();
  startCronProduct(); //csi+ril
  startCronOverdue();
}

const port = process.env.PORT;
app.listen(port, () => console.log("Server running on port ", port + "✅"));
