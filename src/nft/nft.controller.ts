import { Router, Request, Response } from "express";
import multer from "multer";
import { PinataSDK } from "pinata-web3";
import { collectionCreateDTO, nftCreateDTO } from "./nft.dto";
import { addressValidator } from "../user/user.dto";
import { Readable } from "stream";
import { NFTService } from "./nft.service";
import { string, z } from "zod";
import { NotificationService } from "@/notification/notification.service";
import { Blockchain, NotificationType } from "@prisma/client";
import { IReturnCollection } from "./nft.types";
import { UserService } from "@/user/user.service";

const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: process.env.PINATA_GATEWAY,
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = Router();

const nftService = new NFTService();
const userService = new UserService();
const notificationService = new NotificationService();

async function uploadImageToIPFS(file: Express.Multer.File): Promise<string> {
    try {
        const stream = Readable.from(file.buffer);
        const result = await pinata.upload.stream(stream);
        return result.IpfsHash
    } catch (err) {
        console.error(err);
        throw new Error("Failed to upload image");
    }
}

async function uploadMetadataToIPFS(metadata: any): Promise<string> {
    try {
        const result = await pinata.upload.json(metadata);
        return result.IpfsHash
    } catch (err) {
        console.error(err);
        throw new Error("Failed to upload metadata");
    }
}

