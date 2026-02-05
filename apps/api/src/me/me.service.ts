import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export interface MeProfile {
  userId: string;
  displayName: string;
}

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<MeProfile | null> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });
    if (!profile) return null;
    return { userId: profile.userId, displayName: profile.displayName };
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
