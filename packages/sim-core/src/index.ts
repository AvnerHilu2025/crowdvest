export {
  runStep,
  runSimulation,
  type RunSimulationOptions,
} from "./engine";
export { decideAction } from "./action";
export { computeReward } from "./reward";
export { createSeededRng, normal, sampleMarketReturn } from "./rng";
export type {
  SimConfig,
  AgentInSim,
  Action,
  StepExperience,
  StepSnapshot,
  StepResult,
  TraitValues,
  TraitKey,
  SellConfig,
} from "./types";
export {
  DEFAULT_TAKE_PROFIT,
  DEFAULT_STOP_LOSS,
  DEFAULT_MAX_HOLD_STEPS,
  getSellConfig,
} from "./types";
export {
  TRAIT_KEYS,
  DEFAULT_TRAIT,
  getTraitValue,
  buildTraitValues,
} from "./types";