router.post("/collection", upload.single("image"), async (req: Request, res: Response) => {
    try {
        let royalties = req.body.royalties;
        if (typeof royalties === 'string') {
            royalties = parseInt(royalties);
        }
        const collectionValidation = await collectionCreateDTO.safeParseAsync({
            ...req.body,
            royalties
        })

        if (!collectionValidation.success) {
            res.status(400).json({ message: collectionValidation.error.errors })
            return
        }

        if (!req.file) {
            res.status(400).json({ message: "Image is required" })
            return
        }

        const image = await uploadImageToIPFS(req.file)


        const metadata = {
            name: collectionValidation.data.name,
            symbol: collectionValidation.data.symbol,
            contractAddress: collectionValidation.data.contractAddress,
            image: `ipfs:/${image}`
        }

        const metadataHash = await uploadMetadataToIPFS(metadata)
        const metadataUrl = `https://gateway.pinata.cloud/ipfs/${metadataHash}`

        const collection = await nftService.createCollection({
            name: collectionValidation.data.name,
            symbol: collectionValidation.data.symbol,
            contractAddress: collectionValidation.data.contractAddress,
            image: `https://ipfs.io/ipfs/${image}`,
            creatorWallet: collectionValidation.data.creatorWallet,
            royalties: collectionValidation.data.royalties,
            metadata: metadataUrl,
            blockchain: collectionValidation.data.blockchain,
            twitterLink: collectionValidation.data.twitterLink,
            discordLink: collectionValidation.data.discordLink,
            instagramLink: collectionValidation.data.instagramLink,
            facebookLink: collectionValidation.data.facebookLink,
            telegramLink: collectionValidation.data.telegramLink
        })

        if (!collection) {
            res.status(400).json({ message: "Failed to create collection" })
            return
        }

        const result: IReturnCollection = {
            id: collection.id,
            contractAddress: collection.contractAddress,
            name: collection.name,
            symbol: collection.symbol,
            image: collection.image,
            floor: 0,
            floorChange: 0,
            volume: 0,
            volumeChange: 0,
            itemsCount: 0,
            ownersCount: 0,
            metadata: collection.metadata,
            royalties: collection.royalties,
            creatorWallet: collection.creatorWallet
        }

        // await notificationService.createNotification({
        //     userWallet: collection.creatorWallet,
        //     title: "New collection",
        //     message: `You created a new collection: ${collection.name}`,
        //     type: NotificationType.SUCCESS
        // })


        res.status(200).json(result)
        return
    } catch (err) {
        console.error("Error creating collection: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.post("/nft", upload.single("image"), async (req: Request, res: Response) => {
    try {
        let price = req.body.price;
        if (typeof price === 'string') {
            price = parseFloat(price);
        }
        const nftValidation = await nftCreateDTO.safeParseAsync({
            ...req.body,
            price
        })

        if (!nftValidation.success) {
            res.status(400).json({ message: nftValidation.error.errors })
            return
        }

        if (!req.file) {
            res.status(400).json({ message: "Image is required" })
            return
        }

        const imageHash = await uploadImageToIPFS(req.file)
        const imageUrl = `https://ipfs.io/ipfs/${imageHash}`

        const metadata = {
            name: nftValidation.data.name,
            URL: nftValidation.data.URL,
            image: `ipfs:/${imageHash}`
        }

        const metadataHash = await uploadMetadataToIPFS(metadata)
        const metadataUrl = `https://gateway.pinata.cloud/ipfs/${metadataHash}`

        const nft = await nftService.createNFT({
            name: nftValidation.data.name,
            collectionId: nftValidation.data.collectionId,
            URL: nftValidation.data.URL,
            price: nftValidation.data.price,
            image: imageUrl,
            ownerWallet: nftValidation.data.creatorWallet,
            creatorWallet: nftValidation.data.creatorWallet,
            metadataURI: metadataUrl
        })

        if (!nft) {
            res.status(400).json({ message: "Failed to create nft" })
            return
        }

        const user = await userService.getUserByWalletAddress(nft.creatorWallet)
        if (!user) {
            res.status(400).json({ message: "No such user" })
            return
        }

        if (user.successfulMintNotification) {
            await notificationService.createNotification({
                userWallet: nft.creatorWallet,
                title: "NFT MINTED",
                message: `You minted a new NFT: ${nft.name}`,
                type: NotificationType.MINT
            })
        }

        res.status(200).json(nft)
        return

    } catch (err) {
        console.error("Error creating nft: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.put("/nft", async (req: Request, res: Response) => {
    try {
        // console.log(req.body);

        const tokenId = await z.string().safeParseAsync(req.body.tokenId)

        // console.log(tokenId);

        if (!tokenId.success) {
            res.status(400).json({ message: "Token id is required" })
            return
        }

        const id = req.body.nftId

        const updatedNFT = await nftService.getNFTbyId(id)

        if (!updatedNFT) {
            res.status(404).json({ message: "NFT not found" })
            return
        }

        const nft = await nftService.updateNFT(id, {
            name: updatedNFT.name,
            URL: updatedNFT.URL,
            collectionId: updatedNFT.collectionId,
            ownerWallet: updatedNFT.ownerWallet,
            tokenId: tokenId.data
        })

        res.status(200).json(nft)
        return

    } catch (err) {
        console.error("Error updating nft: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.get("/nft", async (req: Request, res: Response) => {
    try {
        const id = req.query.id as string

        if (!id) {
            res.status(400).json({ message: "NFT id is required" })
            return
        }

        const nft = await nftService.getNFTbyId(id)

        if (!nft) {
            res.status(404).json({ message: "NFT not found" })
            return
        }

        const listings = await nftService.getListingsForNFT(id)
        const bids = await nftService.getBidsForNFT(id)
        const activities = await nftService.getActivitiesForNFT(id)

        const collection = await nftService.getCollectionById(nft.collectionId)

        if (!collection) {
            res.status(404).json({ message: "Collection not found" })
            return
        }

        const details = {
            collection: collection.name,
            contractAddress: collection.contractAddress,
            tokenId: nft.tokenId,
            blockchain: collection.blockchain,
            creatorEarnings: collection.royalties
        }

        const user = await userService.getUserByWalletAddress(nft.ownerWallet)
        if(!user) {
            res.status(404).json({ message: "User not found" })
            return
        }

        const about = {
            name: user.nickname,
            avatar: user.avatar
        }

        res.status(200).json({ nft, details, about, listings, bids, activities })
        return
    } catch (err) {
        console.error("Error getting nft: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.get("/nfts", async (req: Request, res: Response) => {
    try {
        const collectionId = req.query.collectionId as string;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const filters = {
            name: req.query.name as string | undefined,
            status: req.query.status ? (req.query.status as string).split(",") as ("LISTED" | "HAS_OFFERS")[] : undefined,
            minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
            maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        };

        const collection = await nftService.getCollectionById(collectionId);

        if (!collection) {
            res.status(404).json({ message: "Collection not found" });
            return;
        }

        const { nfts, totalCount } = await nftService.getNFTsByCollectionId(collectionId, skip, limit, filters);

        res.status(200).json({
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            nfts
        });
    } catch (err) {
        console.error("Error getting NFTs: ", err);
        res.status(500).json({ message: "Internal server error" });
    }
});


router.get("/nft/user", async (req: Request, res: Response) => {
    try {
        const addressValidation = await addressValidator.safeParseAsync(req.query.walletAddress);
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        if (!addressValidation.success) {
            res.status(400).json({ message: addressValidation.error.errors });
            return;
        }

        const filters = {
            query: req.query.query as string | undefined,
            minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
            maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
            blockchain: req.query.blockchain as Blockchain | undefined,
            status: req.query.status as "NEW" | "LISTED" | undefined
        };

        const sortCriteria = req.query.sortCriteria
            ? (req.query.sortCriteria as string)
                .split(",")
                .map((criteria) => {
                    const [field, order] = criteria.split(":");
                    return { field: field as "price" | "bestOffer", order: order as "asc" | "desc" };
                })
            : [];

        const { nfts, totalCount } = await nftService.searchNFTsByWallet(
            addressValidation.data,
            limit,
            skip,
            sortCriteria,
            filters.query,
            filters.minPrice,
            filters.maxPrice,
            filters.blockchain,
            filters.status
        );

        res.status(200).json({
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            nfts
        });
    } catch (err) {
        console.error("Error getting nft: ", err);
        res.status(500).json({ message: "Internal server error" });
    }
});


router.get("/nft/search", async (req: Request, res: Response) => {
    try {
        const query = req.query.query as string || "";
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const collectionName = req.query.collectionName as string | undefined;
        const minPrice = req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined;
        const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined;
        const blockchain = req.query.blockchain as Blockchain | undefined;
        const status = req.query.status as "NEW" | "LISTED" | undefined;

        const { nfts, totalCount } = await nftService.searchNFTs(
            query,
            limit,
            skip,
            collectionName,
            minPrice,
            maxPrice,
            blockchain,
            status
        );

        res.status(200).json({
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            nfts
        });
        return;
    } catch (err) {
        console.error("Error searching NFTs: ", err);
        res.status(500).json({ message: "Internal server error" });
        return;
    }
});


router.get("/collection", async (req: Request, res: Response) => {
    try {
        const id = req.query.id as string

        if (!id) {
            res.status(400).json({ message: "Collection id is required" })
            return
        }

        const collection = await nftService.getCollectionById(id)
        if(!collection) {
            res.status(404).json({ message: "Collection not found" })
            return
        }

        const creatorName = await userService.getUserByWalletAddress(collection.creatorWallet).then((user) => user?.nickname )
        const countItem = await nftService.getItemCountForCollection(id)
        const floor = await nftService.getFloorForCollection(id)
        const volume = await nftService.getVolumeForCollection(id)
        const scheduledMint = await nftService.getScheduledMint(id)

        const response = { ...collection, creatorName, countItem, floor, volume, scheduledMint }

        res.status(200).json(response);
        return
    } catch (err) {
        console.error("Error getting collections: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.get("/collection/activities", async (req: Request, res: Response) => {
    try {
        const collectionId = req.query.id as string;
        const eventTypes = req.query.eventTypes ? (req.query.eventTypes as string).split(",") : undefined;

        if (!collectionId) {
            res.status(400).json({ message: "Collection ID is required." });
            return;
        }

        const activities = await nftService.getActivitiesForCollection(collectionId, { eventTypes });

        res.status(200).json(activities);
    } catch (err) {
        console.error("Error fetching activities for collection: ", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.get("/collections", async (req: Request, res: Response) => {
    try {

        const validation = await addressValidator.safeParseAsync(req.query.creatorWallet as string);

        if (!validation.success) {
            res.status(400).json({ message: "Invalid wallet address" });
            return;
        }

        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const totalCount = await nftService.countCollectionsByCreator(validation.data);
        const collections = await nftService.getCollectionsByOwner(validation.data, skip, limit);

        res.status(200).json({
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            collections
        });
        return
    } catch (err) {
        console.error("Error getting collection: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.get("/collections/search", async (req: Request, res: Response) => {
    try {
        const query = req.query.query as string;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;

        const sortCriteriaRaw = req.query.sortCriteria as string || "[]";
        let sortCriteria: { field: "floor" | "floorChange" | "volumeChange" | "itemsCount" | "ownersCount" | "volume", order: "asc" | "desc" }[];
        try {
            sortCriteria = JSON.parse(sortCriteriaRaw);
        } catch {
            sortCriteria = [];
        }

        const { collections, totalCount } = await nftService.searchCollections(query, sortCriteria, limit, skip);

        res.status(200).json({
            total: totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit),
            collections
        });
        return
    } catch (err) {
        console.error("Error searching collections: ", err);
        res.status(500).json({ message: "Internal server error" });
        return
    }
});


export const nftRouter = router