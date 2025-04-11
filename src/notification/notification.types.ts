import { EmailNotificationStatus, NotificationType, WebNotificationStatus } from "@prisma/client";

export interface ICreateNotification{
    userWallet: string,
    title: string,
    message: string,
    type: NotificationType
}

export interface IUpdateNotification{
    webStatus?: WebNotificationStatus,
    emailStatus?: EmailNotificationStatus
}