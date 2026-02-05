import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { WalletService } from "./wallet.service";

@Controller("wallet")
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  async getWallet(@Query("userId") userId?: string) {
    const uid = (userId?.trim() || "demo-user");
    return this.walletService.getOrCreateWallet(uid);
  }

  /** Dev-only helper for testing. Can be removed later. */
  @Post("reset")
  async resetWallet(
    @Body("userId") userId?: string,
    @Body("balance") balance?: number,
  ) {
    const uid = (userId?.trim() || "demo-user");
    const bal = typeof balance === "number" ? balance : 100;
    return this.walletService.resetWallet(uid, bal);
  }
}
