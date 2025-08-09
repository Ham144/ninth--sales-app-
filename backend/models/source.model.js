import mongoose from "mongoose";

const SourceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  SOAP_PRODUCT_URL: String,
  SOAP_PRODUCT_USERNAME: String,
  SOAP_PRODUCT_PASSWORD: String,
  SOAP_PRODUCT_SOAPACTION: String,
  SOAP_CUSTOMER_URL: String,
  SOAP_CUSTOMER_USERNAME: String,
  SOAP_CUSTOMER_PASSWORD: String,
  SOAP_CUSTOMER_SOAPACTION: String,
});

const Source = mongoose.model("Source", SourceSchema);
export default Source;
