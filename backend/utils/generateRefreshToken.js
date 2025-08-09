import jwt from "jsonwebtoken";

const generateRefreshToken = async (payload) => {
  try {
    const token = jwt.sign(payload, process.env.JWT_SECRET_REFRESH, {
      expiresIn: "7d",
    });
    return token;
  } catch (error) {
    return null;
  }
};

export default generateRefreshToken;
