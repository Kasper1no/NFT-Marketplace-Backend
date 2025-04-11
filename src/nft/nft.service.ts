import { PrismaClient, NFT, Collection, Blockchain, Bid, BidStatus, NFTListing } from "@prisma/client";
import { ICreateNFT, ICreateCollection, IUpdateNFT, IReturnNFT, IReturnCollection, IReturnCollectionCard, IReturnSearchNFT } from "./nft.types";
import Fuse from "fuse.js";
import { UserService } from "@/user/user.service";
import { IReturnBid } from "@/market/market.types";

const userService = new UserService();

export class NFTService {
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

    createNFT(nft: ICreateNFT): Promise<IReturnNFT> {
        return this.prisma.nFT.create({
            data: nft
        })
    }

    createCollection(collection: ICreateCollection): Promise<Collection> {
        return this.prisma.collection.create({
            data: collection
        })
    }
    updateNFT(nftId: string, nft: IUpdateNFT): Promise<IReturnNFT> {
        return this.prisma.nFT.update({
            where: {
                id: nftId
            },
            data: nft
        })
    }

    getNfts(): Promise<IReturnNFT[]> {
        return this.prisma.nFT.findMany()
    }

    getNFTbyId(nftId: string): Promise<IReturnNFT | null> {
        return this.prisma.nFT.findUnique({
            where: {
                id: nftId
            }
        })
    }

    async searchNFTsByWallet(
        walletAddress: string,
        limit: number = 10,
        skip: number = 0,
        sortCriteria: { field: "price" | "bestOffer", order: "asc" | "desc" }[],
        query?: string,
        minPrice?: number,
        maxPrice?: number,
        blockchain?: Blockchain,
        status?: "NEW" | "LISTED"
    ): Promise<{ nfts: IReturnSearchNFT[], totalCount: number }> {
        const prisma = new PrismaClient();

        const filters: any = {
            ownerWallet: walletAddress,
        };

        if (minPrice !== undefined) {
            filters.price = { ...filters.price, gte: minPrice };
        }
        if (maxPrice !== undefined) {
            filters.price = { ...filters.price, lte: maxPrice };
        }

        if (blockchain) {
            const collections = await prisma.collection.findMany({
                where: { blockchain: { equals: blockchain } },
                select: { id: true }
            });
            const blockchainCollectionIds = collections.map((col) => col.id);
            filters.collectionId = { in: blockchainCollectionIds };
        }

        if (status === "NEW") {
            filters.listings = { none: {} };
            filters.TradeItem = { none: {} };
        } else if (status === "LISTED") {
            filters.listings = { some: {} };
        }

        const allNFTs = await prisma.nFT.findMany({
            where: {
                ...filters,
            }
        });

        this.nftFuse.setCollection(allNFTs);

        let filteredNFTs = allNFTs;
        if (query) {
            const fuseResults = this.nftFuse.search(query).map((result) => result.item);
            filteredNFTs = fuseResults;
        }

        const enrichedNFTs = await Promise.all(filteredNFTs.map(async (nft) => {
            const bestOffer = await this.getBestOfferForNFT(nft.id);

            return {
                ...nft,
                bestOffer: bestOffer?.price || 0
            };
        }));

        const sortedNFTs = enrichedNFTs.sort((a, b) => {
            for (const criteria of sortCriteria) {
                const field = criteria.field;
                const order = criteria.order;

                const comparison = order === "asc" ? a[field] - b[field] : b[field] - a[field];

                if (comparison !== 0) {
                    return comparison;
                }
            }
            return 0;
        });

        const totalCount = sortedNFTs.length;

        const paginatedNFTs = sortedNFTs.slice(skip, skip + limit);

        const mappedNFTs: IReturnSearchNFT[] = await Promise.all(
            paginatedNFTs.map(async (nft) => {
                const owner = await userService.getUserByWalletAddress(nft.ownerWallet);

                return {
                    id: nft.id,
                    ownerAvatar: owner?.avatar || "",
                    ownerName: owner?.nickname || "Unknown",
                    ownerWallet: owner?.walletAddress || "",
                    name: nft.name,
                    image: nft.image,
                    price: nft.price,
                    bestOffer: nft.bestOffer
                };
            })
        );

        return { nfts: mappedNFTs, totalCount };
    }


