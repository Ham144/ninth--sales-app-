import jwt from "jsonwebtoken";

const authenticate = (req, res, next) => {
  const token =
    req?.cookies?.access_token || req.headers.authorization?.split(" ")[1];

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
    console.log("authentication success : ", req.originalUrl);
    next();
  } catch (error) {
    console.log("authentication failed : ", req.originalUrl);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default authenticate;
