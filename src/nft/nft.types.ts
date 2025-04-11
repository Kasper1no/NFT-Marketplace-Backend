import { Blockchain } from "@prisma/client";

export interface ICreateNFT{
    id?: string;
    tokenId?: string;
    name: string;
    URL: string;
    price: number;
    collectionId: string;
    ownerWallet: string;
    creatorWallet: string;
    image: string;
    metadataURI: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ICreateCollection{
    contractAddress: string;
    name: string;
    symbol: string;
    image: string;
    metadata: string;
    royalties: number;
    blockchain: Blockchain;
    creatorWallet: string;
    twitterLink?: string;
    discordLink?: string;
    instagramLink?: string;
    facebookLink?: string;
    telegramLink?: string;
}

export interface IUpdateNFT{
    tokenId?: string;
    name?: string;
    price?: number;
    URL?: string;
    collectionId?: string;
    ownerWallet?: string;
}

export interface IReturnNFT{
    id: string;
    tokenId?: string | null;
    name: string;
    URL: string;
    price: number;
    collectionId: string;
    ownerWallet: string;
    creatorWallet: string;
    image: string;
    metadataURI: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface IReturnSearchNFT{
    id: string;
    ownerAvatar: string;
    ownerName: string;
    ownerWallet: string;
    name: string;
    image: string;
    price: number;
    bestOffer: number;
}

export interface IReturnCollectionCard{
    id: string;
    name: string;
    symbol: string;
    image: string;
    creatorName: string;
    creatorImage: string;
    creatorWallet: string;
}

export interface IReturnCollection{
    id: string;
    contractAddress: string;
    name: string;
    symbol: string;
    image: string;
    floor: number;
    floorChange: number;
    volume: number;
    volumeChange: number;
    itemsCount: number;
    ownersCount: number;
    metadata: string;
    royalties: number;
    creatorWallet: string;
    createdAt?: Date;
    updatedAt?: Date;
}