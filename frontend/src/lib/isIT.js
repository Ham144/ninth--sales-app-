/** Hub write privilege: LDAP user.description must be exactly "IT". */
export function isIT(user) {
  return Boolean(user && user.description === "IT");
}
