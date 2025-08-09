import FormData from "form-data";
import { connectDB } from "./connectDB.js";
import "dotenv/config";
import ApiSource from "../models/apiSource.model.js";
import axios from "axios";
import cron from "node-cron";
import Customer from "../models/Customer.model.js";

const reinitilizeCustomerFromSoap = async () => {
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

    //main
    const response = await axios.get(apiSourceConfig.getCustomerUrl, {
      headers: {
        Authorization: `Bearer ${apiSourceConfig.token}`,
      },
    });

    const customers = response?.data?.data || [];

    const externalNos = customers.map((customer) => customer.no);

    await Customer.deleteMany({ no: { $nin: externalNos } });

    const ops = customers.map((c) => ({
      updateOne: {
        filter: { no: c.no },
        update: { $set: c },
        upsert: true,
      },
    }));
    await Customer.bulkWrite(ops);
    console.log("✅ sinkronisai customer selesai");
  } catch (error) {
    console.log("Error parsing or fetching SOAP: ", error);
    return null;
  }
};

function startCronCustomer() {
  cron.schedule("0 * * * *", async () => {
    try {
      console.log("🔃reinitilize Customer From ApiSource..");
      await reinitilizeCustomerFromSoap();
      console.log("✅reinitilize Customer From api source end");
    } catch (error) {
      console.log(error);
    }
  });
}

export default startCronCustomer;
