/**
 * Must run after authenticate. Only LDAP users with description === "IT"
 * may mutate hub content (updates, docs, apps).
 */
export default function requireIT(req, res, next) {
  const description = req.user?.description;
  if (description !== "IT") {
    return res.status(403).json({
      message: "Hanya user IT yang boleh mengubah data hub.",
    });
  }
  return next();
}
