import {
    saveDishImageAndUpsertRecord,
    saveDishImagesAndUpsertRecords,
} from "./admin.image.service.js";

export const uploadDishImageController = async (req, res) => {
    try {
        const { itemid } = req.body || {};
        const result = await saveDishImageAndUpsertRecord({
            itemid,
            file: req.file,
        });

        return res.status(200).json({
            success: true,
            image: result.image,
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Upload failed",
        });
    }
};

export const uploadDishImagesController = async (req, res) => {
    try {
        const filesPayload = req.files;
        const files = Array.isArray(filesPayload)
            ? filesPayload
            : filesPayload
                ? [
                    ...(filesPayload.images || []),
                    ...(filesPayload["images[]"] || []),
                ]
                : [];

        const result = await saveDishImagesAndUpsertRecords({ files });

        return res.status(200).json({
            success: true,
            uploaded: result.uploaded,
        });
    } catch (error) {
        const statusCode = error.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: error.message || "Upload failed",
        });
    }
};
