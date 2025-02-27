export interface ICreateNFT{
    id?: string;
    tokenId?: string;
    name: string;
    description: string;
    collectionId: string;
    quantity: number;
    ownerWallet: string;
    creatorWallet: string;
    image: string;
    metadataURI: string;
    traitIDs: string[];
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ICreateTrait{
    id?: string;
    traitType: string;
    value: string;
}

export interface ICreateCollection{
    id?: string;
    contractAddress: string;
    name: string;
    symbol: string;
    image: string;
    metadata: string;
    creatorWallet: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IUpdateNFT{
    tokenId?: string;
    name: string;
    description: string;
    collectionId: string;
    quantity: number;
    ownerWallet: string;
    creatorWallet: string;
    image: string;
    metadataURI: string;
    traitIDs: string[];
}