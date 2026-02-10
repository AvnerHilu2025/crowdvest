import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface MeProfile {
  userId: string;
  displayName: string;
}

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create-on-first-read: if profile missing, create with displayName (cv_displayName ?? "User") and return. */
  async getOrCreateProfile(userId: string, cvDisplayName?: string): Promise<MeProfile> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });
    if (profile) {
      return { userId: profile.userId, displayName: profile.displayName };
    }
    const displayName = (cvDisplayName && cvDisplayName.length > 0) ? cvDisplayName : "User";
    const created = await this.prisma.userProfile.create({
      data: { userId, displayName },
    });
    return { userId: created.userId, displayName: created.displayName };
  }

  async upsertProfile(userId: string, displayName: string): Promise<MeProfile> {
    const profile = await this.prisma.userProfile.upsert({
      where: { userId },
      create: { userId, displayName },
      update: { displayName },
    });
    return { userId: profile.userId, displayName: profile.displayName };
  }
}
