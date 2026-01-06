const formatDateIndonesian = (dateString) => {
  const indonesianDate = new Date(dateString).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return indonesianDate;
};

export default formatDateIndonesian;
