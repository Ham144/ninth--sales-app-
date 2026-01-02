import mongoose from "mongoose";

const salesLineSchema = new mongoose.Schema(
  {
    DocumentNo: { type: String, required: true },
    LineNo: { type: Number, required: true },
    ItemNo: { type: String, required: true },
    Qty: { type: Number, required: true },
    UnitPrice: { type: Number, default: 0 },
    LineDiscountAmount: { type: Number, default: 0 },
    PromoCode: { type: String, default: "" },
  },
  { _id: false }
);

const salesOrderSchema = new mongoose.Schema(
  {
    return_value: { type: String, required: true },
    DocumentNo: { type: String, required: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    ShiptToCode: { type: String },
    OrderDate: { type: Date },
    LocationCode: { type: String },
    Dim1: { type: String },
    CustomerPriceGrp: { type: String },
    SalespersonCode: { type: String },
    SellToContact: { type: String },
    NoSeries: { type: String },
    ExtDoc: { type: String },
    RequestDeliveryDate: { type: Date, default: null },
    Keterangan: { type: String },
    SalesLine: [salesLineSchema],
    SalesLineTotal: { type: Number, default: 0 },
    org: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Org",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserRefrensi",
    },
    status: {
      type: String,
      enum: ["pending", "completed", "canceled"],
      default: "completed",
    },
  },
  { timestamps: true }
);

const SalesOrder = mongoose.model("SalesOrder", salesOrderSchema);
export default SalesOrder;
