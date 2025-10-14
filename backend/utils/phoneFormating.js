const phoneFormating = (phone) => {
  let phoneFormated;
  if (phone?.trim() != "") {
    if (phone.startsWith("+62") || phone.startsWith("62")) {
      if (phone.startsWith("+")) {
        phoneFormated = phone.slice(1);
      } else {
        phoneFormated = phone;
      }
    } else if (phone.startsWith("0")) {
      phoneFormated = `62${phone.slice(1)}`;
    }
    return phoneFormated;
  }
};

export default phoneFormating;
