import { NotificationService } from "@/notification/notification.service";
import { UserService } from "@/user/user.service";
import cron from "node-cron";
import { sendMail } from "@/notification/mailService";
import { EmailNotificationStatus } from "@prisma/client";

const notificationService = new NotificationService();
const userService = new UserService();

const checkAndSendNotifications = async () => {
    try {
        const unsentNotifications = await notificationService.getEmailNotifications();

        for (const notification of unsentNotifications) {
            const user = await userService.getUserByWalletAddress(notification.userWallet);

            if (user) {
                try {
                    const emailSent = await sendMail(user.email, user.nickname, notification.title, notification.message);
                    if (emailSent) {
                        await notificationService.updateNotification(notification.id, {
                            emailStatus: EmailNotificationStatus.SENT
                        });
                    }
                } catch (err) {
                    console.error("Error sending email: ", err)
                    await notificationService.updateNotification(notification.id, {
                        emailStatus: EmailNotificationStatus.FAILED
                    });
                }
            }
        }
    } catch (err) {
        console.error("Error getting users: ", err)
        return
    }
}

cron.schedule("* * * * *", () => {
    console.log("Checking for notifications to send...");
    checkAndSendNotifications();
  });