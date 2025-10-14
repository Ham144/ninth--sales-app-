import axios from "axios";

const sendWa = async ({ phone, message }) => {
  try {
    const response = await axios.post(
      "http://192.168.169.12:5678/webhook/1831e326-b4da-4e97-8fc4-156d2ffe6930",
      {
        phone,
        message,
        purpose: "wa-otp",
      },
      {
        headers: {
          "x-api-key": process.env.WA_OTP_API_KEY_N8N,
        },
      }
    );

    // Periksa status response dari n8n
    if (response.status === 200) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    // Jika ada error (network, timeout, dll), return false
    return false;
  }
};

export default sendWa;
