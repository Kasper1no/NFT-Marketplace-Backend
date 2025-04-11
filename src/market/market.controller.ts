import { Router, Request, Response } from "express";
import { bidDTO, getTradesDTO, listingDTO, tradeDTO, transactionDTO, updateBidDTO, updateTradeDTO, updateTransactionDTO } from "./market.dto";
import { NFTService } from "@/nft/nft.service";
import { MarketService } from "./market.service";
import { BidStatus, Blockchain, ListingStatus, NotificationType, Trade, TradeSide, TradeStatus, TransactionStatus } from "@prisma/client";
import { UserService } from "@/user/user.service";
import { addressValidator } from "@/user/user.dto";
import { NotificationService } from "@/notification/notification.service";

const router = Router();

const userService = new UserService();
const nftService = new NFTService();
const marketService = new MarketService();
const notificationService = new NotificationService();

// router.post("/transaction", async (req: Request, res: Response) => {
//     try {
//         const transactionValidation = await transactionDTO.safeParseAsync(req.body);

//         if (!transactionValidation.success) {
//             res.status(400).json({ message: transactionValidation.error.errors })
//             return
//         }

//         const transaction = await marketService.createTransaction({
//             listingId: transactionValidation.data.listingId,
//             sellerWallet: transactionValidation.data.sellerWallet,
//             buyerWallet: transactionValidation.data.buyerWallet,
//             price: transactionValidation.data.price,
//             status: TransactionStatus.PENDING,
//             network: "Ethereum"
//         })

//         res.status(200).json(transaction)
//         return
//     } catch (err) {
//         console.error("Error getting users: ", err)
//         res.status(500).json({ message: "Internal server error" })
//         return
//     }
// })

// router.put("/transaction", async (req: Request, res: Response) => {
//     try {
//         const validation = await updateTransactionDTO.safeParseAsync(req.body)

//         if (!validation.success) {
//             res.status(400).json({ message: validation.error.errors })
//             return
//         }

//         const transaction = await marketService.getTransactionById(validation.data.id)
//         if (!transaction) {
//             res.status(400).json({ message: "No such transaction" })
//             return
//         }

//         if (transaction.status === TransactionStatus.FAILED) {
//             res.status(400).json({ message: "Transaction was already failed" })
//             return
//         }

//         const updatedTransaction = await marketService.updateTransaction(validation.data.id, {
//             status: validation.data.status
//         })

//         res.status(200).json(updatedTransaction)
//         return
//     } catch (err) {
//         console.error("Error getting users: ", err)
//         res.status(500).json({ message: "Internal server error" })
//         return
//     }

// })

