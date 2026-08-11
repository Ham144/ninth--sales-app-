import jwt from "jsonwebtoken";
import IntegrationKeyModel from "../models/IntegrationKey.model.js";

const authenticate = async (req, res, next) => {
  //check for the api key first if its backend to backend
  const xapiKey = req.headers["x-api-key"];
  if (xapiKey) {
    const apiKey = await IntegrationKeyModel.findOne({ apiKey: xapiKey });

    if (
      !apiKey ||
      apiKey.status === "revoked" ||
      apiKey.expiredAt < Date.now()
    ) {
      return res.status(401).json({ message: "Api key sudah tidak valid" });
    }

    let userInfo = {};
    try {
      const header = req.headers["user-info"];
      if (header) {
        // pastikan string JSON valid dulu
        userInfo = JSON.parse(header);
      }
    } catch (err) {
      console.error("❌ Failed to parse user-info header:", err.message);
    }
    req.user = userInfo;
    // inject ke req untuk keperluan downstream
    req.integrationKey = apiKey;
    next();
    return;
  }

    const token =req?.cookies?.access_token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    console.log("authentication failed : ", req.originalUrl);
    return res.status(401).json({
      message: "session renewal",
    });
  }

  try {
    let decoded;
    // Verify web token
    decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.log(
      "authentication ❌ : ",
      `${req.user.username}-${req.originalUrl}`
    );
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default authenticate;
