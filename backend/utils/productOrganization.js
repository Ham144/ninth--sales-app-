export const PRODUCT_ORGANIZATIONS = ["csi", "ril"];

export const normalizeProductOrganization = (value) => {
  const organization = String(value ?? "csi").trim().toLowerCase() || "csi";
  if (!PRODUCT_ORGANIZATIONS.includes(organization)) return null;
  return organization;
};

/** CSI also matches rows synced before the organization field existed. */
export const productOrganizationQuery = (organization) => {
  if (organization === "csi") {
    return {
      $or: [
        { organization: "csi" },
        { organization: null },
        { organization: { $exists: false } },
      ],
    };
  }

  return { organization };
};
