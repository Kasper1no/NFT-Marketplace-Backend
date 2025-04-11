import { Bid, BidStatus, ListingStatus, TradeItem, TradeSide, TradeStatus, TransactionStatus } from "@prisma/client";

export interface ICreateListing {
    nftId: string,
    sellerWallet: string,
    price: number,
    contractAddr: string,
    dropAt?: Date | null,
    status: ListingStatus,
    transactionId?: string
}

export interface IUpdateListing {
    price?: number,
    status?: ListingStatus,
    transactionId?: string
}

export interface IReturnListing {
    id: string,
    nftId: string,
    nftName: string,
    nftImage: string,
    collectionName: string,
    sellerName: string,
    sellerImage: string,
    sellerWallet: string,
    listingPrice: number,
    bestOffer: number,
    status: ListingStatus,
    lastListed: Date | null
}

export interface ICreateTransaction {
    listingId: string,
    buyerWallet: string,
    sellerWallet: string,
    price: number,
    status: TransactionStatus,
    network: string
}

export interface IUpdateTransaction {
    status: TransactionStatus
}

export interface IReturnTransaction {
    id: string,
    nftId: string,
    nftName: string,
    nftImage: string,
    listingId: string,
    buyerName: string,
    buyerImage: string,
    buyerWallet: string,
    sellerName: string,
    sellerImage: string,
    sellerWallet: string,
    price: number,
    createdAt: Date
}

export interface ICreateTrade {
    id?: string,
    offererWallet: string,
    takerWallet: string,
    tradeItems?: TradeItem[]
}

export interface IUpdateTrade {
    tradeItems: TradeItem[]
}

export interface IReturnTrade {
    id: string,
    offererWallet: string,
    takerWallet: string,
    status: TradeStatus,
    tradeItems: TradeItem[],
    offerTime: Date,
    exchangeTime?: Date
}

export interface ICreateTradeItem {
    id?: string,
    nftId: string,
    tradeId: string,
    side: TradeSide
}

export interface ICreateBid {
    id?: string,
    listingId: string,
    bidderWallet: string,
    price: number
}

export interface IUpdateBid {
    status: BidStatus
}

export interface IReturnBid {
    id: string,
    listingId: string,
    bidderWallet: string,
    price: number,
    floorDifference: number,
    status: BidStatus,
    createdAt: Date
}