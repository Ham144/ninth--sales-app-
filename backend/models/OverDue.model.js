import mongoose from "mongoose";

const overdueSchema = new mongoose.Schema({
  customerNo: { type: Number },
  postingDate: { type: Date },
  dueDate: { type: Date },
  documentNo: { type: String },
  salespersonCode: { type: String },
  remainingAmount: { type: Number },
  AR: { type: String },
  blocked: { type: Number },
});

const OverDue = mongoose.model("OverDue", overdueSchema);
export default OverDue;