    getBestOfferForNFT(nftId: string): Promise<Bid | null> {
        return this.prisma.bid.findFirst({
            where: {
                listing: {
                    nftId: nftId
                },
                status: BidStatus.ACTIVE
            },
            orderBy: {
                price: "desc"
            }
        });
    }

    getCollectionsByWalletAddress(walletAddress: string, skip: number = 0, pageSize: number = 10): Promise<Collection[]> {
        return this.prisma.collection.findMany({
            where: {
                creatorWallet: walletAddress
            },
            skip,
            take: pageSize
        });
    }

    getCollectionById(collectionId: string): Promise<Collection | null> {
        return this.prisma.collection.findUnique({
            where: {
                id: collectionId
            },
            include: {
                collectionBlocks: true
            }
        })
    }

    async getNFTsByCollectionId(
        collectionId: string,
        skip: number = 0,
        pageSize: number = 10,
        filters?: {
            name?: string;
            status?: ("LISTED" | "HAS_OFFERS")[];
            minPrice?: number;
            maxPrice?: number;
        }
    ): Promise<{ nfts: IReturnSearchNFT[], totalCount: number }> {
        const prisma = new PrismaClient();

        const allNFTs = await prisma.nFT.findMany({
            where: {
                collectionId: collectionId,
                tokenId: { not: null }
            }
        });

        this.nftFuse.setCollection(allNFTs);

        let filteredNFTs = allNFTs;

        if (filters?.name) {
            const searchResults = this.nftFuse.search(filters.name).map((result) => result.item);
            filteredNFTs = searchResults;
        }

        const filteredResults = await Promise.all(filteredNFTs.map(async (nft) => {
            let isValid = true;

            if (filters?.status?.length) {
                const hasListed = filters.status.includes("LISTED") && await prisma.nFTListing.count({
                    where: {
                        nftId: nft.id,
                        status: "ACTIVE"
                    }
                }) > 0;

                const hasOffers = filters.status.includes("HAS_OFFERS") && await prisma.bid.count({
                    where: {
                        listing: {
                            nftId: nft.id
                        }
                    }
                }) > 0;

                isValid = isValid && (hasListed || hasOffers);
            }

            if (filters?.minPrice !== undefined) {
                isValid = isValid && nft.price >= filters.minPrice;
            }
            if (filters?.maxPrice !== undefined) {
                isValid = isValid && nft.price <= filters.maxPrice;
            }

            return isValid ? nft : null;
        }));

        const validNFTs = filteredResults.filter((nft) => nft !== null) as IReturnNFT[];
        const totalCount = validNFTs.length;

        const paginatedNFTs = validNFTs.slice(skip, skip + pageSize);

        const mappedNFTs: IReturnSearchNFT[] = await Promise.all(
            paginatedNFTs.map(async (nft) => {
                const owner = await prisma.user.findUnique({
                    where: { walletAddress: nft.ownerWallet },
                    select: { nickname: true, avatar: true }
                });

                const bestOffer = await prisma.bid.findFirst({
                    where: {
                        listing: {
                            nftId: nft.id
                        },
                        status: "ACTIVE"
                    },
                    orderBy: { price: "desc" }
                });

                return {
                    id: nft.id,
                    ownerAvatar: owner?.avatar || "",
                    ownerName: owner?.nickname || "Unknown Owner",
                    ownerWallet: nft.ownerWallet,
                    name: nft.name,
                    image: nft.image || "",
                    price: nft.price,
                    bestOffer: bestOffer?.price || 0
                };
            })
        );

        return { nfts: mappedNFTs, totalCount };
    }

