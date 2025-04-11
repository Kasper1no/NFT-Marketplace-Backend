import { Bid, BidStatus, Blockchain, Collection, ListingStatus, NFT, NFTListing, PrismaClient, Trade, TradeItem, TradeSide, TradeStatus, Transaction } from "@prisma/client";
import { ICreateBid, ICreateListing, ICreateTrade, ICreateTradeItem, ICreateTransaction, IReturnListing, IReturnTrade, IReturnTransaction, IUpdateBid, IUpdateListing, IUpdateTrade, IUpdateTransaction } from "./market.types";
import { subDays } from "date-fns";
import { IReturnNFT } from "@/nft/nft.types";
import { NFTService } from "@/nft/nft.service";
import Fuse from "fuse.js";
import { UserService } from "@/user/user.service";

const nftService = new NFTService()
const userService = new UserService()

export class MarketService {
    private prisma = new PrismaClient()
    private collectionFuse: Fuse<Collection> = new Fuse([], {
        keys: ["name", "symbol"],
        threshold: 0.3,
        includeScore: true,
    });

    private nftFuse: Fuse<NFT> = new Fuse([], {
        keys: ["name"],
        threshold: 0.3,
        includeScore: true,
    });

    createListing(listing: ICreateListing): Promise<NFTListing> {
        return this.prisma.nFTListing.create({
            data: listing
        })
    }

    updateListing(id: string, listing: IUpdateListing): Promise<NFTListing> {
        return this.prisma.nFTListing.update({
            where: {
                id: id
            },
            data: listing
        })
    }

    createTransaction(transation: ICreateTransaction): Promise<Transaction> {
        return this.prisma.transaction.create({
            data: transation
        })
    }

    getTransactionById(id: string): Promise<Transaction | null> {
        return this.prisma.transaction.findUnique({
            where: {
                id: id
            }
        })
    }

    async getTransactions(
        walletAddress: string,
        role: "seller" | "buyer",
        skip: number = 0,
        pageSize: number = 10,
        filters?: {
            minPrice?: number;
            maxPrice?: number;
            nftName?: string;
        }
    ): Promise<{ transactions: IReturnTransaction[]; totalCount: number }> {
        const prisma = new PrismaClient();

        const roleCondition = role === "seller"
            ? { sellerWallet: walletAddress }
            : { buyerWallet: walletAddress };

        const whereConditions: any = {
            ...roleCondition
        };

        if (filters?.minPrice !== undefined) {
            whereConditions.price = { ...whereConditions.price, gte: filters.minPrice };
        }
        if (filters?.maxPrice !== undefined) {
            whereConditions.price = { ...whereConditions.price, lte: filters.maxPrice };
        }

        const allTransactions = await prisma.transaction.findMany({
            where: whereConditions,
            include: {
                listing: {
                    include: {
                        nft: true
                    }
                }
            }
        });

        let filteredTransactions = allTransactions;
        if (filters?.nftName) {
            this.nftFuse.setCollection(allTransactions.map((transaction) => transaction.listing?.nft).filter(Boolean));

            const fuseResults = this.nftFuse.search(filters.nftName).map((result) => result.item?.id);

            filteredTransactions = filteredTransactions.filter((transaction) =>
                fuseResults.includes(transaction.listing?.nft?.id)
            );
        }

        const paginatedTransactions = filteredTransactions.slice(skip, skip + pageSize);

        const mappedTransactions: IReturnTransaction[] = await Promise.all(
            paginatedTransactions.map(async (transaction) => {
                const buyer = await userService.getUserByWalletAddress(transaction.buyerWallet);
    
                const seller = await userService.getUserByWalletAddress(transaction.sellerWallet);
    
                return {
                    id: transaction.id,
                    nftId: transaction.listing?.nft?.id || "",
                    nftName: transaction.listing?.nft?.name || "",
                    nftImage: transaction.listing?.nft?.image || "",
                    listingId: transaction.listingId,
                    buyerName: buyer?.nickname || "Unknown Buyer",
                    buyerImage: buyer?.avatar || "",
                    buyerWallet: transaction.buyerWallet,
                    sellerName: seller?.nickname || "Unknown Seller",
                    sellerImage: seller?.avatar || "",
                    sellerWallet: transaction.sellerWallet,
                    price: transaction.price,
                    createdAt: transaction.createdAt
                };
            })
        );
    
        const totalCount = filteredTransactions.length;
    
        return { transactions: mappedTransactions, totalCount };
    }


