import cron from "node-cron";
import "dotenv/config";
import ApiSource from "../models/apiSource.model.js";
import { connectDB } from "./connectDB.js";
import axios from "axios";
import FormData from "form-data";
import Product from "../models/product.model.js";

const reinitilizeProductFromSoap = async () => {
  //testing
  await connectDB();
  //testing end

  const form = new FormData();

  try {
    const apiSourceConfig = await ApiSource.findOne({});

    if (apiSourceConfig.length === 0) {
      console.log("Tidak ada konfigurasi API Source");
      return null;
    }

    //validasi apiSourceConfig masih berlaku
    if (
      !apiSourceConfig?.token ||
      new Date(apiSourceConfig?.tokenExpired) < new Date()
    ) {
      console.log(
        "mencoba mengambil token sourceApi baru, karena token sourceApi telah tidak valid"
      );
      apiSourceConfig.authFormData.forEach(({ key, value }) => {
        form.append(key, value);
      });

      const res = await axios.post(apiSourceConfig.authLoginUrl, form, {
        headers: {
          ...form.getHeaders(), // Penting: biar Content-Type dan boundary otomatis
        },
      });

      if (res.status === 200) {
        const expiresInSeconds = res.data.expires_in; // 31536000
        const expiresAt = new Date(Date.now() + expiresInSeconds * 1000); // convert ke Date

        apiSourceConfig.token = res?.data.access_token;
        apiSourceConfig.tokenExpired = expiresAt;
        await apiSourceConfig.save();
      }
    }

    const response = await axios.get(apiSourceConfig.getProductUrl, {
      headers: {
        Authorization: `Bearer ${apiSourceConfig.token}`,
      },
    });

    const products = response?.data?.data || [];

    // Ambil semua 'no' dari pusat
    const externalNos = products.map((p) => p.no);

    // Hapus produk lokal yang tidak ada di pusat
    await Product.deleteMany({ no: { $nin: externalNos } });

    // Siapkan bulk upsert
    const ops = products.map((p) => ({
      updateOne: {
        filter: { no: p.no },
        update: { $set: p },
        upsert: true,
      },
    }));

    await Product.bulkWrite(ops);

    console.log("✅ Sinkronisasi produk selesai");
  } catch (error) {
    console.error("Error parsing atau memperbarui customer cron:", error);
    return null;
  }
};

function startCronProduct() {
  cron.schedule("0 * * * *", async () => {
    try {
      console.log("🔃reinitilize Product From ApiSource..");
      await reinitilizeProductFromSoap();
      console.log("✅reinitilize Product From api source end");
    } catch (error) {
      console.log(error);
    }
  });
}

export default startCronProduct;