    async getActivitiesForNFT(nftId: string): Promise<{ eventType: string; from: string; to: string; price?: number; date: Date }[]> {
        const prisma = new PrismaClient();

        const tradeActivities = await prisma.trade.findMany({
            where: {
                tradeItems: {
                    some: { nftId: nftId }
                },
                status: "COMPLETED"
            },
            select: {
                offererWallet: true,
                takerWallet: true,
                exchangeTime: true,
                tradeItems: {
                    select: { side: true }
                }
            }
        });

        const saleActivities = await prisma.transaction.findMany({
            where: {
                listingId: nftId
            },
            select: {
                price: true,
                createdAt: true,
                sellerWallet: true,
                buyerWallet: true
            }
        });

        const mintActivity = await prisma.nFT.findUnique({
            where: { id: nftId },
            select: {
                createdAt: true,
                creatorWallet: true,
                collection: {
                    select: { creatorWallet: true }
                }
            }
        });

        const formattedTrades = tradeActivities.map((trade) => ({
            eventType: "Transfer",
            from: trade.offererWallet || "Unknown",
            to: trade.takerWallet || "Unknown",
            date: trade.exchangeTime
        }));

        const formattedSales = saleActivities.map((sale) => ({
            eventType: "Sale",
            from: sale.sellerWallet,
            to: sale.buyerWallet,
            price: sale.price,
            date: sale.createdAt
        }));

        const formattedMint = mintActivity
            ? [{
                eventType: "Mint",
                from: mintActivity.creatorWallet || "Unknown",
                to: mintActivity.collection.creatorWallet || "Unknown",
                date: mintActivity.createdAt
            }]
            : [];

        const activities = [
            ...formattedTrades.map((activity) => ({
                ...activity,
                date: activity.date || new Date(0)
            })),
            ...formattedSales.map((sale) => ({
                ...sale,
                date: sale.date || new Date(0)
            })),
            ...formattedMint.map((mint) => ({
                ...mint,
                date: mint.date || new Date(0)
            })),
        ];

        return activities.sort((a, b) => b.date.getTime() - a.date.getTime());
    }

    async getBidsForNFT(nftId: string): Promise<IReturnBid[]> {
        const prisma = new PrismaClient();

        const listing = await prisma.nFT.findUnique({
            where: { id: nftId },
            select: { price: true }
        });
        const floorPrice = listing?.price || 0;

        const bids = await prisma.bid.findMany({
            where: {
                listing: {
                    nftId: nftId
                }
            },
            select: {
                id: true,
                listingId: true,
                bidderWallet: true,
                price: true,
                status: true,
                createdAt: true
            }
        });

        return bids.map((bid) => ({
            id: bid.id,
            listingId: bid.listingId,
            bidderWallet: bid.bidderWallet,
            price: bid.price,
            floorDifference: ((bid.price - floorPrice) / floorPrice) * 100,
            status: bid.status,
            createdAt: bid.createdAt
        }));
    }

    async getListingsForNFT(nftId: string) {
        return this.prisma.nFTListing.findMany({
            where: {
                nftId: nftId
            }
        })
    }

    countCollections(): Promise<number> {
        return this.prisma.collection.count()
    }

    countCollectionsByCreator(creatorWallet: string): Promise<number> {
        return this.prisma.collection.count({
            where: {
                creatorWallet: creatorWallet
            }
        })
    }

    getCollections(skip: number = 0, pageSize: number = 10): Promise<Collection[]> {
        return this.prisma.collection.findMany({ skip, take: pageSize });
    }

    getScheduledMint(collectionId: string): Promise<NFTListing | null> {
        return this.prisma.nFTListing.findFirst({
            where: {
                status: "SCHEDULED",
                nft: {
                    collectionId: collectionId
                }
            },
            orderBy: {
                dropAt: "asc"
            }
        });
    }

    async getCollectionsByOwner(
        walletAddress: string,
        skip: number = 0,
        pageSize: number = 10
    ): Promise<IReturnCollectionCard[]> {
        const prisma = new PrismaClient();

        const collections = await prisma.collection.findMany({
            where: { creatorWallet: walletAddress },
            skip,
            take: pageSize
        });

        const mappedCollections: IReturnCollectionCard[] = await Promise.all(
            collections.map(async (collection) => {
                const creator = await userService.getUserByWalletAddress(collection.creatorWallet);

                return {
                    id: collection.id,
                    name: collection.name,
                    symbol: collection.symbol,
                    image: collection.image || "",
                    creatorName: creator?.nickname || "Unknown Creator",
                    creatorImage: creator?.avatar || "",
                    creatorWallet: collection.creatorWallet
                };
            })
        );

        return mappedCollections;
    }

