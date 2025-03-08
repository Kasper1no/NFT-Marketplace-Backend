import { Router, Request, Response } from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { ethers } from "ethers";
import { TokenService } from "./jwt.service";
import { addressValidator } from "@/user/user.dto";


const router = Router();

const tokenService = new TokenService();

router.use(cors());

router.get("/nonce", async (req: Request, res: Response) => {
  try {
    const address = req.query.address as string | undefined;
    const addressValidation = await addressValidator.safeParseAsync(address);

    if (!address || !addressValidation.success) {
      res.status(400).json({ message: "Address is required" });
      return;
    }

    var nonce = await tokenService.getNonce(addressValidation.data);

    if (!nonce) {
      nonce = randomBytes(16).toString("hex");

      await tokenService.upsertNonce(address, nonce);
    }

    res.status(200).json({ nonce });
  } catch (err) {
    console.error("Error getting nonce: ", err)
    res.status(500).json({ message: "Internal server error" })
    return
  }
})

router.post("/signin", async (req: Request, res: Response) => {
  try {
    const address = req.body.address;
    const signature = req.body.signature;

    if (!address || !signature) {
      res.status(400).json({ message: "Address and signature are required" });
      return;
    }

    const nonce = await tokenService.getNonce(address);

    if (!nonce) {
      res.status(400).json({ message: "Nonce not found" });
      return;
    }

    const fixedSignature = signature.startsWith("0x") ? signature : "0x" + signature;
    const verifiedAddress = ethers.verifyMessage(nonce, fixedSignature);

    if (verifiedAddress.toLowerCase() !== address.toLowerCase()) {
      res.status(400).json({ message: "Invalid signature" });
      return;
    }

    const accessToken = tokenService.createAccessToken(address);
    const refreshToken = tokenService.createRefreshToken(address);
    tokenService.upsertRefreshToken(address, refreshToken);

    res.status(200).json({ accessToken, refreshToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
})

router.post("/refresh", async (req: Request, res: Response) => {
  const refreshToken = req.body.refreshToken as string;

  if (!refreshToken) {
    res.status(400).json({ message: "Refresh token is required" });
    return;
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET as string) as { walletAddress: string };
    const accessToken = tokenService.createAccessToken(decoded.walletAddress);
    const newRefreshToken = tokenService.createRefreshToken(decoded.walletAddress);
    tokenService.upsertRefreshToken(decoded.walletAddress, newRefreshToken);

    res.status(200).json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: "Invalid refresh token" });
  }
})

export const jwtRouter = router
