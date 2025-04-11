import { addressValidator } from "@/user/user.dto";
import {z} from "zod";

const ethereumAddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, {
    message: "Invalid Ethereum address format",
  });

export const listingDTO = z.object({
    nftId: z.string(),
    sellerWallet: addressValidator,
    price: z.number().positive({message: "Price must be a positive number"}),
    contractAddress: ethereumAddressSchema,
    dropAt: z.date().optional()
});

export const transactionDTO = z.object({
    listingId: z.string(),
    sellerWallet: addressValidator,
    buyerWallet: addressValidator,
    price: z.number(),
    contractAddress: ethereumAddressSchema,
    transactionHash: z.string()
});

export const updateTransactionDTO = z.object({
    id: z.string().uuid(),
    status: z.enum(["PENDING", "COMPLETED", "FAILED"])
});

export const tradeDTO = z.object({
    offererWallet: addressValidator,
    takerWallet: addressValidator,
    offeredNFTIds: z.array(z.string()),
    requestedNFTIds: z.array(z.string())
});

export const updateTradeDTO = z.object({
    userWallet: addressValidator,
    tradeId: z.string(),
    accepted: z.boolean()
});

export const getTradesDTO = z.object({
    walletAddress: addressValidator,
    type: z.enum(["sent", "recieved"], { required_error: "Type is required" })
});

export const bidDTO = z.object({
    listingId: z.string(),
    bidderWallet: addressValidator,
    price: z.number().positive({message: "Price must be a positive number"})
})

export const updateBidDTO = z.object({
    id: z.string(),
    userWallet: addressValidator,
    accepted: z.boolean()
})

