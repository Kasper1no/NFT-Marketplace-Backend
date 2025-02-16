import dotenv from "dotenv";
import express from "express";
import { PrismaClient } from "@prisma/client";
import { userRouter } from "./user/user.controller";

dotenv.config();

const app = express();

export const prisma = new PrismaClient();

async function main() {
    app.use(express.json());

    app.use("/api/users", userRouter)

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

