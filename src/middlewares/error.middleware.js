const errorMiddleware = (error, req, res, next) => {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Internal server error";

    res.status(statusCode).json({
        message,
        ...(process.env.NODE_ENV !== "production" && {
            stack: error.stack,
            details: error.details,
        }),
    });
};

export default errorMiddleware;
