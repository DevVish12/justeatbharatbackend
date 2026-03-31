import env from "../config/env.js";
import { verifyToken } from "../utils/jwt.js";

const userAuthMiddleware = (req, res, next) => {
    try {
        const cookieName = env.USER_AUTH_COOKIE_NAME;
        const token = req.cookies?.[cookieName] || null;

        if (!token) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const decoded = verifyToken(token);
        if (!decoded || decoded.role !== "user") {
            return res.status(401).json({ message: "Invalid token" });
        }

        req.user = decoded;
        return next();
    } catch (error) {
        return res.status(401).json({ message: "Token expired or invalid" });
    }
};

export default userAuthMiddleware;