    async getActivitiesForCollection(collectionId: string, filters?: { eventTypes?: string[] }): Promise<{ eventType: string; from: string; to: string; price?: number; date: Date }[]> {
        const prisma = new PrismaClient();

        const tradeActivities = await prisma.trade.findMany({
            where: {
                tradeItems: {
                    some: { nft: { collectionId: collectionId } }
                },
                status: "COMPLETED"
            },
            select: {
                offererWallet: true,
                takerWallet: true,
                exchangeTime: true
            }
        });

        const saleActivities = await prisma.transaction.findMany({
            where: {
                listing: {
                    nft: { collectionId: collectionId }
                }
            },
            select: {
                price: true,
                createdAt: true,
                sellerWallet: true,
                buyerWallet: true
            }
        });

        const mintActivities = await prisma.nFT.findMany({
            where: { collectionId: collectionId },
            select: {
                createdAt: true,
                creatorWallet: true,
                collection: {
                    select: { creatorWallet: true }
                }
            }
        });

        const offerActivities = await prisma.bid.findMany({
            where: {
                listing: {
                    nft: { collectionId: collectionId }
                }
            },
            select: {
                createdAt: true,
                bidderWallet: true,
                listing: {
                    select: { sellerWallet: true }
                },
                price: true
            }
        });

        const formattedTrades = tradeActivities.map((trade) => ({
            eventType: "Transfer",
            from: trade.offererWallet || "Unknown",
            to: trade.takerWallet || "Unknown",
            date: trade.exchangeTime
        }));

        const formattedSales = saleActivities.map((sale) => ({
            eventType: "Sale",
            from: sale.sellerWallet,
            to: sale.buyerWallet,
            price: sale.price,
            date: sale.createdAt
        }));

        const formattedMints = mintActivities.map((mint) => ({
            eventType: "Mint",
            from: mint.creatorWallet || "Unknown",
            to: mint.collection.creatorWallet || "Unknown",
            date: mint.createdAt
        }));

        const formattedOffers = offerActivities.map((offer) => ({
            eventType: "Offer",
            from: offer.bidderWallet || "Unknown",
            to: offer.listing.sellerWallet || "Unknown",
            price: offer.price,
            date: offer.createdAt
        }));

        let activities = [
            ...formattedTrades.map((activity) => ({
                ...activity,
                date: activity.date || new Date(0)
            })),
            ...formattedSales.map((sale) => ({
                ...sale,
                date: sale.date || new Date(0)
            })),
            ...formattedMints.map((mint) => ({
                ...mint,
                date: mint.date || new Date(0)
            })),
            ...formattedOffers.map((offer) => ({
                ...offer,
                date: offer.date || new Date(0)
            }))
        ];

        if (filters?.eventTypes && filters.eventTypes.length > 0) {
            activities = activities.filter(activity => filters.eventTypes!.includes(activity.eventType));
        }

        return activities.sort((a, b) => b.date.getTime() - a.date.getTime());
    }

    getFloorForCollection(collectionId: string): Promise<number> {
        return this.prisma.nFT.aggregate({
            _min: {
                price: true
            },
            where: {
                collectionId: collectionId
            }
        }).then(result => result._min.price || 0)
    }

    getItemCountForCollection(collectionId: string): Promise<number> {
        return this.prisma.nFT.count({
            where: {
                collectionId: collectionId
            }
        })
    }

    async getVolumeForCollection(collectionId: string): Promise<number> {
        return this.prisma.nFT.aggregate({
            _sum: {
                price: true
            },
            where: {
                collectionId: collectionId
            }
        }).then(result => result._sum.price || 0)
    }

