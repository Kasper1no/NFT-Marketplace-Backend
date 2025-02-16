export interface ICreateUser{
    id?: string;
    nickname: string;
    email: string;
    walletAddress: string;
    avatar: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IUpdateUser{
    nickname?: string,
    email?: string,
    avatar?: string
}