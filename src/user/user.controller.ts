import { Router, Request, Response } from "express";
import multer from "multer";
import { v2 as cloudinary } from 'cloudinary';
import { UserService } from "./user.service";
import { addressValidator, createUserDTO, updateUserDTO } from "./user.dto";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const router = Router();

const userService = new UserService();

const baseAvatar = "https://example.com/default-avatar.png";

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

router.get("/", async (req: Request, res: Response) => {
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

router.get("/:walletAddress", async (req: Request, res: Response) => {
    try {
        const addressValidation = await addressValidator.safeParseAsync(req.params.walletAddress)

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

router.post("/", upload.single("avatar"), async (req: Request, res: Response) => {
    try {
        const validation = await createUserDTO.safeParseAsync(req.body)

        if (!validation.success) {
            res.status(400).json({ message: validation.error.errors })
            return
        }

        let avatarUrl = "";

        if (req.file) {
            avatarUrl = await uploadImageToCloud(req.file)
        } else {
            avatarUrl = "https://example.com/default-avatar.png";
        }

        const user = await userService.createUser({
            ...validation.data,
            avatar: avatarUrl
        })
        res.status(200).json(user)
        return
    } catch (err) {
        console.error("Error creating user: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.put("/:walletAddress", upload.single("avatar"), async (req: Request, res: Response) => {
    try {
        const addressValidation = await addressValidator.safeParseAsync(req.params.walletAddress)
        const dataValidation = await updateUserDTO.safeParseAsync(req.body)

        if (!addressValidation.success) {
            res.status(400).json({ message: addressValidation.error.errors })
            return
        }

        if (!dataValidation.success) {
            res.status(400).json({ message: dataValidation.error.errors })
            return
        }

        let avatarUrl;
        const currentAvatar = (await userService.getUserByWalletAddress(addressValidation.data))?.avatar

        if (req.file) {
            avatarUrl = await uploadImageToCloud(req.file)

            const imageId = currentAvatar?.split("/").pop()?.split(".")[0]
            if (imageId) await deleteImageFromCloud(imageId)
        } else {
            avatarUrl = currentAvatar
        }

        const user = await userService.updateUser(
            addressValidation.data,
            { ...dataValidation.data, avatar: avatarUrl }
        )
        res.status(200).json(user)
        return
    } catch (err) {
        console.error("Error updating user: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.delete("/:walletAddress", async (req: Request, res: Response) => {
    try {
        const validation = await addressValidator.safeParseAsync(req.params.walletAddress)

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

export const userRouter = router