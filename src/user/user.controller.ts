import { Router, Request, Response } from "express";
import multer from "multer";
import { v2 as cloudinary } from 'cloudinary';
import { UserService } from "./user.service";
import { addressValidator, createUserDTO, updateUserDTO, friendRequestDTO, getFriendRequestsDTO, acceptFriendRequestDTO, friendshipDTO, updateUserNotificationDTO } from "./user.dto";
import { NotificationType, RequestStatus } from "@prisma/client";
import { NotificationService } from "@/notification/notification.service";
import { TokenService } from "@/middleware/jwt.service";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const router = Router();

const userService = new UserService();
const tokenService = new TokenService();
const notificationService = new NotificationService();

const baseAvatar = "https://res.cloudinary.com/dnkulgobc/image/upload/v1739471803/default_avatar_qh3umt.jpg";
const baseBanner = "https://res.cloudinary.com/dnkulgobc/image/upload/v1739471803/default_banner_pxjfac.jpg";

const upload = multer({ storage: multer.memoryStorage() })

async function uploadImageToCloud(file: Express.Multer.File): Promise<string> {
    try {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload_stream({ use_filename: false }, (error, result) => {
                if (error || !result) {
                    console.error(error);
                    reject(error);
                } else {
                    // console.log(result.url);
                    resolve(result.url);
                }
            }).end(file.buffer);
        });
    } catch (err) {
        console.error(err);
        throw new Error("Failed to upload image");
    }
}

async function deleteImageFromCloud(imageUrl: string): Promise<void> {
    try {
        return new Promise((resolve, reject) => {
            cloudinary.uploader.destroy(imageUrl, (error, result) => {
                if (error) {
                    console.error(error);
                    reject(error);
                } else {
                    // console.log(result);
                    resolve();
                }
            });
        });
    } catch (err) {
        console.error(err);
        throw new Error("Failed to delete image");
    }
}

