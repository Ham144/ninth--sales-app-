import React from "react";
import { LockKeyhole } from "lucide-react";
import { motion } from "framer-motion";

const NotFound = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br ">
      {/* Animasi angka 403 */}
      <motion.h1
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="text-[8rem] sm:text-[10rem] font-extrabold text-white"
      >
        403
      </motion.h1>

      {/* Judul */}
      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-2xl sm:text-3xl font-semibold text-center text-white"
      >
        Halaman yang kamu akses dilindungi 🔒
      </motion.p>

      {/* Deskripsi kecil */}
      <motion.p
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-gray-400 mt-3 text-center text-sm sm:text-base"
      >
        Kamu tidak memiliki izin untuk melihat halaman ini. Silakan hubungi
        admin jika merasa ini kesalahan.
      </motion.p>

      {/* Ikon besar */}
      <motion.div
        initial={{ rotate: -10, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ delay: 0.8, type: "spring", stiffness: 100 }}
        className="mt-10 p-6 bg-white/10 rounded-full backdrop-blur-md shadow-lg"
      >
        <LockKeyhole size={64} className="text-rose-400 animate-pulse" />
      </motion.div>

      {/* Tombol kembali */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => window.history.back()}
        className="mt-10 px-6 py-2 rounded-full bg-gradient-to-r from-rose-500 to-red-500 text-white font-medium shadow-md hover:shadow-lg transition"
      >
        Kembali
      </motion.button>
    </div>
  );
};

export default NotFound;
