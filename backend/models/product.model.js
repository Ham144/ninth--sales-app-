import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    No: { type: String, required: true }, // Gunakan No sebagai unique identifier
    Description: String,
    Description_2: String,
    Description_3: String,
    LongDescription: String,
    Net_Weight: Number,
    Web: Number,
    recgrosir: Number,
    _x003C_recretail_x003E_: Number,
    Unit_Volume: String,
    OS_Price: Number,
    MP_Price: Number,
    JD_Price: Number,
    LK: Number,
    NO_NIK: Number,
    TEMP: Number,
    Retail: Number,
    Dealer: String,
    Barcode_Item: String,
    Manufacturer_Code: String,
    Brand: String,
    Inventory_Posting_Group: String,
    Item_Category_Code: String,
    Blocked: String,
    Blocked_Services: String,
    Blocked_MA: String,
    Inv_PRMT: String,
    Inv_PLUIT: String,
    Inv_MNG2: String,
    Inv_BKS: String,
    Inv_CKP: String,
    Inv_CPDH: String,
    Inv_GLD_F: String,
    Inv_GLD: String,
    Inv_SNTL: String,
    Inv_SRNG: String,
    Inv_MP: String,
    Inv_OFFST: String,
    Inv_PKJ: String,
    Inv_prmt_OS: String,
    Inv_pmrn: String,
    Inv_cjrh: String,
    Inv_Gab4Loc: String,
    hash: String, //ini untuk optimasi super, mencegah update data yg sama
  },
  { timestamps: true }
);

productSchema.index({ No: 1 }, { unique: true });

const Product = mongoose.model("Product", productSchema);
export default Product;
