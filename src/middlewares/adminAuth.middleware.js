import { verifyToken } from "../utils/jwt.js";

const adminAuthMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : null;

        if (!token) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const decoded = verifyToken(token);
        if (!decoded || decoded.role !== "admin") {
            return res.status(401).json({ message: "Invalid token" });
        }

        req.admin = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: "Token expired or invalid" });
    }
};

export default adminAuthMiddleware;
