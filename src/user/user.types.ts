import { RequestStatus } from "@prisma/client";
import { boolean } from "zod";

export interface ICreateUser{
    id?: string;
    nickname: string;
    email: string;
    walletAddress: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IUpdateUser{
    nickname?: string,
    email?: string,
    avatar?: string,
    banner?: string,
    balance?: number
}

export interface IUserNotificationUpdate{
    itemSoldNotification?: boolean,
    offerActivityNotification?: boolean,
    bestOfferActivityNotification?: boolean,
    successfulTransferNotification?: boolean,
    transferNotification?: boolean,
    outbidNotification?: boolean,
    successfulPurchaseNotification?: boolean,
    successfulMintNotification?: boolean
}

export interface ICreateFrendship{
    id?: string,
    user1Wallet: string,
    user2Wallet: string,
    createdAt?: Date,
    updatedAt?: Date
}

export interface ICreateFriendRequest{
    senderWallet: string,
    receiverWallet: string,
    status?: RequestStatus,
    createdAt?: Date,
    updatedAt?: Date
}

export interface IReturnUser{
    id: string,
    nickname: string,
    walletAddress: string,
    avatar: string
}