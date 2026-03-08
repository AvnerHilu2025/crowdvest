import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import {
  STRATEGY_PROFILES,
  DEFAULT_ACTIVE_PROFILE_KEY,
  type StrategyProfileKey,
  type StrategyProfile,
} from "./strategy-profiles.constants";

const DATA_DIR = path.join(__dirname, "..", "data");
const PROFILE_FILE = path.join(DATA_DIR, "strategy-profile.json");

@Injectable()
export class StrategyProfilesService {
  getProfiles(): StrategyProfile[] {
    return [...STRATEGY_PROFILES];
  }

  getActiveProfileKey(): StrategyProfileKey {
    try {
      if (!fs.existsSync(PROFILE_FILE)) {
        return DEFAULT_ACTIVE_PROFILE_KEY;
      }
      const raw = fs.readFileSync(PROFILE_FILE, "utf-8");
      const data = JSON.parse(raw) as { activeProfileKey?: string };
      const key = data?.activeProfileKey;
      if (
        key === "conservative" ||
        key === "balanced" ||
        key === "aggressive" ||
        key === "research"
      ) {
        return key;
      }
    } catch {
      // fallback on parse error or missing file
    }
    return DEFAULT_ACTIVE_PROFILE_KEY;
  }

  getActiveProfile(): StrategyProfile {
    const key = this.getActiveProfileKey();
    const profile = STRATEGY_PROFILES.find((p) => p.key === key);
    return profile ?? STRATEGY_PROFILES[0]!;
  }

  getAllWithActive(): {
    activeProfileKey: StrategyProfileKey;
    profiles: Array<StrategyProfile & { isActive: boolean }>;
  } {
    const activeKey = this.getActiveProfileKey();
    const profiles = STRATEGY_PROFILES.map((p) => ({
      ...p,
      isActive: p.key === activeKey,
    }));
    return { activeProfileKey: activeKey, profiles };
  }

  getDefaults(): {
    activeProfile: StrategyProfile;
    benchmarkDefaults: {
      aggregationMode: string;
      selectionPolicy: string;
      symbols: string[];
      windows: number[];
      n: number;
    };
    runDefaults: {
      aggregationMode: string;
      selectionPolicy: string;
      assetSymbols: string[];
      points: number;
    };
  } {
    const profile = this.getActiveProfile();
    return {
      activeProfile: profile,
      benchmarkDefaults: {
        aggregationMode: profile.aggregationMode,
        selectionPolicy: profile.selectionPolicy,
        symbols: ["SPY", "QQQ", "IWM"],
        windows: [29, 60, 120],
        n: 20,
      },
      runDefaults: {
        aggregationMode: profile.aggregationMode,
        selectionPolicy: profile.selectionPolicy,
        assetSymbols: ["SPY", "QQQ", "IWM"],
        points: 29,
      },
    };
  }

  setActiveProfile(key: StrategyProfileKey): StrategyProfile {
    const profile = STRATEGY_PROFILES.find((p) => p.key === key);
    if (!profile) {
      throw new Error(`Unknown strategy profile key: ${key}`);
    }
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(
        PROFILE_FILE,
        JSON.stringify({ activeProfileKey: key }, null, 0),
        "utf-8",
      );
    } catch (e) {
      throw new Error(
        `Failed to persist strategy profile: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
    return profile;
  }
}
