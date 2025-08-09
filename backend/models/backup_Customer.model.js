import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    no: String,
    name: String,
    address: String,
    address_2: String,
    city: String,
    contact: String,
    phone_no: String,
    customer_price_group: String,
    payment_terms_code: String,
    payment_term: String,
    sales_person_code: String,
    wht_business_posting_group: String,
    vat_business_posting_group: String,
    amount: String,
    blocked: String,
    balance: String,
    credit_limit_lyc: String,
    balance_due: String,
    location_code: String,
    email: String,
    telepon: String,
    x003c_area_x003e: String,
    hp_no: String,
    home_page: String,
    crm_id: String,
  },
  { timestamps: true }
);

const Customer = mongoose.model("Customer", customerSchema);
export default Customer;