    async calculateCollectionProfit(collectionId: string, hours: number): Promise<number> {
        const prisma = new PrismaClient();

        const startTime = new Date();
        startTime.setHours(startTime.getHours() - hours);

        const initialNFTs = await prisma.nFT.findMany({
            where: { collectionId: collectionId, updatedAt: { lte: startTime } },
            select: { price: true }
        });
        const initialValue = initialNFTs.reduce((sum, nft) => sum + nft.price, 0);

        const currentNFTs = await prisma.nFT.findMany({
            where: { collectionId: collectionId },
            select: { price: true }
        });
        const currentValue = currentNFTs.reduce((sum, nft) => sum + nft.price, 0);

        const soldListings = await prisma.transaction.findMany({
            where: {
                createdAt: { gte: startTime },
                listing: { nft: { collectionId: collectionId } }
            },
            select: { price: true }
        });
        const soldValue = soldListings.reduce((sum, tx) => sum + tx.price, 0);

        const profit = ((currentValue + soldValue - initialValue) / (initialValue || 1)) * 100;

        return profit;
    }

    async calculateHourlyNFTProfit(nftId: string, hours: number): Promise<number[]> {
        const prisma = new PrismaClient();
        const results: number[] = [];

        const currentDate = new Date();

        for (let i = 1; i <= hours; i++) {
            const endTime = new Date(currentDate.getTime() - (i - 1) * 60 * 60 * 1000);
            const startTime = new Date(currentDate.getTime() - i * 60 * 60 * 1000);

            const initialNFT = await prisma.nFT.findFirst({
                where: { id: nftId, updatedAt: { lte: startTime } },
                select: { price: true }
            });
            const initialValue = initialNFT?.price || 0;

            const currentNFT = await prisma.nFT.findFirst({
                where: { id: nftId, updatedAt: { lte: endTime } },
                select: { price: true }
            });
            const currentValue = currentNFT?.price || 0;

            const soldTransaction = await prisma.transaction.findMany({
                where: {
                    createdAt: { gte: startTime, lte: endTime },
                    listing: { nftId: nftId }
                },
                select: { price: true }
            });
            const soldValue = soldTransaction.reduce((sum, tx) => sum + tx.price, 0);

            const profit = ((currentValue + soldValue - initialValue) / (initialValue || 1)) * 100;

            results.push(profit);
        }

        return results;
    }


    async getItemCountForOwner(walletAddress: string): Promise<number> {
        return this.prisma.nFT.count({
            where: {
                ownerWallet: walletAddress
            }
        })
    }

    async calculateOwnersCount(collectionId: string): Promise<number> {
        return this.prisma.nFT.groupBy({
            by: ["ownerWallet"],
            where: { collectionId }
        }).then((result) => result.length);
    }

    async calculateFloorChange(collectionId: string): Promise<number> {
        const prisma = new PrismaClient();

        const currentFloor = await this.getFloorForCollection(collectionId);

        const startTime = new Date();
        startTime.setHours(startTime.getHours() - 24);

        const pastFloor = await prisma.nFT.findMany({
            where: {
                collectionId: collectionId,
                updatedAt: { lte: startTime }
            },
            orderBy: { price: "asc" },
            take: 1
        }).then((result) => result[0]?.price || 0);

        const floorChange = ((currentFloor - pastFloor) / (pastFloor || 1)) * 100;

        return floorChange;
    }

