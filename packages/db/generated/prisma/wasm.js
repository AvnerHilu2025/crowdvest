
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.ArchetypeScalarFieldEnum = {
  id: 'id',
  name: 'name',
  description: 'description',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TraitDefinitionScalarFieldEnum = {
  id: 'id',
  key: 'key',
  displayName: 'displayName',
  description: 'description',
  valueRangeText: 'valueRangeText',
  minValue: 'minValue',
  maxValue: 'maxValue',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ArchetypeTraitProfileScalarFieldEnum = {
  archetypeId: 'archetypeId',
  traitDefinitionId: 'traitDefinitionId',
  baselineValue: 'baselineValue'
};

exports.Prisma.AgentScalarFieldEnum = {
  id: 'id',
  displayName: 'displayName',
  archetypeId: 'archetypeId',
  stateJson: 'stateJson',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AgentWalletScalarFieldEnum = {
  agentId: 'agentId',
  balance: 'balance',
  updatedAt: 'updatedAt'
};

exports.Prisma.SimulationRunScalarFieldEnum = {
  id: 'id',
  name: 'name',
  status: 'status',
  seed: 'seed',
  modelVersion: 'modelVersion',
  datasetVersion: 'datasetVersion',
  codeGitSha: 'codeGitSha',
  schemaVersion: 'schemaVersion',
  startedAt: 'startedAt',
  finishedAt: 'finishedAt',
  configJson: 'configJson',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RunVariantScalarFieldEnum = {
  id: 'id',
  runId: 'runId',
  assetSymbol: 'assetSymbol',
  seed: 'seed',
  agents: 'agents',
  steps: 'steps',
  label: 'label',
  createdAt: 'createdAt'
};

exports.Prisma.RunVariantSummaryScalarFieldEnum = {
  id: 'id',
  runVariantId: 'runVariantId',
  corr: 'corr',
  directionalAccuracy: 'directionalAccuracy',
  pairsCount: 'pairsCount',
  computedAt: 'computedAt',
  debugDecisionCounts: 'debugDecisionCounts',
  debugPairsSample: 'debugPairsSample',
  debugDecisionsHash: 'debugDecisionsHash',
  debugReturnsHash: 'debugReturnsHash'
};

exports.Prisma.RunAgentScalarFieldEnum = {
  id: 'id',
  runId: 'runId',
  name: 'name',
  archetype: 'archetype',
  biases: 'biases',
  humanState: 'humanState',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RunAgentTraitScalarFieldEnum = {
  id: 'id',
  agentId: 'agentId',
  key: 'key',
  valueNum: 'valueNum',
  valueStr: 'valueStr',
  createdAt: 'createdAt'
};

exports.Prisma.AgentDecisionScalarFieldEnum = {
  id: 'id',
  runId: 'runId',
  runVariantId: 'runVariantId',
  step: 'step',
  agentId: 'agentId',
  assetSymbol: 'assetSymbol',
  action: 'action',
  confidence: 'confidence',
  rationale: 'rationale',
  createdAt: 'createdAt'
};

exports.Prisma.CrowdMetricsScalarFieldEnum = {
  id: 'id',
  runId: 'runId',
  runVariantId: 'runVariantId',
  assetSymbol: 'assetSymbol',
  step: 'step',
  signal: 'signal',
  weightedSignal: 'weightedSignal',
  consensus: 'consensus',
  polarization: 'polarization',
  uncertainty: 'uncertainty',
  minorityStrength: 'minorityStrength',
  beliefMomentum: 'beliefMomentum',
  diversityIndex: 'diversityIndex',
  independenceIndex: 'independenceIndex',
  herdingIndex: 'herdingIndex',
  wisdomScore: 'wisdomScore',
  noiseSensitivity: 'noiseSensitivity',
  createdAt: 'createdAt'
};

exports.Prisma.AssetStepReturnScalarFieldEnum = {
  id: 'id',
  runId: 'runId',
  assetSymbol: 'assetSymbol',
  step: 'step',
  stepReturn: 'stepReturn',
  createdAt: 'createdAt'
};

exports.Prisma.AgentRewardScalarFieldEnum = {
  id: 'id',
  runId: 'runId',
  runVariantId: 'runVariantId',
  agentId: 'agentId',
  assetSymbol: 'assetSymbol',
  step: 'step',
  action: 'action',
  stepReturn: 'stepReturn',
  pnl: 'pnl',
  regret: 'regret',
  drawdown: 'drawdown',
  rewardScore: 'rewardScore',
  createdAt: 'createdAt'
};

exports.Prisma.InfoEventScalarFieldEnum = {
  id: 'id',
  runId: 'runId',
  assetSymbol: 'assetSymbol',
  step: 'step',
  topic: 'topic',
  sentiment: 'sentiment',
  credibility: 'credibility',
  reach: 'reach',
  volatilityImpact: 'volatilityImpact',
  source: 'source',
  createdAt: 'createdAt'
};

exports.Prisma.AgentInfoStateScalarFieldEnum = {
  id: 'id',
  runId: 'runId',
  runVariantId: 'runVariantId',
  assetSymbol: 'assetSymbol',
  agentId: 'agentId',
  step: 'step',
  exposedCount: 'exposedCount',
  infoSignal: 'infoSignal',
  confidence: 'confidence',
  riskTolerance: 'riskTolerance',
  herding: 'herding',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AgentStateScalarFieldEnum = {
  id: 'id',
  runId: 'runId',
  runVariantId: 'runVariantId',
  assetSymbol: 'assetSymbol',
  agentId: 'agentId',
  step: 'step',
  confidence: 'confidence',
  riskTolerance: 'riskTolerance',
  herding: 'herding',
  infoSignal: 'infoSignal',
  exposedCount: 'exposedCount',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RunTimeSeriesScalarFieldEnum = {
  id: 'id',
  runId: 'runId',
  step: 'step',
  value: 'value',
  createdAt: 'createdAt'
};

exports.Prisma.RunDebugScalarFieldEnum = {
  runId: 'runId',
  prePersistHistogram: 'prePersistHistogram',
  samplePrePersistActions: 'samplePrePersistActions',
  createdAt: 'createdAt'
};

exports.Prisma.AgentExperienceScalarFieldEnum = {
  id: 'id',
  runId: 'runId',
  runVariantId: 'runVariantId',
  runAgentId: 'runAgentId',
  step: 'step',
  ts: 'ts',
  actionJson: 'actionJson',
  signalsJson: 'signalsJson',
  pnl: 'pnl',
  drawdown: 'drawdown',
  reward: 'reward',
  learningMetaJson: 'learningMetaJson',
  stateBeforeJson: 'stateBeforeJson',
  stateAfterJson: 'stateAfterJson'
};

exports.Prisma.CrowdSnapshotScalarFieldEnum = {
  id: 'id',
  runId: 'runId',
  step: 'step',
  ts: 'ts',
  aggregationJson: 'aggregationJson',
  confidence: 'confidence'
};

exports.Prisma.UserProfileScalarFieldEnum = {
  userId: 'userId',
  displayName: 'displayName',
  createdAt: 'createdAt'
};

exports.Prisma.UserWalletScalarFieldEnum = {
  userId: 'userId',
  balance: 'balance',
  updatedAt: 'updatedAt'
};

exports.Prisma.UserWalletTransactionScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  amount: 'amount',
  betId: 'betId',
  runId: 'runId',
  note: 'note',
  createdAt: 'createdAt'
};

exports.Prisma.BetScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  runId: 'runId',
  agentId: 'agentId',
  decisionStep: 'decisionStep',
  assetSymbol: 'assetSymbol',
  direction: 'direction',
  amount: 'amount',
  status: 'status',
  openPrice: 'openPrice',
  openStep: 'openStep',
  closePrice: 'closePrice',
  closeStep: 'closeStep',
  pnl: 'pnl',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ImportRunScalarFieldEnum = {
  id: 'id',
  type: 'type',
  sourceFilename: 'sourceFilename',
  sourceHash: 'sourceHash',
  status: 'status',
  summaryJson: 'summaryJson',
  errorJson: 'errorJson',
  startedAt: 'startedAt',
  finishedAt: 'finishedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PriceSeriesPointScalarFieldEnum = {
  id: 'id',
  symbol: 'symbol',
  date: 'date',
  close: 'close',
  createdAt: 'createdAt'
};

exports.Prisma.BacktestWindowResultScalarFieldEnum = {
  id: 'id',
  symbol: 'symbol',
  runId: 'runId',
  fromDate: 'fromDate',
  toDate: 'toDate',
  window: 'window',
  stride: 'stride',
  agents: 'agents',
  seed: 'seed',
  corr: 'corr',
  hitRate: 'hitRate',
  createdAt: 'createdAt'
};

exports.Prisma.BacktestResultScalarFieldEnum = {
  id: 'id',
  runId: 'runId',
  runVariantId: 'runVariantId',
  assetSymbol: 'assetSymbol',
  seed: 'seed',
  steps: 'steps',
  agents: 'agents',
  pairsCount: 'pairsCount',
  corr: 'corr',
  directionalAccuracy: 'directionalAccuracy',
  createdAt: 'createdAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};
exports.SimulationRunStatus = exports.$Enums.SimulationRunStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

exports.AgentDecisionAction = exports.$Enums.AgentDecisionAction = {
  BUY: 'BUY',
  SELL: 'SELL',
  HOLD: 'HOLD'
};

exports.WalletTransactionType = exports.$Enums.WalletTransactionType = {
  SEED: 'SEED',
  BET_DEBIT: 'BET_DEBIT',
  BET_CREDIT: 'BET_CREDIT',
  ADJUSTMENT: 'ADJUSTMENT'
};

exports.BetDirection = exports.$Enums.BetDirection = {
  BUY: 'BUY',
  SELL: 'SELL'
};

exports.BetStatus = exports.$Enums.BetStatus = {
  OPEN: 'OPEN',
  SETTLED: 'SETTLED',
  CANCELLED: 'CANCELLED'
};

exports.Prisma.ModelName = {
  Archetype: 'Archetype',
  TraitDefinition: 'TraitDefinition',
  ArchetypeTraitProfile: 'ArchetypeTraitProfile',
  Agent: 'Agent',
  AgentWallet: 'AgentWallet',
  SimulationRun: 'SimulationRun',
  RunVariant: 'RunVariant',
  RunVariantSummary: 'RunVariantSummary',
  RunAgent: 'RunAgent',
  RunAgentTrait: 'RunAgentTrait',
  AgentDecision: 'AgentDecision',
  CrowdMetrics: 'CrowdMetrics',
  AssetStepReturn: 'AssetStepReturn',
  AgentReward: 'AgentReward',
  InfoEvent: 'InfoEvent',
  AgentInfoState: 'AgentInfoState',
  AgentState: 'AgentState',
  RunTimeSeries: 'RunTimeSeries',
  RunDebug: 'RunDebug',
  AgentExperience: 'AgentExperience',
  CrowdSnapshot: 'CrowdSnapshot',
  UserProfile: 'UserProfile',
  UserWallet: 'UserWallet',
  UserWalletTransaction: 'UserWalletTransaction',
  Bet: 'Bet',
  ImportRun: 'ImportRun',
  PriceSeriesPoint: 'PriceSeriesPoint',
  BacktestWindowResult: 'BacktestWindowResult',
  BacktestResult: 'BacktestResult'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
