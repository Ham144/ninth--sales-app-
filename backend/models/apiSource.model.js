import mongoose from "mongoose";

const apiSourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  getProductUrl: {
    type: String,
    required: true,
    unique: true,
  },
  getCustomerUrl: {
    type: String,
  },
  authLoginUrl: {
    type: String,
    required: true,
  },
  authFormData: [{ key: String, value: String }],
  token: {
    type: String,
  },
  tokenExpired: {
    type: Date,
  },
});

const ApiSource = mongoose.model("ApiSource", apiSourceSchema);
export default ApiSource;
