import UserRefrensi from "../models/User.model.js";

const authorize = async (req, res, next) => {
  try {
    // Check if userId is present from previous middleware (e.g., authenticate)
    if (!req?.user._id) {
      return res.status(401).json({
        success: false,
        message: "Akses tidak sah. User ID tidak ditemukan.",
      });
    }

    const userDB = await UserRefrensi.findOne({
      username: req.user.username,
      org: req.user.org,
    }).select("-password -otp");

    if (!userDB) {
      return res.status(401).json({
        success: false,
        message: "Anda tidak ditemukan di database. Silakan coba login ulang.",
      });
    }

    req.user = userDB;
    next();
  } catch (error) {
    // For unexpected errors, pass to the global error handling middleware
    console.error("Authorization error:", error); // Log the error for debugging
    next(error); // Pass the error to the next middleware (global error handler)
  }
};

export default authorize;
