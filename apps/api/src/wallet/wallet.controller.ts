import { BadRequestException, Body, Controller, Get, Post, Query } from "@nestjs/common";
import { WalletService } from "./wallet.service";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller("wallet")
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async getWallet(@Query("userId") userId?: string) {
    const uid = userId?.trim() || "demo-user";
    return this.walletService.getOrCreateWallet(uid);
  }

  @Get("summary")
  async getSummary(@Query("userId") userId?: string) {
    const uid = userId?.trim() ?? "";
    if (!uid) {
      throw new BadRequestException("userId is required");
    }
    if (!UUID_REGEX.test(uid)) {
      throw new BadRequestException("userId must be a valid UUID");
    }
    return this.walletService.getWalletSummary(uid);
  }

  @Get("transactions")
  async getTransactions(
    @Query("userId") userId?: string,
    @Query("limit") limitStr?: string,
  ) {
    const uid = userId?.trim() || "";
    if (!uid) {
      throw new BadRequestException("userId is required");
    }
    const limit = Math.min(Math.max(1, parseInt(limitStr ?? "50", 10) || 50), 200);
    return this.walletService.listTransactions(uid, limit);
  }

  /** Admin/dev: adjust wallet balance. Body: { userId, amount, note? } */
  @Post("adjust")
  async adjust(
    @Body("userId") userId?: string,
    @Body("amount") amount?: number,
    @Body("note") note?: string | null,
  ) {
    const uid = userId?.trim() || "";
    if (!uid) {
      throw new BadRequestException("userId is required");
    }
    const amt = typeof amount === "number" && Number.isFinite(amount) ? amount : 0;
    return this.walletService.adjust(uid, amt, note ?? null);
  }

  /** Dev-only helper for testing. Can be removed later. */
  @Post("reset")
  async resetWallet(
    @Body("userId") userId?: string,
    @Body("balance") balance?: number,
  ) {
    const uid = userId?.trim() || "demo-user";
    const bal = typeof balance === "number" ? balance : 100;
    return this.walletService.resetWallet(uid, bal);
  }
}
