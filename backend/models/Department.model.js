import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  org: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Org",
    required: true,
  },
  members: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserRefrensi",
      required: true,
    },
  ],
});

const Department = mongoose.model("Department", departmentSchema);
export default Department;
