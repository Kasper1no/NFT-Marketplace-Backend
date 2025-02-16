export interface ICreateNFT{
    id?: string;
    tokenId: string;
    name: string;
    description: string;
    ownerWallet: string;
    creatorWallet: string;
    image: string;
    metadataURI: string;
    traitsIds: string[];
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ICreateTrait{
    id?: string;
    traitType: string;
    value: string;
}