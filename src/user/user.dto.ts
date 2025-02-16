import { z } from "zod"
import { prisma } from "../server";

export const createUserDTO = z.object({
    email: z.string().email(),
    walletAddress: z.string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address")
        .refine(async (address) => await prisma.user.findUnique({ where: { walletAddress: address } }) === null, "Wallet address already in use"),
    nickname: z.string().min(3, "Nickname is too short").max(20, "Nickname is too long")
});

export const addressValidator = z.string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address")
    .refine(async (address) => await prisma.user.findUnique({ where: { walletAddress: address } }) !== null, "User not found")

export const updateUserDTO = z.object({
    email: z.string().email().optional(),
    nickname: z.string().min(3, "Nickname is too short").max(20, "Nickname is too long").optional()
})
