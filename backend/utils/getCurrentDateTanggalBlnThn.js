function getCurrentDateTanggalBlnThn() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0"); // bulan dari 0
  const year = today.getFullYear();

  // Format DD/MM/YYYY untuk RequestDeliveryDate
  const formattedDate = `${day}/${month}/${year}`;

  return formattedDate;
}

function getCurrentDateISO() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0"); // bulan dari 0
  const year = today.getFullYear();

  // Format YYYY-MM-DD untuk OrderDate dan field lain yang membutuhkan format ISO
  const formattedDate = `${year}-${month}-${day}`;

  return formattedDate;
}

function getCurrentDateNAV() {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0"); // bulan dari 0
  const year = today.getFullYear();

  // Format MM/DD/YYYY yang mungkin lebih kompatibel dengan NAV
  const formattedDate = `${month}/${day}/${year}`;

  return formattedDate;
}

/*
/*Kalau lewat jam 14:00 (2 siang) → tanggal geser ke besok.
/*Kalau lewat jam 14:00 dan hari ini Sabtu → tanggal geser ke Senin (skip Minggu).
*/
function getCurrentDateForNAV() {
  const now = new Date();

  // Cek jika sudah lewat jam 14:00
  if (now.getHours() >= 14) {
    now.setDate(now.getDate() + 1); // geser ke besok

    // Kalau setelah digeser ternyata besok adalah Minggu, tambahkan 1 hari lagi
    if (now.getDay() === 0) {
      // 0 = Minggu
      now.setDate(now.getDate() + 1);
    }
  }

  // Kalau sekarang hari Sabtu DAN sudah lewat jam 14:00 → langsung loncat ke Senin
  if (now.getDay() === 6 && new Date().getHours() >= 14) {
    // 6 = Sabtu
    now.setDate(now.getDate() + 2); // lompat 2 hari ke Senin
  }

  // Format DD/MM/YYYY
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();

  return `${year}-${month}-${day}`;
}

export default getCurrentDateTanggalBlnThn;
export { getCurrentDateISO, getCurrentDateNAV, getCurrentDateForNAV };
