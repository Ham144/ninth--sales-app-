import mongoose from "mongoose";

const temporarySalesOrderSchema = new mongoose.Schema(
  {
    frontendSession: {
      type: String,
      required: true,
    },
    comment: {
      type: String,
      required: true,
    },
    org: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Org",
      required: true,
    },
    products: [
      {
        type: mongoose.Schema.Types.Mixed,
        required: true,
      },
    ],
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserRefrensi",
      required: true,
    },
  },
  { timestamps: true }
);

temporarySalesOrderSchema.index({ frontendSession: 1 }, { unique: true });

const TemporarySalesOrder = mongoose.model(
  "TemporarySalesOrder",
  temporarySalesOrderSchema
);
export default TemporarySalesOrder;
