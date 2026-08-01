import express from "express";
import "dotenv/config";
import { connectDB } from "./utils/connectDB.js";
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
import apiKeyAuth from "./middlewares/apiKeyAuth.js";
import userRoutes from "./routes/user.routes.js";
import organizationRoutes from "./routes/organization.route.js";
import salesOrderNav from "./routes/SalesOrderNav.route.js";
import inventoryRoutes from "./routes/inventory.route.js";

const isProduction = process.env.NODE_ENV === "production";
const corsOrigin = isProduction
  ? ["https://s-bit2.muara.co.id"]
  : ["http://192.168.169.12:1991"];

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
connectDB();

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

if (process.env.NODE_ENV === "production") {
  startCronCustomer();
  startCronProduct();
  startCronOverdue();
}

const port = process.env.PORT;
app.listen(port, () => console.log("Server running on port ", port + "✅"));
