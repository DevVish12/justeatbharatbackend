import { getStoreOpen, setStoreOpen } from "./store.model.js";

export const getStoreStatusController = async (req, res, next) => {
    try {
        const storeOpen = await getStoreOpen();
        return res.status(200).json({ store_open: storeOpen });
    } catch (error) {
        return next(error);
    }
};

export const updateStoreStatusController = async (req, res, next) => {
    try {
        const storeOpenRaw = req?.body?.store_open;
        const storeOpen = Boolean(storeOpenRaw);

        const updated = await setStoreOpen({ storeOpen });
        return res.status(200).json({ store_open: updated });
    } catch (error) {
        return next(error);
    }
};
