import Org from "../models/Organization.model.js";

async function GetMyOrganizationAbbr({ req }) {
  const myOrg = await Org.findById(req.user.org).select("organizationName");

  const abbreviation = myOrg.organizationName
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  return abbreviation;
}

export default GetMyOrganizationAbbr;
