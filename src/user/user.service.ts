import { PrismaClient, User } from "@prisma/client";
import { ICreateUser, IUpdateUser } from "./user.types";

export class UserService {
    private prisma = new PrismaClient();

    getUserByWalletAddress(walletAddress: string): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { walletAddress } });
    }

    getUsers(): Promise<User[]> {
        return this.prisma.user.findMany();
    }

    createUser(user: ICreateUser): Promise<User> {
        return this.prisma.user.create({
            data: user
        })
    }

    updateUser(walletAddress: string, user: IUpdateUser): Promise<User> {
        return this.prisma.user.update({
            where: { walletAddress: walletAddress },
            data: user
        })
    }

    deleteUser(walletAddress: string): Promise<User> {
        return this.prisma.user.delete({
            where: { walletAddress: walletAddress }
        })
    }
}