import { FriendRequest, Friendship, PrismaClient, RequestStatus, User } from "@prisma/client";
import { ICreateFrendship, ICreateFriendRequest, ICreateUser, IReturnUser, IUpdateUser, IUserNotificationUpdate } from "./user.types";
import Fuse from "fuse.js";

export class UserService {
    private prisma = new PrismaClient();
    private userFuse: Fuse<User> = new Fuse([], {
        keys: ["nickname", "walletAddress"],
        threshold: 0.3,
        includeScore: true
    })

    getUserById(id: string): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { id } });
    }

    getUserByWalletAddress(walletAddress: string): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { walletAddress } });
    }

    getUsers(): Promise<IReturnUser[]> {
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

    updateUserNotification(walletAddress: string, userSettings: IUserNotificationUpdate): Promise<User> {
        return this.prisma.user.update({
            where: { walletAddress: walletAddress },
            data: userSettings
        })
    }

    deleteUser(walletAddress: string): Promise<User> {
        return this.prisma.user.delete({
            where: { walletAddress: walletAddress }
        })
    }

    getRecievedRequestsByWallet(walletAddress: string, skip: number = 0, pageSize: number = 10): Promise<FriendRequest[]> {
        return this.prisma.friendRequest.findMany({
            where: {
                receiverWallet: walletAddress,
                status: RequestStatus.PENDING
            },
            skip,
            take: pageSize
        })
    }

    countRecievedRequestsByWallet(walletAddress: string): Promise<number> {
        return this.prisma.friendRequest.count({
            where: {
                receiverWallet: walletAddress,
                status: RequestStatus.PENDING
            }
        })
    }

    getSentRequestsByWallet(walletAddress: string, skip: number = 0, pageSize: number = 10): Promise<FriendRequest[]> {
        return this.prisma.friendRequest.findMany({
            where: {
                senderWallet: walletAddress,
                status: RequestStatus.PENDING
            },
            skip,
            take: pageSize
        })
    }

    countSentRequestsByWallet(walletAddress: string): Promise<number> {
        return this.prisma.friendRequest.count({
            where: {
                senderWallet: walletAddress,
                status: RequestStatus.PENDING
            }
        })
    }

    getRequest(senderWallet: string, receiverWallet: string): Promise<FriendRequest | null> {
        return this.prisma.friendRequest.findFirst({
            where: {
                OR: [
                    { senderWallet, receiverWallet, status: 'PENDING' },
                    { senderWallet: receiverWallet, receiverWallet: senderWallet, status: 'PENDING' }
                ]
            }
        });
    }

    createFriendRequest(friendRequest: ICreateFriendRequest): Promise<FriendRequest> {
        return this.prisma.friendRequest.create({
            data: friendRequest
        })
    }

    updateFriendRequest(id: string, status: RequestStatus): Promise<FriendRequest> {
        return this.prisma.friendRequest.update({
            where: { id: id },
            data: { status }
        })
    }

    createFriendship(friendship: ICreateFrendship): Promise<Friendship> {
        return this.prisma.friendship.create({
            data: friendship
        })
    }

    countFriendsByWallet(walletAddress: string): Promise<number> {
        return this.prisma.friendship.count({
            where: {
                OR: [
                    { user1Wallet: walletAddress },
                    { user2Wallet: walletAddress }
                ]
            }
        })
    }

    getFriendsByWallet(walletAddress: string, skip: number = 0, pageSize: number = 10): Promise<IReturnUser[]> {
        return this.prisma.friendship.findMany({
            where: {
                OR: [
                    { user1Wallet: walletAddress },
                    { user2Wallet: walletAddress }
                ]
            },
            select: {
                user1: {
                    select: {
                        id: true,
                        nickname: true,
                        walletAddress: true,
                        avatar: true
                    }
                },
                user2: {
                    select: {
                        id: true,
                        nickname: true,
                        walletAddress: true,
                        avatar: true
                    }
                }
            },
            skip,
            take: pageSize
        }).then(friendships => {
            return friendships.map(f => f.user1.walletAddress === walletAddress ? f.user2 : f.user1);
        });
    }

    getFriendship(user1Wallet: string, user2Wallet: string): Promise<Friendship | null> {
        return this.prisma.friendship.findFirst({
            where: {
                OR: [
                    { user1Wallet, user2Wallet },
                    { user1Wallet: user2Wallet, user2Wallet: user1Wallet }
                ]
            }
        })
    }

    deleteFriendship(id: string): Promise<Friendship> {
        return this.prisma.friendship.delete({
            where: { id }
        })
    }

    async searchUsers(query: string, limit: number, skip: number): Promise<{ users: IReturnUser[], totalCount: number }> {
        const allUsers = await this.prisma.user.findMany();
        this.userFuse.setCollection(allUsers);
    
        let results;
    
        if (!query || query.trim() === "") {
            results = allUsers.map((user) => ({ item: user }));
        } else {
            results = this.userFuse.search(query);
        }
    
        const totalCount = results.length;
        const users = results.slice(skip, skip + limit).map((result) => result.item);
    
        return { users, totalCount };
    }
    

    async calculateProfit(userWallet: string, hours: number): Promise<number> {
        const prisma = new PrismaClient();

        const startTime = new Date();
        startTime.setHours(startTime.getHours() - hours);

        const initialNFTs = await prisma.nFT.findMany({
            where: { ownerWallet: userWallet, updatedAt: { lte: startTime } },
            select: { price: true }
        });
        const initialValue = initialNFTs.reduce((sum, nft) => sum + nft.price, 0);

        const currentNFTs = await prisma.nFT.findMany({
            where: { ownerWallet: userWallet },
            select: { price: true }
        });
        const currentValue = currentNFTs.reduce((sum, nft) => sum + nft.price, 0);

        const soldNFTs = await prisma.transaction.findMany({
            where: {
                sellerWallet: userWallet,
                createdAt: { gte: startTime }
            },
            select: { price: true }
        });
        const soldValue = soldNFTs.reduce((sum, tx) => sum + tx.price, 0);

        const profit = ((currentValue + soldValue - initialValue) / (initialValue || 1)) * 100;

        return profit;
    }

    async calculateHourlyProfit(userWallet: string, hours: number): Promise<{ [hour: string]: number }> {
        const prisma = new PrismaClient();
        const results: { [hour: string]: number } = {};

        const currentDate = new Date();

        for (let i = 1; i <= hours; i++) {
            const endTime = new Date(currentDate.getTime() - (i - 1) * 60 * 60 * 1000);
            const startTime = new Date(currentDate.getTime() - i * 60 * 60 * 1000);

            const initialNFTs = await prisma.nFT.findMany({
                where: { ownerWallet: userWallet, updatedAt: { lte: startTime } },
                select: { price: true }
            });
            const initialValue = initialNFTs.reduce((sum, nft) => sum + nft.price, 0);

            const currentNFTs = await prisma.nFT.findMany({
                where: { ownerWallet: userWallet, updatedAt: { lte: endTime } },
                select: { price: true }
            });
            const currentValue = currentNFTs.reduce((sum, nft) => sum + nft.price, 0);

            const soldNFTs = await prisma.transaction.findMany({
                where: {
                    sellerWallet: userWallet,
                    createdAt: { gte: startTime, lte: endTime }
                },
                select: { price: true }
            });
            const soldValue = soldNFTs.reduce((sum, tx) => sum + tx.price, 0);

            const profit = ((currentValue + soldValue - initialValue) / (initialValue || 1)) * 100;

            const hourKey = startTime.toTimeString().slice(0, 5);

            results[hourKey] = profit;
        }

        return results;
    }




}