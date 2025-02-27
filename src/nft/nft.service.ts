import { PrismaClient, NFT, NFTTrait, Collection } from "@prisma/client";
import { ICreateNFT, ICreateTrait, ICreateCollection, IUpdateNFT } from "./nft.types";

export class NFTService {
    private prisma = new PrismaClient()

    createNFT(nft: ICreateNFT): Promise<NFT> {
        return this.prisma.nFT.create({
            data: {
                ...nft,
                traits: {
                    connect: nft.traitIDs?.map(id => ({ id }))
                }
            },
            include: {
                traits: true
            }
        })
    }

    createCollection(collection: ICreateCollection): Promise<Collection> {
        return this.prisma.collection.create({
            data: collection
        })
    }

    createTrait(trait: ICreateTrait): Promise<NFTTrait> {
        return this.prisma.nFTTrait.create({
            data: trait
        })
    }

    updateNFT(nftId: string, nft: IUpdateNFT): Promise<NFT> {
        return this.prisma.nFT.update({
            where: {
                id: nftId
            },
            data: nft
        })
    }

    getNFTbyId(nftId: string): Promise<NFT | null> {
        return this.prisma.nFT.findUnique({
            where: {
                id: nftId
            },
            include: {
                traits: true
            }
        })
    }

    getCollectionsByWalletAddress(walletAddress: string): Promise<Collection[]> {
        return this.prisma.collection.findMany({
            where: {
                creatorWallet: walletAddress
            }
        })
    }

    getCollectionById(collectionId: string): Promise<Collection | null> {
        return this.prisma.collection.findUnique({
            where: {
                id: collectionId
            }
        })
    }
}