    updateTransaction(id: string, transaction: IUpdateTransaction): Promise<Transaction> {
        return this.prisma.transaction.update({
            where: {
                id: id
            },
            data: transaction
        })
    }

    getAllListings(skip: number = 0, pageSize: number = 10): Promise<NFTListing[] | null> {
        return this.prisma.nFTListing.findMany({
            where: {
                status: ListingStatus.ACTIVE
            },
            skip,
            take: pageSize
        })
    }

    countAllListings(): Promise<number> {
        return this.prisma.nFTListing.count();
    }

    async searchListingsByWallet(
        walletAddress: string,
        limit: number,
        skip: number,
        sortCriteria: { field: "price" | "bestOffer" | "listingPrice" | "lastListed"; order: "asc" | "desc" }[],
        nftName?: string,
        collectionName?: string,
        minPrice?: number,
        maxPrice?: number,
        blockchain?: Blockchain,
        status?: "SOLD" | "NEW" | "LISTED"
    ): Promise<{ listings: IReturnListing[], totalCount: number }> {
        const prisma = new PrismaClient();

        const filters: any = {
            sellerWallet: walletAddress
        };

        if (status == "SOLD") {
            filters.status = { equals: ListingStatus.SOLD };
        }else if(status = "LISTED"){
            filters.status = { equals: ListingStatus.ACTIVE };
        }else{
            filters.status = { equals: ListingStatus.ACTIVE };
        }

        if (minPrice !== undefined) {
            filters.price = { ...filters.price, gte: minPrice };
        }
        if (maxPrice !== undefined) {
            filters.price = { ...filters.price, lte: maxPrice };
        }

        const allListings = await prisma.nFTListing.findMany({
            where: filters,
            include: {
                nft: {
                    include: { collection: true }
                }
            }
        });

        this.nftFuse.setCollection(allListings.map((listing) => listing.nft));
        let filteredListings = allListings;

        if (nftName) {
            const fuseResults = this.nftFuse.search(nftName).map((result) => result.item);
            const nftIds = fuseResults.map((nft) => nft.id);

            filteredListings = filteredListings.filter((listing) => nftIds.includes(listing.nftId));
        }

        if (collectionName) {
            this.collectionFuse.setCollection(allListings.map((listing) => listing.nft.collection));
            const collectionResults = this.collectionFuse.search(collectionName).map((result) => result.item);
            const collectionIds = collectionResults.map((collection) => collection.id);

            filteredListings = filteredListings.filter((listing) => collectionIds.includes(listing.nft.collectionId));
        }

        if (blockchain) {
            filteredListings = filteredListings.filter((listing) => listing.nft.collection.blockchain === blockchain.toUpperCase());
        }

        const enrichedListings = await Promise.all(
            filteredListings.map(async (listing) => {
                const lastListed = await prisma.nFTListing.findFirst({
                    where: { nftId: listing.nftId },
                    orderBy: { dropAt: "desc" }
                });

                const bestOffer = await prisma.bid.findFirst({
                    where: {
                        listingId: listing.id,
                        status: BidStatus.ACTIVE
                    },
                    orderBy: { price: "desc" }
                });

                return {
                    ...listing,
                    lastListed: lastListed?.dropAt ?? lastListed?.createdAt ?? null,
                    bestOffer: bestOffer?.price ?? 0,
                    listingPrice: listing.price
                };
            })
        );

        const sortedListings = enrichedListings.sort((a, b) => {
            for (const criteria of sortCriteria) {
                const field = criteria.field;
                const order = criteria.order;

                const valueA = a[field] ?? 0;
                const valueB = b[field] ?? 0;

                const comparison =
                    typeof valueA === "number" && typeof valueB === "number"
                        ? order === "asc"
                            ? valueA - valueB
                            : valueB - valueA
                        : 0;

                if (comparison !== 0) {
                    return comparison;
                }
            }
            return 0;
        });

        const totalCount = sortedListings.length;

        const paginatedListings = sortedListings.slice(skip, skip + limit);

        const mappedListings: IReturnListing[] = await Promise.all(
            paginatedListings.map(async (listing) => {
                const nft = await prisma.nFT.findUnique({
                    where: { id: listing.nftId },
                    include: {
                        collection: true
                    }
                });

                const seller = await userService.getUserByWalletAddress(listing.sellerWallet);

                return {
                    id: listing.id,
                    nftId: listing.nftId,
                    nftName: nft?.name || "Unknown",
                    nftImage: nft?.image || "",
                    collectionName: nft?.collection?.name || "Unknown",
                    sellerName: seller?.nickname || "Unknown",
                    sellerImage: seller?.avatar || "",
                    sellerWallet: listing.sellerWallet,
                    listingPrice: listing.listingPrice,
                    bestOffer: listing.bestOffer,
                    status: listing.status,
                    lastListed: listing.lastListed
                };
            })
        );


        return { listings: mappedListings, totalCount };
    }

