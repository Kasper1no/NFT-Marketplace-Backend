import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const generateEmailContent = (userName: string, message: string): string => {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <h1 style="color: #4CAF50;">Hello, ${userName}!</h1>
      <p>${message}</p>
      <footer style="margin-top: 20px; font-size: 12px; color: #777;">
        Best regards,<br>
        Your Cloud Safe Team
      </footer>
    </div>
  `;
};

export const sendMail = async (to: string, nickname: string, subject: string, text: string) => {
    try {
        const info = await transporter.sendMail({
          from: `"Cloud Safe" <${process.env.SMTP_USER}>`,
          to,
          subject,
          html: generateEmailContent(nickname, text),
        });
    
        console.log("Email sent:", info.messageId);
        return info;
      } catch (error) {
        console.error("Error sending email:", error);
        throw error;
      }
};

