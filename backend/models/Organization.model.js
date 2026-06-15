import mongoose from "mongoose";

//tenant
const organizationSchema = new mongoose.Schema(
  {
    organizationName: {
      type: String,
      required: true,
      unique: true,
    },
    owners: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserRefrensi",
        required: true,
      },
    ],
    members: [
      //owner juga harusnya ada disini
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserRefrensi",
        required: true,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserRefrensi",
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
    // start Active Directory---------------
    AD_HOST: {
      type: String,
      required: true,
    },
    AD_PORT: {
      type: Number,
      required: true,
    },
    AD_DOMAIN: {
      type: String,
      required: true,
    },
    AD_BASE_DN: {
      //contoh : DC=csi,DC=my,DC=id
      type: String,
      required: true,
    },
    //END Active Directory-----------------------

    // start smtp---------------
    EMAIL_USER: {
      type: String,
      required: true,
    },
    EMAIL_PASS: {
      type: String,
      required: true,
    },
    EMAIL_HOST: {
      type: String,
      required: true,
    },
    EMAIL_PORT: {
      type: String,
      required: true,
      default: "587",
    },
    EMAIL_SECURE: {
      type: Boolean,
      required: true,
      default: false,
    },
    // END smtp---------------
    //START SOAP---------------
    SOAP_PRODUCT_URL: String,
    SOAP_PRODUCT_USERNAME: String,
    SOAP_PRODUCT_PASSWORD: String,
    SOAP_PRODUCT_SOAPACTION: String,
    SOAP_PRODUCT_XMLNS: String,

    SOAP_STOCK_URL: String,
    SOAP_STOCK_USERNAME: String,
    SOAP_STOCK_PASSWORD: String,
    SOAP_STOCK_SOAPACTION: String,
    SOAP_STOCK_XMLNS: String,

    SOAP_CUSTOMER_URL: String,
    SOAP_CUSTOMER_USERNAME: String,
    SOAP_CUSTOMER_PASSWORD: String,
    SOAP_CUSTOMER_SOAPACTION: String,
    SOAP_CUSTOMER_XMLNS: String,

    // sales order pending released
    SOAP_TRANSACTION_URL: String,
    SOAP_TRANSACTION_USERNAME: String,
    SOAP_TRANSACTION_PASSWORD: String,
    SOAP_TRANSACTION_SOAPACTION: String,
    SOAP_TRANSACTION_XMLNS: String,

    SOAP_PEMBAYARANTERTUNDA_URL: String,
    SOAP_PEMBAYARANTERTUNDA_USERNAME: String,
    SOAP_PEMBAYARANTERTUNDA_PASSWORD: String,
    SOAP_PEMBAYARANTERTUNDA_SOAPACTION: String,
    SOAP_PEMBAYARANTERTUNDA_XMLNS: String,

    SOAP_CHECKSTATUSNAV_URL: String,
    SOAP_CHECKSTATUSNAV_USERNAME: String,
    SOAP_CHECKSTATUSNAV_PASSWORD: String,
    SOAP_CHECKSTATUSNAV_SOAPACTION: String,
    SOAP_CHECKSTATUSNAV_XMLNS: String,

    //END SOAP---------------
  },
  {
    timestamps: true,
  },
);

const Org = new mongoose.model("Org", organizationSchema);
export default Org;