    countListingsByAddress(walletAddress: string): Promise<number> {
        return this.prisma.nFTListing.count({
            where: {
                sellerWallet: walletAddress
            }
        })
    }

    getListingsByNft(nftId: string, skip: number = 0, pageSize: number = 10): Promise<NFTListing[] | null> {
        return this.prisma.nFTListing.findMany({
            where: {
                nftId: nftId
            },
            skip,
            take: pageSize
        })
    }

    countListingsByNft(nftId: string): Promise<number> {
        return this.prisma.nFTListing.count({
            where: {
                nftId: nftId
            }
        })
    }

    getListingById(id: string): Promise<NFTListing | null> {
        return this.prisma.nFTListing.findUnique({
            where: {
                id: id
            }
        })
    }

    createTrade(trade: ICreateTrade): Promise<Trade> {
        return this.prisma.trade.create({
            data: {
                offererWallet: trade.offererWallet,
                takerWallet: trade.takerWallet,
                tradeItems: {
                    create: []
                }
            }
        })
    }

    updateTradeStatus(id: string, status: TradeStatus, tradeTime: Date): Promise<IReturnTrade> {
        return this.prisma.trade.update({
            where: {
                id: id
            },
            data: {
                status: status,
                exchangeTime: tradeTime
            },
            select: {
                id: true,
                offererWallet: true,
                status: true,
                takerWallet: true,
                offerTime: true,
                tradeItems: true
            }
        })
    }

    updateTradeTradeItems(id: string, trade: IUpdateTrade): Promise<Trade> {
        return this.prisma.trade.update({
            where: {
                id: id
            },
            data: {
                tradeItems: {
                    create: trade.tradeItems
                }
            }
        })
    }

    getTradeById(id: string): Promise<IReturnTrade | null> {
        return this.prisma.trade.findUnique({
            where: {
                id: id
            },
            select: {
                id: true,
                offererWallet: true,
                takerWallet: true,
                status: true,
                offerTime: true,
                tradeItems: true
            }
        })
    }

    createTradeItem(tradeItem: ICreateTradeItem): Promise<TradeItem> {
        return this.prisma.tradeItem.create({
            data: tradeItem
        })
    }

    getTradeItemsByTradeId(id: string): Promise<TradeItem[] | null> {
        return this.prisma.tradeItem.findMany({
            where: {
                tradeId: id
            }
        })
    }

