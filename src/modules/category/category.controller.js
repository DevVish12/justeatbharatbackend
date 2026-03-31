export const categoryNotImplemented = async (req, res) => {
    return res.status(501).json({
        message:
            "Category module endpoints are not implemented in this backend snapshot.",
    });
};
