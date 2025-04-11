import { UserService } from "@/user/user.service";
import { Router, Request, Response } from "express";
import { NotificationService } from "./notification.service";
import { addressValidator } from "@/user/user.dto";
import { WebNotificationStatus } from "@prisma/client";

const router = Router();
const userService = new UserService();
const notificationService = new NotificationService();

router.get("/", async (req: Request, res: Response) => {
    try {
        const validation = await addressValidator.safeParseAsync(req.query.walletAddress)

        if(!validation.success) {
            res.status(400).json({ message: validation.error.errors })
            return
        }

        const user = await userService.getUserByWalletAddress(validation.data)
        if(!user) {
            res.status(400).json({ message: "No such user" })
            return
        }

        const notifications = await notificationService.getWebNotifications(user.id)
        res.status(200).json(notifications)
        return
    } catch (err) {
        console.error("Error getting users: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.put("/", async (req: Request, res: Response) => {
    try {
        const notificationId = req.body.notificationId

        if(!notificationId) {
            res.status(400).json({ message: "No such notification" })
            return
        }

        const notification = await notificationService.getNotification(notificationId)

        if(!notification || notification.webStatus === WebNotificationStatus.FAILED) {
            res.status(400).json({ message: "No such notification" })
            return
        }

        const updatedNotification = await notificationService.updateNotification(notificationId, {
            webStatus: WebNotificationStatus.READ
        })

        res.status(200).json(updatedNotification)
        return
    }catch (err) {
        console.error("Error getting users: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})


export const notificationRouter = router