    getAllTradesByAddress(walletAddress: string, skip: number = 0, pageSize: number = 10): Promise<IReturnTrade[] | null> {
        return this.prisma.trade.findMany({
            where: {
                OR: [
                    {
                        offererWallet: walletAddress
                    },
                    {
                        takerWallet: walletAddress
                    }
                ],
                NOT: { status: TradeStatus.PENDING }
            },
            select: {
                id: true,
                offererWallet: true,
                takerWallet: true,
                status: true,
                offerTime: true,
                tradeItems: true
            },
            skip,
            take: pageSize
        })
    }

    countAllTradesByAddress(walletAddress: string): Promise<number> {
        return this.prisma.trade.count({
            where: {
                OR: [
                    {
                        offererWallet: walletAddress
                    },
                    {
                        takerWallet: walletAddress
                    }
                ]
            }
        })
    }

    getSentTradesByAddress(walletAddress: string, skip: number = 0, pageSize: number = 10): Promise<IReturnTrade[] | null> {
        return this.prisma.trade.findMany({
            where: {
                offererWallet: walletAddress,
                status: TradeStatus.PENDING
            },
            select: {
                id: true,
                offererWallet: true,
                takerWallet: true,
                status: true,
                offerTime: true,
                tradeItems: true
            },
            skip,
            take: pageSize
        })
    }

    countSentTradesByAddress(walletAddress: string): Promise<number> {
        return this.prisma.trade.count({
            where: {
                offererWallet: walletAddress,
                status: TradeStatus.PENDING
            }
        })
    }

    getReceivedTradesByAddress(walletAddress: string, skip: number = 0, pageSize: number = 10): Promise<IReturnTrade[] | null> {
        return this.prisma.trade.findMany({
            where: {
                takerWallet: walletAddress,
                status: TradeStatus.PENDING
            },
            select: {
                id: true,
                offererWallet: true,
                takerWallet: true,
                status: true,
                offerTime: true,
                tradeItems: true
            },
            skip,
            take: pageSize
        })
    }

    countReceivedTradesByAddress(walletAddress: string): Promise<number> {
        return this.prisma.trade.count({
            where: {
                takerWallet: walletAddress,
                status: TradeStatus.PENDING
            }
        })
    }

    createBid(bid: ICreateBid): Promise<Bid> {
        return this.prisma.bid.create({
            data: bid
        })
    }

    updateBid(id: string, bid: IUpdateBid): Promise<Bid> {
        return this.prisma.bid.update({
            where: {
                id: id
            },
            data: bid
        })
    }

    getBidById(id: string): Promise<Bid | null> {
        return this.prisma.bid.findUnique({
            where: {
                id: id
            }
        })
    }

