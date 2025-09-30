import jwt from "jsonwebtoken";

const generateTokenJWT = async (payload) => {
  try {
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
    return token;
  } catch (error) {
    return null;
  }
};

export default generateTokenJWT;
