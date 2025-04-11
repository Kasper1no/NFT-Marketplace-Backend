import { EmailNotificationStatus, Notification, NotificationType, PrismaClient, WebNotificationStatus } from "@prisma/client";
import { ICreateNotification, IUpdateNotification } from "./notification.types";

export class NotificationService {
    private prisma = new PrismaClient();

    getWebNotifications(walletAddress: string) {
        return this.prisma.notification.findMany({
            where: {
                userWallet: walletAddress,
                NOT: {
                    webStatus: WebNotificationStatus.FAILED
                }
            }
        });
    }

    getEmailNotifications() {
        return this.prisma.notification.findMany({
            where: {
                NOT: {
                    emailStatus: EmailNotificationStatus.SENT
                }
            }
        });
    }

    getNotification(id: string): Promise<Notification | null> {
        return this.prisma.notification.findUnique({
            where: {
                id: id
            }
        });
    }

    private async checkNotificationSettings(userWallet: string, type: NotificationType): Promise<boolean> {
        const user = await this.prisma.user.findUnique({
            where: {
                walletAddress: userWallet
            }
        })

        if (!user) {
            return false;
        }

        switch (type) {
            case NotificationType.BESTOFFER:
                return user.bestOfferActivityNotification;
            case NotificationType.MINT:
                return user.successfulMintNotification;
            case NotificationType.OFFER:
                return user.offerActivityNotification;
            case NotificationType.OUTBID:
                return user.outbidNotification;
            case NotificationType.SUCCESSTRANSFER:
                return user.successfulTransferNotification;
            case NotificationType.PURCHASE:
                return user.successfulPurchaseNotification;
        }

        return false;
    }

    async createNotification(notification: ICreateNotification): Promise<Notification | void> {
        if (await this.checkNotificationSettings(notification.userWallet, notification.type)) {
            return this.prisma.notification.create({
                data: notification
            });
        }
    }

    updateNotification(id: string, notification: IUpdateNotification): Promise<Notification> {
        return this.prisma.notification.update({
            where: {
                id: id
            },
            data: notification
        });
    }
}