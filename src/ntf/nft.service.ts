import { PrismaClient, NFT, NFTTrait } from "@prisma/client";
import { ICreateNFT, ICreateTrait } from "./nft.types";

export class NFTService {
    private prisma = new PrismaClient()

    craeteNFT(nft: ICreateNFT): Promise<NFT> {
        return this.prisma.nFT.create({
            data: {
                ...nft,
                traits: {
                    connect: nft.traitsIds?.map(id => ({ id }))
                }
            },
            include: {
                traits: true
            }
        })
    }

    createTrait(trait: ICreateTrait): Promise<NFTTrait> {
        return this.prisma.nFTTrait.create({
            data: trait
        })
    }
}