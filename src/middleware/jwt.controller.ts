import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { ethers } from "ethers";
import { TokenService } from "./jwt.service";
import { addressValidator } from "@/user/user.dto";
import { UserService } from "@/user/user.service";


const router = Router();

const userService = new UserService();
const tokenService = new TokenService();


// router.get("/nonce", async (req: Request, res: Response) => {
//   try {
//     const address = req.query.address as string | undefined;
//     const addressValidation = await addressValidator.safeParseAsync(address);

//     if (!address || !addressValidation.success) {
//       res.status(400).json({ message: "Address is required" });
//       return;
//     }

//     var nonce = await tokenService.getNonce(addressValidation.data);

//     if (!nonce) {
//       nonce = randomBytes(16).toString("hex");

//       await tokenService.upsertNonce(address, nonce);
//     }

//     res.status(200).json({ nonce });
//   } catch (err) {
//     console.error("Error getting nonce: ", err)
//     res.status(500).json({ message: "Internal server error" })
//     return
//   }
// })

router.post("/login", async (req: Request, res: Response) => {
  try {
    const validation = await addressValidator.safeParseAsync(req.body.walletAddress);

    if (!validation.success) {
      res.status(400).json({ message: validation.error.errors });
      return;
    }

    const user = await userService.getUserByWalletAddress(validation.data);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const accessToken = await tokenService.createAccessToken(validation.data);
    const refreshToken = await tokenService.createRefreshToken(validation.data);
    await tokenService.upsertRefreshToken(validation.data, refreshToken);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      user,
      accessToken,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
})

router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    const validation = await addressValidator.safeParseAsync(req.body.walletAddress);

    if (!refreshToken) {
      res.status(400).json({ message: "Refresh token is required" });
      return;
    }

    if (!validation.success) {
      res.status(400).json({ message: validation.error.errors });
      return;
    }
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET as string) as { walletAddress: string };

    if (decoded.walletAddress !== validation.data) {
      res.status(401).json({ message: "Invalid wallet address" });
      return;
    }

    const accessToken = await tokenService.createAccessToken(decoded.walletAddress);
    const newRefreshToken = await tokenService.createRefreshToken(decoded.walletAddress);

    await tokenService.upsertRefreshToken(decoded.walletAddress, newRefreshToken);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({ accessToken });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: "Invalid refresh token" });
  }
})

router.post('/logout', async (req: Request, res: Response) => {
  res.clearCookie('refreshToken', {
      path: '/',
      httpOnly: true,
  });
  res.status(200).send('Cookies cleared');
});

export const jwtRouter = router
