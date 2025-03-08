import jwt from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { UserService } from "@/user/user.service";
interface DecodedToken {
    walletAddress: string;
}

const userService = new UserService();

export const jwtMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            console.error("No token provided at all");
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            console.error("No token provided");
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as DecodedToken;
        const user = await userService.getUserByWalletAddress(decoded.walletAddress);

        if (!user) {
            console.error("User not found");
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        next();

    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            res.status(401).json({ message: "Token expired" });
            return;
        }
        if (err instanceof jwt.JsonWebTokenError) {
            res.status(401).json({ message: "Invalid token" });
            return;
        }
        console.error("Error verifying token: ", err);
        res.status(401).json({ message: "Unauthorized" });
        return;
    }
}