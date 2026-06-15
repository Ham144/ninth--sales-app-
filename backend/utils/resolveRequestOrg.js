import mongoose from "mongoose";
import Org from "../models/Organization.model.js";
import UserRefrensi from "../models/User.model.js";

export const resolveOrgId = (orgRef) => {
  if (!orgRef) return null;

  if (typeof orgRef === "string" && mongoose.isValidObjectId(orgRef)) {
    return orgRef;
  }

  if (orgRef instanceof mongoose.Types.ObjectId) {
    return String(orgRef);
  }

  if (typeof orgRef === "object" && orgRef._id) {
    return String(orgRef._id);
  }

  return null;
};

export const loadRequestOrganization = async (req) => {
  if (req.user?._id) {
    const requestor = await UserRefrensi.findById(req.user._id).populate("org");
    if (requestor?.org) {
      return {
        orgId: String(requestor.org._id),
        org: requestor.org,
        source: "user.populate",
      };
    }
  }

  const orgId = resolveOrgId(req.user?.org);
  if (orgId) {
    const org = await Org.findById(orgId);
    if (org) {
      return {
        orgId,
        org,
        source: "token.org",
      };
    }
  }

  return {
    orgId: null,
    org: null,
    source: null,
  };
};
