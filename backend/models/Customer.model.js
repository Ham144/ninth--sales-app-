import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    No: String,
    Name: String,
    Address: String,
    Address_2: String,
    City: String,
    Phone_No: String,
    HP_No: String,
    Customer_Price_Group: String,
    Payment_Terms_Code: String,
    Payment_Term: String,
    Salesperson_Code: String,
    WHT_Business_Posting_Group: String,
    VAT_Bus_Posting_Group: String,
    Amount: String,
    Blocked: String,
    Balance: String,
    Credit_Limit_LCY: String,
    Balance_Due: String,
    Location_Code: String,
    _x003C_Area_x003E_: String,
    Home_Page: String,
    Customer_Disc_Group: String,
    CRM_ID: String,
    hash: String, //ini untuk optimasi super, mencegah update data yg sama
  },
  { timestamps: true }
);

customerSchema.index({ No: 1 }, { unique: true });

const Customer = mongoose.model("Customer", customerSchema);
export default Customer;
