import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`DATABASE Telah berhasil tersambung`);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
};
