import { z } from "zod";
import { ethers } from "ethers";
import { prisma } from "../server";
import { addressValidator } from "@/user/user.dto";

export const blockchainEnum = z.enum([
    "ARBITRUM",
    "AVALANCHE",
    "BASE",
    "BLAST",
    "ETHEREUM",
    "POLYGON",
    "SEI",
    "ZORA"
]);

export const nftCreateDTO = z.object({
    name: z.string().min(3, "Name is too short").max(50, "Name is too long"),
    URL: z.string().min(3, "URL is too short").max(200, "URL is too long"),
    price: z.number().positive({message: "Price must be a positive number"}),
    collectionId: z.string().refine(async (collectionId) => await prisma.collection.findUnique({ where: { id: collectionId } }) !== null, "Collection not found"),
    creatorWallet: addressValidator
});

export const collectionCreateDTO = z.object({
    name: z.string().min(3, "Name is too short").max(50, "Name is too long"),
    symbol: z.string().min(3, "Symbol is too short").max(10, "Symbol is too long"),
    contractAddress: z.string().refine(async (address) => ethers.isAddress(address), "Invalid Ethereum address"),
    royalties: z.number().positive({message: "Royalties must be a positive number"}),
    blockchain: blockchainEnum,
    creatorWallet: addressValidator,
    twitterLink: z.string().optional(),
    discordLink: z.string().optional(),
    instagramLink: z.string().optional(),
    facebookLink: z.string().optional(),
    telegramLink: z.string().optional()
});


    
