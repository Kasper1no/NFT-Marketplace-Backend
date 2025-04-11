import { boolean, z } from "zod"
import { prisma } from "../server";

export const createUserDTO = z.object({
    email: z.string().email(),
    walletAddress: z.string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address")
        .refine(async (address) => await prisma.user.findUnique({ where: { walletAddress: address } }) === null, "Wallet address already in use"),
    nickname: z.string().min(3, "Nickname is too short").max(20, "Nickname is too long")
});

export const addressValidator = z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum addresss")
    .refine(async (address) => await prisma.user.findUnique({ where: { walletAddress: address } }) !== null, "User not found")


export const updateUserNotificationDTO = z.object({
    walletAddress: addressValidator,
    itemSoldNotification: z.boolean().optional(),
    offerActivityNotification: z.boolean().optional(),
    bestOfferActivityNotification: z.boolean().optional(),
    successfulTransferNotification: z.boolean().optional(),
    transferNotification: z.boolean().optional(),
    outbidNotification: z.boolean().optional(),
    successfulPurchaseNotification: z.boolean().optional(),
    successfulMintNotification: z.boolean().optional()
})

export const updateUserDTO = z.object({
    email: z.string().email().optional(),
    nickname: z.string().min(3, "Nickname is too short").max(20, "Nickname is too long").optional()
})

export const friendRequestDTO = z.object({
    senderWallet: addressValidator,
    receiverWallet: addressValidator
})

export const getFriendRequestsDTO = z.object({
    walletAddress: addressValidator,
    type: z.enum(["sent", "received"], { required_error: "Type is required" })
})

export const acceptFriendRequestDTO = z.object({
    senderWallet: addressValidator,
    receiverWallet: addressValidator,
    accepted: z.boolean()
})

export const friendshipDTO = z.object({
    user1Wallet: addressValidator,
    user2Wallet: addressValidator
})
