import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    no: String,
    description: String,
    description_2: String,
    description_3: String,
    net_weight: String,
    web: String,

    retail: String,
    x003c_recretail_x003e: String,
    recgrosir: String,

    manufacturer_code: String,
    x003c_brand_x003e: String,
    inventory_posting_group: String,
    item_category_code: String,

    keterangan: String,
    link_video: String,
    link_photo: String,

    inv_prmt: Number,
    inv_pluit: Number,
    inv_mng2: Number,
    inv_bks: Number,
    inv_ckp: Number,
    inv_cpdh: Number,
    inv_gld_f: Number,
    inv_gld: Number,
    inv_sntl: Number,
    inv_srng: Number,
    inv_mp: Number,
    inv_offst: Number,
    inv_pkj: Number,

    unit_volume: String,
    barcode_item: String,

    blocked_service: Number,
    blocked_ma: Number,
  },
  { timestamps: true }
);

const Product = mongoose.model("Product", productSchema);
export default Product;
