import { MarketService } from "@/market/market.service";
import cron from "node-cron";

const marketService = new MarketService();

async function checkExpiredBids() {
    const expiredBids = await marketService.getExpiredActiveBids();
    if (expiredBids && expiredBids.length > 0) {
        await marketService.rejectExpiredBids(expiredBids);
        console.log(`✅ Rejected ${expiredBids.length} expired bids`);
    } else {
        console.log("ℹ️ Немає прострочених ставок");
    }
}

cron.schedule("0 * * * *", async () => {
    console.log("🔍 Перевірка прострочених ставок...");
    await checkExpiredBids();
});