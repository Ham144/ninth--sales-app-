import { Router } from "express";
import Org from "../models/Organization.model.js";
import LdapClient from "ldapjs-client";
import UserRefrensi from "../models/User.model.js";

const router = Router();

//initialize semua user ldap
router.post("/initialize/all", async (req, res) => {
  const selectedOrg = req.user.org;
  const OrgDB = await Org.findById(selectedOrg);

  const client = new LdapClient({
    url: `ldap://${OrgDB.AD_HOST}:${OrgDB.AD_PORT}`,
  });

  const bindDn = `csi\\${process.env.LDAP_USERNAME}`;
  const baseDN = OrgDB.AD_BASE_DN;

  try {
    await client.bind(bindDn, process.env.LDAP_PASSWORD);

    const result = await client.search(baseDN, {
      scope: "sub",
      filter: "(objectClass=person)",
      attributes: [
        "sAMAccountName",
        "physicalDeliveryOfficeName",
        "displayName",
        "mail",
      ],
    });

    const userLDAP = result;

    if (!userLDAP.length) {
      return res.status(400).json({
        success: false,
        message: "Tidak ada user di LDAP",
      });
    }

    for (const user of userLDAP) {
      const { sAMAccountName, physicalDeliveryOfficeName, displayName, mail } =
        user;

      if (!sAMAccountName || !physicalDeliveryOfficeName) {
        console.log("Skipped (missing field):", user);
        continue;
      }

      // Cari user
      let userDB = await UserRefrensi.findOne({
        username: sAMAccountName,
        org: selectedOrg,
        authMethod: "ldap",
      });

      if (!userDB) {
        userDB = await UserRefrensi.create({
          username: sAMAccountName,
          org: selectedOrg,
          role: "member",
          authMethod: "ldap",
          displayName,
          email: mail,
        });
      } else {
        // update jika ada perubahan
        const updateData = {};
        if (userDB.displayName !== displayName)
          updateData.displayName = displayName;
        if (userDB.email !== mail) updateData.email = mail;

        if (Object.keys(updateData).length > 0) {
          await UserRefrensi.updateOne(
            { _id: userDB._id },
            { $set: updateData }
          );
        }
      }

      // Pastikan user masuk Org.members
      await Org.updateOne(
        { _id: selectedOrg },
        { $addToSet: { members: userDB._id } }
      );
    }

    return res.json({
      success: true,
      message: "Berhasil menginisiasi user list dari AD anda.",
    });
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;
