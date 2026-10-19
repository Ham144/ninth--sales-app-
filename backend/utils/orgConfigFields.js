export const ORG_CONFIG_PUBLIC_FIELDS = [
  "AD_HOST",
  "AD_PORT",
  "AD_DOMAIN",
  "AD_BASE_DN",
  "EMAIL_USER",
  "EMAIL_HOST",
  "EMAIL_PORT",
  "EMAIL_SECURE",
  "SOAP_PRODUCT_URL",
  "SOAP_PRODUCT_USERNAME",
  "SOAP_PRODUCT_SOAPACTION",
  "SOAP_PRODUCT_XMLNS",
  "SOAP_PRODUCT_RIL_URL",
  "SOAP_PRODUCT_RIL_USERNAME",
  "SOAP_PRODUCT_RIL_SOAPACTION",
  "SOAP_PRODUCT_RIL_XMLNS",
  "SOAP_STOCK_URL",
  "SOAP_STOCK_USERNAME",
  "SOAP_STOCK_SOAPACTION",
  "SOAP_STOCK_XMLNS",
  "SOAP_CUSTOMER_URL",
  "SOAP_CUSTOMER_USERNAME",
  "SOAP_CUSTOMER_SOAPACTION",
  "SOAP_CUSTOMER_XMLNS",
  "SOAP_TRANSACTION_URL",
  "SOAP_TRANSACTION_USERNAME",
  "SOAP_TRANSACTION_SOAPACTION",
  "SOAP_TRANSACTION_XMLNS",
  "SOAP_PEMBAYARANTERTUNDA_URL",
  "SOAP_PEMBAYARANTERTUNDA_USERNAME",
  "SOAP_PEMBAYARANTERTUNDA_SOAPACTION",
  "SOAP_PEMBAYARANTERTUNDA_XMLNS",
  "SOAP_CHECKSTATUSNAV_URL",
  "SOAP_CHECKSTATUSNAV_USERNAME",
  "SOAP_CHECKSTATUSNAV_SOAPACTION",
  "SOAP_CHECKSTATUSNAV_XMLNS",
  "SOAP_STOCK_URL",
  "SOAP_STOCK_USERNAME",
  "SOAP_STOCK_SOAPACTION",
  "SOAP_STOCK_XMLNS",
  "SOAP_INVENTORY_URL",
  "SOAP_INVENTORY_USERNAME",
  "SOAP_INVENTORY_SOAPACTION",
  "SOAP_INVENTORY_XMLNS",
];

export const ORG_CONFIG_PASSWORD_FIELDS = [
  "EMAIL_PASS",
  "SOAP_PRODUCT_PASSWORD",
  "SOAP_PRODUCT_RIL_PASSWORD",
  "SOAP_STOCK_PASSWORD",
  "SOAP_CUSTOMER_PASSWORD",
  "SOAP_TRANSACTION_PASSWORD",
  "SOAP_PEMBAYARANTERTUNDA_PASSWORD",
  "SOAP_CHECKSTATUSNAV_PASSWORD",
  "SOAP_INVENTORY_PASSWORD",
];

export const ORG_CONFIG_UPDATABLE_FIELDS = [
  ...ORG_CONFIG_PUBLIC_FIELDS,
  ...ORG_CONFIG_PASSWORD_FIELDS,
];

export const ORG_SMTP_FIELDS = [
  "EMAIL_HOST",
  "EMAIL_PORT",
  "EMAIL_SECURE",
  "EMAIL_USER",
  "EMAIL_PASS",
];

export const ORG_SMTP_SELECT =
  "EMAIL_HOST EMAIL_PORT EMAIL_SECURE EMAIL_USER EMAIL_PASS organizationName _id";

export const ORG_CONFIG_PUBLIC_SELECT = ORG_CONFIG_PUBLIC_FIELDS.join(" ");

export const ORG_SOT_UPDATE_BLOCKLIST = new Set([
  "_id",
  "organizationName",
  "owners",
  "members",
  "createdBy",
  "isDisabled",
  "createdAt",
  "updatedAt",
  "__v",
]);

export const SOAP_CHECKSTATUSNAV_CONFIG_FIELDS = [
  "SOAP_CHECKSTATUSNAV_URL",
  "SOAP_CHECKSTATUSNAV_USERNAME",
  "SOAP_CHECKSTATUSNAV_PASSWORD",
  "SOAP_CHECKSTATUSNAV_SOAPACTION",
  "SOAP_CHECKSTATUSNAV_XMLNS",
];

export const getMissingConfigFields = (org, fields) =>
  fields.filter((field) => {
    const value = org?.[field];
    return value === undefined || value === null || String(value).trim() === "";
  });

export const getPasswordConfiguredFlags = (org) =>
  Object.fromEntries(
    ORG_CONFIG_PASSWORD_FIELDS.map((field) => [
      field,
      Boolean(org?.[field] && String(org[field]).trim()),
    ]),
  );

/** User-facing config: skip empty password agar tidak overwrite nilai lama */
export const pickAllowedConfigUpdate = (body = {}) =>
  Object.fromEntries(
    Object.entries(body).filter(
      ([key, value]) =>
        ORG_CONFIG_UPDATABLE_FIELDS.includes(key) &&
        value !== "" &&
        value !== null &&
        value !== undefined,
    ),
  );

/** SOT backend-to-backend: whitelist field konfigurasi, skip kosong & blocklist */
export const pickSotConfigUpdate = (body = {}) =>
  Object.fromEntries(
    Object.entries(body || {}).filter(
      ([key, value]) =>
        !ORG_SOT_UPDATE_BLOCKLIST.has(key) &&
        ORG_CONFIG_UPDATABLE_FIELDS.includes(key) &&
        value !== "" &&
        value !== null &&
        value !== undefined,
    ),
  );

export const stripOrgPasswordFields = (org) => {
  if (!org) return org;

  const plain = org.toObject ? org.toObject() : { ...org };

  for (const field of ORG_CONFIG_PASSWORD_FIELDS) {
    delete plain[field];
  }

  return plain;
};
