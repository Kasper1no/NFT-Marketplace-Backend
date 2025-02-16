import { Router, Request, Response } from "express";
import multer from "multer";
import { PinataSDK } from "pinata-web3";
import { nftCreateDTO } from "./nft.dto";
import { addressValidator } from "../user/user.dto";
import { Readable } from "stream";
import { NFTService } from "./nft.service";

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



router.post("/", upload.single("image"), async (req: Request, res: Response) => {
    try {
        const addressValidation = await addressValidator.safeParseAsync(req.body.walletAddress)

        if(!addressValidation.success) {
            res.status(400).json({ message: addressValidation.error.errors })
            return
        }

        const nftValidation = await nftCreateDTO.safeParseAsync(req.body)

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

        // TODO:
        // - create contract for minting nft(solo, in collection), deploy & use 
        // - create nft in db
        // - return nft to user

    } catch (err) {
        console.error("Error creating nft: ", err)
        res.status(500).json({ message: "Internal server error" })
        return
    }
})



export const nftRouter = router