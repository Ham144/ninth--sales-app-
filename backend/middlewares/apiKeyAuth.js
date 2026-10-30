import IntegrationKeyModel from "../models/IntegrationKey.model.js";

const apiKeyAuth = async (req, res, next) => {
  try {
    const xapiKey = req.headers["x-api-key"];


    if (!xapiKey) {
      return res.status(401).json({ message: "Missing x-api-key header" });
    }

    const apiKey = await IntegrationKeyModel.findOne({ apiKey: xapiKey });

    if (
      !apiKey ||
      apiKey.status === "revoked" ||
      (apiKey.expiredAt && apiKey.expiredAt.getTime() < Date.now())
    ) {
      return res.status(401).json({ message: "Api key sudah tidak valid" });
    }

    if (apiKey.scope === "public-catalog") {
      return res.status(403).json({
        message: "Api key ini hanya untuk katalog publik",
      });
    }

    // inject ke req untuk keperluan downstream
    req.integrationKey = apiKey;

    next();
  } catch (err) {
    console.error("apiKeyAuth error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export async function publicCatalogKeyAuth(req, res, next) {
  try {
    const xapiKey = req.headers["x-api-key"];
    if (!xapiKey) {
      return res.status(401).json({ message: "Missing x-api-key header" });
    }

    const apiKey = await IntegrationKeyModel.findOne({ apiKey: xapiKey });
    if (
      !apiKey ||
      apiKey.status === "revoked" ||
      (apiKey.expiredAt && apiKey.expiredAt.getTime() < Date.now())
    ) {
      return res.status(401).json({ message: "Api key sudah tidak valid" });
    }

    const scope = apiKey.scope || "full";
    if (scope !== "public-catalog" && scope !== "full") {
      return res.status(403).json({ message: "Api key tidak punya scope katalog publik" });
    }

    req.integrationKey = apiKey;
    next();
  } catch (err) {
    console.error("publicCatalogKeyAuth error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}

export default apiKeyAuth;
