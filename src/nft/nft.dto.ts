import { z } from "zod";
import { ethers } from "ethers";
import { prisma } from "../server";


const traitSchema = z.object({
    traitType: z.string().min(1, "Trait type cannot be empty"),
    value: z.string().min(1, "Trait value cannot be empty"),
  });

export const nftCreateDTO = z.object({
    name: z.string().min(3, "Name is too short").max(50, "Name is too long"),
    quantity: z.number().min(1, "Quantity must be at least 1"),
    collectionId: z.string().refine(async (collectionId) => await prisma.collection.findUnique({ where: { id: collectionId } }) !== null, "Collection not found"),
    description: z.string().min(3, "Description is too short").max(100, "Description is too long"),
    traits: z.array(traitSchema).optional(),
});

export const collectionCreateDTO = z.object({
    name: z.string().min(3, "Name is too short").max(50, "Name is too long"),
    symbol: z.string().min(3, "Symbol is too short").max(10, "Symbol is too long"),
    contractAddress: z.string().refine(async (address) => ethers.isAddress(address), "Invalid Ethereum address")
});


    