router.get("/all", async (req: Request, res: Response) => {
    try {
        const users = await userService.getUsers()
        res.status(200).json(users)
        return
    } catch (err) {
        console.error("Error getting users: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.get("/user", async (req: Request, res: Response) => {
    try {
        const addressValidation = await addressValidator.safeParseAsync(req.query.walletAddress)

        if (!addressValidation.success) {
            res.status(400).json({ message: addressValidation.error.errors })
            return
        }

        const user = await userService.getUserByWalletAddress(addressValidation.data)
        res.status(200).json(user)
        return
    } catch (err) {
        console.error("Error getting users: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.get("/search", async (req: Request, res: Response) => {
    try {
        const query = req.query.query as string
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const { users, totalCount } = await userService.searchUsers(query, limit, skip);

        res.status(200).json({
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            users
        });
        return
    } catch (err) {
        console.error("Error getting users: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.post("/user", async (req: Request, res: Response) => {
    try {
        const validation = await createUserDTO.safeParseAsync(req.body)

        if (!validation.success) {
            res.status(400).json({ message: validation.error.errors })
            return
        }

        const user = await userService.createUser({
            ...validation.data
        })

        if (!user) {
            res.status(500).json({ message: "Internal server error" })
        }

        const accessToken = await tokenService.createAccessToken(validation.data.walletAddress);
        const refreshToken = await tokenService.createRefreshToken(validation.data.walletAddress);
        await tokenService.upsertRefreshToken(validation.data.walletAddress, refreshToken);

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(200).json({
            user,
            accessToken,
        });
        return
    } catch (err) {
        console.error("Error creating user: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.put("/user",
    upload.fields([
        { name: "avatar", maxCount: 1 },
        { name: "banner", maxCount: 1 }
    ]), async (req: Request, res: Response) => {
        try {
            const addressValidation = await addressValidator.safeParseAsync(req.query.walletAddress)
            const dataValidation = await updateUserDTO.safeParseAsync(req.body)

            if (!addressValidation.success) {
                res.status(400).json({ message: addressValidation.error.errors })
                return
            }

            if (!dataValidation.success) {
                res.status(400).json({ message: dataValidation.error.errors })
                return
            }

            let avatarUrl, bannerUrl;
            const currentUser = await userService.getUserByWalletAddress(addressValidation.data)
            const currentAvatar = currentUser?.avatar
            const currentBanner = currentUser?.banner

            const files = req.files as { [fieldname: string]: Express.Multer.File[] };

            if (files && files.avatar[0]) {
                avatarUrl = await uploadImageToCloud(files.avatar[0])

                const imageId = currentAvatar?.split("/").pop()?.split(".")[0]
                if (imageId && currentAvatar != baseAvatar) await deleteImageFromCloud(imageId)
            } else {
                avatarUrl = currentAvatar
            }

            if (files && files.banner[0]) {
                bannerUrl = await uploadImageToCloud(files.banner[0])

                const imageId = currentBanner?.split("/").pop()?.split(".")[0]
                if (imageId && currentBanner != baseBanner) await deleteImageFromCloud(imageId)
            } else {
                bannerUrl = currentBanner
            }

            const user = await userService.updateUser(
                addressValidation.data,
                { ...dataValidation.data, avatar: avatarUrl, banner: bannerUrl }
            )

            if (!user) {
                res.status(400).json({ message: "No such user" })
                return
            }

            // await notificationService.createNotification({
            //     userWallet: user.walletAddress,
            //     title: "Profile update",
            //     message: "Your profile has been updated",
            //     type: NotificationType.SUCCESS
            // })

            res.status(200).json(user)
            return
        } catch (err) {
            console.error("Error updating user: ", err)
            res.status(500).json({ message: "Internal server error" })
            return
        }
    })

router.put("/user-notifications", async (req: Request, res: Response) => {
    try {
        const addressValidation = await updateUserNotificationDTO.safeParseAsync(req.body)

        if (!addressValidation.success) {
            res.status(400).json({ message: addressValidation.error.errors })
            return
        }

        const user = await userService.updateUserNotification(addressValidation.data.walletAddress, {
            ...addressValidation.data
        })

        if (!user) {
            res.status(400).json({ message: "No such user" })
            return
        }

        res.status(200).json(user)
        return
    }catch (err) {
        console.error("Error updating user: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }

})    

router.delete("/user", async (req: Request, res: Response) => {
    try {
        const validation = await addressValidator.safeParseAsync(req.query.walletAddress)

        if (!validation.success) {
            res.status(400).json({ message: validation.error.errors })
            return
        }

        const user = await userService.deleteUser(validation.data)
        if (user) {
            const imageId = user.avatar?.split("/").pop()?.split(".")[0]
            if (imageId) await deleteImageFromCloud(imageId)
        }

        res.status(200).json(user)
        return
    } catch (err) {
        console.error("Error deleting user: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.get("/friend-request", async (req: Request, res: Response) => {
    try {
        const validation = await getFriendRequestsDTO.safeParseAsync({ walletAddress: req.query.walletAddress, type: req.query.type })

        if (!validation.success) {
            console.log(req.query)
            res.status(400).json({ message: validation.error.errors })
            return
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        let requests;
        let totalCount;

        if (validation.data.type === "sent") {
            totalCount = await userService.countSentRequestsByWallet(validation.data.walletAddress)
            requests = await userService.getSentRequestsByWallet(validation.data.walletAddress, skip, limit)
        } else {
            totalCount = await userService.countRecievedRequestsByWallet(validation.data.walletAddress)
            requests = await userService.getRecievedRequestsByWallet(validation.data.walletAddress, skip, limit)
        }


        res.status(200).json({
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            requests
        })
        return
    } catch (err) {
        console.error("Error getting friend requests: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.post("/friend-request", async (req: Request, res: Response) => {
    try {
        const validation = await friendRequestDTO.safeParseAsync(req.body)

        if (!validation.success) {
            res.status(400).json({ message: validation.error.errors })
            return
        }

        const friendRequest = await userService.getRequest(validation.data.senderWallet, validation.data.receiverWallet)
        const friendship = await userService.getFriendship(validation.data.senderWallet, validation.data.receiverWallet)    

        if (friendship) {
            res.status(400).json({ message: "Users are already friends" })
            return
        }
        else if (friendRequest?.status === RequestStatus.PENDING) {
            res.status(400).json({ message: "Friend request already sent" })
            return
        }
        else if (friendRequest?.status === RequestStatus.REJECTED) {
            const newFriendRequest = await userService.updateFriendRequest(friendRequest.id, RequestStatus.PENDING)

            if (!newFriendRequest) {
                res.status(400).json({ message: "Friend request could not be updated" })
                return
            }

            // await notificationService.createNotification({
            //     userWallet: validation.data.senderWallet,
            //     title: "Friend request",
            //     message: `Ypur friend request to ${validation.data.receiverWallet} was sent again`,
            //     type: NotificationType.FRIEND
            // })

            // await notificationService.createNotification({
            //     userWallet: validation.data.receiverWallet,
            //     title: "Friend request",
            //     message: `${validation.data.senderWallet} sent you a friend request again`,
            //     type: NotificationType.FRIEND
            // })

            res.status(200).json(newFriendRequest)
            return
        }

        const newFriendRequest = await userService.createFriendRequest({
            senderWallet: validation.data.senderWallet,
            receiverWallet: validation.data.receiverWallet
        })

        if (!newFriendRequest) {
            res.status(400).json({ message: "Friend request could not be created" })
            return
        }

        // await notificationService.createNotification({
        //     userWallet: newFriendRequest.receiverWallet,
        //     title: "Friend request",
        //     message: `${newFriendRequest.senderWallet} sent you a friend request`,
        //     type: NotificationType.FRIEND
        // })

        // await notificationService.createNotification({
        //     userWallet: newFriendRequest.senderWallet,
        //     title: "Friend request",
        //     message: `You sent ${newFriendRequest.receiverWallet} a friend request`,
        //     type: NotificationType.FRIEND
        // })

        res.status(200).json(newFriendRequest)
        return
    } catch (err) {
        console.error("Error creating friend request: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.put("/friend-request", async (req: Request, res: Response) => {
    try {
        const validation = await acceptFriendRequestDTO.safeParseAsync(req.body)

        if (!validation.success) {
            res.status(400).json({ message: validation.error.errors })
            return
        }

        const friendRequest = await userService.getRequest(validation.data.senderWallet, validation.data.receiverWallet)

        if (!friendRequest) {
            res.status(400).json({ message: "No such friend request" })
            return
        }

        const newFriendRequest = await userService.updateFriendRequest(friendRequest.id, validation.data.accepted ? RequestStatus.ACCEPTED : RequestStatus.REJECTED)

        if (!newFriendRequest) {
            res.status(400).json({ message: "Friend request could not be updated" })
            return
        }
        var senderMessage = ""
        var receiverMessage = ""
        if (validation.data.accepted) {
            const newFriendship = await userService.createFriendship({
                user1Wallet: validation.data.senderWallet,
                user2Wallet: validation.data.receiverWallet
            })

            if (!newFriendship) {
                res.status(400).json({ message: "Friendship could not be created" })
                return
            }

            senderMessage = `Your friend request to ${validation.data.receiverWallet} was accepted`
            receiverMessage = `${validation.data.senderWallet} accepted your friend request`
        }
        else {
            senderMessage = `Your friend request to ${validation.data.receiverWallet} was rejected`
            receiverMessage = `${validation.data.senderWallet} rejected your friend request`
        }

        // await notificationService.createNotification({
        //     userWallet: validation.data.senderWallet,
        //     title: "Friend request",
        //     message: senderMessage,
        //     type: NotificationType.FRIEND
        // })

        // await notificationService.createNotification({
        //     userWallet: validation.data.receiverWallet,
        //     title: "Friend request",
        //     message: receiverMessage,
        //     type: NotificationType.FRIEND
        // })

        res.status(200).json(newFriendRequest)
        return

    } catch (err) {
        console.error("Error accepting friend request: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.get("/friends", async (req: Request, res: Response) => {
    try {
        const validation = await addressValidator.safeParseAsync(req.query.walletAddress);

        if (!validation.success) {
            res.status(400).json({ message: validation.error.errors });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const totalCount = await userService.countFriendsByWallet(validation.data);
        const friends = await userService.getFriendsByWallet(validation.data, skip, limit);

        res.status(200).json({
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            friends
        });
        return
    } catch (err) {
        console.error("Error getting friends: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.delete("/friend", async (req: Request, res: Response) => {
    try {
        const validation = await friendshipDTO.safeParseAsync(req.body)

        if (!validation.success) {
            res.status(400).json({ message: validation.error.errors })
            return
        }

        const friendship = await userService.getFriendship(validation.data.user1Wallet, validation.data.user2Wallet)

        if (!friendship) {
            res.status(400).json({ message: "No such friendship" })
            return
        }

        await userService.deleteFriendship(friendship.id)

        res.status(200).json({ message: "Friendship deleted" })
        return
    } catch (err) {
        console.error("Error deleting friendship: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.get("/profit", async (req: Request, res: Response) => {
    try {
        const { walletAddress, hours } = req.query;

        if (!walletAddress || !hours) {
            res.status(400).json({ message: "Missing required parameters" });
            return
        }

        const profit = await userService.calculateProfit(walletAddress as string, parseInt(hours as string));

        res.status(200).json({ profit });
        return
    } catch (err) {
        console.error("Error calculating profit:", err);
        res.status(500).json({ message: "Internal server error" });
        return
    }
});

router.get("/profit/hours", async (req: Request, res: Response) => {
    try {
        const walletAddress = req.query.walletAddress as string;
        const hours = parseInt(req.query.hours as string);

        if (!walletAddress) {
            res.status(400).json({ message: "Wallet address is required" });
            return;
        }

        if (!hours || isNaN(hours) || hours <= 0) {
            res.status(400).json({ message: "Valid hours parameter is required (positive number)" });
            return;
        }

        const profits = await userService.calculateHourlyProfit(walletAddress, hours);

        res.status(200).json({
            walletAddress,
            hours,
            profits
        });
    } catch (err) {
        console.error("Error calculating profit:", err);
        res.status(500).json({ message: "Internal server error"});
    }
});



export const userRouter = router