import { getLoginHistoryForAdmin, getUsersForAdmin } from "../auth/user.model.js";

export const listUsersController = async (req, res, next) => {
    try {
        const users = await getUsersForAdmin();
        return res.status(200).json({ users });
    } catch (error) {
        return next(error);
    }
};

export const listLoginHistoryController = async (req, res, next) => {
    try {
        const limit = req.query?.limit;
        const history = await getLoginHistoryForAdmin({ limit });
        return res.status(200).json({ history });
    } catch (error) {
        return next(error);
    }
};
