import { Router, Request, Response } from "express";
import multer from "multer";
import { PinataSDK } from "pinata-web3";
import { collectionCreateDTO, nftCreateDTO } from "./nft.dto";
import { addressValidator } from "../user/user.dto";
import { Readable } from "stream";
import { NFTService } from "./nft.service";
import { z } from "zod";    

const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT,
    pinataGateway: process.env.PINATA_GATEWAY,
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const router = Router();

const nftService = new NFTService();


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

router.post("/collection",upload.single("image"), async (req: Request, res: Response) => {
    try {
        const addressValidation = await addressValidator.safeParseAsync(req.body.walletAddress)

        if(!addressValidation.success) {
            res.status(400).json({ message: addressValidation.error.errors })
            return
        }

        const collectionValidation = await collectionCreateDTO.safeParseAsync(req.body)

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
            creatorWallet: addressValidation.data,
            metadata: metadataUrl
        })

        res.status(200).json(collection)
        return
    } catch (err) {
        console.error("Error creating collection: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.post("/nft", upload.single("image"), async (req: Request, res: Response) => {
    try {
        const addressValidation = await addressValidator.safeParseAsync(req.body.walletAddress)

        if(!addressValidation.success) {
            res.status(400).json({ message: addressValidation.error.errors })
            return
        }

        const count: Number = parseInt(req.body.quantity)
        // const traitsArray: Array<{ traitType: string, value: string }> = req.body.traits as Array<{ traitType: string, value: string }>

        const nftValidation = await nftCreateDTO.safeParseAsync({
            name: req.body.name,
            collectionId: req.body.collectionId,    
            description: req.body.description,
            quantity:  count,
            traits: req.body.traits
        })

        if (!nftValidation.success) {
            res.status(400).json({ message: nftValidation.error.errors })
            return
        }

        if (!req.file) {
            res.status(400).json({ message: "Image is required" })
            return
        }

        const traits = []
        if (nftValidation.data.traits) {
            for (const trait of nftValidation.data.traits) {
                if (!trait.traitType || !trait.value) {
                    const result = await nftService.createTrait(trait)
                    if(!result){
                        throw new Error("Failed to create trait")
                    }
                    traits.push(result)
                }
            }
        }

        const imageHash = await uploadImageToIPFS(req.file)
        const imageUrl = `https://ipfs.io/ipfs/${imageHash}`

        const metadata = {
            name: nftValidation.data.name,
            description: nftValidation.data.description,
            image: `ipfs:/${imageHash}`,
            attributes: traits.map(trait => ({
                trait_type: trait.traitType,
                value: trait.value
            }))
        }

        const metadataHash = await uploadMetadataToIPFS(metadata)
        const metadataUrl = `https://gateway.pinata.cloud/ipfs/${metadataHash}`

        const traitsIds = traits.map(trait => trait.id)

        const nft = await nftService.createNFT({
            name: nftValidation.data.name,
            quantity: nftValidation.data.quantity,
            collectionId: nftValidation.data.collectionId,
            description: nftValidation.data.description,
            image: imageUrl,
            ownerWallet: addressValidation.data,
            creatorWallet: addressValidation.data,
            metadataURI: metadataUrl,
            traitIDs: traitsIds
        })

        res.status(200).json(nft)
        return

    } catch (err) {
        console.error("Error creating nft: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})

router.put("/nft/:nftId", async (req: Request, res: Response) => {
    try {
        // console.log(req.body);

        const tokenId = await z.string().safeParseAsync(req.body.tokenId)

        // console.log(tokenId);

        if(!tokenId.success) {
            res.status(400).json({ message: "Token id is required" })
            return
        } 

        const id = req.params.nftId

        const updatedNFT =  await nftService.getNFTbyId(id)

        if(!updatedNFT) {
            res.status(404).json({ message: "NFT not found" })
            return
        }

        const nft = await nftService.updateNFT(id, { 
            name: updatedNFT.name,
            description: updatedNFT.description,
            collectionId: updatedNFT.collectionId,
            ownerWallet: updatedNFT.ownerWallet,
            creatorWallet: updatedNFT.creatorWallet,
            image: updatedNFT.image,
            metadataURI: updatedNFT.metadataURI,
            traitIDs: updatedNFT.traitIDs,
            quantity: updatedNFT.quantity,
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



export const nftRouter = router