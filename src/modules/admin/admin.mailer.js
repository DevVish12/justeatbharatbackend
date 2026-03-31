import nodemailer from "nodemailer";
import env from "../../config/env.js";

let cachedTransporter = null;

const canSendEmail = () =>
    Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_PORT);

const getTransporter = () => {
    if (!canSendEmail()) {
        return null;
    }

    if (!cachedTransporter) {
        cachedTransporter = nodemailer.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_PORT === 465,
            auth: {
                user: env.SMTP_USER,
                pass: env.SMTP_PASS,
            },
        });
    }

    return cachedTransporter;
};

export const sendAdminPasswordResetEmail = async ({ to, resetLink }) => {
    const transporter = getTransporter();

    if (!transporter) {
        console.log(`Password reset link for ${to}: ${resetLink}`);
        return false;
    }

    await transporter.sendMail({
        from: env.SMTP_FROM,
        to,
        subject: "Admin password reset",
        text: `Reset your admin password using this link: ${resetLink}`,
        html: `<p>Reset your admin password using this link:</p><p><a href="${resetLink}">${resetLink}</a></p>`,
    });

    return true;
};
