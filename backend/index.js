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
import departmentRoutes from "./routes/department.route.js";
import bulkRoutes from "./routes/bulk.route.js";
import productRoutes from "./routes/product.route.js";
import customerRoutes from "./routes/customer.route.js";
import startCronCustomer from "./utils/cron-customer.js";
import startCronProduct from "./utils/cron-product.js";
import salesOrderRoutes from "./routes/salesOrder.route.js";

const isProduction = process.env.NODE_ENV === "production";
const corsOrigin = isProduction
  ? ["http://192.168.169.22"]
  : ["http://192.168.169.12:5173"];

const app = express();

//midlerwares
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

// Serve static files from uploads directory
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

//database
connectDB();

//public seutuhnya || kalau sebagian, tambah ke noAuthOriginalUrl js
app.get("/", async (req, res) => {
  return res.send("BACKEND : 200");
});

//routes reusable (jangan dihapus)
app.use("/api/auth", auhtRoutes);
app.use("/api/config", authenticate, authorize, configRoutes);
app.use("/api/org", orgRoutes);
app.use("/api/file", authenticate, fileRoutes);
app.use("/api/department", authenticate, departmentRoutes);
app.use("/api/bulk", authenticate, authorize, bulkRoutes);

//routes project utama
app.use("/api/v1/product", authenticate, productRoutes);
app.use("/api/v1/customer", authenticate, customerRoutes);
app.use("/api/v1/salesOrder", authenticate, salesOrderRoutes);

if (process.env.NODE_ENV === "production") {
  startCronCustomer();
  startCronProduct();
}

const port = process.env.PORT;
app.listen(port, () => console.log("Server Berjalan di port "));
