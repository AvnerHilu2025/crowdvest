import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

export type AgentDetailResponse = {
  id: string;
  name: string;
  archetype: { id: string; name: string };
  wallet: { balance: number };
};

@Injectable()
export class AgentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** GET /agents/:agentId — single agent by id with archetype and wallet. */
  async findOne(agentId: string): Promise<AgentDetailResponse> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        displayName: true,
        archetype: { select: { id: true, name: true } },
        wallet: { select: { balance: true } },
      },
    });
    if (!agent) throw new NotFoundException("Agent not found");
    return {
      id: agent.id,
      name: agent.displayName,
      archetype: agent.archetype,
      wallet: { balance: agent.wallet?.balance ?? 0 },
    };
  }
}
