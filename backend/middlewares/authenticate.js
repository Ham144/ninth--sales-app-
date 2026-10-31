import jwt from "jsonwebtoken";
import IntegrationKeyModel from "../models/IntegrationKey.model.js";

export function bearerToken(req) {
  const header = String(req?.headers?.authorization || "");
  if (!header.startsWith("Bearer ")) return "";
  return header.slice(7).trim();
}

export function authTokensFromRequest(req) {
  const header = bearerToken(req);
  const cookie = String(req?.cookies?.access_token || "").trim();
  return [...new Set([header, cookie].filter(Boolean))];
}

export function verifyFirstValidToken(tokens, secret, verify = jwt.verify) {
  if (!tokens.length) {
    const error = new Error("session renewal");
    error.status = 401;
    error.code = "renewal";
    throw error;
  }
  let lastError;
  for (const token of tokens) {
    try {
      return verify(token, secret);
    } catch (error) {
      lastError = error;
    }
  }
  const error = new Error("Invalid or expired token");
  error.status = 401;
  error.cause = lastError;
  throw error;
}

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
    if (apiKey.scope === "public-catalog") {
      return res.status(403).json({
        message: "Api key ini hanya untuk katalog publik",
      });
    }

    req.user = userInfo;
    // inject ke req untuk keperluan downstream
    req.integrationKey = apiKey;
    next();
    return;
  }

  try {
    req.user = verifyFirstValidToken(
      authTokensFromRequest(req),
      process.env.JWT_SECRET,
    );
    next();
  } catch (error) {
    if (error.code === "renewal") {
      console.log("authentication failed : ", req.originalUrl);
      return res.status(401).json({
        message: "session renewal",
      });
    }
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default authenticate;