    async searchNFTs(
        query: string,
        limit: number,
        skip: number,
        collectionName?: string,
        minPrice?: number,
        maxPrice?: number,
        blockchain?: Blockchain,
        status?: "NEW" | "LISTED"
    ): Promise<{ nfts: IReturnSearchNFT[], totalCount: number }> {
        const prisma = new PrismaClient();

        const filters: any = {};

        if (collectionName && collectionName.trim() !== "") {
            const allCollections = await prisma.collection.findMany();
            this.collectionFuse.setCollection(allCollections);
        
            const fuseResults = this.collectionFuse.search(collectionName).map((result) => result.item);
            const collectionIds = fuseResults.map((col) => col.id);
        
            filters.collectionId = { in: collectionIds };
        } else {
            const allCollections = await prisma.collection.findMany({
                select: { id: true }
            });
        
            const collectionIds = allCollections.map((col) => col.id);
            filters.collectionId = { in: collectionIds };
        }

        if (minPrice !== undefined) {
            filters.price = { ...filters.price, gte: minPrice };
        }
        if (maxPrice !== undefined) {
            filters.price = { ...filters.price, lte: maxPrice };
        }

        if (blockchain) {
            const collections = await prisma.collection.findMany({
                where: { blockchain: { equals: blockchain } },
                select: { id: true }
            });
            const blockchainCollectionIds = collections.map((col) => col.id);
            filters.collectionId = filters.collectionId
                ? { in: filters.collectionId.in.filter((id: string) => blockchainCollectionIds.includes(id)) }
                : { in: blockchainCollectionIds };
        }

        if (status === "NEW") {
            filters.listings = { none: {} };
            filters.TradeItem = { none: {} };
        } else if (status === "LISTED") {
            filters.listings = { some: {} };
        }

        const allNFTs = await prisma.nFT.findMany({
            where: {
                ...filters,
            }
        });

        this.nftFuse.setCollection(allNFTs);

        let filteredNFTs;

        if (!query || query.trim() === "") {
            filteredNFTs = allNFTs;
        } else {
            const fuseResults = this.nftFuse.search(query).map((result) => result.item);
            filteredNFTs = fuseResults;
        }

        const totalCount = filteredNFTs.length;

        const paginatedNFTs = filteredNFTs.slice(skip, skip + limit);

        const mappedNFTs: IReturnSearchNFT[] = await Promise.all(
            paginatedNFTs.map(async (nft) => {
                const bestOffer = await this.getBestOfferForNFT(nft.id);
                const owner = await userService.getUserByWalletAddress(nft.ownerWallet);

                return {
                    id: nft.id,
                    ownerAvatar: owner?.avatar || "",
                    ownerName: owner?.nickname || "Unknown",
                    ownerWallet: owner?.walletAddress || "",
                    name: nft.name,
                    image: nft.image,
                    price: nft.price,
                    bestOffer: bestOffer?.price || 0
                };
            })
        );

        return { nfts: mappedNFTs, totalCount };
    }


    async searchCollections(
        query: string,
        sortCriteria: { field: "floor" | "floorChange" | "volumeChange" | "itemsCount" | "ownersCount" | "volume", order: "asc" | "desc" }[],
        limit: number,
        skip: number
    ): Promise<{ collections: IReturnCollection[], totalCount: number }> {
        const prisma = new PrismaClient();

        const allCollections = await prisma.collection.findMany();
        this.collectionFuse.setCollection(allCollections);
        let searchResults;

        if (!query || query.trim() === "") {
            searchResults = allCollections.map((collection) => ({ item: collection }));
        } else {
            searchResults = this.collectionFuse.search(query);
        }
        const totalCount = searchResults.length;

        const enrichedCollections = await Promise.all(searchResults.map(async (result) => {
            const collection = result.item;

            const floor = await this.getFloorForCollection(collection.id);
            const floorChange = await this.calculateFloorChange(collection.id);
            const volume = await this.getVolumeForCollection(collection.id);
            const volumeChange = await this.calculateCollectionProfit(collection.id, 24);
            const itemsCount = await this.getItemCountForCollection(collection.id);
            const ownersCount = await this.calculateOwnersCount(collection.id);

            return {
                ...collection,
                floor,
                floorChange,
                volume,
                volumeChange,
                itemsCount,
                ownersCount
            };
        }));

        const sortedCollections = enrichedCollections.sort((a, b) => {
            for (const criteria of sortCriteria) {
                const field = criteria.field;
                const order = criteria.order;

                const comparison = order === "asc" ? a[field] - b[field] : b[field] - a[field];

                if (comparison !== 0) {
                    return comparison;
                }
            }
            return 0;
        });

        const paginatedCollections = sortedCollections.slice(skip, skip + limit);

        return { collections: paginatedCollections, totalCount };
    }




}