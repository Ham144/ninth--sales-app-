import Counter from "./../models/Counter.model.js";
import Org from "./../models/Organization.model.js";

const generateGlobalIndex = async (req, sequenceName) => {
  const currentYear = new Date().getFullYear().toString();

  let counter = await Counter.findOne({
    name: sequenceName,
    org: req.user.org,
  });

  // Ambil organisasi
  const myOrg = await Org.findById(req.user.org)
    .select("organizationName")
    .lean();

  const abbreviation = myOrg.organizationName
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase())
    .join("");

  // Jika belum ada counter, buat satu di database
  if (!counter) {
    counter = await Counter.create({
      name: sequenceName,
      org: req.user.org,
      year: currentYear,
      sequence_value: 1,
    });

    return `${abbreviation}-${currentYear}-${String(1).padStart(5, "0")}`;
  }

  //reset ke 1 jika tahun berganti
  if (counter.year !== currentYear) {
    counter.sequence_value = 1;
    counter.year = currentYear;
  } else {
    counter.sequence_value += 1;
  }

  await counter.save();

  return `${abbreviation}-${currentYear}-${String(
    counter.sequence_value
  ).padStart(5, "0")}`;
};

export default generateGlobalIndex;
