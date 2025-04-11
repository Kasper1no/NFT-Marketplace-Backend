import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";

const ACCESS_TOKEN_EXPIRY = "1h";
const REFRESH_TOKEN_EXPIRY = "7d";

interface DecodedToken {
    walletAddress: string;
}

export class TokenService {
    private prisma = new PrismaClient();

    createAccessToken(walletAddress: string): string {
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not defined");
        }
        const accessToken = jwt.sign({ walletAddress }, process.env.JWT_SECRET as string, { expiresIn: ACCESS_TOKEN_EXPIRY });
        return accessToken;
    }

    createRefreshToken(walletAddress: string): string {
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not defined");
        }
        const refreshToken = jwt.sign({ walletAddress }, process.env.JWT_SECRET as string, { expiresIn: REFRESH_TOKEN_EXPIRY });
        return refreshToken;
    }

    upsertRefreshToken(walletAddress: string, refreshToken: string) {
        this.prisma.refreshToken.upsert({
            where: { walletAddress },
            update: {
                tokenId: refreshToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
            create: {
                walletAddress,
                tokenId: refreshToken,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
    }

    // upsertNonce(walletAddress: string, nonce: string) {
    //     return this.prisma.nonce.upsert({
    //         where: { walletAddress },
    //         update: {
    //             nonce: nonce,
    //         },
    //         create: {
    //             walletAddress,
    //             nonce: nonce,
    //         },
    //     });
    // }

    // getNonce(walletAddress: string): Promise<string | null> {
    //     return this.prisma.nonce.findUnique({ where: { walletAddress } }).then((nonce) => nonce?.nonce || null);    
    // }
}