router.get("/transactions", async (req: Request, res: Response) => {
    try {
        const walletAddressValidation = await addressValidator.safeParseAsync(req.query.walletAddress);

        if (!walletAddressValidation.success) {
            res.status(400).json({ message: walletAddressValidation.error.errors });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const role = req.query.role as "seller" | "buyer";
        if (!["seller", "buyer"].includes(role)) {
            res.status(400).json({ message: "Invalid role. Must be 'seller' or 'buyer'." });
            return;
        }

        const filters = {
            minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
            maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
            nftName: req.query.nftName as string | undefined
        };

        const { transactions, totalCount } = await marketService.getTransactions(
            walletAddressValidation.data,
            role,
            skip,
            limit,
            filters
        );

        res.status(200).json({
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            transactions
        });
    } catch (err) {
        console.error("Error fetching transactions: ", err);
        res.status(500).json({ message: "Internal server error" });
    }
});


router.get("/listing", async (req: Request, res: Response) => {
    try {
        const validation = await addressValidator.safeParseAsync(req.query.walletAddress);

        if (!validation.success) {
            res.status(400).json({ message: validation.error.errors });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const filters = {
            nftName: req.query.nftName as string | undefined,
            collectionName: req.query.collectionName as string | undefined,
            minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
            maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
            blockchain: req.query.blockchain as Blockchain | undefined,
            status: req.query.status as "SOLD" | "NEW" | "LISTED" | undefined
        };

        const sortCriteria = req.query.sortCriteria
            ? (req.query.sortCriteria as string)
                .split(",")
                .map((criteria) => {
                    const [field, order] = criteria.split(":");
                    return { field: field as "price" | "bestOffer" | "listingPrice" | "lastListed", order: order as "asc" | "desc" };
                })
            : [];
        const { listings, totalCount } = await marketService.searchListingsByWallet(
            validation.data,
            limit,
            skip,
            sortCriteria,
            filters.nftName,
            filters.collectionName,
            filters.minPrice,
            filters.maxPrice,
            filters.blockchain,
            filters.status
        );

        res.status(200).json({
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            listings
        });
    } catch (err) {
        console.error("Error getting listings: ", err);
        res.status(500).json({ message: "Internal server error" });
    }
});


router.get("/listing/all", async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const totalCount = await marketService.countAllListings()
        const listings = await marketService.getAllListings(skip, limit)

        res.status(200).json({
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            listings
        })
        return
    } catch (err) {
        console.error("Error getting users: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.post("/listing", async (req: Request, res: Response) => {
    try {
        let price = req.body.price;
        if (typeof price === 'string') {
            price = parseFloat(price);
        }
        const listingValidation = await listingDTO.safeParseAsync({
            ...req.body,
            dropAt: req.body.dropAt ? new Date(req.body.dropAt) : null,
            price
        })

        if (!listingValidation.success) {
            res.status(400).json({ message: listingValidation.error.errors })
            return
        }

        const nft = await nftService.getNFTbyId(listingValidation.data.nftId);
        if (!nft || nft.ownerWallet != listingValidation.data.sellerWallet) {
            res.status(400).json({ message: "No such nft or seller is not the owner" })
            return
        }
        const status = listingValidation.data.dropAt ? ListingStatus.SCHEDULED : ListingStatus.ACTIVE

        const listing = await marketService.createListing({
            nftId: listingValidation.data.nftId,
            sellerWallet: listingValidation.data.sellerWallet,
            price: listingValidation.data.price,
            contractAddr: listingValidation.data.contractAddress,
            status: status,
            dropAt: listingValidation.data.dropAt ? listingValidation.data.dropAt : new Date()
        })

        if (!listing) {
            res.status(400).json({ message: "Listing was not created" })
            return
        }

        var message = ""
        if (listingValidation.data.dropAt) {
            message = "Listing was successfully scheduled"
        } else {
            message = "Listing was successfully created"
        }

        const user = await userService.getUserByWalletAddress(listing.sellerWallet)
        if (!user) {
            res.status(400).json({ message: "No such user" })
            return
        }

        if (user.successfulMintNotification) {
            await notificationService.createNotification({
                userWallet: listing.sellerWallet,
                title: "Listing",
                message: message,
                type: NotificationType.MINT
            })
        }

        res.status(200).json(listing)
        return
    } catch (err) {
        console.error("Error getting users: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.post("/listing/buy", async (req: Request, res: Response) => {
    try {
        const validation = await addressValidator.safeParseAsync(req.body.walletAddress);
        if (!validation.success) {
            res.json({ message: validation.error.errors })
            return
        }
        const listingId = req.body.listingId;
        if (!listingId) {
            res.status(400).json({ message: "ListingId is required" })
            return
        }
        const listing = await marketService.getListingById(listingId);
        if (!listing) {
            res.status(400).json({ message: "No such listing" })
            return
        }

        const user = await userService.getUserByWalletAddress(listing.sellerWallet);
        if (!user) {
            res.status(400).json({ message: "No such user" })
            return
        }

        const buyer = await userService.getUserByWalletAddress(validation.data);
        if (!buyer) {
            res.status(400).json({ message: "No such buyer" })
            return
        }

        if(buyer.id === user.id) {
            res.status(400).json({ message: "You can't buy your own listing" })
            return
        }

        if (buyer.balance < listing.price) {
            res.status(400).json({ message: "You don't have enough balance" })
            return
        }

        const nft = await nftService.getNFTbyId(listing.nftId);
        if (!nft) {
            res.status(400).json({ message: "NFT not found" });
            return;
        }

        const collection = await nftService.getCollectionById(nft.collectionId);
        if (!collection) {
            res.status(400).json({ message: "Collection not found" });
            return;
        }

        const loyaltyPercentage = collection.royalties || 0;
        const loyaltyAmount = (listing.price * loyaltyPercentage) / 100;
        const sellerAmount = listing.price - loyaltyAmount;

        const updatedBuyer = await userService.updateUser(buyer.walletAddress, {
            balance: (buyer.balance - listing.price)
        });
        if (!updatedBuyer) {
            res.status(400).json({ message: "Something went wrong with updating buyer balance" });
            return;
        }

        const updatedSeller = await userService.updateUser(user.walletAddress, {
            balance: user.balance + sellerAmount
        });
        if (!updatedSeller) {
            await userService.updateUser(buyer.walletAddress, {
                balance: buyer.balance + listing.price
            });
            res.status(400).json({ message: "Something went wrong with updating seller balance" });
            return;
        }

        if (loyaltyAmount > 0) {
            const owner = await userService.getUserByWalletAddress(collection.creatorWallet);
            if (owner) {
                const updatedOwner = await userService.updateUser(owner.walletAddress, {
                    balance: owner.balance + loyaltyAmount
                });
                if (!updatedOwner) {
                    await userService.updateUser(buyer.walletAddress, {
                        balance: buyer.balance + listing.price
                    });
                    await userService.updateUser(user.walletAddress, {
                        balance: user.balance - sellerAmount
                    });
                    res.status(400).json({ message: "Something went wrong with updating owner balance" });
                    return;
                }
            }
        }

        const updatedNFT = await nftService.updateNFT(listing.nftId, {
            ownerWallet: buyer.walletAddress
        });
        if (!updatedNFT) {
            await userService.updateUser(buyer.walletAddress, {
                balance: buyer.balance + listing.price
            });
            await userService.updateUser(user.walletAddress, {
                balance: user.balance - sellerAmount
            });
            res.status(400).json({ message: "Something went wrong with updating NFT owner" });
            return;
        }

        await marketService.createTransaction({
            listingId: listing.id,
            sellerWallet: listing.sellerWallet,
            buyerWallet: buyer.walletAddress,
            price: listing.price,
            network: "Ethereum",
            status: "COMPLETED"
        })

        await marketService.updateListing(listing.id, {
            status: ListingStatus.SOLD
        })

        if (buyer.successfulPurchaseNotification) {
            await notificationService.createNotification({
                userWallet: buyer.walletAddress,
                title: "Purchase",
                message: `You successfully bought ${nft.name} for ${listing.price}`,
                type: NotificationType.PURCHASE
            })
        }

        res.status(200).json({ message: "You successfully bought NFT" })
        return
    } catch (err) {
        console.error("Error getting users: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.put("/listing", async (req: Request, res: Response) => {
    try {
        const transactionId = req.body.transactionId
        const listingId = req.body.listingId


        if (!transactionId || !listingId) {
            res.status(400).json({ message: "TransactionId && ListingId is required" })
            return
        }

        const transaction = await marketService.getTransactionById(transactionId)
        if (!transaction) {
            res.status(400).json({ message: "No such transaction" })
            return
        }

        const listing = await marketService.getListingById(listingId)
        if (!listing) {
            res.status(400).json({ message: "No such listing" })
            return
        }

        if (transaction.status === TransactionStatus.COMPLETED) {
            const nft = await nftService.getNFTbyId(listing.nftId);

            if (!nft) {
                res.status(400).json({ message: "No such nft" })
                return
            }

            if (nft.ownerWallet != transaction.sellerWallet) {
                res.status(400).json({ message: "You are not the owner of this nft" })
                return
            }

            await marketService.updateListing(listing.id, {
                status: ListingStatus.SOLD,
                transactionId: transaction.id
            });

            await nftService.updateNFT(listing.nftId, {
                ownerWallet: transaction.buyerWallet
            })

            res.status(200).json({ message: "Nft owner changed" })
            return
        }
        res.status(400).json({ message: "Transaction was not completed" })
        return
    } catch (err) {
        console.error("Error getting users: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.get("/bid/listing", async (req: Request, res: Response) => {
    try {
        const listingId = req.query.listingId as string

        if (!listingId) {
            res.status(400).json({ message: "ListingId is required" })
            return
        }

        const listing = await marketService.getListingById(listingId)

        if (!listing) {
            res.status(400).json({ message: "No such listing" })
            return
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;


        const totalCount = await marketService.countBidsByListing(listing.id)
        const bids = await marketService.getBidsByListing(listing.id, skip, limit)

        res.status(200).json({
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            bids
        })
        return
    } catch (err) {
        console.error("Error getting users: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.get("/bid", async (req: Request, res: Response) => {
    try {
        const walletAddressValidation = await addressValidator.safeParseAsync(req.query.walletAddress);

        if (!walletAddressValidation.success) {
            res.status(400).json({ message: walletAddressValidation.error.errors });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const filters = {
            minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
            maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
            collectionName: req.query.collectionName as string | undefined,
            status: req.query.status as "ACTIVE" | "REJECTED" | "EXPIRING" | undefined
        };

        const sortCriteria = req.query.sortCriteria
            ? (req.query.sortCriteria as string)
                .split(",")
                .map((criteria) => {
                    const [field, order] = criteria.split(":");
                    return { field: field as "price" | "expiration" | "createdAt", order: order as "asc" | "desc" };
                })
            : [];

        const { bids, totalCount } = await marketService.getBidsByOwner(
            walletAddressValidation.data,
            skip,
            limit,
            sortCriteria,
            filters
        );

        res.status(200).json({
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            bids
        });
    } catch (err) {
        console.error("Error getting bids: ", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.get("/bid/current", async (req: Request, res: Response) => {
    try {
        const listingId = req.query.listingId as string

        if (!listingId) {
            res.status(400).json({ message: "ListingId is required" })
            return
        }

        const listing = await marketService.getListingById(listingId)

        if (!listing) {
            res.status(400).json({ message: "No such listing" })
            return
        }

        const bid = await marketService.getHighestBid(listing.id)

        res.status(200).json(bid)
        return
    } catch (err) {
        console.error("Error getting users: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.post("/bid", async (req: Request, res: Response) => {
    try {
        const bidValidation = await bidDTO.safeParseAsync(req.body)

        if (!bidValidation.success) {
            res.status(400).json({ message: bidValidation.error.errors })
            return
        }

        const listing = await marketService.getListingById(bidValidation.data.listingId);
        if (!listing || listing.status !== ListingStatus.ACTIVE) {
            res.status(400).json({ message: "No such listing" })
            return
        }

        const bidder = await userService.getUserByWalletAddress(bidValidation.data.bidderWallet)
        if (!bidder) {
            res.status(400).json({ message: "No such user" })
            return
        }

        if (bidder.balance < bidValidation.data.price) {
            res.status(400).json({ message: "You don't have enough balance" })
            return
        }

        const currentBid = await marketService.getHighestBid(bidValidation.data.listingId)
        if (currentBid && currentBid.price >= bidValidation.data.price) {
            res.status(400).json({ message: "Bid is too low" })
            return
        } else if (currentBid) {
            const updatedBid = await marketService.updateBid(currentBid.id, {
                status: BidStatus.REJECTED
            })

            if (!updatedBid) {
                res.status(400).json({ message: "Bid was not updated" })
                return
            }

            const user = await userService.getUserByWalletAddress(currentBid.bidderWallet)
            if (!user) {
                res.status(400).json({ message: "No such user" })
                return
            }

            if (user.outbidNotification) {
                await notificationService.createNotification({
                    userWallet: currentBid.bidderWallet,
                    title: "Bid outbid",
                    message: "Your bid was ooutbid",
                    type: NotificationType.OUTBID
                })
            }
        }

        if (bidValidation.data.bidderWallet === listing.sellerWallet) {
            res.status(400).json({ message: "You cannot bid on your own listing" })
            return
        }

        const bid = await marketService.createBid({
            listingId: listing.id,
            bidderWallet: bidValidation.data.bidderWallet,
            price: bidValidation.data.price
        })

        if (!bid) {
            res.status(400).json({ message: "Bid was not created" })
            return
        }

        if (listing.price < bid.price) {
            await marketService.updateListing(listing.id, {
                price: bid.price
            })
        }
        const nft = await nftService.getNFTbyId(listing.nftId)

        if (!nft) {
            res.status(400).json({ message: "No such NFT" })
            return
        }

        const user = await userService.getUserByWalletAddress(nft.ownerWallet)
        if (!user) {
            res.status(400).json({ message: "No such user" })
            return
        }

        if (user.bestOfferActivityNotification) {
            await notificationService.createNotification({
                userWallet: nft.ownerWallet,
                title: "New offer",
                type: NotificationType.BESTOFFER,
                message: `${bidValidation.data.bidderWallet} made a new offer on your listing for ${nft.name}`
            })
        }

        res.status(200).json(bid)
        return
    } catch (err) {
        console.error("Error getting users: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.put("/bid", async (req: Request, res: Response) => {
    try {
        const validation = await updateBidDTO.safeParseAsync(req.body)
        if (!validation.success) {
            res.status(400).json({ message: validation.error.errors })
            return
        }

        const bid = await marketService.getBidById(validation.data.id)

        if (!bid || bid.status !== BidStatus.ACTIVE) {
            res.status(400).json({ message: "No such bid" })
            return
        }

        const listing = await marketService.getListingById(bid.listingId)
        if (!listing) {
            res.status(400).json({ message: "No such listing" })
            return
        }

        if (bid.bidderWallet !== validation.data.userWallet && listing.sellerWallet !== validation.data.userWallet) {
            res.status(400).json({ message: "You cannot update this bid" })
            return
        }

        const bidder = await userService.getUserByWalletAddress(bid.bidderWallet)
        const seller = await userService.getUserByWalletAddress(listing.sellerWallet)
        const nft = await nftService.getNFTbyId(listing.nftId)

        if (!bidder || !seller) {
            res.status(400).json({ message: "No such user" })
            return
        }

        if (!nft) {
            res.status(400).json({ message: "No such nft" })
            return
        }

        const updatedBid = await marketService.updateBid(validation.data.id, {
            status: (validation.data.accepted ? BidStatus.ACCEPTED : BidStatus.REJECTED)
        })

        if (!updatedBid) {
            res.status(400).json({ message: "Bid was not updated" })
            return
        }

        var bidderMessage = ""
        var sellerMessage = ""

        if (updatedBid.status === BidStatus.ACCEPTED) {
            await marketService.updateListing(listing.id, {
                status: ListingStatus.SOLD
            })
            await nftService.updateNFT(listing.nftId, {
                ownerWallet: updatedBid.bidderWallet
            })

            bidderMessage = `Your bid for ${nft.name} was accepted`
            sellerMessage = `You accepted ${bidder.nickname}'s bid for ${nft.name}`
        } else {
            bidderMessage = `Your bid for ${nft.name} was rejected`
            sellerMessage = `You rejected ${bidder.nickname}'s bid for ${nft.name}`
        }

        if (updatedBid.status === BidStatus.ACCEPTED) {
            const collection = await nftService.getCollectionById(nft.collectionId)

            if (!collection) {
                res.status(400).json({ message: "No such collection" })
                return
            }

            const loyaltyPercentage = collection.royalties || 0;
            const loyaltyAmount = (updatedBid.price * loyaltyPercentage) / 100;
            const sellerAmount = updatedBid.price - loyaltyAmount;

            await marketService.createTransaction({
                listingId: listing.id,
                sellerWallet: listing.sellerWallet,
                buyerWallet: updatedBid.bidderWallet,
                price: updatedBid.price,
                status: TransactionStatus.COMPLETED,
                network: "Ethereum"
            });

            await userService.updateUser(updatedBid.bidderWallet, {
                balance: (bidder.balance - updatedBid.price)
            });

            const updatedSeller = await userService.updateUser(listing.sellerWallet, {
                balance: (seller.balance + sellerAmount)
            });
            if (!updatedSeller) {
                await userService.updateUser(updatedBid.bidderWallet, {
                    balance: (bidder.balance + updatedBid.price)
                });
                res.status(400).json({ message: "Something went wrong with updating seller balance" });
                return;
            }

            if (loyaltyAmount > 0) {
                const owner = await userService.getUserByWalletAddress(collection.creatorWallet);
                if (owner) {
                    const updatedOwner = await userService.updateUser(owner.walletAddress, {
                        balance: owner.balance + loyaltyAmount
                    });
                    if (!updatedOwner) {
                        await userService.updateUser(updatedBid.bidderWallet, {
                            balance: (bidder.balance + updatedBid.price)
                        });
                        await userService.updateUser(listing.sellerWallet, {
                            balance: (seller.balance - sellerAmount)
                        });
                        res.status(400).json({ message: "Something went wrong with updating owner balance" });
                        return;
                    }
                }
            }

            if (bidder.successfulPurchaseNotification) {
                await notificationService.createNotification({
                    userWallet: updatedBid.bidderWallet,
                    title: "Bid accepted",
                    type: NotificationType.PURCHASE,
                    message: bidderMessage
                });
            }

        }

        res.status(200).json(updatedBid)
        return
    } catch (err) {
        console.error("Error getting users: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.get("/trades", async (req: Request, res: Response) => {
    try {
        const validation = await getTradesDTO.safeParseAsync(req.query)

        if (!validation.success) {
            res.status(400).json({ message: validation.error.errors })
            return
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        var trades, totalCount;

        if (validation.data.type === "sent") {
            totalCount = await marketService.countSentTradesByAddress(validation.data.walletAddress)
            trades = await marketService.getSentTradesByAddress(validation.data.walletAddress, skip, limit)
        }
        else {
            totalCount = await marketService.countReceivedTradesByAddress(validation.data.walletAddress)
            trades = await marketService.getReceivedTradesByAddress(validation.data.walletAddress, skip, limit)
        }

        const response = await Promise.all(
            (!trades ? [] : trades).map(async (trade) => ({
                tradeId: trade.id,
                offerTime: trade.offerTime,
                exchangeTime: trade.exchangeTime,
                status: trade.status,
                taker: {
                    user: trade.takerWallet,
                    nfts: await marketService.getNFTForTrade(trade, "received"),
                },
                offerer: {
                    user: trade.offererWallet,
                    nfts: await marketService.getNFTForTrade(trade, "sent"),
                },
            }))
        );

        res.status(200).json({
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            trades: response,
        });
        return
    }
    catch (err) {
        console.error("Error getting trades: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.get("/trade/all", async (req: Request, res: Response) => {
    try {
        const walletAddress = await addressValidator.parseAsync(req.query.walletAddress)

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const totalCount = await marketService.countAllTradesByAddress(walletAddress)
        const trades = await marketService.getAllTradesByAddress(walletAddress, skip, limit)

        console.log(trades);
        const response = await Promise.all(
            (!trades ? [] : trades).map(async (trade) => {
                const taker = await userService.getUserByWalletAddress(trade.takerWallet)

                const offerer = await userService.getUserByWalletAddress(trade.offererWallet)

                return {
                    tradeId: trade.id,
                    offerTime: trade.offerTime,
                    exchangeTime: trade.exchangeTime,
                    status: trade.status,
                    taker: {
                        user: {
                            wallet: trade.takerWallet,
                            nickname: taker?.nickname || "Unknown User",
                            image: taker?.avatar || ""
                        },
                        nfts: await marketService.getNFTForTrade(trade, "received"),
                    },
                    offerer: {
                        user: {
                            wallet: trade.offererWallet,
                            nickname: offerer?.nickname || "Unknown User",
                            image: offerer?.avatar || ""
                        },
                        nfts: await marketService.getNFTForTrade(trade, "sent"),
                    },
                };
            })
        );

        res.status(200).json({
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            trades: response,
        });
    } catch (err) {
        console.error("Error fetching trades:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post("/trade", async (req: Request, res: Response) => {
    try {

        const validation = await tradeDTO.safeParseAsync(req.body)

        if (!validation.success) {
            res.status(400).json({ message: validation.error.errors })
            return
        }

        const friendship = await userService.getFriendship(validation.data.offererWallet, validation.data.takerWallet)

        if (!friendship) {
            res.status(400).json({ message: "You must be friends to trade" })
            return
        }

        const trade = await marketService.createTrade({
            offererWallet: validation.data.offererWallet,
            takerWallet: validation.data.takerWallet
        })

        if (!trade) {
            res.status(400).json({ message: "No such trade" })
            return
        }

        const offered = new Array();
        const requested = new Array();
        validation.data.offeredNFTIds.forEach(async id => {
            const nft = await nftService.getNFTbyId(id);
            if (!nft || nft.ownerWallet != validation.data.offererWallet) {
                res.status(400).json({ message: "No such nft" })
                return
            }
            offered.push(await marketService.createTradeItem({
                nftId: id,
                tradeId: trade.id,
                side: TradeSide.OFFER
            }))
        });

        const nfts = await Promise.all(
            validation.data.requestedNFTIds.map(id => nftService.getNFTbyId(id))
        )

        const invalidNft = nfts.find(nft => !nft || nft.ownerWallet !== validation.data.takerWallet)

        if (invalidNft) {
            res.status(400).json({ message: "No such nft" });
            return;
        }

        offered.forEach(element => {
            if (!element) {
                res.status(400).json({ message: "No such trade item" })
                return
            }
        });

        requested.forEach(element => {
            if (!element) {
                res.status(400).json({ message: "No such trade item" })
                return
            }
        });

        const finalTrade = await marketService.updateTradeTradeItems(trade.id, {
            tradeItems: [...offered, ...requested]
        })

        if (!finalTrade) {
            res.status(400).json({ message: "No such trade" })
            return
        }

        // await notificationService.createNotification({
        //     userWallet: finalTrade.offererWallet,
        //     title: "Trade offer",
        //     message: `Your trade with ${finalTrade.takerWallet} was created`,
        //     type: NotificationType.TRANSFER
        // })

        // await notificationService.createNotification({
        //     userWallet: finalTrade.takerWallet,
        //     title: "Trade offer",
        //     message: `${finalTrade.offererWallet} send a tranfer offer to you`,
        //     type: NotificationType.TRANSFER
        // })

        res.status(200).json(finalTrade)
        return
    } catch (err) {
        console.error("Error creating trade: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.put("/trade", async (req: Request, res: Response) => {
    try {
        const validation = await updateTradeDTO.safeParseAsync(req.body)

        if (!validation.success) {
            res.status(400).json({ message: validation.error.errors })
            return
        }

        const trade = await marketService.getTradeById(validation.data.tradeId)

        if (!trade) {
            res.status(400).json({ message: "No such trade" })
            return
        }

        if (trade.status === TradeStatus.PENDING) {
            if (trade.takerWallet != validation.data.userWallet) {
                res.status(400).json({ message: "You are not the taker of this trade" })
                return
            }

            var takerMessage = ""
            var offererMessage = ""
            var responce = {}

            if (!validation.data.accepted) {
                const cancelledTrade = await marketService.updateTradeStatus(trade.id, TradeStatus.CANCELLED, new Date())

                if (!cancelledTrade) {
                    res.status(400).json({ message: "No such trade" })
                    return
                }

                takerMessage = `Your trade with ${trade.offererWallet} was cancelled`
                offererMessage = `Your trade with ${trade.takerWallet} was cancelled`

                responce = {
                    trade: cancelledTrade
                }
            } else {
                const tradeItems = await marketService.getTradeItemsByTradeId(trade.id)

                if (!tradeItems) {
                    res.status(400).json({ message: "Nothing to trade" })
                    return
                }

                const offered = tradeItems.filter(item => item.side == TradeSide.OFFER)
                const requested = tradeItems.filter(item => item.side == TradeSide.RECEIVER)

                offered.forEach(async item => {
                    const nft = await nftService.getNFTbyId(item.nftId)
                    if (!nft) {
                        res.status(400).json({ message: "No such nft" })
                        return
                    }
                    await nftService.updateNFT(item.nftId, {
                        ownerWallet: trade.takerWallet
                    })
                })

                requested.forEach(async item => {
                    const nft = await nftService.getNFTbyId(item.nftId)
                    if (!nft) {
                        res.status(400).json({ message: "No such nft" })
                        return
                    }
                    await nftService.updateNFT(item.nftId, {
                        ownerWallet: trade.offererWallet
                    })
                })

                const updatedTrade = await marketService.updateTradeStatus(trade.id, TradeStatus.COMPLETED, new Date())

                if (!updatedTrade) {
                    res.status(400).json({ message: "No such trade" })
                    return
                }

                responce = {
                    tradeId: updatedTrade.id,
                    offerTime: updatedTrade.offerTime,
                    exchangeTime: updatedTrade.exchangeTime,
                    status: updatedTrade.status,
                    taker: {
                        user: updatedTrade.takerWallet,
                        nfts: await marketService.getNFTForTrade(updatedTrade, "received")
                    },
                    offerer: {
                        user: updatedTrade.offererWallet,
                        nfts: await marketService.getNFTForTrade(updatedTrade, "sent")
                    }
                }

                takerMessage = `Your trade with ${trade.offererWallet} was completed`
                offererMessage = `Your trade with ${trade.takerWallet} was completed`
            }

            const offerer = await userService.getUserByWalletAddress(trade.offererWallet)
            if (!offerer) {
                res.status(400).json({ message: "No such user" })
                return
            }

            if (validation.data.accepted && offerer.successfulTransferNotification) {

                await notificationService.createNotification({
                    userWallet: trade.offererWallet,
                    title: "Trade completed",
                    message: takerMessage,
                    type: NotificationType.TRANSFER
                })
            }

            const taker = await userService.getUserByWalletAddress(trade.takerWallet)
            if (!taker) {
                res.status(400).json({ message: "No such user" })
                return
            }

            if (validation.data.accepted && taker.successfulTransferNotification) {

                await notificationService.createNotification({
                    userWallet: trade.takerWallet,
                    title: "Trade completed",
                    message: offererMessage,
                    type: NotificationType.TRANSFER
                })
            }

            res.status(200).json(responce)
            return
        } else {
            res.status(400).json({ message: "Trade is alredy done" })
            return
        }
    } catch (err) {
        console.error("Error getting users: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})


export const marketRouter = router