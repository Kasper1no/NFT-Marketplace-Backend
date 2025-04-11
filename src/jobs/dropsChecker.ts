import { MarketService } from "@/market/market.service";
import { NFTService } from "@/nft/nft.service";
import { NotificationService } from "@/notification/notification.service";
import { UserService } from "@/user/user.service";
import { ListingStatus, NotificationType } from "@prisma/client";
import cron from "node-cron";

const marketService = new MarketService();
const userService = new UserService();
const notificationService = new NotificationService();
const nftService = new NFTService();

async function checkUndroppedNFTs() {
    try {
        const listings = await marketService.getUndroppedListings();

        if (listings.length === 0) {
            console.log("No NFTs to drop at this moment.");
            return;
        }

        console.log(`Processing ${listings.length} NFT drops...`);

        await Promise.all(listings.map(async (listing) => {
            await marketService.updateListing(listing.id, { status: ListingStatus.ACTIVE });

            const nft = await nftService.getNFTbyId(listing.nftId);

            if (!nft) {
                console.log(`NFT ${listing.nftId} not found.`);
                return;
            }
            await notificationService.createNotification({
                userWallet: listing.sellerWallet,
                type: NotificationType.SUCCESS,
                message: `Your NFT ${nft.name} has dropped!`,
                title: "Drop",
            });


            console.log(`NFT ${nft.id} (${nft.name}) marked as DROPPED.`);
        }));

    } catch (error) {
        console.error("Error checking undropped NFTs:", error);
    }
}

cron.schedule("* * * * *", async () => {
    console.log("Running NFT drop checker...");
    await checkUndroppedNFTs();
});
