import mongoose from "mongoose";
const counterSchema = new mongoose.Schema({
  name: { type: String, required: true },
  org: { type: mongoose.Schema.Types.ObjectId, ref: "Org", required: true },
  year: { type: String, required: true },
  sequence_value: { type: Number, required: true },
});

counterSchema.index({ org: 1, year: 1 }, { unique: true });

const Counter = mongoose.model("Counter", counterSchema);
export default Counter;