    async getBidsByOwner(
        walletAddress: string,
        skip: number = 0,
        pageSize: number = 10,
        sortCriteria: { field: "price" | "expiration" | "createdAt"; order: "asc" | "desc" }[] = [],
        filters?: {
            minPrice?: number;
            maxPrice?: number;
            collectionName?: string;
            status?: "ACTIVE" | "REJECTED" | "EXPIRING";
        }
    ): Promise<{ bids: Bid[], totalCount: number }> {
        const prisma = new PrismaClient();

        const whereConditions: any = {
            listing: {
                sellerWallet: walletAddress
            }
        };

        if (filters?.minPrice !== undefined) {
            whereConditions.price = { ...whereConditions.price, gte: filters.minPrice };
        }
        if (filters?.maxPrice !== undefined) {
            whereConditions.price = { ...whereConditions.price, lte: filters.maxPrice };
        }

        if (filters?.collectionName) {
            const collections = await prisma.collection.findMany({
                where: {
                    name: { contains: filters.collectionName, mode: "insensitive" }
                },
                select: { id: true }
            });
            const collectionIds = collections.map((col) => col.id);
            whereConditions.listing.nFT = {
                collectionId: { in: collectionIds }
            };
        }

        if (filters?.status) {
            if (filters.status === "ACTIVE") {
                whereConditions.status = "ACTIVE";
            } else if (filters.status === "REJECTED") {
                whereConditions.status = "REJECTED";
            } else if (filters.status === "EXPIRING") {
                whereConditions.expiration = {
                    lte: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
                };
            }
        }

        const allBids = await prisma.bid.findMany({
            where: whereConditions,
            include: {
                listing: {
                    include: {
                        nft: {
                            include: {
                                collection: true
                            }
                        }
                    }
                }
            }
        });

        const enrichedBids = allBids.map((bid) => ({
            ...bid,
            expiration: new Date(bid.createdAt.getTime() + 30 * 24 * 60 * 60 * 1000)
        }));

        const sortedBids = enrichedBids.sort((a, b) => {
            for (const criteria of sortCriteria || []) {
                const field = criteria.field;
                const order = criteria.order;

                let valueA: number;
                let valueB: number;

                if (field === "expiration") {
                    valueA = a.expiration?.getTime() || 0;
                    valueB = b.expiration?.getTime() || 0;
                } else if (field === "createdAt") {
                    valueA = a.createdAt?.getTime() || 0;
                    valueB = b.createdAt?.getTime() || 0;
                } else if (field === "price") {
                    valueA = a.price || 0;
                    valueB = b.price || 0;
                } else {
                    continue;
                }

                const comparison = order === "asc" ? valueA - valueB : valueB - valueA;

                if (comparison !== 0) {
                    return comparison;
                }
            }
            return 0;
        });

        const totalCount = sortedBids.length;

        const paginatedBids = sortedBids.slice(skip, skip + pageSize);

        return { bids: paginatedBids, totalCount };
    }

    getBidsByListing(listingId: string, skip: number = 0, pageSize: number = 10): Promise<Bid[] | null> {
        return this.prisma.bid.findMany({
            where: {
                listingId: listingId
            },
            skip,
            take: pageSize
        })
    }

    countBidsByListing(listingId: string): Promise<number> {
        return this.prisma.bid.count({
            where: {
                listingId: listingId
            }
        })
    }

    getHighestBid(listingId: string): Promise<Bid | null> {
        return this.prisma.bid.findFirst({
            where: {
                listingId: listingId,
                status: BidStatus.ACTIVE
            },
            orderBy: {
                price: "desc"
            }
        })
    }

    getExpiredActiveBids(): Promise<Bid[] | null> {
        const thresholdDate = subDays(new Date(), 30);
        return this.prisma.bid.findMany({
            where: {
                status: BidStatus.ACTIVE,
                createdAt: { lt: thresholdDate }
            }
        })
    }

    rejectExpiredBids(expiredBids: Bid[]) {
        if (expiredBids.length > 0) {
            this.prisma.bid.updateMany({
                where: { id: { in: expiredBids.map(bid => bid.id) } },
                data: { status: BidStatus.REJECTED }
            });
        }
    }

    getUndroppedListings(): Promise<NFTListing[]> {
        return this.prisma.nFTListing.findMany({
            where: {
                status: ListingStatus.SCHEDULED,
                dropAt: { lt: new Date() }
            }
        })
    }

    async getNFTForTrade(trade: IReturnTrade, type: "sent" | "received"): Promise<IReturnNFT[]> {
        const nfts: IReturnNFT[] = [];

        if (type === "sent") {
            for (const item of trade.tradeItems) {
                if (item.side === TradeSide.RECEIVER) continue
                const nft = await nftService.getNFTbyId(item.nftId);
                if (!nft) continue
                nfts.push(nft);
            }
        } else if (type === "received") {
            for (const item of trade.tradeItems) {
                if (item.side === TradeSide.OFFER) continue
                const nft = await nftService.getNFTbyId(item.nftId);
                if (!nft) continue
                nfts.push(nft);
            }
        }

        return nfts;
    }

}