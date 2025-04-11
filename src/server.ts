import dotenv from "dotenv";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { userRouter } from "./user/user.controller";
import { nftRouter } from "./nft/nft.controller";
import { jwtRouter } from "./middleware/jwt.controller";
import { jwtMiddleware } from "./middleware/jwt.middleware";
import { marketRouter } from "./market/market.controller";
import { notificationRouter } from "./notification/notification.controller";
import cors from "cors";
import cookieParser from "cookie-parser";

import "./jobs/dropsChecker";
import "./jobs/bidsChecker";
import "./jobs/notificationChecker";


dotenv.config();

const app = express();
const corsOptions = {
    origin: 'http://localhost:3000',
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true
}

export const prisma = new PrismaClient();

async function main() {
    app.use(express.json());
    app.use(cors(corsOptions));
    app.use(cookieParser());

    app.use("/api/jwt", jwtRouter)

    app.use("/api/users", userRouter)

    app.use("/api/nfts", nftRouter)

    app.use("/api/market", marketRouter)

    app.use("/api/notification", notificationRouter);

    const port = process.env.PORT || 4200;
    app.listen(port, () => {
        console.log(`Server is listening on port ${port}`);
    });
}

main()
    .then(async () => {
        await prisma.$connect();
    }).catch(async e => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    })

