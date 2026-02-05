
/**
 * Client
**/

import * as runtime from './runtime/library.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model Archetype
 * 
 */
export type Archetype = $Result.DefaultSelection<Prisma.$ArchetypePayload>
/**
 * Model TraitDefinition
 * 
 */
export type TraitDefinition = $Result.DefaultSelection<Prisma.$TraitDefinitionPayload>
/**
 * Model ArchetypeTraitProfile
 * 
 */
export type ArchetypeTraitProfile = $Result.DefaultSelection<Prisma.$ArchetypeTraitProfilePayload>
/**
 * Model Agent
 * 
 */
export type Agent = $Result.DefaultSelection<Prisma.$AgentPayload>
/**
 * Model SimulationRun
 * 
 */
export type SimulationRun = $Result.DefaultSelection<Prisma.$SimulationRunPayload>
/**
 * Model RunDebug
 * 
 */
export type RunDebug = $Result.DefaultSelection<Prisma.$RunDebugPayload>
/**
 * Model AgentExperience
 * 
 */
export type AgentExperience = $Result.DefaultSelection<Prisma.$AgentExperiencePayload>
/**
 * Model CrowdSnapshot
 * 
 */
export type CrowdSnapshot = $Result.DefaultSelection<Prisma.$CrowdSnapshotPayload>
/**
 * Model UserProfile
 * 
 */
export type UserProfile = $Result.DefaultSelection<Prisma.$UserProfilePayload>
/**
 * Model UserWallet
 * 
 */
export type UserWallet = $Result.DefaultSelection<Prisma.$UserWalletPayload>
/**
 * Model Bet
 * 
 */
export type Bet = $Result.DefaultSelection<Prisma.$BetPayload>
/**
 * Model ImportRun
 * 
 */
export type ImportRun = $Result.DefaultSelection<Prisma.$ImportRunPayload>

/**
 * Enums
 */
export namespace $Enums {
  export const SimulationRunStatus: {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

export type SimulationRunStatus = (typeof SimulationRunStatus)[keyof typeof SimulationRunStatus]


export const BetDirection: {
  BUY: 'BUY',
  SELL: 'SELL',
  HOLD: 'HOLD'
};

export type BetDirection = (typeof BetDirection)[keyof typeof BetDirection]

}

export type SimulationRunStatus = $Enums.SimulationRunStatus

export const SimulationRunStatus: typeof $Enums.SimulationRunStatus

export type BetDirection = $Enums.BetDirection

export const BetDirection: typeof $Enums.BetDirection

/**
 * ##  Prisma Client ʲˢ
 * 
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient()
 * // Fetch zero or more Archetypes
 * const archetypes = await prisma.archetype.findMany()
 * ```
 *
 * 
 * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   * 
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient()
   * // Fetch zero or more Archetypes
   * const archetypes = await prisma.archetype.findMany()
   * ```
   *
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): void;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

  /**
   * Add a middleware
   * @deprecated since 4.16.0. For new code, prefer client extensions instead.
   * @see https://pris.ly/d/extensions
   */
  $use(cb: Prisma.Middleware): void

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/raw-database-access).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>


  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb, ExtArgs>

      /**
   * `prisma.archetype`: Exposes CRUD operations for the **Archetype** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Archetypes
    * const archetypes = await prisma.archetype.findMany()
    * ```
    */
  get archetype(): Prisma.ArchetypeDelegate<ExtArgs>;

  /**
   * `prisma.traitDefinition`: Exposes CRUD operations for the **TraitDefinition** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more TraitDefinitions
    * const traitDefinitions = await prisma.traitDefinition.findMany()
    * ```
    */
  get traitDefinition(): Prisma.TraitDefinitionDelegate<ExtArgs>;

  /**
   * `prisma.archetypeTraitProfile`: Exposes CRUD operations for the **ArchetypeTraitProfile** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ArchetypeTraitProfiles
    * const archetypeTraitProfiles = await prisma.archetypeTraitProfile.findMany()
    * ```
    */
  get archetypeTraitProfile(): Prisma.ArchetypeTraitProfileDelegate<ExtArgs>;

  /**
   * `prisma.agent`: Exposes CRUD operations for the **Agent** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Agents
    * const agents = await prisma.agent.findMany()
    * ```
    */
  get agent(): Prisma.AgentDelegate<ExtArgs>;

  /**
   * `prisma.simulationRun`: Exposes CRUD operations for the **SimulationRun** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more SimulationRuns
    * const simulationRuns = await prisma.simulationRun.findMany()
    * ```
    */
  get simulationRun(): Prisma.SimulationRunDelegate<ExtArgs>;

  /**
   * `prisma.runDebug`: Exposes CRUD operations for the **RunDebug** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more RunDebugs
    * const runDebugs = await prisma.runDebug.findMany()
    * ```
    */
  get runDebug(): Prisma.RunDebugDelegate<ExtArgs>;

  /**
   * `prisma.agentExperience`: Exposes CRUD operations for the **AgentExperience** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more AgentExperiences
    * const agentExperiences = await prisma.agentExperience.findMany()
    * ```
    */
  get agentExperience(): Prisma.AgentExperienceDelegate<ExtArgs>;

  /**
   * `prisma.crowdSnapshot`: Exposes CRUD operations for the **CrowdSnapshot** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more CrowdSnapshots
    * const crowdSnapshots = await prisma.crowdSnapshot.findMany()
    * ```
    */
  get crowdSnapshot(): Prisma.CrowdSnapshotDelegate<ExtArgs>;

  /**
   * `prisma.userProfile`: Exposes CRUD operations for the **UserProfile** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more UserProfiles
    * const userProfiles = await prisma.userProfile.findMany()
    * ```
    */
  get userProfile(): Prisma.UserProfileDelegate<ExtArgs>;

  /**
   * `prisma.userWallet`: Exposes CRUD operations for the **UserWallet** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more UserWallets
    * const userWallets = await prisma.userWallet.findMany()
    * ```
    */
  get userWallet(): Prisma.UserWalletDelegate<ExtArgs>;

  /**
   * `prisma.bet`: Exposes CRUD operations for the **Bet** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Bets
    * const bets = await prisma.bet.findMany()
    * ```
    */
  get bet(): Prisma.BetDelegate<ExtArgs>;

  /**
   * `prisma.importRun`: Exposes CRUD operations for the **ImportRun** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ImportRuns
    * const importRuns = await prisma.importRun.findMany()
    * ```
    */
  get importRun(): Prisma.ImportRunDelegate<ExtArgs>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError
  export import NotFoundError = runtime.NotFoundError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
   * Metrics 
   */
  export type Metrics = runtime.Metrics
  export type Metric<T> = runtime.Metric<T>
  export type MetricHistogram = runtime.MetricHistogram
  export type MetricHistogramBucket = runtime.MetricHistogramBucket

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 5.22.0
   * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
   */
  export type PrismaVersion = {
    client: string
  }

  export const prismaVersion: PrismaVersion 

  /**
   * Utility Types
   */


  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    * 
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    * 
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   * 
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? K : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Archetype: 'Archetype',
    TraitDefinition: 'TraitDefinition',
    ArchetypeTraitProfile: 'ArchetypeTraitProfile',
    Agent: 'Agent',
    SimulationRun: 'SimulationRun',
    RunDebug: 'RunDebug',
    AgentExperience: 'AgentExperience',
    CrowdSnapshot: 'CrowdSnapshot',
    UserProfile: 'UserProfile',
    UserWallet: 'UserWallet',
    Bet: 'Bet',
    ImportRun: 'ImportRun'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]


  export type Datasources = {
    db?: Datasource
  }

  interface TypeMapCb extends $Utils.Fn<{extArgs: $Extensions.InternalArgs, clientOptions: PrismaClientOptions }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], this['params']['clientOptions']>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, ClientOptions = {}> = {
    meta: {
      modelProps: "archetype" | "traitDefinition" | "archetypeTraitProfile" | "agent" | "simulationRun" | "runDebug" | "agentExperience" | "crowdSnapshot" | "userProfile" | "userWallet" | "bet" | "importRun"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      Archetype: {
        payload: Prisma.$ArchetypePayload<ExtArgs>
        fields: Prisma.ArchetypeFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ArchetypeFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ArchetypeFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypePayload>
          }
          findFirst: {
            args: Prisma.ArchetypeFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ArchetypeFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypePayload>
          }
          findMany: {
            args: Prisma.ArchetypeFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypePayload>[]
          }
          create: {
            args: Prisma.ArchetypeCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypePayload>
          }
          createMany: {
            args: Prisma.ArchetypeCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ArchetypeCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypePayload>[]
          }
          delete: {
            args: Prisma.ArchetypeDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypePayload>
          }
          update: {
            args: Prisma.ArchetypeUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypePayload>
          }
          deleteMany: {
            args: Prisma.ArchetypeDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ArchetypeUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.ArchetypeUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypePayload>
          }
          aggregate: {
            args: Prisma.ArchetypeAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateArchetype>
          }
          groupBy: {
            args: Prisma.ArchetypeGroupByArgs<ExtArgs>
            result: $Utils.Optional<ArchetypeGroupByOutputType>[]
          }
          count: {
            args: Prisma.ArchetypeCountArgs<ExtArgs>
            result: $Utils.Optional<ArchetypeCountAggregateOutputType> | number
          }
        }
      }
      TraitDefinition: {
        payload: Prisma.$TraitDefinitionPayload<ExtArgs>
        fields: Prisma.TraitDefinitionFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TraitDefinitionFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TraitDefinitionPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TraitDefinitionFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TraitDefinitionPayload>
          }
          findFirst: {
            args: Prisma.TraitDefinitionFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TraitDefinitionPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TraitDefinitionFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TraitDefinitionPayload>
          }
          findMany: {
            args: Prisma.TraitDefinitionFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TraitDefinitionPayload>[]
          }
          create: {
            args: Prisma.TraitDefinitionCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TraitDefinitionPayload>
          }
          createMany: {
            args: Prisma.TraitDefinitionCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TraitDefinitionCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TraitDefinitionPayload>[]
          }
          delete: {
            args: Prisma.TraitDefinitionDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TraitDefinitionPayload>
          }
          update: {
            args: Prisma.TraitDefinitionUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TraitDefinitionPayload>
          }
          deleteMany: {
            args: Prisma.TraitDefinitionDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TraitDefinitionUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.TraitDefinitionUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TraitDefinitionPayload>
          }
          aggregate: {
            args: Prisma.TraitDefinitionAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTraitDefinition>
          }
          groupBy: {
            args: Prisma.TraitDefinitionGroupByArgs<ExtArgs>
            result: $Utils.Optional<TraitDefinitionGroupByOutputType>[]
          }
          count: {
            args: Prisma.TraitDefinitionCountArgs<ExtArgs>
            result: $Utils.Optional<TraitDefinitionCountAggregateOutputType> | number
          }
        }
      }
      ArchetypeTraitProfile: {
        payload: Prisma.$ArchetypeTraitProfilePayload<ExtArgs>
        fields: Prisma.ArchetypeTraitProfileFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ArchetypeTraitProfileFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypeTraitProfilePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ArchetypeTraitProfileFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypeTraitProfilePayload>
          }
          findFirst: {
            args: Prisma.ArchetypeTraitProfileFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypeTraitProfilePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ArchetypeTraitProfileFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypeTraitProfilePayload>
          }
          findMany: {
            args: Prisma.ArchetypeTraitProfileFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypeTraitProfilePayload>[]
          }
          create: {
            args: Prisma.ArchetypeTraitProfileCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypeTraitProfilePayload>
          }
          createMany: {
            args: Prisma.ArchetypeTraitProfileCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ArchetypeTraitProfileCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypeTraitProfilePayload>[]
          }
          delete: {
            args: Prisma.ArchetypeTraitProfileDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypeTraitProfilePayload>
          }
          update: {
            args: Prisma.ArchetypeTraitProfileUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypeTraitProfilePayload>
          }
          deleteMany: {
            args: Prisma.ArchetypeTraitProfileDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ArchetypeTraitProfileUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.ArchetypeTraitProfileUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ArchetypeTraitProfilePayload>
          }
          aggregate: {
            args: Prisma.ArchetypeTraitProfileAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateArchetypeTraitProfile>
          }
          groupBy: {
            args: Prisma.ArchetypeTraitProfileGroupByArgs<ExtArgs>
            result: $Utils.Optional<ArchetypeTraitProfileGroupByOutputType>[]
          }
          count: {
            args: Prisma.ArchetypeTraitProfileCountArgs<ExtArgs>
            result: $Utils.Optional<ArchetypeTraitProfileCountAggregateOutputType> | number
          }
        }
      }
      Agent: {
        payload: Prisma.$AgentPayload<ExtArgs>
        fields: Prisma.AgentFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AgentFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AgentFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentPayload>
          }
          findFirst: {
            args: Prisma.AgentFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AgentFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentPayload>
          }
          findMany: {
            args: Prisma.AgentFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentPayload>[]
          }
          create: {
            args: Prisma.AgentCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentPayload>
          }
          createMany: {
            args: Prisma.AgentCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AgentCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentPayload>[]
          }
          delete: {
            args: Prisma.AgentDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentPayload>
          }
          update: {
            args: Prisma.AgentUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentPayload>
          }
          deleteMany: {
            args: Prisma.AgentDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AgentUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.AgentUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentPayload>
          }
          aggregate: {
            args: Prisma.AgentAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAgent>
          }
          groupBy: {
            args: Prisma.AgentGroupByArgs<ExtArgs>
            result: $Utils.Optional<AgentGroupByOutputType>[]
          }
          count: {
            args: Prisma.AgentCountArgs<ExtArgs>
            result: $Utils.Optional<AgentCountAggregateOutputType> | number
          }
        }
      }
      SimulationRun: {
        payload: Prisma.$SimulationRunPayload<ExtArgs>
        fields: Prisma.SimulationRunFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SimulationRunFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SimulationRunPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SimulationRunFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SimulationRunPayload>
          }
          findFirst: {
            args: Prisma.SimulationRunFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SimulationRunPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SimulationRunFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SimulationRunPayload>
          }
          findMany: {
            args: Prisma.SimulationRunFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SimulationRunPayload>[]
          }
          create: {
            args: Prisma.SimulationRunCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SimulationRunPayload>
          }
          createMany: {
            args: Prisma.SimulationRunCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SimulationRunCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SimulationRunPayload>[]
          }
          delete: {
            args: Prisma.SimulationRunDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SimulationRunPayload>
          }
          update: {
            args: Prisma.SimulationRunUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SimulationRunPayload>
          }
          deleteMany: {
            args: Prisma.SimulationRunDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SimulationRunUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.SimulationRunUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SimulationRunPayload>
          }
          aggregate: {
            args: Prisma.SimulationRunAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSimulationRun>
          }
          groupBy: {
            args: Prisma.SimulationRunGroupByArgs<ExtArgs>
            result: $Utils.Optional<SimulationRunGroupByOutputType>[]
          }
          count: {
            args: Prisma.SimulationRunCountArgs<ExtArgs>
            result: $Utils.Optional<SimulationRunCountAggregateOutputType> | number
          }
        }
      }
      RunDebug: {
        payload: Prisma.$RunDebugPayload<ExtArgs>
        fields: Prisma.RunDebugFieldRefs
        operations: {
          findUnique: {
            args: Prisma.RunDebugFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RunDebugPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.RunDebugFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RunDebugPayload>
          }
          findFirst: {
            args: Prisma.RunDebugFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RunDebugPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.RunDebugFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RunDebugPayload>
          }
          findMany: {
            args: Prisma.RunDebugFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RunDebugPayload>[]
          }
          create: {
            args: Prisma.RunDebugCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RunDebugPayload>
          }
          createMany: {
            args: Prisma.RunDebugCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.RunDebugCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RunDebugPayload>[]
          }
          delete: {
            args: Prisma.RunDebugDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RunDebugPayload>
          }
          update: {
            args: Prisma.RunDebugUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RunDebugPayload>
          }
          deleteMany: {
            args: Prisma.RunDebugDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.RunDebugUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.RunDebugUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$RunDebugPayload>
          }
          aggregate: {
            args: Prisma.RunDebugAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateRunDebug>
          }
          groupBy: {
            args: Prisma.RunDebugGroupByArgs<ExtArgs>
            result: $Utils.Optional<RunDebugGroupByOutputType>[]
          }
          count: {
            args: Prisma.RunDebugCountArgs<ExtArgs>
            result: $Utils.Optional<RunDebugCountAggregateOutputType> | number
          }
        }
      }
      AgentExperience: {
        payload: Prisma.$AgentExperiencePayload<ExtArgs>
        fields: Prisma.AgentExperienceFieldRefs
        operations: {
          findUnique: {
            args: Prisma.AgentExperienceFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentExperiencePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.AgentExperienceFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentExperiencePayload>
          }
          findFirst: {
            args: Prisma.AgentExperienceFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentExperiencePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.AgentExperienceFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentExperiencePayload>
          }
          findMany: {
            args: Prisma.AgentExperienceFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentExperiencePayload>[]
          }
          create: {
            args: Prisma.AgentExperienceCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentExperiencePayload>
          }
          createMany: {
            args: Prisma.AgentExperienceCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.AgentExperienceCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentExperiencePayload>[]
          }
          delete: {
            args: Prisma.AgentExperienceDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentExperiencePayload>
          }
          update: {
            args: Prisma.AgentExperienceUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentExperiencePayload>
          }
          deleteMany: {
            args: Prisma.AgentExperienceDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.AgentExperienceUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.AgentExperienceUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$AgentExperiencePayload>
          }
          aggregate: {
            args: Prisma.AgentExperienceAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateAgentExperience>
          }
          groupBy: {
            args: Prisma.AgentExperienceGroupByArgs<ExtArgs>
            result: $Utils.Optional<AgentExperienceGroupByOutputType>[]
          }
          count: {
            args: Prisma.AgentExperienceCountArgs<ExtArgs>
            result: $Utils.Optional<AgentExperienceCountAggregateOutputType> | number
          }
        }
      }
      CrowdSnapshot: {
        payload: Prisma.$CrowdSnapshotPayload<ExtArgs>
        fields: Prisma.CrowdSnapshotFieldRefs
        operations: {
          findUnique: {
            args: Prisma.CrowdSnapshotFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CrowdSnapshotPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.CrowdSnapshotFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CrowdSnapshotPayload>
          }
          findFirst: {
            args: Prisma.CrowdSnapshotFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CrowdSnapshotPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.CrowdSnapshotFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CrowdSnapshotPayload>
          }
          findMany: {
            args: Prisma.CrowdSnapshotFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CrowdSnapshotPayload>[]
          }
          create: {
            args: Prisma.CrowdSnapshotCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CrowdSnapshotPayload>
          }
          createMany: {
            args: Prisma.CrowdSnapshotCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.CrowdSnapshotCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CrowdSnapshotPayload>[]
          }
          delete: {
            args: Prisma.CrowdSnapshotDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CrowdSnapshotPayload>
          }
          update: {
            args: Prisma.CrowdSnapshotUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CrowdSnapshotPayload>
          }
          deleteMany: {
            args: Prisma.CrowdSnapshotDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.CrowdSnapshotUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.CrowdSnapshotUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$CrowdSnapshotPayload>
          }
          aggregate: {
            args: Prisma.CrowdSnapshotAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateCrowdSnapshot>
          }
          groupBy: {
            args: Prisma.CrowdSnapshotGroupByArgs<ExtArgs>
            result: $Utils.Optional<CrowdSnapshotGroupByOutputType>[]
          }
          count: {
            args: Prisma.CrowdSnapshotCountArgs<ExtArgs>
            result: $Utils.Optional<CrowdSnapshotCountAggregateOutputType> | number
          }
        }
      }
      UserProfile: {
        payload: Prisma.$UserProfilePayload<ExtArgs>
        fields: Prisma.UserProfileFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserProfileFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserProfilePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserProfileFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserProfilePayload>
          }
          findFirst: {
            args: Prisma.UserProfileFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserProfilePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserProfileFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserProfilePayload>
          }
          findMany: {
            args: Prisma.UserProfileFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserProfilePayload>[]
          }
          create: {
            args: Prisma.UserProfileCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserProfilePayload>
          }
          createMany: {
            args: Prisma.UserProfileCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserProfileCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserProfilePayload>[]
          }
          delete: {
            args: Prisma.UserProfileDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserProfilePayload>
          }
          update: {
            args: Prisma.UserProfileUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserProfilePayload>
          }
          deleteMany: {
            args: Prisma.UserProfileDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserProfileUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.UserProfileUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserProfilePayload>
          }
          aggregate: {
            args: Prisma.UserProfileAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUserProfile>
          }
          groupBy: {
            args: Prisma.UserProfileGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserProfileGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserProfileCountArgs<ExtArgs>
            result: $Utils.Optional<UserProfileCountAggregateOutputType> | number
          }
        }
      }
      UserWallet: {
        payload: Prisma.$UserWalletPayload<ExtArgs>
        fields: Prisma.UserWalletFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserWalletFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserWalletPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserWalletFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserWalletPayload>
          }
          findFirst: {
            args: Prisma.UserWalletFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserWalletPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserWalletFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserWalletPayload>
          }
          findMany: {
            args: Prisma.UserWalletFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserWalletPayload>[]
          }
          create: {
            args: Prisma.UserWalletCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserWalletPayload>
          }
          createMany: {
            args: Prisma.UserWalletCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserWalletCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserWalletPayload>[]
          }
          delete: {
            args: Prisma.UserWalletDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserWalletPayload>
          }
          update: {
            args: Prisma.UserWalletUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserWalletPayload>
          }
          deleteMany: {
            args: Prisma.UserWalletDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserWalletUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.UserWalletUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserWalletPayload>
          }
          aggregate: {
            args: Prisma.UserWalletAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUserWallet>
          }
          groupBy: {
            args: Prisma.UserWalletGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserWalletGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserWalletCountArgs<ExtArgs>
            result: $Utils.Optional<UserWalletCountAggregateOutputType> | number
          }
        }
      }
      Bet: {
        payload: Prisma.$BetPayload<ExtArgs>
        fields: Prisma.BetFieldRefs
        operations: {
          findUnique: {
            args: Prisma.BetFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BetPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.BetFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BetPayload>
          }
          findFirst: {
            args: Prisma.BetFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BetPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.BetFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BetPayload>
          }
          findMany: {
            args: Prisma.BetFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BetPayload>[]
          }
          create: {
            args: Prisma.BetCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BetPayload>
          }
          createMany: {
            args: Prisma.BetCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.BetCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BetPayload>[]
          }
          delete: {
            args: Prisma.BetDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BetPayload>
          }
          update: {
            args: Prisma.BetUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BetPayload>
          }
          deleteMany: {
            args: Prisma.BetDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.BetUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.BetUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$BetPayload>
          }
          aggregate: {
            args: Prisma.BetAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateBet>
          }
          groupBy: {
            args: Prisma.BetGroupByArgs<ExtArgs>
            result: $Utils.Optional<BetGroupByOutputType>[]
          }
          count: {
            args: Prisma.BetCountArgs<ExtArgs>
            result: $Utils.Optional<BetCountAggregateOutputType> | number
          }
        }
      }
      ImportRun: {
        payload: Prisma.$ImportRunPayload<ExtArgs>
        fields: Prisma.ImportRunFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ImportRunFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ImportRunPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ImportRunFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ImportRunPayload>
          }
          findFirst: {
            args: Prisma.ImportRunFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ImportRunPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ImportRunFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ImportRunPayload>
          }
          findMany: {
            args: Prisma.ImportRunFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ImportRunPayload>[]
          }
          create: {
            args: Prisma.ImportRunCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ImportRunPayload>
          }
          createMany: {
            args: Prisma.ImportRunCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ImportRunCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ImportRunPayload>[]
          }
          delete: {
            args: Prisma.ImportRunDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ImportRunPayload>
          }
          update: {
            args: Prisma.ImportRunUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ImportRunPayload>
          }
          deleteMany: {
            args: Prisma.ImportRunDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ImportRunUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          upsert: {
            args: Prisma.ImportRunUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ImportRunPayload>
          }
          aggregate: {
            args: Prisma.ImportRunAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateImportRun>
          }
          groupBy: {
            args: Prisma.ImportRunGroupByArgs<ExtArgs>
            result: $Utils.Optional<ImportRunGroupByOutputType>[]
          }
          count: {
            args: Prisma.ImportRunCountArgs<ExtArgs>
            result: $Utils.Optional<ImportRunCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasources?: Datasources
    /**
     * Overwrites the datasource url from your schema.prisma file
     */
    datasourceUrl?: string
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Defaults to stdout
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events
     * log: [
     *   { emit: 'stdout', level: 'query' },
     *   { emit: 'stdout', level: 'info' },
     *   { emit: 'stdout', level: 'warn' }
     *   { emit: 'stdout', level: 'error' }
     * ]
     * ```
     * Read more in our [docs](https://www.prisma.io/docs/reference/tools-and-interfaces/prisma-client/logging#the-log-option).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
  }


  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type GetLogType<T extends LogLevel | LogDefinition> = T extends LogDefinition ? T['emit'] extends 'event' ? T['level'] : never : never
  export type GetEvents<T extends any> = T extends Array<LogLevel | LogDefinition> ?
    GetLogType<T[0]> | GetLogType<T[1]> | GetLogType<T[2]> | GetLogType<T[3]>
    : never

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  /**
   * These options are being passed into the middleware as "params"
   */
  export type MiddlewareParams = {
    model?: ModelName
    action: PrismaAction
    args: any
    dataPath: string[]
    runInTransaction: boolean
  }

  /**
   * The `T` type makes sure, that the `return proceed` is not forgotten in the middleware implementation
   */
  export type Middleware<T = any> = (
    params: MiddlewareParams,
    next: (params: MiddlewareParams) => $Utils.JsPromise<T>,
  ) => $Utils.JsPromise<T>

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type ArchetypeCountOutputType
   */

  export type ArchetypeCountOutputType = {
    traitProfiles: number
    agents: number
  }

  export type ArchetypeCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    traitProfiles?: boolean | ArchetypeCountOutputTypeCountTraitProfilesArgs
    agents?: boolean | ArchetypeCountOutputTypeCountAgentsArgs
  }

  // Custom InputTypes
  /**
   * ArchetypeCountOutputType without action
   */
  export type ArchetypeCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ArchetypeCountOutputType
     */
    select?: ArchetypeCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * ArchetypeCountOutputType without action
   */
  export type ArchetypeCountOutputTypeCountTraitProfilesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ArchetypeTraitProfileWhereInput
  }

  /**
   * ArchetypeCountOutputType without action
   */
  export type ArchetypeCountOutputTypeCountAgentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AgentWhereInput
  }


  /**
   * Count Type TraitDefinitionCountOutputType
   */

  export type TraitDefinitionCountOutputType = {
    archetypeProfiles: number
  }

  export type TraitDefinitionCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    archetypeProfiles?: boolean | TraitDefinitionCountOutputTypeCountArchetypeProfilesArgs
  }

  // Custom InputTypes
  /**
   * TraitDefinitionCountOutputType without action
   */
  export type TraitDefinitionCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TraitDefinitionCountOutputType
     */
    select?: TraitDefinitionCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * TraitDefinitionCountOutputType without action
   */
  export type TraitDefinitionCountOutputTypeCountArchetypeProfilesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ArchetypeTraitProfileWhereInput
  }


  /**
   * Count Type AgentCountOutputType
   */

  export type AgentCountOutputType = {
    experiences: number
  }

  export type AgentCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    experiences?: boolean | AgentCountOutputTypeCountExperiencesArgs
  }

  // Custom InputTypes
  /**
   * AgentCountOutputType without action
   */
  export type AgentCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgentCountOutputType
     */
    select?: AgentCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * AgentCountOutputType without action
   */
  export type AgentCountOutputTypeCountExperiencesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AgentExperienceWhereInput
  }


  /**
   * Count Type SimulationRunCountOutputType
   */

  export type SimulationRunCountOutputType = {
    agentExperiences: number
    crowdSnapshots: number
    bets: number
  }

  export type SimulationRunCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    agentExperiences?: boolean | SimulationRunCountOutputTypeCountAgentExperiencesArgs
    crowdSnapshots?: boolean | SimulationRunCountOutputTypeCountCrowdSnapshotsArgs
    bets?: boolean | SimulationRunCountOutputTypeCountBetsArgs
  }

  // Custom InputTypes
  /**
   * SimulationRunCountOutputType without action
   */
  export type SimulationRunCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SimulationRunCountOutputType
     */
    select?: SimulationRunCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * SimulationRunCountOutputType without action
   */
  export type SimulationRunCountOutputTypeCountAgentExperiencesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AgentExperienceWhereInput
  }

  /**
   * SimulationRunCountOutputType without action
   */
  export type SimulationRunCountOutputTypeCountCrowdSnapshotsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CrowdSnapshotWhereInput
  }

  /**
   * SimulationRunCountOutputType without action
   */
  export type SimulationRunCountOutputTypeCountBetsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: BetWhereInput
  }


  /**
   * Models
   */

  /**
   * Model Archetype
   */

  export type AggregateArchetype = {
    _count: ArchetypeCountAggregateOutputType | null
    _min: ArchetypeMinAggregateOutputType | null
    _max: ArchetypeMaxAggregateOutputType | null
  }

  export type ArchetypeMinAggregateOutputType = {
    id: string | null
    name: string | null
    description: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ArchetypeMaxAggregateOutputType = {
    id: string | null
    name: string | null
    description: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ArchetypeCountAggregateOutputType = {
    id: number
    name: number
    description: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ArchetypeMinAggregateInputType = {
    id?: true
    name?: true
    description?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ArchetypeMaxAggregateInputType = {
    id?: true
    name?: true
    description?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ArchetypeCountAggregateInputType = {
    id?: true
    name?: true
    description?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ArchetypeAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Archetype to aggregate.
     */
    where?: ArchetypeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Archetypes to fetch.
     */
    orderBy?: ArchetypeOrderByWithRelationInput | ArchetypeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ArchetypeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Archetypes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Archetypes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Archetypes
    **/
    _count?: true | ArchetypeCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ArchetypeMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ArchetypeMaxAggregateInputType
  }

  export type GetArchetypeAggregateType<T extends ArchetypeAggregateArgs> = {
        [P in keyof T & keyof AggregateArchetype]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateArchetype[P]>
      : GetScalarType<T[P], AggregateArchetype[P]>
  }




  export type ArchetypeGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ArchetypeWhereInput
    orderBy?: ArchetypeOrderByWithAggregationInput | ArchetypeOrderByWithAggregationInput[]
    by: ArchetypeScalarFieldEnum[] | ArchetypeScalarFieldEnum
    having?: ArchetypeScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ArchetypeCountAggregateInputType | true
    _min?: ArchetypeMinAggregateInputType
    _max?: ArchetypeMaxAggregateInputType
  }

  export type ArchetypeGroupByOutputType = {
    id: string
    name: string
    description: string | null
    createdAt: Date
    updatedAt: Date
    _count: ArchetypeCountAggregateOutputType | null
    _min: ArchetypeMinAggregateOutputType | null
    _max: ArchetypeMaxAggregateOutputType | null
  }

  type GetArchetypeGroupByPayload<T extends ArchetypeGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ArchetypeGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ArchetypeGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ArchetypeGroupByOutputType[P]>
            : GetScalarType<T[P], ArchetypeGroupByOutputType[P]>
        }
      >
    >


  export type ArchetypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    description?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    traitProfiles?: boolean | Archetype$traitProfilesArgs<ExtArgs>
    agents?: boolean | Archetype$agentsArgs<ExtArgs>
    _count?: boolean | ArchetypeCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["archetype"]>

  export type ArchetypeSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    description?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["archetype"]>

  export type ArchetypeSelectScalar = {
    id?: boolean
    name?: boolean
    description?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ArchetypeInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    traitProfiles?: boolean | Archetype$traitProfilesArgs<ExtArgs>
    agents?: boolean | Archetype$agentsArgs<ExtArgs>
    _count?: boolean | ArchetypeCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type ArchetypeIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $ArchetypePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Archetype"
    objects: {
      traitProfiles: Prisma.$ArchetypeTraitProfilePayload<ExtArgs>[]
      agents: Prisma.$AgentPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      description: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["archetype"]>
    composites: {}
  }

  type ArchetypeGetPayload<S extends boolean | null | undefined | ArchetypeDefaultArgs> = $Result.GetResult<Prisma.$ArchetypePayload, S>

  type ArchetypeCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ArchetypeFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ArchetypeCountAggregateInputType | true
    }

  export interface ArchetypeDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Archetype'], meta: { name: 'Archetype' } }
    /**
     * Find zero or one Archetype that matches the filter.
     * @param {ArchetypeFindUniqueArgs} args - Arguments to find a Archetype
     * @example
     * // Get one Archetype
     * const archetype = await prisma.archetype.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ArchetypeFindUniqueArgs>(args: SelectSubset<T, ArchetypeFindUniqueArgs<ExtArgs>>): Prisma__ArchetypeClient<$Result.GetResult<Prisma.$ArchetypePayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one Archetype that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {ArchetypeFindUniqueOrThrowArgs} args - Arguments to find a Archetype
     * @example
     * // Get one Archetype
     * const archetype = await prisma.archetype.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ArchetypeFindUniqueOrThrowArgs>(args: SelectSubset<T, ArchetypeFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ArchetypeClient<$Result.GetResult<Prisma.$ArchetypePayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first Archetype that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ArchetypeFindFirstArgs} args - Arguments to find a Archetype
     * @example
     * // Get one Archetype
     * const archetype = await prisma.archetype.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ArchetypeFindFirstArgs>(args?: SelectSubset<T, ArchetypeFindFirstArgs<ExtArgs>>): Prisma__ArchetypeClient<$Result.GetResult<Prisma.$ArchetypePayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first Archetype that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ArchetypeFindFirstOrThrowArgs} args - Arguments to find a Archetype
     * @example
     * // Get one Archetype
     * const archetype = await prisma.archetype.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ArchetypeFindFirstOrThrowArgs>(args?: SelectSubset<T, ArchetypeFindFirstOrThrowArgs<ExtArgs>>): Prisma__ArchetypeClient<$Result.GetResult<Prisma.$ArchetypePayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Archetypes that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ArchetypeFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Archetypes
     * const archetypes = await prisma.archetype.findMany()
     * 
     * // Get first 10 Archetypes
     * const archetypes = await prisma.archetype.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const archetypeWithIdOnly = await prisma.archetype.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ArchetypeFindManyArgs>(args?: SelectSubset<T, ArchetypeFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ArchetypePayload<ExtArgs>, T, "findMany">>

    /**
     * Create a Archetype.
     * @param {ArchetypeCreateArgs} args - Arguments to create a Archetype.
     * @example
     * // Create one Archetype
     * const Archetype = await prisma.archetype.create({
     *   data: {
     *     // ... data to create a Archetype
     *   }
     * })
     * 
     */
    create<T extends ArchetypeCreateArgs>(args: SelectSubset<T, ArchetypeCreateArgs<ExtArgs>>): Prisma__ArchetypeClient<$Result.GetResult<Prisma.$ArchetypePayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Archetypes.
     * @param {ArchetypeCreateManyArgs} args - Arguments to create many Archetypes.
     * @example
     * // Create many Archetypes
     * const archetype = await prisma.archetype.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ArchetypeCreateManyArgs>(args?: SelectSubset<T, ArchetypeCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Archetypes and returns the data saved in the database.
     * @param {ArchetypeCreateManyAndReturnArgs} args - Arguments to create many Archetypes.
     * @example
     * // Create many Archetypes
     * const archetype = await prisma.archetype.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Archetypes and only return the `id`
     * const archetypeWithIdOnly = await prisma.archetype.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ArchetypeCreateManyAndReturnArgs>(args?: SelectSubset<T, ArchetypeCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ArchetypePayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a Archetype.
     * @param {ArchetypeDeleteArgs} args - Arguments to delete one Archetype.
     * @example
     * // Delete one Archetype
     * const Archetype = await prisma.archetype.delete({
     *   where: {
     *     // ... filter to delete one Archetype
     *   }
     * })
     * 
     */
    delete<T extends ArchetypeDeleteArgs>(args: SelectSubset<T, ArchetypeDeleteArgs<ExtArgs>>): Prisma__ArchetypeClient<$Result.GetResult<Prisma.$ArchetypePayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one Archetype.
     * @param {ArchetypeUpdateArgs} args - Arguments to update one Archetype.
     * @example
     * // Update one Archetype
     * const archetype = await prisma.archetype.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ArchetypeUpdateArgs>(args: SelectSubset<T, ArchetypeUpdateArgs<ExtArgs>>): Prisma__ArchetypeClient<$Result.GetResult<Prisma.$ArchetypePayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Archetypes.
     * @param {ArchetypeDeleteManyArgs} args - Arguments to filter Archetypes to delete.
     * @example
     * // Delete a few Archetypes
     * const { count } = await prisma.archetype.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ArchetypeDeleteManyArgs>(args?: SelectSubset<T, ArchetypeDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Archetypes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ArchetypeUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Archetypes
     * const archetype = await prisma.archetype.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ArchetypeUpdateManyArgs>(args: SelectSubset<T, ArchetypeUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Archetype.
     * @param {ArchetypeUpsertArgs} args - Arguments to update or create a Archetype.
     * @example
     * // Update or create a Archetype
     * const archetype = await prisma.archetype.upsert({
     *   create: {
     *     // ... data to create a Archetype
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Archetype we want to update
     *   }
     * })
     */
    upsert<T extends ArchetypeUpsertArgs>(args: SelectSubset<T, ArchetypeUpsertArgs<ExtArgs>>): Prisma__ArchetypeClient<$Result.GetResult<Prisma.$ArchetypePayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Archetypes.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ArchetypeCountArgs} args - Arguments to filter Archetypes to count.
     * @example
     * // Count the number of Archetypes
     * const count = await prisma.archetype.count({
     *   where: {
     *     // ... the filter for the Archetypes we want to count
     *   }
     * })
    **/
    count<T extends ArchetypeCountArgs>(
      args?: Subset<T, ArchetypeCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ArchetypeCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Archetype.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ArchetypeAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ArchetypeAggregateArgs>(args: Subset<T, ArchetypeAggregateArgs>): Prisma.PrismaPromise<GetArchetypeAggregateType<T>>

    /**
     * Group by Archetype.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ArchetypeGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ArchetypeGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ArchetypeGroupByArgs['orderBy'] }
        : { orderBy?: ArchetypeGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ArchetypeGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetArchetypeGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Archetype model
   */
  readonly fields: ArchetypeFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Archetype.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ArchetypeClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    traitProfiles<T extends Archetype$traitProfilesArgs<ExtArgs> = {}>(args?: Subset<T, Archetype$traitProfilesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ArchetypeTraitProfilePayload<ExtArgs>, T, "findMany"> | Null>
    agents<T extends Archetype$agentsArgs<ExtArgs> = {}>(args?: Subset<T, Archetype$agentsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AgentPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Archetype model
   */ 
  interface ArchetypeFieldRefs {
    readonly id: FieldRef<"Archetype", 'String'>
    readonly name: FieldRef<"Archetype", 'String'>
    readonly description: FieldRef<"Archetype", 'String'>
    readonly createdAt: FieldRef<"Archetype", 'DateTime'>
    readonly updatedAt: FieldRef<"Archetype", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Archetype findUnique
   */
  export type ArchetypeFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Archetype
     */
    select?: ArchetypeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeInclude<ExtArgs> | null
    /**
     * Filter, which Archetype to fetch.
     */
    where: ArchetypeWhereUniqueInput
  }

  /**
   * Archetype findUniqueOrThrow
   */
  export type ArchetypeFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Archetype
     */
    select?: ArchetypeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeInclude<ExtArgs> | null
    /**
     * Filter, which Archetype to fetch.
     */
    where: ArchetypeWhereUniqueInput
  }

  /**
   * Archetype findFirst
   */
  export type ArchetypeFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Archetype
     */
    select?: ArchetypeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeInclude<ExtArgs> | null
    /**
     * Filter, which Archetype to fetch.
     */
    where?: ArchetypeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Archetypes to fetch.
     */
    orderBy?: ArchetypeOrderByWithRelationInput | ArchetypeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Archetypes.
     */
    cursor?: ArchetypeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Archetypes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Archetypes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Archetypes.
     */
    distinct?: ArchetypeScalarFieldEnum | ArchetypeScalarFieldEnum[]
  }

  /**
   * Archetype findFirstOrThrow
   */
  export type ArchetypeFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Archetype
     */
    select?: ArchetypeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeInclude<ExtArgs> | null
    /**
     * Filter, which Archetype to fetch.
     */
    where?: ArchetypeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Archetypes to fetch.
     */
    orderBy?: ArchetypeOrderByWithRelationInput | ArchetypeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Archetypes.
     */
    cursor?: ArchetypeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Archetypes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Archetypes.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Archetypes.
     */
    distinct?: ArchetypeScalarFieldEnum | ArchetypeScalarFieldEnum[]
  }

  /**
   * Archetype findMany
   */
  export type ArchetypeFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Archetype
     */
    select?: ArchetypeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeInclude<ExtArgs> | null
    /**
     * Filter, which Archetypes to fetch.
     */
    where?: ArchetypeWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Archetypes to fetch.
     */
    orderBy?: ArchetypeOrderByWithRelationInput | ArchetypeOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Archetypes.
     */
    cursor?: ArchetypeWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Archetypes from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Archetypes.
     */
    skip?: number
    distinct?: ArchetypeScalarFieldEnum | ArchetypeScalarFieldEnum[]
  }

  /**
   * Archetype create
   */
  export type ArchetypeCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Archetype
     */
    select?: ArchetypeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeInclude<ExtArgs> | null
    /**
     * The data needed to create a Archetype.
     */
    data: XOR<ArchetypeCreateInput, ArchetypeUncheckedCreateInput>
  }

  /**
   * Archetype createMany
   */
  export type ArchetypeCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Archetypes.
     */
    data: ArchetypeCreateManyInput | ArchetypeCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Archetype createManyAndReturn
   */
  export type ArchetypeCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Archetype
     */
    select?: ArchetypeSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Archetypes.
     */
    data: ArchetypeCreateManyInput | ArchetypeCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Archetype update
   */
  export type ArchetypeUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Archetype
     */
    select?: ArchetypeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeInclude<ExtArgs> | null
    /**
     * The data needed to update a Archetype.
     */
    data: XOR<ArchetypeUpdateInput, ArchetypeUncheckedUpdateInput>
    /**
     * Choose, which Archetype to update.
     */
    where: ArchetypeWhereUniqueInput
  }

  /**
   * Archetype updateMany
   */
  export type ArchetypeUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Archetypes.
     */
    data: XOR<ArchetypeUpdateManyMutationInput, ArchetypeUncheckedUpdateManyInput>
    /**
     * Filter which Archetypes to update
     */
    where?: ArchetypeWhereInput
  }

  /**
   * Archetype upsert
   */
  export type ArchetypeUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Archetype
     */
    select?: ArchetypeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeInclude<ExtArgs> | null
    /**
     * The filter to search for the Archetype to update in case it exists.
     */
    where: ArchetypeWhereUniqueInput
    /**
     * In case the Archetype found by the `where` argument doesn't exist, create a new Archetype with this data.
     */
    create: XOR<ArchetypeCreateInput, ArchetypeUncheckedCreateInput>
    /**
     * In case the Archetype was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ArchetypeUpdateInput, ArchetypeUncheckedUpdateInput>
  }

  /**
   * Archetype delete
   */
  export type ArchetypeDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Archetype
     */
    select?: ArchetypeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeInclude<ExtArgs> | null
    /**
     * Filter which Archetype to delete.
     */
    where: ArchetypeWhereUniqueInput
  }

  /**
   * Archetype deleteMany
   */
  export type ArchetypeDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Archetypes to delete
     */
    where?: ArchetypeWhereInput
  }

  /**
   * Archetype.traitProfiles
   */
  export type Archetype$traitProfilesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ArchetypeTraitProfile
     */
    select?: ArchetypeTraitProfileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeTraitProfileInclude<ExtArgs> | null
    where?: ArchetypeTraitProfileWhereInput
    orderBy?: ArchetypeTraitProfileOrderByWithRelationInput | ArchetypeTraitProfileOrderByWithRelationInput[]
    cursor?: ArchetypeTraitProfileWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ArchetypeTraitProfileScalarFieldEnum | ArchetypeTraitProfileScalarFieldEnum[]
  }

  /**
   * Archetype.agents
   */
  export type Archetype$agentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Agent
     */
    select?: AgentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentInclude<ExtArgs> | null
    where?: AgentWhereInput
    orderBy?: AgentOrderByWithRelationInput | AgentOrderByWithRelationInput[]
    cursor?: AgentWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AgentScalarFieldEnum | AgentScalarFieldEnum[]
  }

  /**
   * Archetype without action
   */
  export type ArchetypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Archetype
     */
    select?: ArchetypeSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeInclude<ExtArgs> | null
  }


  /**
   * Model TraitDefinition
   */

  export type AggregateTraitDefinition = {
    _count: TraitDefinitionCountAggregateOutputType | null
    _avg: TraitDefinitionAvgAggregateOutputType | null
    _sum: TraitDefinitionSumAggregateOutputType | null
    _min: TraitDefinitionMinAggregateOutputType | null
    _max: TraitDefinitionMaxAggregateOutputType | null
  }

  export type TraitDefinitionAvgAggregateOutputType = {
    minValue: number | null
    maxValue: number | null
  }

  export type TraitDefinitionSumAggregateOutputType = {
    minValue: number | null
    maxValue: number | null
  }

  export type TraitDefinitionMinAggregateOutputType = {
    id: string | null
    key: string | null
    displayName: string | null
    description: string | null
    valueRangeText: string | null
    minValue: number | null
    maxValue: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TraitDefinitionMaxAggregateOutputType = {
    id: string | null
    key: string | null
    displayName: string | null
    description: string | null
    valueRangeText: string | null
    minValue: number | null
    maxValue: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type TraitDefinitionCountAggregateOutputType = {
    id: number
    key: number
    displayName: number
    description: number
    valueRangeText: number
    minValue: number
    maxValue: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type TraitDefinitionAvgAggregateInputType = {
    minValue?: true
    maxValue?: true
  }

  export type TraitDefinitionSumAggregateInputType = {
    minValue?: true
    maxValue?: true
  }

  export type TraitDefinitionMinAggregateInputType = {
    id?: true
    key?: true
    displayName?: true
    description?: true
    valueRangeText?: true
    minValue?: true
    maxValue?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TraitDefinitionMaxAggregateInputType = {
    id?: true
    key?: true
    displayName?: true
    description?: true
    valueRangeText?: true
    minValue?: true
    maxValue?: true
    createdAt?: true
    updatedAt?: true
  }

  export type TraitDefinitionCountAggregateInputType = {
    id?: true
    key?: true
    displayName?: true
    description?: true
    valueRangeText?: true
    minValue?: true
    maxValue?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type TraitDefinitionAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TraitDefinition to aggregate.
     */
    where?: TraitDefinitionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TraitDefinitions to fetch.
     */
    orderBy?: TraitDefinitionOrderByWithRelationInput | TraitDefinitionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TraitDefinitionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TraitDefinitions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TraitDefinitions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned TraitDefinitions
    **/
    _count?: true | TraitDefinitionCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TraitDefinitionAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TraitDefinitionSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TraitDefinitionMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TraitDefinitionMaxAggregateInputType
  }

  export type GetTraitDefinitionAggregateType<T extends TraitDefinitionAggregateArgs> = {
        [P in keyof T & keyof AggregateTraitDefinition]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTraitDefinition[P]>
      : GetScalarType<T[P], AggregateTraitDefinition[P]>
  }




  export type TraitDefinitionGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TraitDefinitionWhereInput
    orderBy?: TraitDefinitionOrderByWithAggregationInput | TraitDefinitionOrderByWithAggregationInput[]
    by: TraitDefinitionScalarFieldEnum[] | TraitDefinitionScalarFieldEnum
    having?: TraitDefinitionScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TraitDefinitionCountAggregateInputType | true
    _avg?: TraitDefinitionAvgAggregateInputType
    _sum?: TraitDefinitionSumAggregateInputType
    _min?: TraitDefinitionMinAggregateInputType
    _max?: TraitDefinitionMaxAggregateInputType
  }

  export type TraitDefinitionGroupByOutputType = {
    id: string
    key: string
    displayName: string
    description: string | null
    valueRangeText: string | null
    minValue: number | null
    maxValue: number | null
    createdAt: Date
    updatedAt: Date
    _count: TraitDefinitionCountAggregateOutputType | null
    _avg: TraitDefinitionAvgAggregateOutputType | null
    _sum: TraitDefinitionSumAggregateOutputType | null
    _min: TraitDefinitionMinAggregateOutputType | null
    _max: TraitDefinitionMaxAggregateOutputType | null
  }

  type GetTraitDefinitionGroupByPayload<T extends TraitDefinitionGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TraitDefinitionGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TraitDefinitionGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TraitDefinitionGroupByOutputType[P]>
            : GetScalarType<T[P], TraitDefinitionGroupByOutputType[P]>
        }
      >
    >


  export type TraitDefinitionSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    key?: boolean
    displayName?: boolean
    description?: boolean
    valueRangeText?: boolean
    minValue?: boolean
    maxValue?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    archetypeProfiles?: boolean | TraitDefinition$archetypeProfilesArgs<ExtArgs>
    _count?: boolean | TraitDefinitionCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["traitDefinition"]>

  export type TraitDefinitionSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    key?: boolean
    displayName?: boolean
    description?: boolean
    valueRangeText?: boolean
    minValue?: boolean
    maxValue?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["traitDefinition"]>

  export type TraitDefinitionSelectScalar = {
    id?: boolean
    key?: boolean
    displayName?: boolean
    description?: boolean
    valueRangeText?: boolean
    minValue?: boolean
    maxValue?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type TraitDefinitionInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    archetypeProfiles?: boolean | TraitDefinition$archetypeProfilesArgs<ExtArgs>
    _count?: boolean | TraitDefinitionCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type TraitDefinitionIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $TraitDefinitionPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "TraitDefinition"
    objects: {
      archetypeProfiles: Prisma.$ArchetypeTraitProfilePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      key: string
      displayName: string
      description: string | null
      valueRangeText: string | null
      minValue: number | null
      maxValue: number | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["traitDefinition"]>
    composites: {}
  }

  type TraitDefinitionGetPayload<S extends boolean | null | undefined | TraitDefinitionDefaultArgs> = $Result.GetResult<Prisma.$TraitDefinitionPayload, S>

  type TraitDefinitionCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<TraitDefinitionFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: TraitDefinitionCountAggregateInputType | true
    }

  export interface TraitDefinitionDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['TraitDefinition'], meta: { name: 'TraitDefinition' } }
    /**
     * Find zero or one TraitDefinition that matches the filter.
     * @param {TraitDefinitionFindUniqueArgs} args - Arguments to find a TraitDefinition
     * @example
     * // Get one TraitDefinition
     * const traitDefinition = await prisma.traitDefinition.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TraitDefinitionFindUniqueArgs>(args: SelectSubset<T, TraitDefinitionFindUniqueArgs<ExtArgs>>): Prisma__TraitDefinitionClient<$Result.GetResult<Prisma.$TraitDefinitionPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one TraitDefinition that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {TraitDefinitionFindUniqueOrThrowArgs} args - Arguments to find a TraitDefinition
     * @example
     * // Get one TraitDefinition
     * const traitDefinition = await prisma.traitDefinition.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TraitDefinitionFindUniqueOrThrowArgs>(args: SelectSubset<T, TraitDefinitionFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TraitDefinitionClient<$Result.GetResult<Prisma.$TraitDefinitionPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first TraitDefinition that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TraitDefinitionFindFirstArgs} args - Arguments to find a TraitDefinition
     * @example
     * // Get one TraitDefinition
     * const traitDefinition = await prisma.traitDefinition.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TraitDefinitionFindFirstArgs>(args?: SelectSubset<T, TraitDefinitionFindFirstArgs<ExtArgs>>): Prisma__TraitDefinitionClient<$Result.GetResult<Prisma.$TraitDefinitionPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first TraitDefinition that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TraitDefinitionFindFirstOrThrowArgs} args - Arguments to find a TraitDefinition
     * @example
     * // Get one TraitDefinition
     * const traitDefinition = await prisma.traitDefinition.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TraitDefinitionFindFirstOrThrowArgs>(args?: SelectSubset<T, TraitDefinitionFindFirstOrThrowArgs<ExtArgs>>): Prisma__TraitDefinitionClient<$Result.GetResult<Prisma.$TraitDefinitionPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more TraitDefinitions that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TraitDefinitionFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all TraitDefinitions
     * const traitDefinitions = await prisma.traitDefinition.findMany()
     * 
     * // Get first 10 TraitDefinitions
     * const traitDefinitions = await prisma.traitDefinition.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const traitDefinitionWithIdOnly = await prisma.traitDefinition.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TraitDefinitionFindManyArgs>(args?: SelectSubset<T, TraitDefinitionFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TraitDefinitionPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a TraitDefinition.
     * @param {TraitDefinitionCreateArgs} args - Arguments to create a TraitDefinition.
     * @example
     * // Create one TraitDefinition
     * const TraitDefinition = await prisma.traitDefinition.create({
     *   data: {
     *     // ... data to create a TraitDefinition
     *   }
     * })
     * 
     */
    create<T extends TraitDefinitionCreateArgs>(args: SelectSubset<T, TraitDefinitionCreateArgs<ExtArgs>>): Prisma__TraitDefinitionClient<$Result.GetResult<Prisma.$TraitDefinitionPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many TraitDefinitions.
     * @param {TraitDefinitionCreateManyArgs} args - Arguments to create many TraitDefinitions.
     * @example
     * // Create many TraitDefinitions
     * const traitDefinition = await prisma.traitDefinition.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TraitDefinitionCreateManyArgs>(args?: SelectSubset<T, TraitDefinitionCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many TraitDefinitions and returns the data saved in the database.
     * @param {TraitDefinitionCreateManyAndReturnArgs} args - Arguments to create many TraitDefinitions.
     * @example
     * // Create many TraitDefinitions
     * const traitDefinition = await prisma.traitDefinition.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many TraitDefinitions and only return the `id`
     * const traitDefinitionWithIdOnly = await prisma.traitDefinition.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TraitDefinitionCreateManyAndReturnArgs>(args?: SelectSubset<T, TraitDefinitionCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TraitDefinitionPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a TraitDefinition.
     * @param {TraitDefinitionDeleteArgs} args - Arguments to delete one TraitDefinition.
     * @example
     * // Delete one TraitDefinition
     * const TraitDefinition = await prisma.traitDefinition.delete({
     *   where: {
     *     // ... filter to delete one TraitDefinition
     *   }
     * })
     * 
     */
    delete<T extends TraitDefinitionDeleteArgs>(args: SelectSubset<T, TraitDefinitionDeleteArgs<ExtArgs>>): Prisma__TraitDefinitionClient<$Result.GetResult<Prisma.$TraitDefinitionPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one TraitDefinition.
     * @param {TraitDefinitionUpdateArgs} args - Arguments to update one TraitDefinition.
     * @example
     * // Update one TraitDefinition
     * const traitDefinition = await prisma.traitDefinition.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TraitDefinitionUpdateArgs>(args: SelectSubset<T, TraitDefinitionUpdateArgs<ExtArgs>>): Prisma__TraitDefinitionClient<$Result.GetResult<Prisma.$TraitDefinitionPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more TraitDefinitions.
     * @param {TraitDefinitionDeleteManyArgs} args - Arguments to filter TraitDefinitions to delete.
     * @example
     * // Delete a few TraitDefinitions
     * const { count } = await prisma.traitDefinition.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TraitDefinitionDeleteManyArgs>(args?: SelectSubset<T, TraitDefinitionDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more TraitDefinitions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TraitDefinitionUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many TraitDefinitions
     * const traitDefinition = await prisma.traitDefinition.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TraitDefinitionUpdateManyArgs>(args: SelectSubset<T, TraitDefinitionUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one TraitDefinition.
     * @param {TraitDefinitionUpsertArgs} args - Arguments to update or create a TraitDefinition.
     * @example
     * // Update or create a TraitDefinition
     * const traitDefinition = await prisma.traitDefinition.upsert({
     *   create: {
     *     // ... data to create a TraitDefinition
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the TraitDefinition we want to update
     *   }
     * })
     */
    upsert<T extends TraitDefinitionUpsertArgs>(args: SelectSubset<T, TraitDefinitionUpsertArgs<ExtArgs>>): Prisma__TraitDefinitionClient<$Result.GetResult<Prisma.$TraitDefinitionPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of TraitDefinitions.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TraitDefinitionCountArgs} args - Arguments to filter TraitDefinitions to count.
     * @example
     * // Count the number of TraitDefinitions
     * const count = await prisma.traitDefinition.count({
     *   where: {
     *     // ... the filter for the TraitDefinitions we want to count
     *   }
     * })
    **/
    count<T extends TraitDefinitionCountArgs>(
      args?: Subset<T, TraitDefinitionCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TraitDefinitionCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a TraitDefinition.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TraitDefinitionAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TraitDefinitionAggregateArgs>(args: Subset<T, TraitDefinitionAggregateArgs>): Prisma.PrismaPromise<GetTraitDefinitionAggregateType<T>>

    /**
     * Group by TraitDefinition.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TraitDefinitionGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TraitDefinitionGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TraitDefinitionGroupByArgs['orderBy'] }
        : { orderBy?: TraitDefinitionGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TraitDefinitionGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTraitDefinitionGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the TraitDefinition model
   */
  readonly fields: TraitDefinitionFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for TraitDefinition.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TraitDefinitionClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    archetypeProfiles<T extends TraitDefinition$archetypeProfilesArgs<ExtArgs> = {}>(args?: Subset<T, TraitDefinition$archetypeProfilesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ArchetypeTraitProfilePayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the TraitDefinition model
   */ 
  interface TraitDefinitionFieldRefs {
    readonly id: FieldRef<"TraitDefinition", 'String'>
    readonly key: FieldRef<"TraitDefinition", 'String'>
    readonly displayName: FieldRef<"TraitDefinition", 'String'>
    readonly description: FieldRef<"TraitDefinition", 'String'>
    readonly valueRangeText: FieldRef<"TraitDefinition", 'String'>
    readonly minValue: FieldRef<"TraitDefinition", 'Float'>
    readonly maxValue: FieldRef<"TraitDefinition", 'Float'>
    readonly createdAt: FieldRef<"TraitDefinition", 'DateTime'>
    readonly updatedAt: FieldRef<"TraitDefinition", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * TraitDefinition findUnique
   */
  export type TraitDefinitionFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TraitDefinition
     */
    select?: TraitDefinitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TraitDefinitionInclude<ExtArgs> | null
    /**
     * Filter, which TraitDefinition to fetch.
     */
    where: TraitDefinitionWhereUniqueInput
  }

  /**
   * TraitDefinition findUniqueOrThrow
   */
  export type TraitDefinitionFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TraitDefinition
     */
    select?: TraitDefinitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TraitDefinitionInclude<ExtArgs> | null
    /**
     * Filter, which TraitDefinition to fetch.
     */
    where: TraitDefinitionWhereUniqueInput
  }

  /**
   * TraitDefinition findFirst
   */
  export type TraitDefinitionFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TraitDefinition
     */
    select?: TraitDefinitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TraitDefinitionInclude<ExtArgs> | null
    /**
     * Filter, which TraitDefinition to fetch.
     */
    where?: TraitDefinitionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TraitDefinitions to fetch.
     */
    orderBy?: TraitDefinitionOrderByWithRelationInput | TraitDefinitionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TraitDefinitions.
     */
    cursor?: TraitDefinitionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TraitDefinitions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TraitDefinitions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TraitDefinitions.
     */
    distinct?: TraitDefinitionScalarFieldEnum | TraitDefinitionScalarFieldEnum[]
  }

  /**
   * TraitDefinition findFirstOrThrow
   */
  export type TraitDefinitionFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TraitDefinition
     */
    select?: TraitDefinitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TraitDefinitionInclude<ExtArgs> | null
    /**
     * Filter, which TraitDefinition to fetch.
     */
    where?: TraitDefinitionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TraitDefinitions to fetch.
     */
    orderBy?: TraitDefinitionOrderByWithRelationInput | TraitDefinitionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for TraitDefinitions.
     */
    cursor?: TraitDefinitionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TraitDefinitions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TraitDefinitions.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of TraitDefinitions.
     */
    distinct?: TraitDefinitionScalarFieldEnum | TraitDefinitionScalarFieldEnum[]
  }

  /**
   * TraitDefinition findMany
   */
  export type TraitDefinitionFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TraitDefinition
     */
    select?: TraitDefinitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TraitDefinitionInclude<ExtArgs> | null
    /**
     * Filter, which TraitDefinitions to fetch.
     */
    where?: TraitDefinitionWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of TraitDefinitions to fetch.
     */
    orderBy?: TraitDefinitionOrderByWithRelationInput | TraitDefinitionOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing TraitDefinitions.
     */
    cursor?: TraitDefinitionWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` TraitDefinitions from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` TraitDefinitions.
     */
    skip?: number
    distinct?: TraitDefinitionScalarFieldEnum | TraitDefinitionScalarFieldEnum[]
  }

  /**
   * TraitDefinition create
   */
  export type TraitDefinitionCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TraitDefinition
     */
    select?: TraitDefinitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TraitDefinitionInclude<ExtArgs> | null
    /**
     * The data needed to create a TraitDefinition.
     */
    data: XOR<TraitDefinitionCreateInput, TraitDefinitionUncheckedCreateInput>
  }

  /**
   * TraitDefinition createMany
   */
  export type TraitDefinitionCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many TraitDefinitions.
     */
    data: TraitDefinitionCreateManyInput | TraitDefinitionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * TraitDefinition createManyAndReturn
   */
  export type TraitDefinitionCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TraitDefinition
     */
    select?: TraitDefinitionSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many TraitDefinitions.
     */
    data: TraitDefinitionCreateManyInput | TraitDefinitionCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * TraitDefinition update
   */
  export type TraitDefinitionUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TraitDefinition
     */
    select?: TraitDefinitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TraitDefinitionInclude<ExtArgs> | null
    /**
     * The data needed to update a TraitDefinition.
     */
    data: XOR<TraitDefinitionUpdateInput, TraitDefinitionUncheckedUpdateInput>
    /**
     * Choose, which TraitDefinition to update.
     */
    where: TraitDefinitionWhereUniqueInput
  }

  /**
   * TraitDefinition updateMany
   */
  export type TraitDefinitionUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update TraitDefinitions.
     */
    data: XOR<TraitDefinitionUpdateManyMutationInput, TraitDefinitionUncheckedUpdateManyInput>
    /**
     * Filter which TraitDefinitions to update
     */
    where?: TraitDefinitionWhereInput
  }

  /**
   * TraitDefinition upsert
   */
  export type TraitDefinitionUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TraitDefinition
     */
    select?: TraitDefinitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TraitDefinitionInclude<ExtArgs> | null
    /**
     * The filter to search for the TraitDefinition to update in case it exists.
     */
    where: TraitDefinitionWhereUniqueInput
    /**
     * In case the TraitDefinition found by the `where` argument doesn't exist, create a new TraitDefinition with this data.
     */
    create: XOR<TraitDefinitionCreateInput, TraitDefinitionUncheckedCreateInput>
    /**
     * In case the TraitDefinition was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TraitDefinitionUpdateInput, TraitDefinitionUncheckedUpdateInput>
  }

  /**
   * TraitDefinition delete
   */
  export type TraitDefinitionDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TraitDefinition
     */
    select?: TraitDefinitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TraitDefinitionInclude<ExtArgs> | null
    /**
     * Filter which TraitDefinition to delete.
     */
    where: TraitDefinitionWhereUniqueInput
  }

  /**
   * TraitDefinition deleteMany
   */
  export type TraitDefinitionDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which TraitDefinitions to delete
     */
    where?: TraitDefinitionWhereInput
  }

  /**
   * TraitDefinition.archetypeProfiles
   */
  export type TraitDefinition$archetypeProfilesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ArchetypeTraitProfile
     */
    select?: ArchetypeTraitProfileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeTraitProfileInclude<ExtArgs> | null
    where?: ArchetypeTraitProfileWhereInput
    orderBy?: ArchetypeTraitProfileOrderByWithRelationInput | ArchetypeTraitProfileOrderByWithRelationInput[]
    cursor?: ArchetypeTraitProfileWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ArchetypeTraitProfileScalarFieldEnum | ArchetypeTraitProfileScalarFieldEnum[]
  }

  /**
   * TraitDefinition without action
   */
  export type TraitDefinitionDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the TraitDefinition
     */
    select?: TraitDefinitionSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: TraitDefinitionInclude<ExtArgs> | null
  }


  /**
   * Model ArchetypeTraitProfile
   */

  export type AggregateArchetypeTraitProfile = {
    _count: ArchetypeTraitProfileCountAggregateOutputType | null
    _avg: ArchetypeTraitProfileAvgAggregateOutputType | null
    _sum: ArchetypeTraitProfileSumAggregateOutputType | null
    _min: ArchetypeTraitProfileMinAggregateOutputType | null
    _max: ArchetypeTraitProfileMaxAggregateOutputType | null
  }

  export type ArchetypeTraitProfileAvgAggregateOutputType = {
    baselineValue: number | null
  }

  export type ArchetypeTraitProfileSumAggregateOutputType = {
    baselineValue: number | null
  }

  export type ArchetypeTraitProfileMinAggregateOutputType = {
    archetypeId: string | null
    traitDefinitionId: string | null
    baselineValue: number | null
  }

  export type ArchetypeTraitProfileMaxAggregateOutputType = {
    archetypeId: string | null
    traitDefinitionId: string | null
    baselineValue: number | null
  }

  export type ArchetypeTraitProfileCountAggregateOutputType = {
    archetypeId: number
    traitDefinitionId: number
    baselineValue: number
    _all: number
  }


  export type ArchetypeTraitProfileAvgAggregateInputType = {
    baselineValue?: true
  }

  export type ArchetypeTraitProfileSumAggregateInputType = {
    baselineValue?: true
  }

  export type ArchetypeTraitProfileMinAggregateInputType = {
    archetypeId?: true
    traitDefinitionId?: true
    baselineValue?: true
  }

  export type ArchetypeTraitProfileMaxAggregateInputType = {
    archetypeId?: true
    traitDefinitionId?: true
    baselineValue?: true
  }

  export type ArchetypeTraitProfileCountAggregateInputType = {
    archetypeId?: true
    traitDefinitionId?: true
    baselineValue?: true
    _all?: true
  }

  export type ArchetypeTraitProfileAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ArchetypeTraitProfile to aggregate.
     */
    where?: ArchetypeTraitProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ArchetypeTraitProfiles to fetch.
     */
    orderBy?: ArchetypeTraitProfileOrderByWithRelationInput | ArchetypeTraitProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ArchetypeTraitProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ArchetypeTraitProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ArchetypeTraitProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ArchetypeTraitProfiles
    **/
    _count?: true | ArchetypeTraitProfileCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: ArchetypeTraitProfileAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: ArchetypeTraitProfileSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ArchetypeTraitProfileMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ArchetypeTraitProfileMaxAggregateInputType
  }

  export type GetArchetypeTraitProfileAggregateType<T extends ArchetypeTraitProfileAggregateArgs> = {
        [P in keyof T & keyof AggregateArchetypeTraitProfile]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateArchetypeTraitProfile[P]>
      : GetScalarType<T[P], AggregateArchetypeTraitProfile[P]>
  }




  export type ArchetypeTraitProfileGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ArchetypeTraitProfileWhereInput
    orderBy?: ArchetypeTraitProfileOrderByWithAggregationInput | ArchetypeTraitProfileOrderByWithAggregationInput[]
    by: ArchetypeTraitProfileScalarFieldEnum[] | ArchetypeTraitProfileScalarFieldEnum
    having?: ArchetypeTraitProfileScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ArchetypeTraitProfileCountAggregateInputType | true
    _avg?: ArchetypeTraitProfileAvgAggregateInputType
    _sum?: ArchetypeTraitProfileSumAggregateInputType
    _min?: ArchetypeTraitProfileMinAggregateInputType
    _max?: ArchetypeTraitProfileMaxAggregateInputType
  }

  export type ArchetypeTraitProfileGroupByOutputType = {
    archetypeId: string
    traitDefinitionId: string
    baselineValue: number
    _count: ArchetypeTraitProfileCountAggregateOutputType | null
    _avg: ArchetypeTraitProfileAvgAggregateOutputType | null
    _sum: ArchetypeTraitProfileSumAggregateOutputType | null
    _min: ArchetypeTraitProfileMinAggregateOutputType | null
    _max: ArchetypeTraitProfileMaxAggregateOutputType | null
  }

  type GetArchetypeTraitProfileGroupByPayload<T extends ArchetypeTraitProfileGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ArchetypeTraitProfileGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ArchetypeTraitProfileGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ArchetypeTraitProfileGroupByOutputType[P]>
            : GetScalarType<T[P], ArchetypeTraitProfileGroupByOutputType[P]>
        }
      >
    >


  export type ArchetypeTraitProfileSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    archetypeId?: boolean
    traitDefinitionId?: boolean
    baselineValue?: boolean
    archetype?: boolean | ArchetypeDefaultArgs<ExtArgs>
    traitDefinition?: boolean | TraitDefinitionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["archetypeTraitProfile"]>

  export type ArchetypeTraitProfileSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    archetypeId?: boolean
    traitDefinitionId?: boolean
    baselineValue?: boolean
    archetype?: boolean | ArchetypeDefaultArgs<ExtArgs>
    traitDefinition?: boolean | TraitDefinitionDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["archetypeTraitProfile"]>

  export type ArchetypeTraitProfileSelectScalar = {
    archetypeId?: boolean
    traitDefinitionId?: boolean
    baselineValue?: boolean
  }

  export type ArchetypeTraitProfileInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    archetype?: boolean | ArchetypeDefaultArgs<ExtArgs>
    traitDefinition?: boolean | TraitDefinitionDefaultArgs<ExtArgs>
  }
  export type ArchetypeTraitProfileIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    archetype?: boolean | ArchetypeDefaultArgs<ExtArgs>
    traitDefinition?: boolean | TraitDefinitionDefaultArgs<ExtArgs>
  }

  export type $ArchetypeTraitProfilePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ArchetypeTraitProfile"
    objects: {
      archetype: Prisma.$ArchetypePayload<ExtArgs>
      traitDefinition: Prisma.$TraitDefinitionPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      archetypeId: string
      traitDefinitionId: string
      baselineValue: number
    }, ExtArgs["result"]["archetypeTraitProfile"]>
    composites: {}
  }

  type ArchetypeTraitProfileGetPayload<S extends boolean | null | undefined | ArchetypeTraitProfileDefaultArgs> = $Result.GetResult<Prisma.$ArchetypeTraitProfilePayload, S>

  type ArchetypeTraitProfileCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ArchetypeTraitProfileFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ArchetypeTraitProfileCountAggregateInputType | true
    }

  export interface ArchetypeTraitProfileDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ArchetypeTraitProfile'], meta: { name: 'ArchetypeTraitProfile' } }
    /**
     * Find zero or one ArchetypeTraitProfile that matches the filter.
     * @param {ArchetypeTraitProfileFindUniqueArgs} args - Arguments to find a ArchetypeTraitProfile
     * @example
     * // Get one ArchetypeTraitProfile
     * const archetypeTraitProfile = await prisma.archetypeTraitProfile.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ArchetypeTraitProfileFindUniqueArgs>(args: SelectSubset<T, ArchetypeTraitProfileFindUniqueArgs<ExtArgs>>): Prisma__ArchetypeTraitProfileClient<$Result.GetResult<Prisma.$ArchetypeTraitProfilePayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one ArchetypeTraitProfile that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {ArchetypeTraitProfileFindUniqueOrThrowArgs} args - Arguments to find a ArchetypeTraitProfile
     * @example
     * // Get one ArchetypeTraitProfile
     * const archetypeTraitProfile = await prisma.archetypeTraitProfile.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ArchetypeTraitProfileFindUniqueOrThrowArgs>(args: SelectSubset<T, ArchetypeTraitProfileFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ArchetypeTraitProfileClient<$Result.GetResult<Prisma.$ArchetypeTraitProfilePayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first ArchetypeTraitProfile that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ArchetypeTraitProfileFindFirstArgs} args - Arguments to find a ArchetypeTraitProfile
     * @example
     * // Get one ArchetypeTraitProfile
     * const archetypeTraitProfile = await prisma.archetypeTraitProfile.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ArchetypeTraitProfileFindFirstArgs>(args?: SelectSubset<T, ArchetypeTraitProfileFindFirstArgs<ExtArgs>>): Prisma__ArchetypeTraitProfileClient<$Result.GetResult<Prisma.$ArchetypeTraitProfilePayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first ArchetypeTraitProfile that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ArchetypeTraitProfileFindFirstOrThrowArgs} args - Arguments to find a ArchetypeTraitProfile
     * @example
     * // Get one ArchetypeTraitProfile
     * const archetypeTraitProfile = await prisma.archetypeTraitProfile.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ArchetypeTraitProfileFindFirstOrThrowArgs>(args?: SelectSubset<T, ArchetypeTraitProfileFindFirstOrThrowArgs<ExtArgs>>): Prisma__ArchetypeTraitProfileClient<$Result.GetResult<Prisma.$ArchetypeTraitProfilePayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more ArchetypeTraitProfiles that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ArchetypeTraitProfileFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ArchetypeTraitProfiles
     * const archetypeTraitProfiles = await prisma.archetypeTraitProfile.findMany()
     * 
     * // Get first 10 ArchetypeTraitProfiles
     * const archetypeTraitProfiles = await prisma.archetypeTraitProfile.findMany({ take: 10 })
     * 
     * // Only select the `archetypeId`
     * const archetypeTraitProfileWithArchetypeIdOnly = await prisma.archetypeTraitProfile.findMany({ select: { archetypeId: true } })
     * 
     */
    findMany<T extends ArchetypeTraitProfileFindManyArgs>(args?: SelectSubset<T, ArchetypeTraitProfileFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ArchetypeTraitProfilePayload<ExtArgs>, T, "findMany">>

    /**
     * Create a ArchetypeTraitProfile.
     * @param {ArchetypeTraitProfileCreateArgs} args - Arguments to create a ArchetypeTraitProfile.
     * @example
     * // Create one ArchetypeTraitProfile
     * const ArchetypeTraitProfile = await prisma.archetypeTraitProfile.create({
     *   data: {
     *     // ... data to create a ArchetypeTraitProfile
     *   }
     * })
     * 
     */
    create<T extends ArchetypeTraitProfileCreateArgs>(args: SelectSubset<T, ArchetypeTraitProfileCreateArgs<ExtArgs>>): Prisma__ArchetypeTraitProfileClient<$Result.GetResult<Prisma.$ArchetypeTraitProfilePayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many ArchetypeTraitProfiles.
     * @param {ArchetypeTraitProfileCreateManyArgs} args - Arguments to create many ArchetypeTraitProfiles.
     * @example
     * // Create many ArchetypeTraitProfiles
     * const archetypeTraitProfile = await prisma.archetypeTraitProfile.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ArchetypeTraitProfileCreateManyArgs>(args?: SelectSubset<T, ArchetypeTraitProfileCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ArchetypeTraitProfiles and returns the data saved in the database.
     * @param {ArchetypeTraitProfileCreateManyAndReturnArgs} args - Arguments to create many ArchetypeTraitProfiles.
     * @example
     * // Create many ArchetypeTraitProfiles
     * const archetypeTraitProfile = await prisma.archetypeTraitProfile.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ArchetypeTraitProfiles and only return the `archetypeId`
     * const archetypeTraitProfileWithArchetypeIdOnly = await prisma.archetypeTraitProfile.createManyAndReturn({ 
     *   select: { archetypeId: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ArchetypeTraitProfileCreateManyAndReturnArgs>(args?: SelectSubset<T, ArchetypeTraitProfileCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ArchetypeTraitProfilePayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a ArchetypeTraitProfile.
     * @param {ArchetypeTraitProfileDeleteArgs} args - Arguments to delete one ArchetypeTraitProfile.
     * @example
     * // Delete one ArchetypeTraitProfile
     * const ArchetypeTraitProfile = await prisma.archetypeTraitProfile.delete({
     *   where: {
     *     // ... filter to delete one ArchetypeTraitProfile
     *   }
     * })
     * 
     */
    delete<T extends ArchetypeTraitProfileDeleteArgs>(args: SelectSubset<T, ArchetypeTraitProfileDeleteArgs<ExtArgs>>): Prisma__ArchetypeTraitProfileClient<$Result.GetResult<Prisma.$ArchetypeTraitProfilePayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one ArchetypeTraitProfile.
     * @param {ArchetypeTraitProfileUpdateArgs} args - Arguments to update one ArchetypeTraitProfile.
     * @example
     * // Update one ArchetypeTraitProfile
     * const archetypeTraitProfile = await prisma.archetypeTraitProfile.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ArchetypeTraitProfileUpdateArgs>(args: SelectSubset<T, ArchetypeTraitProfileUpdateArgs<ExtArgs>>): Prisma__ArchetypeTraitProfileClient<$Result.GetResult<Prisma.$ArchetypeTraitProfilePayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more ArchetypeTraitProfiles.
     * @param {ArchetypeTraitProfileDeleteManyArgs} args - Arguments to filter ArchetypeTraitProfiles to delete.
     * @example
     * // Delete a few ArchetypeTraitProfiles
     * const { count } = await prisma.archetypeTraitProfile.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ArchetypeTraitProfileDeleteManyArgs>(args?: SelectSubset<T, ArchetypeTraitProfileDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ArchetypeTraitProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ArchetypeTraitProfileUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ArchetypeTraitProfiles
     * const archetypeTraitProfile = await prisma.archetypeTraitProfile.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ArchetypeTraitProfileUpdateManyArgs>(args: SelectSubset<T, ArchetypeTraitProfileUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one ArchetypeTraitProfile.
     * @param {ArchetypeTraitProfileUpsertArgs} args - Arguments to update or create a ArchetypeTraitProfile.
     * @example
     * // Update or create a ArchetypeTraitProfile
     * const archetypeTraitProfile = await prisma.archetypeTraitProfile.upsert({
     *   create: {
     *     // ... data to create a ArchetypeTraitProfile
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ArchetypeTraitProfile we want to update
     *   }
     * })
     */
    upsert<T extends ArchetypeTraitProfileUpsertArgs>(args: SelectSubset<T, ArchetypeTraitProfileUpsertArgs<ExtArgs>>): Prisma__ArchetypeTraitProfileClient<$Result.GetResult<Prisma.$ArchetypeTraitProfilePayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of ArchetypeTraitProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ArchetypeTraitProfileCountArgs} args - Arguments to filter ArchetypeTraitProfiles to count.
     * @example
     * // Count the number of ArchetypeTraitProfiles
     * const count = await prisma.archetypeTraitProfile.count({
     *   where: {
     *     // ... the filter for the ArchetypeTraitProfiles we want to count
     *   }
     * })
    **/
    count<T extends ArchetypeTraitProfileCountArgs>(
      args?: Subset<T, ArchetypeTraitProfileCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ArchetypeTraitProfileCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ArchetypeTraitProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ArchetypeTraitProfileAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ArchetypeTraitProfileAggregateArgs>(args: Subset<T, ArchetypeTraitProfileAggregateArgs>): Prisma.PrismaPromise<GetArchetypeTraitProfileAggregateType<T>>

    /**
     * Group by ArchetypeTraitProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ArchetypeTraitProfileGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ArchetypeTraitProfileGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ArchetypeTraitProfileGroupByArgs['orderBy'] }
        : { orderBy?: ArchetypeTraitProfileGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ArchetypeTraitProfileGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetArchetypeTraitProfileGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ArchetypeTraitProfile model
   */
  readonly fields: ArchetypeTraitProfileFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ArchetypeTraitProfile.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ArchetypeTraitProfileClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    archetype<T extends ArchetypeDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ArchetypeDefaultArgs<ExtArgs>>): Prisma__ArchetypeClient<$Result.GetResult<Prisma.$ArchetypePayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    traitDefinition<T extends TraitDefinitionDefaultArgs<ExtArgs> = {}>(args?: Subset<T, TraitDefinitionDefaultArgs<ExtArgs>>): Prisma__TraitDefinitionClient<$Result.GetResult<Prisma.$TraitDefinitionPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ArchetypeTraitProfile model
   */ 
  interface ArchetypeTraitProfileFieldRefs {
    readonly archetypeId: FieldRef<"ArchetypeTraitProfile", 'String'>
    readonly traitDefinitionId: FieldRef<"ArchetypeTraitProfile", 'String'>
    readonly baselineValue: FieldRef<"ArchetypeTraitProfile", 'Float'>
  }
    

  // Custom InputTypes
  /**
   * ArchetypeTraitProfile findUnique
   */
  export type ArchetypeTraitProfileFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ArchetypeTraitProfile
     */
    select?: ArchetypeTraitProfileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeTraitProfileInclude<ExtArgs> | null
    /**
     * Filter, which ArchetypeTraitProfile to fetch.
     */
    where: ArchetypeTraitProfileWhereUniqueInput
  }

  /**
   * ArchetypeTraitProfile findUniqueOrThrow
   */
  export type ArchetypeTraitProfileFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ArchetypeTraitProfile
     */
    select?: ArchetypeTraitProfileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeTraitProfileInclude<ExtArgs> | null
    /**
     * Filter, which ArchetypeTraitProfile to fetch.
     */
    where: ArchetypeTraitProfileWhereUniqueInput
  }

  /**
   * ArchetypeTraitProfile findFirst
   */
  export type ArchetypeTraitProfileFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ArchetypeTraitProfile
     */
    select?: ArchetypeTraitProfileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeTraitProfileInclude<ExtArgs> | null
    /**
     * Filter, which ArchetypeTraitProfile to fetch.
     */
    where?: ArchetypeTraitProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ArchetypeTraitProfiles to fetch.
     */
    orderBy?: ArchetypeTraitProfileOrderByWithRelationInput | ArchetypeTraitProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ArchetypeTraitProfiles.
     */
    cursor?: ArchetypeTraitProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ArchetypeTraitProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ArchetypeTraitProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ArchetypeTraitProfiles.
     */
    distinct?: ArchetypeTraitProfileScalarFieldEnum | ArchetypeTraitProfileScalarFieldEnum[]
  }

  /**
   * ArchetypeTraitProfile findFirstOrThrow
   */
  export type ArchetypeTraitProfileFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ArchetypeTraitProfile
     */
    select?: ArchetypeTraitProfileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeTraitProfileInclude<ExtArgs> | null
    /**
     * Filter, which ArchetypeTraitProfile to fetch.
     */
    where?: ArchetypeTraitProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ArchetypeTraitProfiles to fetch.
     */
    orderBy?: ArchetypeTraitProfileOrderByWithRelationInput | ArchetypeTraitProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ArchetypeTraitProfiles.
     */
    cursor?: ArchetypeTraitProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ArchetypeTraitProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ArchetypeTraitProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ArchetypeTraitProfiles.
     */
    distinct?: ArchetypeTraitProfileScalarFieldEnum | ArchetypeTraitProfileScalarFieldEnum[]
  }

  /**
   * ArchetypeTraitProfile findMany
   */
  export type ArchetypeTraitProfileFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ArchetypeTraitProfile
     */
    select?: ArchetypeTraitProfileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeTraitProfileInclude<ExtArgs> | null
    /**
     * Filter, which ArchetypeTraitProfiles to fetch.
     */
    where?: ArchetypeTraitProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ArchetypeTraitProfiles to fetch.
     */
    orderBy?: ArchetypeTraitProfileOrderByWithRelationInput | ArchetypeTraitProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ArchetypeTraitProfiles.
     */
    cursor?: ArchetypeTraitProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ArchetypeTraitProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ArchetypeTraitProfiles.
     */
    skip?: number
    distinct?: ArchetypeTraitProfileScalarFieldEnum | ArchetypeTraitProfileScalarFieldEnum[]
  }

  /**
   * ArchetypeTraitProfile create
   */
  export type ArchetypeTraitProfileCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ArchetypeTraitProfile
     */
    select?: ArchetypeTraitProfileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeTraitProfileInclude<ExtArgs> | null
    /**
     * The data needed to create a ArchetypeTraitProfile.
     */
    data: XOR<ArchetypeTraitProfileCreateInput, ArchetypeTraitProfileUncheckedCreateInput>
  }

  /**
   * ArchetypeTraitProfile createMany
   */
  export type ArchetypeTraitProfileCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ArchetypeTraitProfiles.
     */
    data: ArchetypeTraitProfileCreateManyInput | ArchetypeTraitProfileCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ArchetypeTraitProfile createManyAndReturn
   */
  export type ArchetypeTraitProfileCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ArchetypeTraitProfile
     */
    select?: ArchetypeTraitProfileSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many ArchetypeTraitProfiles.
     */
    data: ArchetypeTraitProfileCreateManyInput | ArchetypeTraitProfileCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeTraitProfileIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ArchetypeTraitProfile update
   */
  export type ArchetypeTraitProfileUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ArchetypeTraitProfile
     */
    select?: ArchetypeTraitProfileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeTraitProfileInclude<ExtArgs> | null
    /**
     * The data needed to update a ArchetypeTraitProfile.
     */
    data: XOR<ArchetypeTraitProfileUpdateInput, ArchetypeTraitProfileUncheckedUpdateInput>
    /**
     * Choose, which ArchetypeTraitProfile to update.
     */
    where: ArchetypeTraitProfileWhereUniqueInput
  }

  /**
   * ArchetypeTraitProfile updateMany
   */
  export type ArchetypeTraitProfileUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ArchetypeTraitProfiles.
     */
    data: XOR<ArchetypeTraitProfileUpdateManyMutationInput, ArchetypeTraitProfileUncheckedUpdateManyInput>
    /**
     * Filter which ArchetypeTraitProfiles to update
     */
    where?: ArchetypeTraitProfileWhereInput
  }

  /**
   * ArchetypeTraitProfile upsert
   */
  export type ArchetypeTraitProfileUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ArchetypeTraitProfile
     */
    select?: ArchetypeTraitProfileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeTraitProfileInclude<ExtArgs> | null
    /**
     * The filter to search for the ArchetypeTraitProfile to update in case it exists.
     */
    where: ArchetypeTraitProfileWhereUniqueInput
    /**
     * In case the ArchetypeTraitProfile found by the `where` argument doesn't exist, create a new ArchetypeTraitProfile with this data.
     */
    create: XOR<ArchetypeTraitProfileCreateInput, ArchetypeTraitProfileUncheckedCreateInput>
    /**
     * In case the ArchetypeTraitProfile was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ArchetypeTraitProfileUpdateInput, ArchetypeTraitProfileUncheckedUpdateInput>
  }

  /**
   * ArchetypeTraitProfile delete
   */
  export type ArchetypeTraitProfileDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ArchetypeTraitProfile
     */
    select?: ArchetypeTraitProfileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeTraitProfileInclude<ExtArgs> | null
    /**
     * Filter which ArchetypeTraitProfile to delete.
     */
    where: ArchetypeTraitProfileWhereUniqueInput
  }

  /**
   * ArchetypeTraitProfile deleteMany
   */
  export type ArchetypeTraitProfileDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ArchetypeTraitProfiles to delete
     */
    where?: ArchetypeTraitProfileWhereInput
  }

  /**
   * ArchetypeTraitProfile without action
   */
  export type ArchetypeTraitProfileDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ArchetypeTraitProfile
     */
    select?: ArchetypeTraitProfileSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ArchetypeTraitProfileInclude<ExtArgs> | null
  }


  /**
   * Model Agent
   */

  export type AggregateAgent = {
    _count: AgentCountAggregateOutputType | null
    _min: AgentMinAggregateOutputType | null
    _max: AgentMaxAggregateOutputType | null
  }

  export type AgentMinAggregateOutputType = {
    id: string | null
    displayName: string | null
    archetypeId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AgentMaxAggregateOutputType = {
    id: string | null
    displayName: string | null
    archetypeId: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type AgentCountAggregateOutputType = {
    id: number
    displayName: number
    archetypeId: number
    stateJson: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type AgentMinAggregateInputType = {
    id?: true
    displayName?: true
    archetypeId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AgentMaxAggregateInputType = {
    id?: true
    displayName?: true
    archetypeId?: true
    createdAt?: true
    updatedAt?: true
  }

  export type AgentCountAggregateInputType = {
    id?: true
    displayName?: true
    archetypeId?: true
    stateJson?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type AgentAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Agent to aggregate.
     */
    where?: AgentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Agents to fetch.
     */
    orderBy?: AgentOrderByWithRelationInput | AgentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AgentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Agents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Agents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Agents
    **/
    _count?: true | AgentCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AgentMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AgentMaxAggregateInputType
  }

  export type GetAgentAggregateType<T extends AgentAggregateArgs> = {
        [P in keyof T & keyof AggregateAgent]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAgent[P]>
      : GetScalarType<T[P], AggregateAgent[P]>
  }




  export type AgentGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AgentWhereInput
    orderBy?: AgentOrderByWithAggregationInput | AgentOrderByWithAggregationInput[]
    by: AgentScalarFieldEnum[] | AgentScalarFieldEnum
    having?: AgentScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AgentCountAggregateInputType | true
    _min?: AgentMinAggregateInputType
    _max?: AgentMaxAggregateInputType
  }

  export type AgentGroupByOutputType = {
    id: string
    displayName: string
    archetypeId: string
    stateJson: JsonValue | null
    createdAt: Date
    updatedAt: Date
    _count: AgentCountAggregateOutputType | null
    _min: AgentMinAggregateOutputType | null
    _max: AgentMaxAggregateOutputType | null
  }

  type GetAgentGroupByPayload<T extends AgentGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AgentGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AgentGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AgentGroupByOutputType[P]>
            : GetScalarType<T[P], AgentGroupByOutputType[P]>
        }
      >
    >


  export type AgentSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    displayName?: boolean
    archetypeId?: boolean
    stateJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    archetype?: boolean | ArchetypeDefaultArgs<ExtArgs>
    experiences?: boolean | Agent$experiencesArgs<ExtArgs>
    _count?: boolean | AgentCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["agent"]>

  export type AgentSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    displayName?: boolean
    archetypeId?: boolean
    stateJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    archetype?: boolean | ArchetypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["agent"]>

  export type AgentSelectScalar = {
    id?: boolean
    displayName?: boolean
    archetypeId?: boolean
    stateJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type AgentInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    archetype?: boolean | ArchetypeDefaultArgs<ExtArgs>
    experiences?: boolean | Agent$experiencesArgs<ExtArgs>
    _count?: boolean | AgentCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type AgentIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    archetype?: boolean | ArchetypeDefaultArgs<ExtArgs>
  }

  export type $AgentPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Agent"
    objects: {
      archetype: Prisma.$ArchetypePayload<ExtArgs>
      experiences: Prisma.$AgentExperiencePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      displayName: string
      archetypeId: string
      stateJson: Prisma.JsonValue | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["agent"]>
    composites: {}
  }

  type AgentGetPayload<S extends boolean | null | undefined | AgentDefaultArgs> = $Result.GetResult<Prisma.$AgentPayload, S>

  type AgentCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<AgentFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: AgentCountAggregateInputType | true
    }

  export interface AgentDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Agent'], meta: { name: 'Agent' } }
    /**
     * Find zero or one Agent that matches the filter.
     * @param {AgentFindUniqueArgs} args - Arguments to find a Agent
     * @example
     * // Get one Agent
     * const agent = await prisma.agent.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AgentFindUniqueArgs>(args: SelectSubset<T, AgentFindUniqueArgs<ExtArgs>>): Prisma__AgentClient<$Result.GetResult<Prisma.$AgentPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one Agent that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {AgentFindUniqueOrThrowArgs} args - Arguments to find a Agent
     * @example
     * // Get one Agent
     * const agent = await prisma.agent.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AgentFindUniqueOrThrowArgs>(args: SelectSubset<T, AgentFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AgentClient<$Result.GetResult<Prisma.$AgentPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first Agent that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgentFindFirstArgs} args - Arguments to find a Agent
     * @example
     * // Get one Agent
     * const agent = await prisma.agent.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AgentFindFirstArgs>(args?: SelectSubset<T, AgentFindFirstArgs<ExtArgs>>): Prisma__AgentClient<$Result.GetResult<Prisma.$AgentPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first Agent that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgentFindFirstOrThrowArgs} args - Arguments to find a Agent
     * @example
     * // Get one Agent
     * const agent = await prisma.agent.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AgentFindFirstOrThrowArgs>(args?: SelectSubset<T, AgentFindFirstOrThrowArgs<ExtArgs>>): Prisma__AgentClient<$Result.GetResult<Prisma.$AgentPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Agents that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgentFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Agents
     * const agents = await prisma.agent.findMany()
     * 
     * // Get first 10 Agents
     * const agents = await prisma.agent.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const agentWithIdOnly = await prisma.agent.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AgentFindManyArgs>(args?: SelectSubset<T, AgentFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AgentPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a Agent.
     * @param {AgentCreateArgs} args - Arguments to create a Agent.
     * @example
     * // Create one Agent
     * const Agent = await prisma.agent.create({
     *   data: {
     *     // ... data to create a Agent
     *   }
     * })
     * 
     */
    create<T extends AgentCreateArgs>(args: SelectSubset<T, AgentCreateArgs<ExtArgs>>): Prisma__AgentClient<$Result.GetResult<Prisma.$AgentPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Agents.
     * @param {AgentCreateManyArgs} args - Arguments to create many Agents.
     * @example
     * // Create many Agents
     * const agent = await prisma.agent.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AgentCreateManyArgs>(args?: SelectSubset<T, AgentCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Agents and returns the data saved in the database.
     * @param {AgentCreateManyAndReturnArgs} args - Arguments to create many Agents.
     * @example
     * // Create many Agents
     * const agent = await prisma.agent.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Agents and only return the `id`
     * const agentWithIdOnly = await prisma.agent.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AgentCreateManyAndReturnArgs>(args?: SelectSubset<T, AgentCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AgentPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a Agent.
     * @param {AgentDeleteArgs} args - Arguments to delete one Agent.
     * @example
     * // Delete one Agent
     * const Agent = await prisma.agent.delete({
     *   where: {
     *     // ... filter to delete one Agent
     *   }
     * })
     * 
     */
    delete<T extends AgentDeleteArgs>(args: SelectSubset<T, AgentDeleteArgs<ExtArgs>>): Prisma__AgentClient<$Result.GetResult<Prisma.$AgentPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one Agent.
     * @param {AgentUpdateArgs} args - Arguments to update one Agent.
     * @example
     * // Update one Agent
     * const agent = await prisma.agent.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AgentUpdateArgs>(args: SelectSubset<T, AgentUpdateArgs<ExtArgs>>): Prisma__AgentClient<$Result.GetResult<Prisma.$AgentPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Agents.
     * @param {AgentDeleteManyArgs} args - Arguments to filter Agents to delete.
     * @example
     * // Delete a few Agents
     * const { count } = await prisma.agent.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AgentDeleteManyArgs>(args?: SelectSubset<T, AgentDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Agents.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgentUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Agents
     * const agent = await prisma.agent.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AgentUpdateManyArgs>(args: SelectSubset<T, AgentUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Agent.
     * @param {AgentUpsertArgs} args - Arguments to update or create a Agent.
     * @example
     * // Update or create a Agent
     * const agent = await prisma.agent.upsert({
     *   create: {
     *     // ... data to create a Agent
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Agent we want to update
     *   }
     * })
     */
    upsert<T extends AgentUpsertArgs>(args: SelectSubset<T, AgentUpsertArgs<ExtArgs>>): Prisma__AgentClient<$Result.GetResult<Prisma.$AgentPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Agents.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgentCountArgs} args - Arguments to filter Agents to count.
     * @example
     * // Count the number of Agents
     * const count = await prisma.agent.count({
     *   where: {
     *     // ... the filter for the Agents we want to count
     *   }
     * })
    **/
    count<T extends AgentCountArgs>(
      args?: Subset<T, AgentCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AgentCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Agent.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgentAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AgentAggregateArgs>(args: Subset<T, AgentAggregateArgs>): Prisma.PrismaPromise<GetAgentAggregateType<T>>

    /**
     * Group by Agent.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgentGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AgentGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AgentGroupByArgs['orderBy'] }
        : { orderBy?: AgentGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AgentGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAgentGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Agent model
   */
  readonly fields: AgentFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Agent.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AgentClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    archetype<T extends ArchetypeDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ArchetypeDefaultArgs<ExtArgs>>): Prisma__ArchetypeClient<$Result.GetResult<Prisma.$ArchetypePayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    experiences<T extends Agent$experiencesArgs<ExtArgs> = {}>(args?: Subset<T, Agent$experiencesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AgentExperiencePayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Agent model
   */ 
  interface AgentFieldRefs {
    readonly id: FieldRef<"Agent", 'String'>
    readonly displayName: FieldRef<"Agent", 'String'>
    readonly archetypeId: FieldRef<"Agent", 'String'>
    readonly stateJson: FieldRef<"Agent", 'Json'>
    readonly createdAt: FieldRef<"Agent", 'DateTime'>
    readonly updatedAt: FieldRef<"Agent", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Agent findUnique
   */
  export type AgentFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Agent
     */
    select?: AgentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentInclude<ExtArgs> | null
    /**
     * Filter, which Agent to fetch.
     */
    where: AgentWhereUniqueInput
  }

  /**
   * Agent findUniqueOrThrow
   */
  export type AgentFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Agent
     */
    select?: AgentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentInclude<ExtArgs> | null
    /**
     * Filter, which Agent to fetch.
     */
    where: AgentWhereUniqueInput
  }

  /**
   * Agent findFirst
   */
  export type AgentFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Agent
     */
    select?: AgentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentInclude<ExtArgs> | null
    /**
     * Filter, which Agent to fetch.
     */
    where?: AgentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Agents to fetch.
     */
    orderBy?: AgentOrderByWithRelationInput | AgentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Agents.
     */
    cursor?: AgentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Agents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Agents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Agents.
     */
    distinct?: AgentScalarFieldEnum | AgentScalarFieldEnum[]
  }

  /**
   * Agent findFirstOrThrow
   */
  export type AgentFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Agent
     */
    select?: AgentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentInclude<ExtArgs> | null
    /**
     * Filter, which Agent to fetch.
     */
    where?: AgentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Agents to fetch.
     */
    orderBy?: AgentOrderByWithRelationInput | AgentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Agents.
     */
    cursor?: AgentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Agents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Agents.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Agents.
     */
    distinct?: AgentScalarFieldEnum | AgentScalarFieldEnum[]
  }

  /**
   * Agent findMany
   */
  export type AgentFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Agent
     */
    select?: AgentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentInclude<ExtArgs> | null
    /**
     * Filter, which Agents to fetch.
     */
    where?: AgentWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Agents to fetch.
     */
    orderBy?: AgentOrderByWithRelationInput | AgentOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Agents.
     */
    cursor?: AgentWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Agents from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Agents.
     */
    skip?: number
    distinct?: AgentScalarFieldEnum | AgentScalarFieldEnum[]
  }

  /**
   * Agent create
   */
  export type AgentCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Agent
     */
    select?: AgentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentInclude<ExtArgs> | null
    /**
     * The data needed to create a Agent.
     */
    data: XOR<AgentCreateInput, AgentUncheckedCreateInput>
  }

  /**
   * Agent createMany
   */
  export type AgentCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Agents.
     */
    data: AgentCreateManyInput | AgentCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Agent createManyAndReturn
   */
  export type AgentCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Agent
     */
    select?: AgentSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Agents.
     */
    data: AgentCreateManyInput | AgentCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Agent update
   */
  export type AgentUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Agent
     */
    select?: AgentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentInclude<ExtArgs> | null
    /**
     * The data needed to update a Agent.
     */
    data: XOR<AgentUpdateInput, AgentUncheckedUpdateInput>
    /**
     * Choose, which Agent to update.
     */
    where: AgentWhereUniqueInput
  }

  /**
   * Agent updateMany
   */
  export type AgentUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Agents.
     */
    data: XOR<AgentUpdateManyMutationInput, AgentUncheckedUpdateManyInput>
    /**
     * Filter which Agents to update
     */
    where?: AgentWhereInput
  }

  /**
   * Agent upsert
   */
  export type AgentUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Agent
     */
    select?: AgentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentInclude<ExtArgs> | null
    /**
     * The filter to search for the Agent to update in case it exists.
     */
    where: AgentWhereUniqueInput
    /**
     * In case the Agent found by the `where` argument doesn't exist, create a new Agent with this data.
     */
    create: XOR<AgentCreateInput, AgentUncheckedCreateInput>
    /**
     * In case the Agent was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AgentUpdateInput, AgentUncheckedUpdateInput>
  }

  /**
   * Agent delete
   */
  export type AgentDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Agent
     */
    select?: AgentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentInclude<ExtArgs> | null
    /**
     * Filter which Agent to delete.
     */
    where: AgentWhereUniqueInput
  }

  /**
   * Agent deleteMany
   */
  export type AgentDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Agents to delete
     */
    where?: AgentWhereInput
  }

  /**
   * Agent.experiences
   */
  export type Agent$experiencesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgentExperience
     */
    select?: AgentExperienceSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentExperienceInclude<ExtArgs> | null
    where?: AgentExperienceWhereInput
    orderBy?: AgentExperienceOrderByWithRelationInput | AgentExperienceOrderByWithRelationInput[]
    cursor?: AgentExperienceWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AgentExperienceScalarFieldEnum | AgentExperienceScalarFieldEnum[]
  }

  /**
   * Agent without action
   */
  export type AgentDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Agent
     */
    select?: AgentSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentInclude<ExtArgs> | null
  }


  /**
   * Model SimulationRun
   */

  export type AggregateSimulationRun = {
    _count: SimulationRunCountAggregateOutputType | null
    _avg: SimulationRunAvgAggregateOutputType | null
    _sum: SimulationRunSumAggregateOutputType | null
    _min: SimulationRunMinAggregateOutputType | null
    _max: SimulationRunMaxAggregateOutputType | null
  }

  export type SimulationRunAvgAggregateOutputType = {
    seed: number | null
  }

  export type SimulationRunSumAggregateOutputType = {
    seed: number | null
  }

  export type SimulationRunMinAggregateOutputType = {
    id: string | null
    name: string | null
    status: $Enums.SimulationRunStatus | null
    seed: number | null
    modelVersion: string | null
    datasetVersion: string | null
    codeGitSha: string | null
    schemaVersion: string | null
    startedAt: Date | null
    finishedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SimulationRunMaxAggregateOutputType = {
    id: string | null
    name: string | null
    status: $Enums.SimulationRunStatus | null
    seed: number | null
    modelVersion: string | null
    datasetVersion: string | null
    codeGitSha: string | null
    schemaVersion: string | null
    startedAt: Date | null
    finishedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SimulationRunCountAggregateOutputType = {
    id: number
    name: number
    status: number
    seed: number
    modelVersion: number
    datasetVersion: number
    codeGitSha: number
    schemaVersion: number
    startedAt: number
    finishedAt: number
    configJson: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type SimulationRunAvgAggregateInputType = {
    seed?: true
  }

  export type SimulationRunSumAggregateInputType = {
    seed?: true
  }

  export type SimulationRunMinAggregateInputType = {
    id?: true
    name?: true
    status?: true
    seed?: true
    modelVersion?: true
    datasetVersion?: true
    codeGitSha?: true
    schemaVersion?: true
    startedAt?: true
    finishedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SimulationRunMaxAggregateInputType = {
    id?: true
    name?: true
    status?: true
    seed?: true
    modelVersion?: true
    datasetVersion?: true
    codeGitSha?: true
    schemaVersion?: true
    startedAt?: true
    finishedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SimulationRunCountAggregateInputType = {
    id?: true
    name?: true
    status?: true
    seed?: true
    modelVersion?: true
    datasetVersion?: true
    codeGitSha?: true
    schemaVersion?: true
    startedAt?: true
    finishedAt?: true
    configJson?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type SimulationRunAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SimulationRun to aggregate.
     */
    where?: SimulationRunWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SimulationRuns to fetch.
     */
    orderBy?: SimulationRunOrderByWithRelationInput | SimulationRunOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SimulationRunWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SimulationRuns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SimulationRuns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned SimulationRuns
    **/
    _count?: true | SimulationRunCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: SimulationRunAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: SimulationRunSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SimulationRunMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SimulationRunMaxAggregateInputType
  }

  export type GetSimulationRunAggregateType<T extends SimulationRunAggregateArgs> = {
        [P in keyof T & keyof AggregateSimulationRun]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSimulationRun[P]>
      : GetScalarType<T[P], AggregateSimulationRun[P]>
  }




  export type SimulationRunGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SimulationRunWhereInput
    orderBy?: SimulationRunOrderByWithAggregationInput | SimulationRunOrderByWithAggregationInput[]
    by: SimulationRunScalarFieldEnum[] | SimulationRunScalarFieldEnum
    having?: SimulationRunScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SimulationRunCountAggregateInputType | true
    _avg?: SimulationRunAvgAggregateInputType
    _sum?: SimulationRunSumAggregateInputType
    _min?: SimulationRunMinAggregateInputType
    _max?: SimulationRunMaxAggregateInputType
  }

  export type SimulationRunGroupByOutputType = {
    id: string
    name: string
    status: $Enums.SimulationRunStatus
    seed: number
    modelVersion: string
    datasetVersion: string
    codeGitSha: string | null
    schemaVersion: string
    startedAt: Date | null
    finishedAt: Date | null
    configJson: JsonValue | null
    createdAt: Date
    updatedAt: Date
    _count: SimulationRunCountAggregateOutputType | null
    _avg: SimulationRunAvgAggregateOutputType | null
    _sum: SimulationRunSumAggregateOutputType | null
    _min: SimulationRunMinAggregateOutputType | null
    _max: SimulationRunMaxAggregateOutputType | null
  }

  type GetSimulationRunGroupByPayload<T extends SimulationRunGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SimulationRunGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SimulationRunGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SimulationRunGroupByOutputType[P]>
            : GetScalarType<T[P], SimulationRunGroupByOutputType[P]>
        }
      >
    >


  export type SimulationRunSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    status?: boolean
    seed?: boolean
    modelVersion?: boolean
    datasetVersion?: boolean
    codeGitSha?: boolean
    schemaVersion?: boolean
    startedAt?: boolean
    finishedAt?: boolean
    configJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    agentExperiences?: boolean | SimulationRun$agentExperiencesArgs<ExtArgs>
    crowdSnapshots?: boolean | SimulationRun$crowdSnapshotsArgs<ExtArgs>
    runDebug?: boolean | SimulationRun$runDebugArgs<ExtArgs>
    bets?: boolean | SimulationRun$betsArgs<ExtArgs>
    _count?: boolean | SimulationRunCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["simulationRun"]>

  export type SimulationRunSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    name?: boolean
    status?: boolean
    seed?: boolean
    modelVersion?: boolean
    datasetVersion?: boolean
    codeGitSha?: boolean
    schemaVersion?: boolean
    startedAt?: boolean
    finishedAt?: boolean
    configJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["simulationRun"]>

  export type SimulationRunSelectScalar = {
    id?: boolean
    name?: boolean
    status?: boolean
    seed?: boolean
    modelVersion?: boolean
    datasetVersion?: boolean
    codeGitSha?: boolean
    schemaVersion?: boolean
    startedAt?: boolean
    finishedAt?: boolean
    configJson?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type SimulationRunInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    agentExperiences?: boolean | SimulationRun$agentExperiencesArgs<ExtArgs>
    crowdSnapshots?: boolean | SimulationRun$crowdSnapshotsArgs<ExtArgs>
    runDebug?: boolean | SimulationRun$runDebugArgs<ExtArgs>
    bets?: boolean | SimulationRun$betsArgs<ExtArgs>
    _count?: boolean | SimulationRunCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type SimulationRunIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $SimulationRunPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "SimulationRun"
    objects: {
      agentExperiences: Prisma.$AgentExperiencePayload<ExtArgs>[]
      crowdSnapshots: Prisma.$CrowdSnapshotPayload<ExtArgs>[]
      runDebug: Prisma.$RunDebugPayload<ExtArgs> | null
      bets: Prisma.$BetPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      name: string
      status: $Enums.SimulationRunStatus
      seed: number
      modelVersion: string
      datasetVersion: string
      codeGitSha: string | null
      schemaVersion: string
      startedAt: Date | null
      finishedAt: Date | null
      configJson: Prisma.JsonValue | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["simulationRun"]>
    composites: {}
  }

  type SimulationRunGetPayload<S extends boolean | null | undefined | SimulationRunDefaultArgs> = $Result.GetResult<Prisma.$SimulationRunPayload, S>

  type SimulationRunCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<SimulationRunFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: SimulationRunCountAggregateInputType | true
    }

  export interface SimulationRunDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['SimulationRun'], meta: { name: 'SimulationRun' } }
    /**
     * Find zero or one SimulationRun that matches the filter.
     * @param {SimulationRunFindUniqueArgs} args - Arguments to find a SimulationRun
     * @example
     * // Get one SimulationRun
     * const simulationRun = await prisma.simulationRun.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SimulationRunFindUniqueArgs>(args: SelectSubset<T, SimulationRunFindUniqueArgs<ExtArgs>>): Prisma__SimulationRunClient<$Result.GetResult<Prisma.$SimulationRunPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one SimulationRun that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {SimulationRunFindUniqueOrThrowArgs} args - Arguments to find a SimulationRun
     * @example
     * // Get one SimulationRun
     * const simulationRun = await prisma.simulationRun.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SimulationRunFindUniqueOrThrowArgs>(args: SelectSubset<T, SimulationRunFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SimulationRunClient<$Result.GetResult<Prisma.$SimulationRunPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first SimulationRun that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SimulationRunFindFirstArgs} args - Arguments to find a SimulationRun
     * @example
     * // Get one SimulationRun
     * const simulationRun = await prisma.simulationRun.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SimulationRunFindFirstArgs>(args?: SelectSubset<T, SimulationRunFindFirstArgs<ExtArgs>>): Prisma__SimulationRunClient<$Result.GetResult<Prisma.$SimulationRunPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first SimulationRun that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SimulationRunFindFirstOrThrowArgs} args - Arguments to find a SimulationRun
     * @example
     * // Get one SimulationRun
     * const simulationRun = await prisma.simulationRun.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SimulationRunFindFirstOrThrowArgs>(args?: SelectSubset<T, SimulationRunFindFirstOrThrowArgs<ExtArgs>>): Prisma__SimulationRunClient<$Result.GetResult<Prisma.$SimulationRunPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more SimulationRuns that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SimulationRunFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all SimulationRuns
     * const simulationRuns = await prisma.simulationRun.findMany()
     * 
     * // Get first 10 SimulationRuns
     * const simulationRuns = await prisma.simulationRun.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const simulationRunWithIdOnly = await prisma.simulationRun.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SimulationRunFindManyArgs>(args?: SelectSubset<T, SimulationRunFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SimulationRunPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a SimulationRun.
     * @param {SimulationRunCreateArgs} args - Arguments to create a SimulationRun.
     * @example
     * // Create one SimulationRun
     * const SimulationRun = await prisma.simulationRun.create({
     *   data: {
     *     // ... data to create a SimulationRun
     *   }
     * })
     * 
     */
    create<T extends SimulationRunCreateArgs>(args: SelectSubset<T, SimulationRunCreateArgs<ExtArgs>>): Prisma__SimulationRunClient<$Result.GetResult<Prisma.$SimulationRunPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many SimulationRuns.
     * @param {SimulationRunCreateManyArgs} args - Arguments to create many SimulationRuns.
     * @example
     * // Create many SimulationRuns
     * const simulationRun = await prisma.simulationRun.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SimulationRunCreateManyArgs>(args?: SelectSubset<T, SimulationRunCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many SimulationRuns and returns the data saved in the database.
     * @param {SimulationRunCreateManyAndReturnArgs} args - Arguments to create many SimulationRuns.
     * @example
     * // Create many SimulationRuns
     * const simulationRun = await prisma.simulationRun.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many SimulationRuns and only return the `id`
     * const simulationRunWithIdOnly = await prisma.simulationRun.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SimulationRunCreateManyAndReturnArgs>(args?: SelectSubset<T, SimulationRunCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SimulationRunPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a SimulationRun.
     * @param {SimulationRunDeleteArgs} args - Arguments to delete one SimulationRun.
     * @example
     * // Delete one SimulationRun
     * const SimulationRun = await prisma.simulationRun.delete({
     *   where: {
     *     // ... filter to delete one SimulationRun
     *   }
     * })
     * 
     */
    delete<T extends SimulationRunDeleteArgs>(args: SelectSubset<T, SimulationRunDeleteArgs<ExtArgs>>): Prisma__SimulationRunClient<$Result.GetResult<Prisma.$SimulationRunPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one SimulationRun.
     * @param {SimulationRunUpdateArgs} args - Arguments to update one SimulationRun.
     * @example
     * // Update one SimulationRun
     * const simulationRun = await prisma.simulationRun.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SimulationRunUpdateArgs>(args: SelectSubset<T, SimulationRunUpdateArgs<ExtArgs>>): Prisma__SimulationRunClient<$Result.GetResult<Prisma.$SimulationRunPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more SimulationRuns.
     * @param {SimulationRunDeleteManyArgs} args - Arguments to filter SimulationRuns to delete.
     * @example
     * // Delete a few SimulationRuns
     * const { count } = await prisma.simulationRun.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SimulationRunDeleteManyArgs>(args?: SelectSubset<T, SimulationRunDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SimulationRuns.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SimulationRunUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many SimulationRuns
     * const simulationRun = await prisma.simulationRun.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SimulationRunUpdateManyArgs>(args: SelectSubset<T, SimulationRunUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one SimulationRun.
     * @param {SimulationRunUpsertArgs} args - Arguments to update or create a SimulationRun.
     * @example
     * // Update or create a SimulationRun
     * const simulationRun = await prisma.simulationRun.upsert({
     *   create: {
     *     // ... data to create a SimulationRun
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the SimulationRun we want to update
     *   }
     * })
     */
    upsert<T extends SimulationRunUpsertArgs>(args: SelectSubset<T, SimulationRunUpsertArgs<ExtArgs>>): Prisma__SimulationRunClient<$Result.GetResult<Prisma.$SimulationRunPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of SimulationRuns.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SimulationRunCountArgs} args - Arguments to filter SimulationRuns to count.
     * @example
     * // Count the number of SimulationRuns
     * const count = await prisma.simulationRun.count({
     *   where: {
     *     // ... the filter for the SimulationRuns we want to count
     *   }
     * })
    **/
    count<T extends SimulationRunCountArgs>(
      args?: Subset<T, SimulationRunCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SimulationRunCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a SimulationRun.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SimulationRunAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SimulationRunAggregateArgs>(args: Subset<T, SimulationRunAggregateArgs>): Prisma.PrismaPromise<GetSimulationRunAggregateType<T>>

    /**
     * Group by SimulationRun.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SimulationRunGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SimulationRunGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SimulationRunGroupByArgs['orderBy'] }
        : { orderBy?: SimulationRunGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SimulationRunGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSimulationRunGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the SimulationRun model
   */
  readonly fields: SimulationRunFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for SimulationRun.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SimulationRunClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    agentExperiences<T extends SimulationRun$agentExperiencesArgs<ExtArgs> = {}>(args?: Subset<T, SimulationRun$agentExperiencesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AgentExperiencePayload<ExtArgs>, T, "findMany"> | Null>
    crowdSnapshots<T extends SimulationRun$crowdSnapshotsArgs<ExtArgs> = {}>(args?: Subset<T, SimulationRun$crowdSnapshotsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CrowdSnapshotPayload<ExtArgs>, T, "findMany"> | Null>
    runDebug<T extends SimulationRun$runDebugArgs<ExtArgs> = {}>(args?: Subset<T, SimulationRun$runDebugArgs<ExtArgs>>): Prisma__RunDebugClient<$Result.GetResult<Prisma.$RunDebugPayload<ExtArgs>, T, "findUniqueOrThrow"> | null, null, ExtArgs>
    bets<T extends SimulationRun$betsArgs<ExtArgs> = {}>(args?: Subset<T, SimulationRun$betsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BetPayload<ExtArgs>, T, "findMany"> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the SimulationRun model
   */ 
  interface SimulationRunFieldRefs {
    readonly id: FieldRef<"SimulationRun", 'String'>
    readonly name: FieldRef<"SimulationRun", 'String'>
    readonly status: FieldRef<"SimulationRun", 'SimulationRunStatus'>
    readonly seed: FieldRef<"SimulationRun", 'Int'>
    readonly modelVersion: FieldRef<"SimulationRun", 'String'>
    readonly datasetVersion: FieldRef<"SimulationRun", 'String'>
    readonly codeGitSha: FieldRef<"SimulationRun", 'String'>
    readonly schemaVersion: FieldRef<"SimulationRun", 'String'>
    readonly startedAt: FieldRef<"SimulationRun", 'DateTime'>
    readonly finishedAt: FieldRef<"SimulationRun", 'DateTime'>
    readonly configJson: FieldRef<"SimulationRun", 'Json'>
    readonly createdAt: FieldRef<"SimulationRun", 'DateTime'>
    readonly updatedAt: FieldRef<"SimulationRun", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * SimulationRun findUnique
   */
  export type SimulationRunFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SimulationRun
     */
    select?: SimulationRunSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SimulationRunInclude<ExtArgs> | null
    /**
     * Filter, which SimulationRun to fetch.
     */
    where: SimulationRunWhereUniqueInput
  }

  /**
   * SimulationRun findUniqueOrThrow
   */
  export type SimulationRunFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SimulationRun
     */
    select?: SimulationRunSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SimulationRunInclude<ExtArgs> | null
    /**
     * Filter, which SimulationRun to fetch.
     */
    where: SimulationRunWhereUniqueInput
  }

  /**
   * SimulationRun findFirst
   */
  export type SimulationRunFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SimulationRun
     */
    select?: SimulationRunSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SimulationRunInclude<ExtArgs> | null
    /**
     * Filter, which SimulationRun to fetch.
     */
    where?: SimulationRunWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SimulationRuns to fetch.
     */
    orderBy?: SimulationRunOrderByWithRelationInput | SimulationRunOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SimulationRuns.
     */
    cursor?: SimulationRunWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SimulationRuns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SimulationRuns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SimulationRuns.
     */
    distinct?: SimulationRunScalarFieldEnum | SimulationRunScalarFieldEnum[]
  }

  /**
   * SimulationRun findFirstOrThrow
   */
  export type SimulationRunFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SimulationRun
     */
    select?: SimulationRunSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SimulationRunInclude<ExtArgs> | null
    /**
     * Filter, which SimulationRun to fetch.
     */
    where?: SimulationRunWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SimulationRuns to fetch.
     */
    orderBy?: SimulationRunOrderByWithRelationInput | SimulationRunOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SimulationRuns.
     */
    cursor?: SimulationRunWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SimulationRuns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SimulationRuns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SimulationRuns.
     */
    distinct?: SimulationRunScalarFieldEnum | SimulationRunScalarFieldEnum[]
  }

  /**
   * SimulationRun findMany
   */
  export type SimulationRunFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SimulationRun
     */
    select?: SimulationRunSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SimulationRunInclude<ExtArgs> | null
    /**
     * Filter, which SimulationRuns to fetch.
     */
    where?: SimulationRunWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SimulationRuns to fetch.
     */
    orderBy?: SimulationRunOrderByWithRelationInput | SimulationRunOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing SimulationRuns.
     */
    cursor?: SimulationRunWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SimulationRuns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SimulationRuns.
     */
    skip?: number
    distinct?: SimulationRunScalarFieldEnum | SimulationRunScalarFieldEnum[]
  }

  /**
   * SimulationRun create
   */
  export type SimulationRunCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SimulationRun
     */
    select?: SimulationRunSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SimulationRunInclude<ExtArgs> | null
    /**
     * The data needed to create a SimulationRun.
     */
    data: XOR<SimulationRunCreateInput, SimulationRunUncheckedCreateInput>
  }

  /**
   * SimulationRun createMany
   */
  export type SimulationRunCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many SimulationRuns.
     */
    data: SimulationRunCreateManyInput | SimulationRunCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * SimulationRun createManyAndReturn
   */
  export type SimulationRunCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SimulationRun
     */
    select?: SimulationRunSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many SimulationRuns.
     */
    data: SimulationRunCreateManyInput | SimulationRunCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * SimulationRun update
   */
  export type SimulationRunUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SimulationRun
     */
    select?: SimulationRunSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SimulationRunInclude<ExtArgs> | null
    /**
     * The data needed to update a SimulationRun.
     */
    data: XOR<SimulationRunUpdateInput, SimulationRunUncheckedUpdateInput>
    /**
     * Choose, which SimulationRun to update.
     */
    where: SimulationRunWhereUniqueInput
  }

  /**
   * SimulationRun updateMany
   */
  export type SimulationRunUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update SimulationRuns.
     */
    data: XOR<SimulationRunUpdateManyMutationInput, SimulationRunUncheckedUpdateManyInput>
    /**
     * Filter which SimulationRuns to update
     */
    where?: SimulationRunWhereInput
  }

  /**
   * SimulationRun upsert
   */
  export type SimulationRunUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SimulationRun
     */
    select?: SimulationRunSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SimulationRunInclude<ExtArgs> | null
    /**
     * The filter to search for the SimulationRun to update in case it exists.
     */
    where: SimulationRunWhereUniqueInput
    /**
     * In case the SimulationRun found by the `where` argument doesn't exist, create a new SimulationRun with this data.
     */
    create: XOR<SimulationRunCreateInput, SimulationRunUncheckedCreateInput>
    /**
     * In case the SimulationRun was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SimulationRunUpdateInput, SimulationRunUncheckedUpdateInput>
  }

  /**
   * SimulationRun delete
   */
  export type SimulationRunDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SimulationRun
     */
    select?: SimulationRunSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SimulationRunInclude<ExtArgs> | null
    /**
     * Filter which SimulationRun to delete.
     */
    where: SimulationRunWhereUniqueInput
  }

  /**
   * SimulationRun deleteMany
   */
  export type SimulationRunDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SimulationRuns to delete
     */
    where?: SimulationRunWhereInput
  }

  /**
   * SimulationRun.agentExperiences
   */
  export type SimulationRun$agentExperiencesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgentExperience
     */
    select?: AgentExperienceSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentExperienceInclude<ExtArgs> | null
    where?: AgentExperienceWhereInput
    orderBy?: AgentExperienceOrderByWithRelationInput | AgentExperienceOrderByWithRelationInput[]
    cursor?: AgentExperienceWhereUniqueInput
    take?: number
    skip?: number
    distinct?: AgentExperienceScalarFieldEnum | AgentExperienceScalarFieldEnum[]
  }

  /**
   * SimulationRun.crowdSnapshots
   */
  export type SimulationRun$crowdSnapshotsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CrowdSnapshot
     */
    select?: CrowdSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CrowdSnapshotInclude<ExtArgs> | null
    where?: CrowdSnapshotWhereInput
    orderBy?: CrowdSnapshotOrderByWithRelationInput | CrowdSnapshotOrderByWithRelationInput[]
    cursor?: CrowdSnapshotWhereUniqueInput
    take?: number
    skip?: number
    distinct?: CrowdSnapshotScalarFieldEnum | CrowdSnapshotScalarFieldEnum[]
  }

  /**
   * SimulationRun.runDebug
   */
  export type SimulationRun$runDebugArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RunDebug
     */
    select?: RunDebugSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RunDebugInclude<ExtArgs> | null
    where?: RunDebugWhereInput
  }

  /**
   * SimulationRun.bets
   */
  export type SimulationRun$betsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Bet
     */
    select?: BetSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BetInclude<ExtArgs> | null
    where?: BetWhereInput
    orderBy?: BetOrderByWithRelationInput | BetOrderByWithRelationInput[]
    cursor?: BetWhereUniqueInput
    take?: number
    skip?: number
    distinct?: BetScalarFieldEnum | BetScalarFieldEnum[]
  }

  /**
   * SimulationRun without action
   */
  export type SimulationRunDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SimulationRun
     */
    select?: SimulationRunSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: SimulationRunInclude<ExtArgs> | null
  }


  /**
   * Model RunDebug
   */

  export type AggregateRunDebug = {
    _count: RunDebugCountAggregateOutputType | null
    _min: RunDebugMinAggregateOutputType | null
    _max: RunDebugMaxAggregateOutputType | null
  }

  export type RunDebugMinAggregateOutputType = {
    runId: string | null
    createdAt: Date | null
  }

  export type RunDebugMaxAggregateOutputType = {
    runId: string | null
    createdAt: Date | null
  }

  export type RunDebugCountAggregateOutputType = {
    runId: number
    prePersistHistogram: number
    samplePrePersistActions: number
    createdAt: number
    _all: number
  }


  export type RunDebugMinAggregateInputType = {
    runId?: true
    createdAt?: true
  }

  export type RunDebugMaxAggregateInputType = {
    runId?: true
    createdAt?: true
  }

  export type RunDebugCountAggregateInputType = {
    runId?: true
    prePersistHistogram?: true
    samplePrePersistActions?: true
    createdAt?: true
    _all?: true
  }

  export type RunDebugAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RunDebug to aggregate.
     */
    where?: RunDebugWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RunDebugs to fetch.
     */
    orderBy?: RunDebugOrderByWithRelationInput | RunDebugOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: RunDebugWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RunDebugs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RunDebugs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned RunDebugs
    **/
    _count?: true | RunDebugCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: RunDebugMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: RunDebugMaxAggregateInputType
  }

  export type GetRunDebugAggregateType<T extends RunDebugAggregateArgs> = {
        [P in keyof T & keyof AggregateRunDebug]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateRunDebug[P]>
      : GetScalarType<T[P], AggregateRunDebug[P]>
  }




  export type RunDebugGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: RunDebugWhereInput
    orderBy?: RunDebugOrderByWithAggregationInput | RunDebugOrderByWithAggregationInput[]
    by: RunDebugScalarFieldEnum[] | RunDebugScalarFieldEnum
    having?: RunDebugScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: RunDebugCountAggregateInputType | true
    _min?: RunDebugMinAggregateInputType
    _max?: RunDebugMaxAggregateInputType
  }

  export type RunDebugGroupByOutputType = {
    runId: string
    prePersistHistogram: JsonValue | null
    samplePrePersistActions: JsonValue | null
    createdAt: Date
    _count: RunDebugCountAggregateOutputType | null
    _min: RunDebugMinAggregateOutputType | null
    _max: RunDebugMaxAggregateOutputType | null
  }

  type GetRunDebugGroupByPayload<T extends RunDebugGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<RunDebugGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof RunDebugGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], RunDebugGroupByOutputType[P]>
            : GetScalarType<T[P], RunDebugGroupByOutputType[P]>
        }
      >
    >


  export type RunDebugSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    runId?: boolean
    prePersistHistogram?: boolean
    samplePrePersistActions?: boolean
    createdAt?: boolean
    run?: boolean | SimulationRunDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["runDebug"]>

  export type RunDebugSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    runId?: boolean
    prePersistHistogram?: boolean
    samplePrePersistActions?: boolean
    createdAt?: boolean
    run?: boolean | SimulationRunDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["runDebug"]>

  export type RunDebugSelectScalar = {
    runId?: boolean
    prePersistHistogram?: boolean
    samplePrePersistActions?: boolean
    createdAt?: boolean
  }

  export type RunDebugInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    run?: boolean | SimulationRunDefaultArgs<ExtArgs>
  }
  export type RunDebugIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    run?: boolean | SimulationRunDefaultArgs<ExtArgs>
  }

  export type $RunDebugPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "RunDebug"
    objects: {
      run: Prisma.$SimulationRunPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      runId: string
      prePersistHistogram: Prisma.JsonValue | null
      samplePrePersistActions: Prisma.JsonValue | null
      createdAt: Date
    }, ExtArgs["result"]["runDebug"]>
    composites: {}
  }

  type RunDebugGetPayload<S extends boolean | null | undefined | RunDebugDefaultArgs> = $Result.GetResult<Prisma.$RunDebugPayload, S>

  type RunDebugCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<RunDebugFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: RunDebugCountAggregateInputType | true
    }

  export interface RunDebugDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['RunDebug'], meta: { name: 'RunDebug' } }
    /**
     * Find zero or one RunDebug that matches the filter.
     * @param {RunDebugFindUniqueArgs} args - Arguments to find a RunDebug
     * @example
     * // Get one RunDebug
     * const runDebug = await prisma.runDebug.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends RunDebugFindUniqueArgs>(args: SelectSubset<T, RunDebugFindUniqueArgs<ExtArgs>>): Prisma__RunDebugClient<$Result.GetResult<Prisma.$RunDebugPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one RunDebug that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {RunDebugFindUniqueOrThrowArgs} args - Arguments to find a RunDebug
     * @example
     * // Get one RunDebug
     * const runDebug = await prisma.runDebug.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends RunDebugFindUniqueOrThrowArgs>(args: SelectSubset<T, RunDebugFindUniqueOrThrowArgs<ExtArgs>>): Prisma__RunDebugClient<$Result.GetResult<Prisma.$RunDebugPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first RunDebug that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RunDebugFindFirstArgs} args - Arguments to find a RunDebug
     * @example
     * // Get one RunDebug
     * const runDebug = await prisma.runDebug.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends RunDebugFindFirstArgs>(args?: SelectSubset<T, RunDebugFindFirstArgs<ExtArgs>>): Prisma__RunDebugClient<$Result.GetResult<Prisma.$RunDebugPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first RunDebug that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RunDebugFindFirstOrThrowArgs} args - Arguments to find a RunDebug
     * @example
     * // Get one RunDebug
     * const runDebug = await prisma.runDebug.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends RunDebugFindFirstOrThrowArgs>(args?: SelectSubset<T, RunDebugFindFirstOrThrowArgs<ExtArgs>>): Prisma__RunDebugClient<$Result.GetResult<Prisma.$RunDebugPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more RunDebugs that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RunDebugFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all RunDebugs
     * const runDebugs = await prisma.runDebug.findMany()
     * 
     * // Get first 10 RunDebugs
     * const runDebugs = await prisma.runDebug.findMany({ take: 10 })
     * 
     * // Only select the `runId`
     * const runDebugWithRunIdOnly = await prisma.runDebug.findMany({ select: { runId: true } })
     * 
     */
    findMany<T extends RunDebugFindManyArgs>(args?: SelectSubset<T, RunDebugFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RunDebugPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a RunDebug.
     * @param {RunDebugCreateArgs} args - Arguments to create a RunDebug.
     * @example
     * // Create one RunDebug
     * const RunDebug = await prisma.runDebug.create({
     *   data: {
     *     // ... data to create a RunDebug
     *   }
     * })
     * 
     */
    create<T extends RunDebugCreateArgs>(args: SelectSubset<T, RunDebugCreateArgs<ExtArgs>>): Prisma__RunDebugClient<$Result.GetResult<Prisma.$RunDebugPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many RunDebugs.
     * @param {RunDebugCreateManyArgs} args - Arguments to create many RunDebugs.
     * @example
     * // Create many RunDebugs
     * const runDebug = await prisma.runDebug.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends RunDebugCreateManyArgs>(args?: SelectSubset<T, RunDebugCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many RunDebugs and returns the data saved in the database.
     * @param {RunDebugCreateManyAndReturnArgs} args - Arguments to create many RunDebugs.
     * @example
     * // Create many RunDebugs
     * const runDebug = await prisma.runDebug.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many RunDebugs and only return the `runId`
     * const runDebugWithRunIdOnly = await prisma.runDebug.createManyAndReturn({ 
     *   select: { runId: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends RunDebugCreateManyAndReturnArgs>(args?: SelectSubset<T, RunDebugCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$RunDebugPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a RunDebug.
     * @param {RunDebugDeleteArgs} args - Arguments to delete one RunDebug.
     * @example
     * // Delete one RunDebug
     * const RunDebug = await prisma.runDebug.delete({
     *   where: {
     *     // ... filter to delete one RunDebug
     *   }
     * })
     * 
     */
    delete<T extends RunDebugDeleteArgs>(args: SelectSubset<T, RunDebugDeleteArgs<ExtArgs>>): Prisma__RunDebugClient<$Result.GetResult<Prisma.$RunDebugPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one RunDebug.
     * @param {RunDebugUpdateArgs} args - Arguments to update one RunDebug.
     * @example
     * // Update one RunDebug
     * const runDebug = await prisma.runDebug.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends RunDebugUpdateArgs>(args: SelectSubset<T, RunDebugUpdateArgs<ExtArgs>>): Prisma__RunDebugClient<$Result.GetResult<Prisma.$RunDebugPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more RunDebugs.
     * @param {RunDebugDeleteManyArgs} args - Arguments to filter RunDebugs to delete.
     * @example
     * // Delete a few RunDebugs
     * const { count } = await prisma.runDebug.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends RunDebugDeleteManyArgs>(args?: SelectSubset<T, RunDebugDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more RunDebugs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RunDebugUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many RunDebugs
     * const runDebug = await prisma.runDebug.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends RunDebugUpdateManyArgs>(args: SelectSubset<T, RunDebugUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one RunDebug.
     * @param {RunDebugUpsertArgs} args - Arguments to update or create a RunDebug.
     * @example
     * // Update or create a RunDebug
     * const runDebug = await prisma.runDebug.upsert({
     *   create: {
     *     // ... data to create a RunDebug
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the RunDebug we want to update
     *   }
     * })
     */
    upsert<T extends RunDebugUpsertArgs>(args: SelectSubset<T, RunDebugUpsertArgs<ExtArgs>>): Prisma__RunDebugClient<$Result.GetResult<Prisma.$RunDebugPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of RunDebugs.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RunDebugCountArgs} args - Arguments to filter RunDebugs to count.
     * @example
     * // Count the number of RunDebugs
     * const count = await prisma.runDebug.count({
     *   where: {
     *     // ... the filter for the RunDebugs we want to count
     *   }
     * })
    **/
    count<T extends RunDebugCountArgs>(
      args?: Subset<T, RunDebugCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], RunDebugCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a RunDebug.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RunDebugAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends RunDebugAggregateArgs>(args: Subset<T, RunDebugAggregateArgs>): Prisma.PrismaPromise<GetRunDebugAggregateType<T>>

    /**
     * Group by RunDebug.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {RunDebugGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends RunDebugGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: RunDebugGroupByArgs['orderBy'] }
        : { orderBy?: RunDebugGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, RunDebugGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetRunDebugGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the RunDebug model
   */
  readonly fields: RunDebugFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for RunDebug.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__RunDebugClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    run<T extends SimulationRunDefaultArgs<ExtArgs> = {}>(args?: Subset<T, SimulationRunDefaultArgs<ExtArgs>>): Prisma__SimulationRunClient<$Result.GetResult<Prisma.$SimulationRunPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the RunDebug model
   */ 
  interface RunDebugFieldRefs {
    readonly runId: FieldRef<"RunDebug", 'String'>
    readonly prePersistHistogram: FieldRef<"RunDebug", 'Json'>
    readonly samplePrePersistActions: FieldRef<"RunDebug", 'Json'>
    readonly createdAt: FieldRef<"RunDebug", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * RunDebug findUnique
   */
  export type RunDebugFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RunDebug
     */
    select?: RunDebugSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RunDebugInclude<ExtArgs> | null
    /**
     * Filter, which RunDebug to fetch.
     */
    where: RunDebugWhereUniqueInput
  }

  /**
   * RunDebug findUniqueOrThrow
   */
  export type RunDebugFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RunDebug
     */
    select?: RunDebugSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RunDebugInclude<ExtArgs> | null
    /**
     * Filter, which RunDebug to fetch.
     */
    where: RunDebugWhereUniqueInput
  }

  /**
   * RunDebug findFirst
   */
  export type RunDebugFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RunDebug
     */
    select?: RunDebugSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RunDebugInclude<ExtArgs> | null
    /**
     * Filter, which RunDebug to fetch.
     */
    where?: RunDebugWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RunDebugs to fetch.
     */
    orderBy?: RunDebugOrderByWithRelationInput | RunDebugOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RunDebugs.
     */
    cursor?: RunDebugWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RunDebugs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RunDebugs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RunDebugs.
     */
    distinct?: RunDebugScalarFieldEnum | RunDebugScalarFieldEnum[]
  }

  /**
   * RunDebug findFirstOrThrow
   */
  export type RunDebugFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RunDebug
     */
    select?: RunDebugSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RunDebugInclude<ExtArgs> | null
    /**
     * Filter, which RunDebug to fetch.
     */
    where?: RunDebugWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RunDebugs to fetch.
     */
    orderBy?: RunDebugOrderByWithRelationInput | RunDebugOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for RunDebugs.
     */
    cursor?: RunDebugWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RunDebugs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RunDebugs.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of RunDebugs.
     */
    distinct?: RunDebugScalarFieldEnum | RunDebugScalarFieldEnum[]
  }

  /**
   * RunDebug findMany
   */
  export type RunDebugFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RunDebug
     */
    select?: RunDebugSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RunDebugInclude<ExtArgs> | null
    /**
     * Filter, which RunDebugs to fetch.
     */
    where?: RunDebugWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of RunDebugs to fetch.
     */
    orderBy?: RunDebugOrderByWithRelationInput | RunDebugOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing RunDebugs.
     */
    cursor?: RunDebugWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` RunDebugs from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` RunDebugs.
     */
    skip?: number
    distinct?: RunDebugScalarFieldEnum | RunDebugScalarFieldEnum[]
  }

  /**
   * RunDebug create
   */
  export type RunDebugCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RunDebug
     */
    select?: RunDebugSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RunDebugInclude<ExtArgs> | null
    /**
     * The data needed to create a RunDebug.
     */
    data: XOR<RunDebugCreateInput, RunDebugUncheckedCreateInput>
  }

  /**
   * RunDebug createMany
   */
  export type RunDebugCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many RunDebugs.
     */
    data: RunDebugCreateManyInput | RunDebugCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * RunDebug createManyAndReturn
   */
  export type RunDebugCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RunDebug
     */
    select?: RunDebugSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many RunDebugs.
     */
    data: RunDebugCreateManyInput | RunDebugCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RunDebugIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * RunDebug update
   */
  export type RunDebugUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RunDebug
     */
    select?: RunDebugSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RunDebugInclude<ExtArgs> | null
    /**
     * The data needed to update a RunDebug.
     */
    data: XOR<RunDebugUpdateInput, RunDebugUncheckedUpdateInput>
    /**
     * Choose, which RunDebug to update.
     */
    where: RunDebugWhereUniqueInput
  }

  /**
   * RunDebug updateMany
   */
  export type RunDebugUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update RunDebugs.
     */
    data: XOR<RunDebugUpdateManyMutationInput, RunDebugUncheckedUpdateManyInput>
    /**
     * Filter which RunDebugs to update
     */
    where?: RunDebugWhereInput
  }

  /**
   * RunDebug upsert
   */
  export type RunDebugUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RunDebug
     */
    select?: RunDebugSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RunDebugInclude<ExtArgs> | null
    /**
     * The filter to search for the RunDebug to update in case it exists.
     */
    where: RunDebugWhereUniqueInput
    /**
     * In case the RunDebug found by the `where` argument doesn't exist, create a new RunDebug with this data.
     */
    create: XOR<RunDebugCreateInput, RunDebugUncheckedCreateInput>
    /**
     * In case the RunDebug was found with the provided `where` argument, update it with this data.
     */
    update: XOR<RunDebugUpdateInput, RunDebugUncheckedUpdateInput>
  }

  /**
   * RunDebug delete
   */
  export type RunDebugDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RunDebug
     */
    select?: RunDebugSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RunDebugInclude<ExtArgs> | null
    /**
     * Filter which RunDebug to delete.
     */
    where: RunDebugWhereUniqueInput
  }

  /**
   * RunDebug deleteMany
   */
  export type RunDebugDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which RunDebugs to delete
     */
    where?: RunDebugWhereInput
  }

  /**
   * RunDebug without action
   */
  export type RunDebugDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the RunDebug
     */
    select?: RunDebugSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: RunDebugInclude<ExtArgs> | null
  }


  /**
   * Model AgentExperience
   */

  export type AggregateAgentExperience = {
    _count: AgentExperienceCountAggregateOutputType | null
    _avg: AgentExperienceAvgAggregateOutputType | null
    _sum: AgentExperienceSumAggregateOutputType | null
    _min: AgentExperienceMinAggregateOutputType | null
    _max: AgentExperienceMaxAggregateOutputType | null
  }

  export type AgentExperienceAvgAggregateOutputType = {
    step: number | null
    pnl: number | null
    drawdown: number | null
    reward: number | null
  }

  export type AgentExperienceSumAggregateOutputType = {
    step: number | null
    pnl: number | null
    drawdown: number | null
    reward: number | null
  }

  export type AgentExperienceMinAggregateOutputType = {
    id: string | null
    runId: string | null
    agentId: string | null
    step: number | null
    ts: Date | null
    pnl: number | null
    drawdown: number | null
    reward: number | null
  }

  export type AgentExperienceMaxAggregateOutputType = {
    id: string | null
    runId: string | null
    agentId: string | null
    step: number | null
    ts: Date | null
    pnl: number | null
    drawdown: number | null
    reward: number | null
  }

  export type AgentExperienceCountAggregateOutputType = {
    id: number
    runId: number
    agentId: number
    step: number
    ts: number
    actionJson: number
    signalsJson: number
    pnl: number
    drawdown: number
    reward: number
    learningMetaJson: number
    stateBeforeJson: number
    stateAfterJson: number
    _all: number
  }


  export type AgentExperienceAvgAggregateInputType = {
    step?: true
    pnl?: true
    drawdown?: true
    reward?: true
  }

  export type AgentExperienceSumAggregateInputType = {
    step?: true
    pnl?: true
    drawdown?: true
    reward?: true
  }

  export type AgentExperienceMinAggregateInputType = {
    id?: true
    runId?: true
    agentId?: true
    step?: true
    ts?: true
    pnl?: true
    drawdown?: true
    reward?: true
  }

  export type AgentExperienceMaxAggregateInputType = {
    id?: true
    runId?: true
    agentId?: true
    step?: true
    ts?: true
    pnl?: true
    drawdown?: true
    reward?: true
  }

  export type AgentExperienceCountAggregateInputType = {
    id?: true
    runId?: true
    agentId?: true
    step?: true
    ts?: true
    actionJson?: true
    signalsJson?: true
    pnl?: true
    drawdown?: true
    reward?: true
    learningMetaJson?: true
    stateBeforeJson?: true
    stateAfterJson?: true
    _all?: true
  }

  export type AgentExperienceAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AgentExperience to aggregate.
     */
    where?: AgentExperienceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AgentExperiences to fetch.
     */
    orderBy?: AgentExperienceOrderByWithRelationInput | AgentExperienceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: AgentExperienceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AgentExperiences from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AgentExperiences.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned AgentExperiences
    **/
    _count?: true | AgentExperienceCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: AgentExperienceAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: AgentExperienceSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: AgentExperienceMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: AgentExperienceMaxAggregateInputType
  }

  export type GetAgentExperienceAggregateType<T extends AgentExperienceAggregateArgs> = {
        [P in keyof T & keyof AggregateAgentExperience]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateAgentExperience[P]>
      : GetScalarType<T[P], AggregateAgentExperience[P]>
  }




  export type AgentExperienceGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: AgentExperienceWhereInput
    orderBy?: AgentExperienceOrderByWithAggregationInput | AgentExperienceOrderByWithAggregationInput[]
    by: AgentExperienceScalarFieldEnum[] | AgentExperienceScalarFieldEnum
    having?: AgentExperienceScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: AgentExperienceCountAggregateInputType | true
    _avg?: AgentExperienceAvgAggregateInputType
    _sum?: AgentExperienceSumAggregateInputType
    _min?: AgentExperienceMinAggregateInputType
    _max?: AgentExperienceMaxAggregateInputType
  }

  export type AgentExperienceGroupByOutputType = {
    id: string
    runId: string
    agentId: string
    step: number
    ts: Date
    actionJson: JsonValue | null
    signalsJson: JsonValue | null
    pnl: number | null
    drawdown: number | null
    reward: number | null
    learningMetaJson: JsonValue | null
    stateBeforeJson: JsonValue | null
    stateAfterJson: JsonValue | null
    _count: AgentExperienceCountAggregateOutputType | null
    _avg: AgentExperienceAvgAggregateOutputType | null
    _sum: AgentExperienceSumAggregateOutputType | null
    _min: AgentExperienceMinAggregateOutputType | null
    _max: AgentExperienceMaxAggregateOutputType | null
  }

  type GetAgentExperienceGroupByPayload<T extends AgentExperienceGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<AgentExperienceGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof AgentExperienceGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], AgentExperienceGroupByOutputType[P]>
            : GetScalarType<T[P], AgentExperienceGroupByOutputType[P]>
        }
      >
    >


  export type AgentExperienceSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    runId?: boolean
    agentId?: boolean
    step?: boolean
    ts?: boolean
    actionJson?: boolean
    signalsJson?: boolean
    pnl?: boolean
    drawdown?: boolean
    reward?: boolean
    learningMetaJson?: boolean
    stateBeforeJson?: boolean
    stateAfterJson?: boolean
    run?: boolean | SimulationRunDefaultArgs<ExtArgs>
    agent?: boolean | AgentDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["agentExperience"]>

  export type AgentExperienceSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    runId?: boolean
    agentId?: boolean
    step?: boolean
    ts?: boolean
    actionJson?: boolean
    signalsJson?: boolean
    pnl?: boolean
    drawdown?: boolean
    reward?: boolean
    learningMetaJson?: boolean
    stateBeforeJson?: boolean
    stateAfterJson?: boolean
    run?: boolean | SimulationRunDefaultArgs<ExtArgs>
    agent?: boolean | AgentDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["agentExperience"]>

  export type AgentExperienceSelectScalar = {
    id?: boolean
    runId?: boolean
    agentId?: boolean
    step?: boolean
    ts?: boolean
    actionJson?: boolean
    signalsJson?: boolean
    pnl?: boolean
    drawdown?: boolean
    reward?: boolean
    learningMetaJson?: boolean
    stateBeforeJson?: boolean
    stateAfterJson?: boolean
  }

  export type AgentExperienceInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    run?: boolean | SimulationRunDefaultArgs<ExtArgs>
    agent?: boolean | AgentDefaultArgs<ExtArgs>
  }
  export type AgentExperienceIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    run?: boolean | SimulationRunDefaultArgs<ExtArgs>
    agent?: boolean | AgentDefaultArgs<ExtArgs>
  }

  export type $AgentExperiencePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "AgentExperience"
    objects: {
      run: Prisma.$SimulationRunPayload<ExtArgs>
      agent: Prisma.$AgentPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      runId: string
      agentId: string
      step: number
      ts: Date
      actionJson: Prisma.JsonValue | null
      signalsJson: Prisma.JsonValue | null
      pnl: number | null
      drawdown: number | null
      reward: number | null
      learningMetaJson: Prisma.JsonValue | null
      stateBeforeJson: Prisma.JsonValue | null
      stateAfterJson: Prisma.JsonValue | null
    }, ExtArgs["result"]["agentExperience"]>
    composites: {}
  }

  type AgentExperienceGetPayload<S extends boolean | null | undefined | AgentExperienceDefaultArgs> = $Result.GetResult<Prisma.$AgentExperiencePayload, S>

  type AgentExperienceCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<AgentExperienceFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: AgentExperienceCountAggregateInputType | true
    }

  export interface AgentExperienceDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['AgentExperience'], meta: { name: 'AgentExperience' } }
    /**
     * Find zero or one AgentExperience that matches the filter.
     * @param {AgentExperienceFindUniqueArgs} args - Arguments to find a AgentExperience
     * @example
     * // Get one AgentExperience
     * const agentExperience = await prisma.agentExperience.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends AgentExperienceFindUniqueArgs>(args: SelectSubset<T, AgentExperienceFindUniqueArgs<ExtArgs>>): Prisma__AgentExperienceClient<$Result.GetResult<Prisma.$AgentExperiencePayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one AgentExperience that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {AgentExperienceFindUniqueOrThrowArgs} args - Arguments to find a AgentExperience
     * @example
     * // Get one AgentExperience
     * const agentExperience = await prisma.agentExperience.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends AgentExperienceFindUniqueOrThrowArgs>(args: SelectSubset<T, AgentExperienceFindUniqueOrThrowArgs<ExtArgs>>): Prisma__AgentExperienceClient<$Result.GetResult<Prisma.$AgentExperiencePayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first AgentExperience that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgentExperienceFindFirstArgs} args - Arguments to find a AgentExperience
     * @example
     * // Get one AgentExperience
     * const agentExperience = await prisma.agentExperience.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends AgentExperienceFindFirstArgs>(args?: SelectSubset<T, AgentExperienceFindFirstArgs<ExtArgs>>): Prisma__AgentExperienceClient<$Result.GetResult<Prisma.$AgentExperiencePayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first AgentExperience that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgentExperienceFindFirstOrThrowArgs} args - Arguments to find a AgentExperience
     * @example
     * // Get one AgentExperience
     * const agentExperience = await prisma.agentExperience.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends AgentExperienceFindFirstOrThrowArgs>(args?: SelectSubset<T, AgentExperienceFindFirstOrThrowArgs<ExtArgs>>): Prisma__AgentExperienceClient<$Result.GetResult<Prisma.$AgentExperiencePayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more AgentExperiences that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgentExperienceFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all AgentExperiences
     * const agentExperiences = await prisma.agentExperience.findMany()
     * 
     * // Get first 10 AgentExperiences
     * const agentExperiences = await prisma.agentExperience.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const agentExperienceWithIdOnly = await prisma.agentExperience.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends AgentExperienceFindManyArgs>(args?: SelectSubset<T, AgentExperienceFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AgentExperiencePayload<ExtArgs>, T, "findMany">>

    /**
     * Create a AgentExperience.
     * @param {AgentExperienceCreateArgs} args - Arguments to create a AgentExperience.
     * @example
     * // Create one AgentExperience
     * const AgentExperience = await prisma.agentExperience.create({
     *   data: {
     *     // ... data to create a AgentExperience
     *   }
     * })
     * 
     */
    create<T extends AgentExperienceCreateArgs>(args: SelectSubset<T, AgentExperienceCreateArgs<ExtArgs>>): Prisma__AgentExperienceClient<$Result.GetResult<Prisma.$AgentExperiencePayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many AgentExperiences.
     * @param {AgentExperienceCreateManyArgs} args - Arguments to create many AgentExperiences.
     * @example
     * // Create many AgentExperiences
     * const agentExperience = await prisma.agentExperience.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends AgentExperienceCreateManyArgs>(args?: SelectSubset<T, AgentExperienceCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many AgentExperiences and returns the data saved in the database.
     * @param {AgentExperienceCreateManyAndReturnArgs} args - Arguments to create many AgentExperiences.
     * @example
     * // Create many AgentExperiences
     * const agentExperience = await prisma.agentExperience.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many AgentExperiences and only return the `id`
     * const agentExperienceWithIdOnly = await prisma.agentExperience.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends AgentExperienceCreateManyAndReturnArgs>(args?: SelectSubset<T, AgentExperienceCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$AgentExperiencePayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a AgentExperience.
     * @param {AgentExperienceDeleteArgs} args - Arguments to delete one AgentExperience.
     * @example
     * // Delete one AgentExperience
     * const AgentExperience = await prisma.agentExperience.delete({
     *   where: {
     *     // ... filter to delete one AgentExperience
     *   }
     * })
     * 
     */
    delete<T extends AgentExperienceDeleteArgs>(args: SelectSubset<T, AgentExperienceDeleteArgs<ExtArgs>>): Prisma__AgentExperienceClient<$Result.GetResult<Prisma.$AgentExperiencePayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one AgentExperience.
     * @param {AgentExperienceUpdateArgs} args - Arguments to update one AgentExperience.
     * @example
     * // Update one AgentExperience
     * const agentExperience = await prisma.agentExperience.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends AgentExperienceUpdateArgs>(args: SelectSubset<T, AgentExperienceUpdateArgs<ExtArgs>>): Prisma__AgentExperienceClient<$Result.GetResult<Prisma.$AgentExperiencePayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more AgentExperiences.
     * @param {AgentExperienceDeleteManyArgs} args - Arguments to filter AgentExperiences to delete.
     * @example
     * // Delete a few AgentExperiences
     * const { count } = await prisma.agentExperience.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends AgentExperienceDeleteManyArgs>(args?: SelectSubset<T, AgentExperienceDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more AgentExperiences.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgentExperienceUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many AgentExperiences
     * const agentExperience = await prisma.agentExperience.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends AgentExperienceUpdateManyArgs>(args: SelectSubset<T, AgentExperienceUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one AgentExperience.
     * @param {AgentExperienceUpsertArgs} args - Arguments to update or create a AgentExperience.
     * @example
     * // Update or create a AgentExperience
     * const agentExperience = await prisma.agentExperience.upsert({
     *   create: {
     *     // ... data to create a AgentExperience
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the AgentExperience we want to update
     *   }
     * })
     */
    upsert<T extends AgentExperienceUpsertArgs>(args: SelectSubset<T, AgentExperienceUpsertArgs<ExtArgs>>): Prisma__AgentExperienceClient<$Result.GetResult<Prisma.$AgentExperiencePayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of AgentExperiences.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgentExperienceCountArgs} args - Arguments to filter AgentExperiences to count.
     * @example
     * // Count the number of AgentExperiences
     * const count = await prisma.agentExperience.count({
     *   where: {
     *     // ... the filter for the AgentExperiences we want to count
     *   }
     * })
    **/
    count<T extends AgentExperienceCountArgs>(
      args?: Subset<T, AgentExperienceCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], AgentExperienceCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a AgentExperience.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgentExperienceAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends AgentExperienceAggregateArgs>(args: Subset<T, AgentExperienceAggregateArgs>): Prisma.PrismaPromise<GetAgentExperienceAggregateType<T>>

    /**
     * Group by AgentExperience.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {AgentExperienceGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends AgentExperienceGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: AgentExperienceGroupByArgs['orderBy'] }
        : { orderBy?: AgentExperienceGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, AgentExperienceGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetAgentExperienceGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the AgentExperience model
   */
  readonly fields: AgentExperienceFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for AgentExperience.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__AgentExperienceClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    run<T extends SimulationRunDefaultArgs<ExtArgs> = {}>(args?: Subset<T, SimulationRunDefaultArgs<ExtArgs>>): Prisma__SimulationRunClient<$Result.GetResult<Prisma.$SimulationRunPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    agent<T extends AgentDefaultArgs<ExtArgs> = {}>(args?: Subset<T, AgentDefaultArgs<ExtArgs>>): Prisma__AgentClient<$Result.GetResult<Prisma.$AgentPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the AgentExperience model
   */ 
  interface AgentExperienceFieldRefs {
    readonly id: FieldRef<"AgentExperience", 'String'>
    readonly runId: FieldRef<"AgentExperience", 'String'>
    readonly agentId: FieldRef<"AgentExperience", 'String'>
    readonly step: FieldRef<"AgentExperience", 'Int'>
    readonly ts: FieldRef<"AgentExperience", 'DateTime'>
    readonly actionJson: FieldRef<"AgentExperience", 'Json'>
    readonly signalsJson: FieldRef<"AgentExperience", 'Json'>
    readonly pnl: FieldRef<"AgentExperience", 'Float'>
    readonly drawdown: FieldRef<"AgentExperience", 'Float'>
    readonly reward: FieldRef<"AgentExperience", 'Float'>
    readonly learningMetaJson: FieldRef<"AgentExperience", 'Json'>
    readonly stateBeforeJson: FieldRef<"AgentExperience", 'Json'>
    readonly stateAfterJson: FieldRef<"AgentExperience", 'Json'>
  }
    

  // Custom InputTypes
  /**
   * AgentExperience findUnique
   */
  export type AgentExperienceFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgentExperience
     */
    select?: AgentExperienceSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentExperienceInclude<ExtArgs> | null
    /**
     * Filter, which AgentExperience to fetch.
     */
    where: AgentExperienceWhereUniqueInput
  }

  /**
   * AgentExperience findUniqueOrThrow
   */
  export type AgentExperienceFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgentExperience
     */
    select?: AgentExperienceSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentExperienceInclude<ExtArgs> | null
    /**
     * Filter, which AgentExperience to fetch.
     */
    where: AgentExperienceWhereUniqueInput
  }

  /**
   * AgentExperience findFirst
   */
  export type AgentExperienceFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgentExperience
     */
    select?: AgentExperienceSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentExperienceInclude<ExtArgs> | null
    /**
     * Filter, which AgentExperience to fetch.
     */
    where?: AgentExperienceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AgentExperiences to fetch.
     */
    orderBy?: AgentExperienceOrderByWithRelationInput | AgentExperienceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AgentExperiences.
     */
    cursor?: AgentExperienceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AgentExperiences from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AgentExperiences.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AgentExperiences.
     */
    distinct?: AgentExperienceScalarFieldEnum | AgentExperienceScalarFieldEnum[]
  }

  /**
   * AgentExperience findFirstOrThrow
   */
  export type AgentExperienceFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgentExperience
     */
    select?: AgentExperienceSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentExperienceInclude<ExtArgs> | null
    /**
     * Filter, which AgentExperience to fetch.
     */
    where?: AgentExperienceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AgentExperiences to fetch.
     */
    orderBy?: AgentExperienceOrderByWithRelationInput | AgentExperienceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for AgentExperiences.
     */
    cursor?: AgentExperienceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AgentExperiences from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AgentExperiences.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of AgentExperiences.
     */
    distinct?: AgentExperienceScalarFieldEnum | AgentExperienceScalarFieldEnum[]
  }

  /**
   * AgentExperience findMany
   */
  export type AgentExperienceFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgentExperience
     */
    select?: AgentExperienceSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentExperienceInclude<ExtArgs> | null
    /**
     * Filter, which AgentExperiences to fetch.
     */
    where?: AgentExperienceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of AgentExperiences to fetch.
     */
    orderBy?: AgentExperienceOrderByWithRelationInput | AgentExperienceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing AgentExperiences.
     */
    cursor?: AgentExperienceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` AgentExperiences from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` AgentExperiences.
     */
    skip?: number
    distinct?: AgentExperienceScalarFieldEnum | AgentExperienceScalarFieldEnum[]
  }

  /**
   * AgentExperience create
   */
  export type AgentExperienceCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgentExperience
     */
    select?: AgentExperienceSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentExperienceInclude<ExtArgs> | null
    /**
     * The data needed to create a AgentExperience.
     */
    data: XOR<AgentExperienceCreateInput, AgentExperienceUncheckedCreateInput>
  }

  /**
   * AgentExperience createMany
   */
  export type AgentExperienceCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many AgentExperiences.
     */
    data: AgentExperienceCreateManyInput | AgentExperienceCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * AgentExperience createManyAndReturn
   */
  export type AgentExperienceCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgentExperience
     */
    select?: AgentExperienceSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many AgentExperiences.
     */
    data: AgentExperienceCreateManyInput | AgentExperienceCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentExperienceIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * AgentExperience update
   */
  export type AgentExperienceUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgentExperience
     */
    select?: AgentExperienceSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentExperienceInclude<ExtArgs> | null
    /**
     * The data needed to update a AgentExperience.
     */
    data: XOR<AgentExperienceUpdateInput, AgentExperienceUncheckedUpdateInput>
    /**
     * Choose, which AgentExperience to update.
     */
    where: AgentExperienceWhereUniqueInput
  }

  /**
   * AgentExperience updateMany
   */
  export type AgentExperienceUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update AgentExperiences.
     */
    data: XOR<AgentExperienceUpdateManyMutationInput, AgentExperienceUncheckedUpdateManyInput>
    /**
     * Filter which AgentExperiences to update
     */
    where?: AgentExperienceWhereInput
  }

  /**
   * AgentExperience upsert
   */
  export type AgentExperienceUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgentExperience
     */
    select?: AgentExperienceSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentExperienceInclude<ExtArgs> | null
    /**
     * The filter to search for the AgentExperience to update in case it exists.
     */
    where: AgentExperienceWhereUniqueInput
    /**
     * In case the AgentExperience found by the `where` argument doesn't exist, create a new AgentExperience with this data.
     */
    create: XOR<AgentExperienceCreateInput, AgentExperienceUncheckedCreateInput>
    /**
     * In case the AgentExperience was found with the provided `where` argument, update it with this data.
     */
    update: XOR<AgentExperienceUpdateInput, AgentExperienceUncheckedUpdateInput>
  }

  /**
   * AgentExperience delete
   */
  export type AgentExperienceDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgentExperience
     */
    select?: AgentExperienceSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentExperienceInclude<ExtArgs> | null
    /**
     * Filter which AgentExperience to delete.
     */
    where: AgentExperienceWhereUniqueInput
  }

  /**
   * AgentExperience deleteMany
   */
  export type AgentExperienceDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which AgentExperiences to delete
     */
    where?: AgentExperienceWhereInput
  }

  /**
   * AgentExperience without action
   */
  export type AgentExperienceDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the AgentExperience
     */
    select?: AgentExperienceSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: AgentExperienceInclude<ExtArgs> | null
  }


  /**
   * Model CrowdSnapshot
   */

  export type AggregateCrowdSnapshot = {
    _count: CrowdSnapshotCountAggregateOutputType | null
    _avg: CrowdSnapshotAvgAggregateOutputType | null
    _sum: CrowdSnapshotSumAggregateOutputType | null
    _min: CrowdSnapshotMinAggregateOutputType | null
    _max: CrowdSnapshotMaxAggregateOutputType | null
  }

  export type CrowdSnapshotAvgAggregateOutputType = {
    step: number | null
    confidence: number | null
  }

  export type CrowdSnapshotSumAggregateOutputType = {
    step: number | null
    confidence: number | null
  }

  export type CrowdSnapshotMinAggregateOutputType = {
    id: string | null
    runId: string | null
    step: number | null
    ts: Date | null
    confidence: number | null
  }

  export type CrowdSnapshotMaxAggregateOutputType = {
    id: string | null
    runId: string | null
    step: number | null
    ts: Date | null
    confidence: number | null
  }

  export type CrowdSnapshotCountAggregateOutputType = {
    id: number
    runId: number
    step: number
    ts: number
    aggregationJson: number
    confidence: number
    _all: number
  }


  export type CrowdSnapshotAvgAggregateInputType = {
    step?: true
    confidence?: true
  }

  export type CrowdSnapshotSumAggregateInputType = {
    step?: true
    confidence?: true
  }

  export type CrowdSnapshotMinAggregateInputType = {
    id?: true
    runId?: true
    step?: true
    ts?: true
    confidence?: true
  }

  export type CrowdSnapshotMaxAggregateInputType = {
    id?: true
    runId?: true
    step?: true
    ts?: true
    confidence?: true
  }

  export type CrowdSnapshotCountAggregateInputType = {
    id?: true
    runId?: true
    step?: true
    ts?: true
    aggregationJson?: true
    confidence?: true
    _all?: true
  }

  export type CrowdSnapshotAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CrowdSnapshot to aggregate.
     */
    where?: CrowdSnapshotWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CrowdSnapshots to fetch.
     */
    orderBy?: CrowdSnapshotOrderByWithRelationInput | CrowdSnapshotOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: CrowdSnapshotWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CrowdSnapshots from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CrowdSnapshots.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned CrowdSnapshots
    **/
    _count?: true | CrowdSnapshotCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: CrowdSnapshotAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: CrowdSnapshotSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: CrowdSnapshotMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: CrowdSnapshotMaxAggregateInputType
  }

  export type GetCrowdSnapshotAggregateType<T extends CrowdSnapshotAggregateArgs> = {
        [P in keyof T & keyof AggregateCrowdSnapshot]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateCrowdSnapshot[P]>
      : GetScalarType<T[P], AggregateCrowdSnapshot[P]>
  }




  export type CrowdSnapshotGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: CrowdSnapshotWhereInput
    orderBy?: CrowdSnapshotOrderByWithAggregationInput | CrowdSnapshotOrderByWithAggregationInput[]
    by: CrowdSnapshotScalarFieldEnum[] | CrowdSnapshotScalarFieldEnum
    having?: CrowdSnapshotScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: CrowdSnapshotCountAggregateInputType | true
    _avg?: CrowdSnapshotAvgAggregateInputType
    _sum?: CrowdSnapshotSumAggregateInputType
    _min?: CrowdSnapshotMinAggregateInputType
    _max?: CrowdSnapshotMaxAggregateInputType
  }

  export type CrowdSnapshotGroupByOutputType = {
    id: string
    runId: string
    step: number
    ts: Date
    aggregationJson: JsonValue | null
    confidence: number | null
    _count: CrowdSnapshotCountAggregateOutputType | null
    _avg: CrowdSnapshotAvgAggregateOutputType | null
    _sum: CrowdSnapshotSumAggregateOutputType | null
    _min: CrowdSnapshotMinAggregateOutputType | null
    _max: CrowdSnapshotMaxAggregateOutputType | null
  }

  type GetCrowdSnapshotGroupByPayload<T extends CrowdSnapshotGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<CrowdSnapshotGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof CrowdSnapshotGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], CrowdSnapshotGroupByOutputType[P]>
            : GetScalarType<T[P], CrowdSnapshotGroupByOutputType[P]>
        }
      >
    >


  export type CrowdSnapshotSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    runId?: boolean
    step?: boolean
    ts?: boolean
    aggregationJson?: boolean
    confidence?: boolean
    run?: boolean | SimulationRunDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["crowdSnapshot"]>

  export type CrowdSnapshotSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    runId?: boolean
    step?: boolean
    ts?: boolean
    aggregationJson?: boolean
    confidence?: boolean
    run?: boolean | SimulationRunDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["crowdSnapshot"]>

  export type CrowdSnapshotSelectScalar = {
    id?: boolean
    runId?: boolean
    step?: boolean
    ts?: boolean
    aggregationJson?: boolean
    confidence?: boolean
  }

  export type CrowdSnapshotInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    run?: boolean | SimulationRunDefaultArgs<ExtArgs>
  }
  export type CrowdSnapshotIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    run?: boolean | SimulationRunDefaultArgs<ExtArgs>
  }

  export type $CrowdSnapshotPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "CrowdSnapshot"
    objects: {
      run: Prisma.$SimulationRunPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      runId: string
      step: number
      ts: Date
      aggregationJson: Prisma.JsonValue | null
      confidence: number | null
    }, ExtArgs["result"]["crowdSnapshot"]>
    composites: {}
  }

  type CrowdSnapshotGetPayload<S extends boolean | null | undefined | CrowdSnapshotDefaultArgs> = $Result.GetResult<Prisma.$CrowdSnapshotPayload, S>

  type CrowdSnapshotCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<CrowdSnapshotFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: CrowdSnapshotCountAggregateInputType | true
    }

  export interface CrowdSnapshotDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['CrowdSnapshot'], meta: { name: 'CrowdSnapshot' } }
    /**
     * Find zero or one CrowdSnapshot that matches the filter.
     * @param {CrowdSnapshotFindUniqueArgs} args - Arguments to find a CrowdSnapshot
     * @example
     * // Get one CrowdSnapshot
     * const crowdSnapshot = await prisma.crowdSnapshot.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends CrowdSnapshotFindUniqueArgs>(args: SelectSubset<T, CrowdSnapshotFindUniqueArgs<ExtArgs>>): Prisma__CrowdSnapshotClient<$Result.GetResult<Prisma.$CrowdSnapshotPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one CrowdSnapshot that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {CrowdSnapshotFindUniqueOrThrowArgs} args - Arguments to find a CrowdSnapshot
     * @example
     * // Get one CrowdSnapshot
     * const crowdSnapshot = await prisma.crowdSnapshot.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends CrowdSnapshotFindUniqueOrThrowArgs>(args: SelectSubset<T, CrowdSnapshotFindUniqueOrThrowArgs<ExtArgs>>): Prisma__CrowdSnapshotClient<$Result.GetResult<Prisma.$CrowdSnapshotPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first CrowdSnapshot that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CrowdSnapshotFindFirstArgs} args - Arguments to find a CrowdSnapshot
     * @example
     * // Get one CrowdSnapshot
     * const crowdSnapshot = await prisma.crowdSnapshot.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends CrowdSnapshotFindFirstArgs>(args?: SelectSubset<T, CrowdSnapshotFindFirstArgs<ExtArgs>>): Prisma__CrowdSnapshotClient<$Result.GetResult<Prisma.$CrowdSnapshotPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first CrowdSnapshot that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CrowdSnapshotFindFirstOrThrowArgs} args - Arguments to find a CrowdSnapshot
     * @example
     * // Get one CrowdSnapshot
     * const crowdSnapshot = await prisma.crowdSnapshot.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends CrowdSnapshotFindFirstOrThrowArgs>(args?: SelectSubset<T, CrowdSnapshotFindFirstOrThrowArgs<ExtArgs>>): Prisma__CrowdSnapshotClient<$Result.GetResult<Prisma.$CrowdSnapshotPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more CrowdSnapshots that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CrowdSnapshotFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all CrowdSnapshots
     * const crowdSnapshots = await prisma.crowdSnapshot.findMany()
     * 
     * // Get first 10 CrowdSnapshots
     * const crowdSnapshots = await prisma.crowdSnapshot.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const crowdSnapshotWithIdOnly = await prisma.crowdSnapshot.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends CrowdSnapshotFindManyArgs>(args?: SelectSubset<T, CrowdSnapshotFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CrowdSnapshotPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a CrowdSnapshot.
     * @param {CrowdSnapshotCreateArgs} args - Arguments to create a CrowdSnapshot.
     * @example
     * // Create one CrowdSnapshot
     * const CrowdSnapshot = await prisma.crowdSnapshot.create({
     *   data: {
     *     // ... data to create a CrowdSnapshot
     *   }
     * })
     * 
     */
    create<T extends CrowdSnapshotCreateArgs>(args: SelectSubset<T, CrowdSnapshotCreateArgs<ExtArgs>>): Prisma__CrowdSnapshotClient<$Result.GetResult<Prisma.$CrowdSnapshotPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many CrowdSnapshots.
     * @param {CrowdSnapshotCreateManyArgs} args - Arguments to create many CrowdSnapshots.
     * @example
     * // Create many CrowdSnapshots
     * const crowdSnapshot = await prisma.crowdSnapshot.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends CrowdSnapshotCreateManyArgs>(args?: SelectSubset<T, CrowdSnapshotCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many CrowdSnapshots and returns the data saved in the database.
     * @param {CrowdSnapshotCreateManyAndReturnArgs} args - Arguments to create many CrowdSnapshots.
     * @example
     * // Create many CrowdSnapshots
     * const crowdSnapshot = await prisma.crowdSnapshot.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many CrowdSnapshots and only return the `id`
     * const crowdSnapshotWithIdOnly = await prisma.crowdSnapshot.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends CrowdSnapshotCreateManyAndReturnArgs>(args?: SelectSubset<T, CrowdSnapshotCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$CrowdSnapshotPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a CrowdSnapshot.
     * @param {CrowdSnapshotDeleteArgs} args - Arguments to delete one CrowdSnapshot.
     * @example
     * // Delete one CrowdSnapshot
     * const CrowdSnapshot = await prisma.crowdSnapshot.delete({
     *   where: {
     *     // ... filter to delete one CrowdSnapshot
     *   }
     * })
     * 
     */
    delete<T extends CrowdSnapshotDeleteArgs>(args: SelectSubset<T, CrowdSnapshotDeleteArgs<ExtArgs>>): Prisma__CrowdSnapshotClient<$Result.GetResult<Prisma.$CrowdSnapshotPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one CrowdSnapshot.
     * @param {CrowdSnapshotUpdateArgs} args - Arguments to update one CrowdSnapshot.
     * @example
     * // Update one CrowdSnapshot
     * const crowdSnapshot = await prisma.crowdSnapshot.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends CrowdSnapshotUpdateArgs>(args: SelectSubset<T, CrowdSnapshotUpdateArgs<ExtArgs>>): Prisma__CrowdSnapshotClient<$Result.GetResult<Prisma.$CrowdSnapshotPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more CrowdSnapshots.
     * @param {CrowdSnapshotDeleteManyArgs} args - Arguments to filter CrowdSnapshots to delete.
     * @example
     * // Delete a few CrowdSnapshots
     * const { count } = await prisma.crowdSnapshot.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends CrowdSnapshotDeleteManyArgs>(args?: SelectSubset<T, CrowdSnapshotDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more CrowdSnapshots.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CrowdSnapshotUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many CrowdSnapshots
     * const crowdSnapshot = await prisma.crowdSnapshot.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends CrowdSnapshotUpdateManyArgs>(args: SelectSubset<T, CrowdSnapshotUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one CrowdSnapshot.
     * @param {CrowdSnapshotUpsertArgs} args - Arguments to update or create a CrowdSnapshot.
     * @example
     * // Update or create a CrowdSnapshot
     * const crowdSnapshot = await prisma.crowdSnapshot.upsert({
     *   create: {
     *     // ... data to create a CrowdSnapshot
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the CrowdSnapshot we want to update
     *   }
     * })
     */
    upsert<T extends CrowdSnapshotUpsertArgs>(args: SelectSubset<T, CrowdSnapshotUpsertArgs<ExtArgs>>): Prisma__CrowdSnapshotClient<$Result.GetResult<Prisma.$CrowdSnapshotPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of CrowdSnapshots.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CrowdSnapshotCountArgs} args - Arguments to filter CrowdSnapshots to count.
     * @example
     * // Count the number of CrowdSnapshots
     * const count = await prisma.crowdSnapshot.count({
     *   where: {
     *     // ... the filter for the CrowdSnapshots we want to count
     *   }
     * })
    **/
    count<T extends CrowdSnapshotCountArgs>(
      args?: Subset<T, CrowdSnapshotCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], CrowdSnapshotCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a CrowdSnapshot.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CrowdSnapshotAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends CrowdSnapshotAggregateArgs>(args: Subset<T, CrowdSnapshotAggregateArgs>): Prisma.PrismaPromise<GetCrowdSnapshotAggregateType<T>>

    /**
     * Group by CrowdSnapshot.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {CrowdSnapshotGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends CrowdSnapshotGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: CrowdSnapshotGroupByArgs['orderBy'] }
        : { orderBy?: CrowdSnapshotGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, CrowdSnapshotGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetCrowdSnapshotGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the CrowdSnapshot model
   */
  readonly fields: CrowdSnapshotFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for CrowdSnapshot.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__CrowdSnapshotClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    run<T extends SimulationRunDefaultArgs<ExtArgs> = {}>(args?: Subset<T, SimulationRunDefaultArgs<ExtArgs>>): Prisma__SimulationRunClient<$Result.GetResult<Prisma.$SimulationRunPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the CrowdSnapshot model
   */ 
  interface CrowdSnapshotFieldRefs {
    readonly id: FieldRef<"CrowdSnapshot", 'String'>
    readonly runId: FieldRef<"CrowdSnapshot", 'String'>
    readonly step: FieldRef<"CrowdSnapshot", 'Int'>
    readonly ts: FieldRef<"CrowdSnapshot", 'DateTime'>
    readonly aggregationJson: FieldRef<"CrowdSnapshot", 'Json'>
    readonly confidence: FieldRef<"CrowdSnapshot", 'Float'>
  }
    

  // Custom InputTypes
  /**
   * CrowdSnapshot findUnique
   */
  export type CrowdSnapshotFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CrowdSnapshot
     */
    select?: CrowdSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CrowdSnapshotInclude<ExtArgs> | null
    /**
     * Filter, which CrowdSnapshot to fetch.
     */
    where: CrowdSnapshotWhereUniqueInput
  }

  /**
   * CrowdSnapshot findUniqueOrThrow
   */
  export type CrowdSnapshotFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CrowdSnapshot
     */
    select?: CrowdSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CrowdSnapshotInclude<ExtArgs> | null
    /**
     * Filter, which CrowdSnapshot to fetch.
     */
    where: CrowdSnapshotWhereUniqueInput
  }

  /**
   * CrowdSnapshot findFirst
   */
  export type CrowdSnapshotFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CrowdSnapshot
     */
    select?: CrowdSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CrowdSnapshotInclude<ExtArgs> | null
    /**
     * Filter, which CrowdSnapshot to fetch.
     */
    where?: CrowdSnapshotWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CrowdSnapshots to fetch.
     */
    orderBy?: CrowdSnapshotOrderByWithRelationInput | CrowdSnapshotOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CrowdSnapshots.
     */
    cursor?: CrowdSnapshotWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CrowdSnapshots from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CrowdSnapshots.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CrowdSnapshots.
     */
    distinct?: CrowdSnapshotScalarFieldEnum | CrowdSnapshotScalarFieldEnum[]
  }

  /**
   * CrowdSnapshot findFirstOrThrow
   */
  export type CrowdSnapshotFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CrowdSnapshot
     */
    select?: CrowdSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CrowdSnapshotInclude<ExtArgs> | null
    /**
     * Filter, which CrowdSnapshot to fetch.
     */
    where?: CrowdSnapshotWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CrowdSnapshots to fetch.
     */
    orderBy?: CrowdSnapshotOrderByWithRelationInput | CrowdSnapshotOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for CrowdSnapshots.
     */
    cursor?: CrowdSnapshotWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CrowdSnapshots from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CrowdSnapshots.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of CrowdSnapshots.
     */
    distinct?: CrowdSnapshotScalarFieldEnum | CrowdSnapshotScalarFieldEnum[]
  }

  /**
   * CrowdSnapshot findMany
   */
  export type CrowdSnapshotFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CrowdSnapshot
     */
    select?: CrowdSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CrowdSnapshotInclude<ExtArgs> | null
    /**
     * Filter, which CrowdSnapshots to fetch.
     */
    where?: CrowdSnapshotWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of CrowdSnapshots to fetch.
     */
    orderBy?: CrowdSnapshotOrderByWithRelationInput | CrowdSnapshotOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing CrowdSnapshots.
     */
    cursor?: CrowdSnapshotWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` CrowdSnapshots from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` CrowdSnapshots.
     */
    skip?: number
    distinct?: CrowdSnapshotScalarFieldEnum | CrowdSnapshotScalarFieldEnum[]
  }

  /**
   * CrowdSnapshot create
   */
  export type CrowdSnapshotCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CrowdSnapshot
     */
    select?: CrowdSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CrowdSnapshotInclude<ExtArgs> | null
    /**
     * The data needed to create a CrowdSnapshot.
     */
    data: XOR<CrowdSnapshotCreateInput, CrowdSnapshotUncheckedCreateInput>
  }

  /**
   * CrowdSnapshot createMany
   */
  export type CrowdSnapshotCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many CrowdSnapshots.
     */
    data: CrowdSnapshotCreateManyInput | CrowdSnapshotCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * CrowdSnapshot createManyAndReturn
   */
  export type CrowdSnapshotCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CrowdSnapshot
     */
    select?: CrowdSnapshotSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many CrowdSnapshots.
     */
    data: CrowdSnapshotCreateManyInput | CrowdSnapshotCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CrowdSnapshotIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * CrowdSnapshot update
   */
  export type CrowdSnapshotUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CrowdSnapshot
     */
    select?: CrowdSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CrowdSnapshotInclude<ExtArgs> | null
    /**
     * The data needed to update a CrowdSnapshot.
     */
    data: XOR<CrowdSnapshotUpdateInput, CrowdSnapshotUncheckedUpdateInput>
    /**
     * Choose, which CrowdSnapshot to update.
     */
    where: CrowdSnapshotWhereUniqueInput
  }

  /**
   * CrowdSnapshot updateMany
   */
  export type CrowdSnapshotUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update CrowdSnapshots.
     */
    data: XOR<CrowdSnapshotUpdateManyMutationInput, CrowdSnapshotUncheckedUpdateManyInput>
    /**
     * Filter which CrowdSnapshots to update
     */
    where?: CrowdSnapshotWhereInput
  }

  /**
   * CrowdSnapshot upsert
   */
  export type CrowdSnapshotUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CrowdSnapshot
     */
    select?: CrowdSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CrowdSnapshotInclude<ExtArgs> | null
    /**
     * The filter to search for the CrowdSnapshot to update in case it exists.
     */
    where: CrowdSnapshotWhereUniqueInput
    /**
     * In case the CrowdSnapshot found by the `where` argument doesn't exist, create a new CrowdSnapshot with this data.
     */
    create: XOR<CrowdSnapshotCreateInput, CrowdSnapshotUncheckedCreateInput>
    /**
     * In case the CrowdSnapshot was found with the provided `where` argument, update it with this data.
     */
    update: XOR<CrowdSnapshotUpdateInput, CrowdSnapshotUncheckedUpdateInput>
  }

  /**
   * CrowdSnapshot delete
   */
  export type CrowdSnapshotDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CrowdSnapshot
     */
    select?: CrowdSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CrowdSnapshotInclude<ExtArgs> | null
    /**
     * Filter which CrowdSnapshot to delete.
     */
    where: CrowdSnapshotWhereUniqueInput
  }

  /**
   * CrowdSnapshot deleteMany
   */
  export type CrowdSnapshotDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which CrowdSnapshots to delete
     */
    where?: CrowdSnapshotWhereInput
  }

  /**
   * CrowdSnapshot without action
   */
  export type CrowdSnapshotDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the CrowdSnapshot
     */
    select?: CrowdSnapshotSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: CrowdSnapshotInclude<ExtArgs> | null
  }


  /**
   * Model UserProfile
   */

  export type AggregateUserProfile = {
    _count: UserProfileCountAggregateOutputType | null
    _min: UserProfileMinAggregateOutputType | null
    _max: UserProfileMaxAggregateOutputType | null
  }

  export type UserProfileMinAggregateOutputType = {
    userId: string | null
    displayName: string | null
    createdAt: Date | null
  }

  export type UserProfileMaxAggregateOutputType = {
    userId: string | null
    displayName: string | null
    createdAt: Date | null
  }

  export type UserProfileCountAggregateOutputType = {
    userId: number
    displayName: number
    createdAt: number
    _all: number
  }


  export type UserProfileMinAggregateInputType = {
    userId?: true
    displayName?: true
    createdAt?: true
  }

  export type UserProfileMaxAggregateInputType = {
    userId?: true
    displayName?: true
    createdAt?: true
  }

  export type UserProfileCountAggregateInputType = {
    userId?: true
    displayName?: true
    createdAt?: true
    _all?: true
  }

  export type UserProfileAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserProfile to aggregate.
     */
    where?: UserProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserProfiles to fetch.
     */
    orderBy?: UserProfileOrderByWithRelationInput | UserProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned UserProfiles
    **/
    _count?: true | UserProfileCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserProfileMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserProfileMaxAggregateInputType
  }

  export type GetUserProfileAggregateType<T extends UserProfileAggregateArgs> = {
        [P in keyof T & keyof AggregateUserProfile]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUserProfile[P]>
      : GetScalarType<T[P], AggregateUserProfile[P]>
  }




  export type UserProfileGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserProfileWhereInput
    orderBy?: UserProfileOrderByWithAggregationInput | UserProfileOrderByWithAggregationInput[]
    by: UserProfileScalarFieldEnum[] | UserProfileScalarFieldEnum
    having?: UserProfileScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserProfileCountAggregateInputType | true
    _min?: UserProfileMinAggregateInputType
    _max?: UserProfileMaxAggregateInputType
  }

  export type UserProfileGroupByOutputType = {
    userId: string
    displayName: string
    createdAt: Date
    _count: UserProfileCountAggregateOutputType | null
    _min: UserProfileMinAggregateOutputType | null
    _max: UserProfileMaxAggregateOutputType | null
  }

  type GetUserProfileGroupByPayload<T extends UserProfileGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserProfileGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserProfileGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserProfileGroupByOutputType[P]>
            : GetScalarType<T[P], UserProfileGroupByOutputType[P]>
        }
      >
    >


  export type UserProfileSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    displayName?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["userProfile"]>

  export type UserProfileSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    displayName?: boolean
    createdAt?: boolean
  }, ExtArgs["result"]["userProfile"]>

  export type UserProfileSelectScalar = {
    userId?: boolean
    displayName?: boolean
    createdAt?: boolean
  }


  export type $UserProfilePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "UserProfile"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      userId: string
      displayName: string
      createdAt: Date
    }, ExtArgs["result"]["userProfile"]>
    composites: {}
  }

  type UserProfileGetPayload<S extends boolean | null | undefined | UserProfileDefaultArgs> = $Result.GetResult<Prisma.$UserProfilePayload, S>

  type UserProfileCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<UserProfileFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: UserProfileCountAggregateInputType | true
    }

  export interface UserProfileDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['UserProfile'], meta: { name: 'UserProfile' } }
    /**
     * Find zero or one UserProfile that matches the filter.
     * @param {UserProfileFindUniqueArgs} args - Arguments to find a UserProfile
     * @example
     * // Get one UserProfile
     * const userProfile = await prisma.userProfile.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserProfileFindUniqueArgs>(args: SelectSubset<T, UserProfileFindUniqueArgs<ExtArgs>>): Prisma__UserProfileClient<$Result.GetResult<Prisma.$UserProfilePayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one UserProfile that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {UserProfileFindUniqueOrThrowArgs} args - Arguments to find a UserProfile
     * @example
     * // Get one UserProfile
     * const userProfile = await prisma.userProfile.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserProfileFindUniqueOrThrowArgs>(args: SelectSubset<T, UserProfileFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserProfileClient<$Result.GetResult<Prisma.$UserProfilePayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first UserProfile that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserProfileFindFirstArgs} args - Arguments to find a UserProfile
     * @example
     * // Get one UserProfile
     * const userProfile = await prisma.userProfile.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserProfileFindFirstArgs>(args?: SelectSubset<T, UserProfileFindFirstArgs<ExtArgs>>): Prisma__UserProfileClient<$Result.GetResult<Prisma.$UserProfilePayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first UserProfile that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserProfileFindFirstOrThrowArgs} args - Arguments to find a UserProfile
     * @example
     * // Get one UserProfile
     * const userProfile = await prisma.userProfile.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserProfileFindFirstOrThrowArgs>(args?: SelectSubset<T, UserProfileFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserProfileClient<$Result.GetResult<Prisma.$UserProfilePayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more UserProfiles that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserProfileFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all UserProfiles
     * const userProfiles = await prisma.userProfile.findMany()
     * 
     * // Get first 10 UserProfiles
     * const userProfiles = await prisma.userProfile.findMany({ take: 10 })
     * 
     * // Only select the `userId`
     * const userProfileWithUserIdOnly = await prisma.userProfile.findMany({ select: { userId: true } })
     * 
     */
    findMany<T extends UserProfileFindManyArgs>(args?: SelectSubset<T, UserProfileFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserProfilePayload<ExtArgs>, T, "findMany">>

    /**
     * Create a UserProfile.
     * @param {UserProfileCreateArgs} args - Arguments to create a UserProfile.
     * @example
     * // Create one UserProfile
     * const UserProfile = await prisma.userProfile.create({
     *   data: {
     *     // ... data to create a UserProfile
     *   }
     * })
     * 
     */
    create<T extends UserProfileCreateArgs>(args: SelectSubset<T, UserProfileCreateArgs<ExtArgs>>): Prisma__UserProfileClient<$Result.GetResult<Prisma.$UserProfilePayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many UserProfiles.
     * @param {UserProfileCreateManyArgs} args - Arguments to create many UserProfiles.
     * @example
     * // Create many UserProfiles
     * const userProfile = await prisma.userProfile.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserProfileCreateManyArgs>(args?: SelectSubset<T, UserProfileCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many UserProfiles and returns the data saved in the database.
     * @param {UserProfileCreateManyAndReturnArgs} args - Arguments to create many UserProfiles.
     * @example
     * // Create many UserProfiles
     * const userProfile = await prisma.userProfile.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many UserProfiles and only return the `userId`
     * const userProfileWithUserIdOnly = await prisma.userProfile.createManyAndReturn({ 
     *   select: { userId: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserProfileCreateManyAndReturnArgs>(args?: SelectSubset<T, UserProfileCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserProfilePayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a UserProfile.
     * @param {UserProfileDeleteArgs} args - Arguments to delete one UserProfile.
     * @example
     * // Delete one UserProfile
     * const UserProfile = await prisma.userProfile.delete({
     *   where: {
     *     // ... filter to delete one UserProfile
     *   }
     * })
     * 
     */
    delete<T extends UserProfileDeleteArgs>(args: SelectSubset<T, UserProfileDeleteArgs<ExtArgs>>): Prisma__UserProfileClient<$Result.GetResult<Prisma.$UserProfilePayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one UserProfile.
     * @param {UserProfileUpdateArgs} args - Arguments to update one UserProfile.
     * @example
     * // Update one UserProfile
     * const userProfile = await prisma.userProfile.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserProfileUpdateArgs>(args: SelectSubset<T, UserProfileUpdateArgs<ExtArgs>>): Prisma__UserProfileClient<$Result.GetResult<Prisma.$UserProfilePayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more UserProfiles.
     * @param {UserProfileDeleteManyArgs} args - Arguments to filter UserProfiles to delete.
     * @example
     * // Delete a few UserProfiles
     * const { count } = await prisma.userProfile.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserProfileDeleteManyArgs>(args?: SelectSubset<T, UserProfileDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UserProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserProfileUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many UserProfiles
     * const userProfile = await prisma.userProfile.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserProfileUpdateManyArgs>(args: SelectSubset<T, UserProfileUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one UserProfile.
     * @param {UserProfileUpsertArgs} args - Arguments to update or create a UserProfile.
     * @example
     * // Update or create a UserProfile
     * const userProfile = await prisma.userProfile.upsert({
     *   create: {
     *     // ... data to create a UserProfile
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the UserProfile we want to update
     *   }
     * })
     */
    upsert<T extends UserProfileUpsertArgs>(args: SelectSubset<T, UserProfileUpsertArgs<ExtArgs>>): Prisma__UserProfileClient<$Result.GetResult<Prisma.$UserProfilePayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of UserProfiles.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserProfileCountArgs} args - Arguments to filter UserProfiles to count.
     * @example
     * // Count the number of UserProfiles
     * const count = await prisma.userProfile.count({
     *   where: {
     *     // ... the filter for the UserProfiles we want to count
     *   }
     * })
    **/
    count<T extends UserProfileCountArgs>(
      args?: Subset<T, UserProfileCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserProfileCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a UserProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserProfileAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserProfileAggregateArgs>(args: Subset<T, UserProfileAggregateArgs>): Prisma.PrismaPromise<GetUserProfileAggregateType<T>>

    /**
     * Group by UserProfile.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserProfileGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserProfileGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserProfileGroupByArgs['orderBy'] }
        : { orderBy?: UserProfileGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserProfileGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserProfileGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the UserProfile model
   */
  readonly fields: UserProfileFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for UserProfile.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserProfileClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the UserProfile model
   */ 
  interface UserProfileFieldRefs {
    readonly userId: FieldRef<"UserProfile", 'String'>
    readonly displayName: FieldRef<"UserProfile", 'String'>
    readonly createdAt: FieldRef<"UserProfile", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * UserProfile findUnique
   */
  export type UserProfileFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserProfile
     */
    select?: UserProfileSelect<ExtArgs> | null
    /**
     * Filter, which UserProfile to fetch.
     */
    where: UserProfileWhereUniqueInput
  }

  /**
   * UserProfile findUniqueOrThrow
   */
  export type UserProfileFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserProfile
     */
    select?: UserProfileSelect<ExtArgs> | null
    /**
     * Filter, which UserProfile to fetch.
     */
    where: UserProfileWhereUniqueInput
  }

  /**
   * UserProfile findFirst
   */
  export type UserProfileFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserProfile
     */
    select?: UserProfileSelect<ExtArgs> | null
    /**
     * Filter, which UserProfile to fetch.
     */
    where?: UserProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserProfiles to fetch.
     */
    orderBy?: UserProfileOrderByWithRelationInput | UserProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserProfiles.
     */
    cursor?: UserProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserProfiles.
     */
    distinct?: UserProfileScalarFieldEnum | UserProfileScalarFieldEnum[]
  }

  /**
   * UserProfile findFirstOrThrow
   */
  export type UserProfileFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserProfile
     */
    select?: UserProfileSelect<ExtArgs> | null
    /**
     * Filter, which UserProfile to fetch.
     */
    where?: UserProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserProfiles to fetch.
     */
    orderBy?: UserProfileOrderByWithRelationInput | UserProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserProfiles.
     */
    cursor?: UserProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserProfiles.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserProfiles.
     */
    distinct?: UserProfileScalarFieldEnum | UserProfileScalarFieldEnum[]
  }

  /**
   * UserProfile findMany
   */
  export type UserProfileFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserProfile
     */
    select?: UserProfileSelect<ExtArgs> | null
    /**
     * Filter, which UserProfiles to fetch.
     */
    where?: UserProfileWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserProfiles to fetch.
     */
    orderBy?: UserProfileOrderByWithRelationInput | UserProfileOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing UserProfiles.
     */
    cursor?: UserProfileWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserProfiles from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserProfiles.
     */
    skip?: number
    distinct?: UserProfileScalarFieldEnum | UserProfileScalarFieldEnum[]
  }

  /**
   * UserProfile create
   */
  export type UserProfileCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserProfile
     */
    select?: UserProfileSelect<ExtArgs> | null
    /**
     * The data needed to create a UserProfile.
     */
    data: XOR<UserProfileCreateInput, UserProfileUncheckedCreateInput>
  }

  /**
   * UserProfile createMany
   */
  export type UserProfileCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many UserProfiles.
     */
    data: UserProfileCreateManyInput | UserProfileCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * UserProfile createManyAndReturn
   */
  export type UserProfileCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserProfile
     */
    select?: UserProfileSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many UserProfiles.
     */
    data: UserProfileCreateManyInput | UserProfileCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * UserProfile update
   */
  export type UserProfileUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserProfile
     */
    select?: UserProfileSelect<ExtArgs> | null
    /**
     * The data needed to update a UserProfile.
     */
    data: XOR<UserProfileUpdateInput, UserProfileUncheckedUpdateInput>
    /**
     * Choose, which UserProfile to update.
     */
    where: UserProfileWhereUniqueInput
  }

  /**
   * UserProfile updateMany
   */
  export type UserProfileUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update UserProfiles.
     */
    data: XOR<UserProfileUpdateManyMutationInput, UserProfileUncheckedUpdateManyInput>
    /**
     * Filter which UserProfiles to update
     */
    where?: UserProfileWhereInput
  }

  /**
   * UserProfile upsert
   */
  export type UserProfileUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserProfile
     */
    select?: UserProfileSelect<ExtArgs> | null
    /**
     * The filter to search for the UserProfile to update in case it exists.
     */
    where: UserProfileWhereUniqueInput
    /**
     * In case the UserProfile found by the `where` argument doesn't exist, create a new UserProfile with this data.
     */
    create: XOR<UserProfileCreateInput, UserProfileUncheckedCreateInput>
    /**
     * In case the UserProfile was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserProfileUpdateInput, UserProfileUncheckedUpdateInput>
  }

  /**
   * UserProfile delete
   */
  export type UserProfileDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserProfile
     */
    select?: UserProfileSelect<ExtArgs> | null
    /**
     * Filter which UserProfile to delete.
     */
    where: UserProfileWhereUniqueInput
  }

  /**
   * UserProfile deleteMany
   */
  export type UserProfileDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserProfiles to delete
     */
    where?: UserProfileWhereInput
  }

  /**
   * UserProfile without action
   */
  export type UserProfileDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserProfile
     */
    select?: UserProfileSelect<ExtArgs> | null
  }


  /**
   * Model UserWallet
   */

  export type AggregateUserWallet = {
    _count: UserWalletCountAggregateOutputType | null
    _avg: UserWalletAvgAggregateOutputType | null
    _sum: UserWalletSumAggregateOutputType | null
    _min: UserWalletMinAggregateOutputType | null
    _max: UserWalletMaxAggregateOutputType | null
  }

  export type UserWalletAvgAggregateOutputType = {
    balance: number | null
  }

  export type UserWalletSumAggregateOutputType = {
    balance: number | null
  }

  export type UserWalletMinAggregateOutputType = {
    userId: string | null
    balance: number | null
    updatedAt: Date | null
  }

  export type UserWalletMaxAggregateOutputType = {
    userId: string | null
    balance: number | null
    updatedAt: Date | null
  }

  export type UserWalletCountAggregateOutputType = {
    userId: number
    balance: number
    updatedAt: number
    _all: number
  }


  export type UserWalletAvgAggregateInputType = {
    balance?: true
  }

  export type UserWalletSumAggregateInputType = {
    balance?: true
  }

  export type UserWalletMinAggregateInputType = {
    userId?: true
    balance?: true
    updatedAt?: true
  }

  export type UserWalletMaxAggregateInputType = {
    userId?: true
    balance?: true
    updatedAt?: true
  }

  export type UserWalletCountAggregateInputType = {
    userId?: true
    balance?: true
    updatedAt?: true
    _all?: true
  }

  export type UserWalletAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserWallet to aggregate.
     */
    where?: UserWalletWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserWallets to fetch.
     */
    orderBy?: UserWalletOrderByWithRelationInput | UserWalletOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWalletWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserWallets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserWallets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned UserWallets
    **/
    _count?: true | UserWalletCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: UserWalletAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: UserWalletSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserWalletMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserWalletMaxAggregateInputType
  }

  export type GetUserWalletAggregateType<T extends UserWalletAggregateArgs> = {
        [P in keyof T & keyof AggregateUserWallet]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUserWallet[P]>
      : GetScalarType<T[P], AggregateUserWallet[P]>
  }




  export type UserWalletGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWalletWhereInput
    orderBy?: UserWalletOrderByWithAggregationInput | UserWalletOrderByWithAggregationInput[]
    by: UserWalletScalarFieldEnum[] | UserWalletScalarFieldEnum
    having?: UserWalletScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserWalletCountAggregateInputType | true
    _avg?: UserWalletAvgAggregateInputType
    _sum?: UserWalletSumAggregateInputType
    _min?: UserWalletMinAggregateInputType
    _max?: UserWalletMaxAggregateInputType
  }

  export type UserWalletGroupByOutputType = {
    userId: string
    balance: number
    updatedAt: Date
    _count: UserWalletCountAggregateOutputType | null
    _avg: UserWalletAvgAggregateOutputType | null
    _sum: UserWalletSumAggregateOutputType | null
    _min: UserWalletMinAggregateOutputType | null
    _max: UserWalletMaxAggregateOutputType | null
  }

  type GetUserWalletGroupByPayload<T extends UserWalletGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserWalletGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserWalletGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserWalletGroupByOutputType[P]>
            : GetScalarType<T[P], UserWalletGroupByOutputType[P]>
        }
      >
    >


  export type UserWalletSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    balance?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["userWallet"]>

  export type UserWalletSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    balance?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["userWallet"]>

  export type UserWalletSelectScalar = {
    userId?: boolean
    balance?: boolean
    updatedAt?: boolean
  }


  export type $UserWalletPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "UserWallet"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      userId: string
      balance: number
      updatedAt: Date
    }, ExtArgs["result"]["userWallet"]>
    composites: {}
  }

  type UserWalletGetPayload<S extends boolean | null | undefined | UserWalletDefaultArgs> = $Result.GetResult<Prisma.$UserWalletPayload, S>

  type UserWalletCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<UserWalletFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: UserWalletCountAggregateInputType | true
    }

  export interface UserWalletDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['UserWallet'], meta: { name: 'UserWallet' } }
    /**
     * Find zero or one UserWallet that matches the filter.
     * @param {UserWalletFindUniqueArgs} args - Arguments to find a UserWallet
     * @example
     * // Get one UserWallet
     * const userWallet = await prisma.userWallet.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserWalletFindUniqueArgs>(args: SelectSubset<T, UserWalletFindUniqueArgs<ExtArgs>>): Prisma__UserWalletClient<$Result.GetResult<Prisma.$UserWalletPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one UserWallet that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {UserWalletFindUniqueOrThrowArgs} args - Arguments to find a UserWallet
     * @example
     * // Get one UserWallet
     * const userWallet = await prisma.userWallet.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserWalletFindUniqueOrThrowArgs>(args: SelectSubset<T, UserWalletFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserWalletClient<$Result.GetResult<Prisma.$UserWalletPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first UserWallet that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserWalletFindFirstArgs} args - Arguments to find a UserWallet
     * @example
     * // Get one UserWallet
     * const userWallet = await prisma.userWallet.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserWalletFindFirstArgs>(args?: SelectSubset<T, UserWalletFindFirstArgs<ExtArgs>>): Prisma__UserWalletClient<$Result.GetResult<Prisma.$UserWalletPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first UserWallet that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserWalletFindFirstOrThrowArgs} args - Arguments to find a UserWallet
     * @example
     * // Get one UserWallet
     * const userWallet = await prisma.userWallet.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserWalletFindFirstOrThrowArgs>(args?: SelectSubset<T, UserWalletFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserWalletClient<$Result.GetResult<Prisma.$UserWalletPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more UserWallets that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserWalletFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all UserWallets
     * const userWallets = await prisma.userWallet.findMany()
     * 
     * // Get first 10 UserWallets
     * const userWallets = await prisma.userWallet.findMany({ take: 10 })
     * 
     * // Only select the `userId`
     * const userWalletWithUserIdOnly = await prisma.userWallet.findMany({ select: { userId: true } })
     * 
     */
    findMany<T extends UserWalletFindManyArgs>(args?: SelectSubset<T, UserWalletFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserWalletPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a UserWallet.
     * @param {UserWalletCreateArgs} args - Arguments to create a UserWallet.
     * @example
     * // Create one UserWallet
     * const UserWallet = await prisma.userWallet.create({
     *   data: {
     *     // ... data to create a UserWallet
     *   }
     * })
     * 
     */
    create<T extends UserWalletCreateArgs>(args: SelectSubset<T, UserWalletCreateArgs<ExtArgs>>): Prisma__UserWalletClient<$Result.GetResult<Prisma.$UserWalletPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many UserWallets.
     * @param {UserWalletCreateManyArgs} args - Arguments to create many UserWallets.
     * @example
     * // Create many UserWallets
     * const userWallet = await prisma.userWallet.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserWalletCreateManyArgs>(args?: SelectSubset<T, UserWalletCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many UserWallets and returns the data saved in the database.
     * @param {UserWalletCreateManyAndReturnArgs} args - Arguments to create many UserWallets.
     * @example
     * // Create many UserWallets
     * const userWallet = await prisma.userWallet.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many UserWallets and only return the `userId`
     * const userWalletWithUserIdOnly = await prisma.userWallet.createManyAndReturn({ 
     *   select: { userId: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserWalletCreateManyAndReturnArgs>(args?: SelectSubset<T, UserWalletCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserWalletPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a UserWallet.
     * @param {UserWalletDeleteArgs} args - Arguments to delete one UserWallet.
     * @example
     * // Delete one UserWallet
     * const UserWallet = await prisma.userWallet.delete({
     *   where: {
     *     // ... filter to delete one UserWallet
     *   }
     * })
     * 
     */
    delete<T extends UserWalletDeleteArgs>(args: SelectSubset<T, UserWalletDeleteArgs<ExtArgs>>): Prisma__UserWalletClient<$Result.GetResult<Prisma.$UserWalletPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one UserWallet.
     * @param {UserWalletUpdateArgs} args - Arguments to update one UserWallet.
     * @example
     * // Update one UserWallet
     * const userWallet = await prisma.userWallet.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserWalletUpdateArgs>(args: SelectSubset<T, UserWalletUpdateArgs<ExtArgs>>): Prisma__UserWalletClient<$Result.GetResult<Prisma.$UserWalletPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more UserWallets.
     * @param {UserWalletDeleteManyArgs} args - Arguments to filter UserWallets to delete.
     * @example
     * // Delete a few UserWallets
     * const { count } = await prisma.userWallet.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserWalletDeleteManyArgs>(args?: SelectSubset<T, UserWalletDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UserWallets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserWalletUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many UserWallets
     * const userWallet = await prisma.userWallet.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserWalletUpdateManyArgs>(args: SelectSubset<T, UserWalletUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one UserWallet.
     * @param {UserWalletUpsertArgs} args - Arguments to update or create a UserWallet.
     * @example
     * // Update or create a UserWallet
     * const userWallet = await prisma.userWallet.upsert({
     *   create: {
     *     // ... data to create a UserWallet
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the UserWallet we want to update
     *   }
     * })
     */
    upsert<T extends UserWalletUpsertArgs>(args: SelectSubset<T, UserWalletUpsertArgs<ExtArgs>>): Prisma__UserWalletClient<$Result.GetResult<Prisma.$UserWalletPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of UserWallets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserWalletCountArgs} args - Arguments to filter UserWallets to count.
     * @example
     * // Count the number of UserWallets
     * const count = await prisma.userWallet.count({
     *   where: {
     *     // ... the filter for the UserWallets we want to count
     *   }
     * })
    **/
    count<T extends UserWalletCountArgs>(
      args?: Subset<T, UserWalletCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserWalletCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a UserWallet.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserWalletAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserWalletAggregateArgs>(args: Subset<T, UserWalletAggregateArgs>): Prisma.PrismaPromise<GetUserWalletAggregateType<T>>

    /**
     * Group by UserWallet.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserWalletGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserWalletGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserWalletGroupByArgs['orderBy'] }
        : { orderBy?: UserWalletGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserWalletGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserWalletGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the UserWallet model
   */
  readonly fields: UserWalletFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for UserWallet.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserWalletClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the UserWallet model
   */ 
  interface UserWalletFieldRefs {
    readonly userId: FieldRef<"UserWallet", 'String'>
    readonly balance: FieldRef<"UserWallet", 'Float'>
    readonly updatedAt: FieldRef<"UserWallet", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * UserWallet findUnique
   */
  export type UserWalletFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserWallet
     */
    select?: UserWalletSelect<ExtArgs> | null
    /**
     * Filter, which UserWallet to fetch.
     */
    where: UserWalletWhereUniqueInput
  }

  /**
   * UserWallet findUniqueOrThrow
   */
  export type UserWalletFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserWallet
     */
    select?: UserWalletSelect<ExtArgs> | null
    /**
     * Filter, which UserWallet to fetch.
     */
    where: UserWalletWhereUniqueInput
  }

  /**
   * UserWallet findFirst
   */
  export type UserWalletFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserWallet
     */
    select?: UserWalletSelect<ExtArgs> | null
    /**
     * Filter, which UserWallet to fetch.
     */
    where?: UserWalletWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserWallets to fetch.
     */
    orderBy?: UserWalletOrderByWithRelationInput | UserWalletOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserWallets.
     */
    cursor?: UserWalletWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserWallets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserWallets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserWallets.
     */
    distinct?: UserWalletScalarFieldEnum | UserWalletScalarFieldEnum[]
  }

  /**
   * UserWallet findFirstOrThrow
   */
  export type UserWalletFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserWallet
     */
    select?: UserWalletSelect<ExtArgs> | null
    /**
     * Filter, which UserWallet to fetch.
     */
    where?: UserWalletWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserWallets to fetch.
     */
    orderBy?: UserWalletOrderByWithRelationInput | UserWalletOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserWallets.
     */
    cursor?: UserWalletWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserWallets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserWallets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserWallets.
     */
    distinct?: UserWalletScalarFieldEnum | UserWalletScalarFieldEnum[]
  }

  /**
   * UserWallet findMany
   */
  export type UserWalletFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserWallet
     */
    select?: UserWalletSelect<ExtArgs> | null
    /**
     * Filter, which UserWallets to fetch.
     */
    where?: UserWalletWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserWallets to fetch.
     */
    orderBy?: UserWalletOrderByWithRelationInput | UserWalletOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing UserWallets.
     */
    cursor?: UserWalletWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserWallets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserWallets.
     */
    skip?: number
    distinct?: UserWalletScalarFieldEnum | UserWalletScalarFieldEnum[]
  }

  /**
   * UserWallet create
   */
  export type UserWalletCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserWallet
     */
    select?: UserWalletSelect<ExtArgs> | null
    /**
     * The data needed to create a UserWallet.
     */
    data: XOR<UserWalletCreateInput, UserWalletUncheckedCreateInput>
  }

  /**
   * UserWallet createMany
   */
  export type UserWalletCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many UserWallets.
     */
    data: UserWalletCreateManyInput | UserWalletCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * UserWallet createManyAndReturn
   */
  export type UserWalletCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserWallet
     */
    select?: UserWalletSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many UserWallets.
     */
    data: UserWalletCreateManyInput | UserWalletCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * UserWallet update
   */
  export type UserWalletUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserWallet
     */
    select?: UserWalletSelect<ExtArgs> | null
    /**
     * The data needed to update a UserWallet.
     */
    data: XOR<UserWalletUpdateInput, UserWalletUncheckedUpdateInput>
    /**
     * Choose, which UserWallet to update.
     */
    where: UserWalletWhereUniqueInput
  }

  /**
   * UserWallet updateMany
   */
  export type UserWalletUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update UserWallets.
     */
    data: XOR<UserWalletUpdateManyMutationInput, UserWalletUncheckedUpdateManyInput>
    /**
     * Filter which UserWallets to update
     */
    where?: UserWalletWhereInput
  }

  /**
   * UserWallet upsert
   */
  export type UserWalletUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserWallet
     */
    select?: UserWalletSelect<ExtArgs> | null
    /**
     * The filter to search for the UserWallet to update in case it exists.
     */
    where: UserWalletWhereUniqueInput
    /**
     * In case the UserWallet found by the `where` argument doesn't exist, create a new UserWallet with this data.
     */
    create: XOR<UserWalletCreateInput, UserWalletUncheckedCreateInput>
    /**
     * In case the UserWallet was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserWalletUpdateInput, UserWalletUncheckedUpdateInput>
  }

  /**
   * UserWallet delete
   */
  export type UserWalletDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserWallet
     */
    select?: UserWalletSelect<ExtArgs> | null
    /**
     * Filter which UserWallet to delete.
     */
    where: UserWalletWhereUniqueInput
  }

  /**
   * UserWallet deleteMany
   */
  export type UserWalletDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserWallets to delete
     */
    where?: UserWalletWhereInput
  }

  /**
   * UserWallet without action
   */
  export type UserWalletDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserWallet
     */
    select?: UserWalletSelect<ExtArgs> | null
  }


  /**
   * Model Bet
   */

  export type AggregateBet = {
    _count: BetCountAggregateOutputType | null
    _avg: BetAvgAggregateOutputType | null
    _sum: BetSumAggregateOutputType | null
    _min: BetMinAggregateOutputType | null
    _max: BetMaxAggregateOutputType | null
  }

  export type BetAvgAggregateOutputType = {
    confidence: number | null
    stake: number | null
    pnl: number | null
  }

  export type BetSumAggregateOutputType = {
    confidence: number | null
    stake: number | null
    pnl: number | null
  }

  export type BetMinAggregateOutputType = {
    id: string | null
    userId: string | null
    runId: string | null
    direction: $Enums.BetDirection | null
    confidence: number | null
    stake: number | null
    thesis: string | null
    status: string | null
    evalVersion: string | null
    isCorrect: boolean | null
    pnl: number | null
    settledAt: Date | null
    createdAt: Date | null
  }

  export type BetMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    runId: string | null
    direction: $Enums.BetDirection | null
    confidence: number | null
    stake: number | null
    thesis: string | null
    status: string | null
    evalVersion: string | null
    isCorrect: boolean | null
    pnl: number | null
    settledAt: Date | null
    createdAt: Date | null
  }

  export type BetCountAggregateOutputType = {
    id: number
    userId: number
    runId: number
    direction: number
    confidence: number
    stake: number
    thesis: number
    status: number
    evalVersion: number
    isCorrect: number
    pnl: number
    settledAt: number
    createdAt: number
    _all: number
  }


  export type BetAvgAggregateInputType = {
    confidence?: true
    stake?: true
    pnl?: true
  }

  export type BetSumAggregateInputType = {
    confidence?: true
    stake?: true
    pnl?: true
  }

  export type BetMinAggregateInputType = {
    id?: true
    userId?: true
    runId?: true
    direction?: true
    confidence?: true
    stake?: true
    thesis?: true
    status?: true
    evalVersion?: true
    isCorrect?: true
    pnl?: true
    settledAt?: true
    createdAt?: true
  }

  export type BetMaxAggregateInputType = {
    id?: true
    userId?: true
    runId?: true
    direction?: true
    confidence?: true
    stake?: true
    thesis?: true
    status?: true
    evalVersion?: true
    isCorrect?: true
    pnl?: true
    settledAt?: true
    createdAt?: true
  }

  export type BetCountAggregateInputType = {
    id?: true
    userId?: true
    runId?: true
    direction?: true
    confidence?: true
    stake?: true
    thesis?: true
    status?: true
    evalVersion?: true
    isCorrect?: true
    pnl?: true
    settledAt?: true
    createdAt?: true
    _all?: true
  }

  export type BetAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Bet to aggregate.
     */
    where?: BetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Bets to fetch.
     */
    orderBy?: BetOrderByWithRelationInput | BetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: BetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Bets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Bets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Bets
    **/
    _count?: true | BetCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: BetAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: BetSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: BetMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: BetMaxAggregateInputType
  }

  export type GetBetAggregateType<T extends BetAggregateArgs> = {
        [P in keyof T & keyof AggregateBet]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateBet[P]>
      : GetScalarType<T[P], AggregateBet[P]>
  }




  export type BetGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: BetWhereInput
    orderBy?: BetOrderByWithAggregationInput | BetOrderByWithAggregationInput[]
    by: BetScalarFieldEnum[] | BetScalarFieldEnum
    having?: BetScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: BetCountAggregateInputType | true
    _avg?: BetAvgAggregateInputType
    _sum?: BetSumAggregateInputType
    _min?: BetMinAggregateInputType
    _max?: BetMaxAggregateInputType
  }

  export type BetGroupByOutputType = {
    id: string
    userId: string
    runId: string
    direction: $Enums.BetDirection
    confidence: number
    stake: number
    thesis: string | null
    status: string
    evalVersion: string | null
    isCorrect: boolean | null
    pnl: number | null
    settledAt: Date | null
    createdAt: Date
    _count: BetCountAggregateOutputType | null
    _avg: BetAvgAggregateOutputType | null
    _sum: BetSumAggregateOutputType | null
    _min: BetMinAggregateOutputType | null
    _max: BetMaxAggregateOutputType | null
  }

  type GetBetGroupByPayload<T extends BetGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<BetGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof BetGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], BetGroupByOutputType[P]>
            : GetScalarType<T[P], BetGroupByOutputType[P]>
        }
      >
    >


  export type BetSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    runId?: boolean
    direction?: boolean
    confidence?: boolean
    stake?: boolean
    thesis?: boolean
    status?: boolean
    evalVersion?: boolean
    isCorrect?: boolean
    pnl?: boolean
    settledAt?: boolean
    createdAt?: boolean
    run?: boolean | SimulationRunDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["bet"]>

  export type BetSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    runId?: boolean
    direction?: boolean
    confidence?: boolean
    stake?: boolean
    thesis?: boolean
    status?: boolean
    evalVersion?: boolean
    isCorrect?: boolean
    pnl?: boolean
    settledAt?: boolean
    createdAt?: boolean
    run?: boolean | SimulationRunDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["bet"]>

  export type BetSelectScalar = {
    id?: boolean
    userId?: boolean
    runId?: boolean
    direction?: boolean
    confidence?: boolean
    stake?: boolean
    thesis?: boolean
    status?: boolean
    evalVersion?: boolean
    isCorrect?: boolean
    pnl?: boolean
    settledAt?: boolean
    createdAt?: boolean
  }

  export type BetInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    run?: boolean | SimulationRunDefaultArgs<ExtArgs>
  }
  export type BetIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    run?: boolean | SimulationRunDefaultArgs<ExtArgs>
  }

  export type $BetPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Bet"
    objects: {
      run: Prisma.$SimulationRunPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      runId: string
      direction: $Enums.BetDirection
      confidence: number
      stake: number
      thesis: string | null
      status: string
      evalVersion: string | null
      isCorrect: boolean | null
      pnl: number | null
      settledAt: Date | null
      createdAt: Date
    }, ExtArgs["result"]["bet"]>
    composites: {}
  }

  type BetGetPayload<S extends boolean | null | undefined | BetDefaultArgs> = $Result.GetResult<Prisma.$BetPayload, S>

  type BetCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<BetFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: BetCountAggregateInputType | true
    }

  export interface BetDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Bet'], meta: { name: 'Bet' } }
    /**
     * Find zero or one Bet that matches the filter.
     * @param {BetFindUniqueArgs} args - Arguments to find a Bet
     * @example
     * // Get one Bet
     * const bet = await prisma.bet.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends BetFindUniqueArgs>(args: SelectSubset<T, BetFindUniqueArgs<ExtArgs>>): Prisma__BetClient<$Result.GetResult<Prisma.$BetPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one Bet that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {BetFindUniqueOrThrowArgs} args - Arguments to find a Bet
     * @example
     * // Get one Bet
     * const bet = await prisma.bet.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends BetFindUniqueOrThrowArgs>(args: SelectSubset<T, BetFindUniqueOrThrowArgs<ExtArgs>>): Prisma__BetClient<$Result.GetResult<Prisma.$BetPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first Bet that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BetFindFirstArgs} args - Arguments to find a Bet
     * @example
     * // Get one Bet
     * const bet = await prisma.bet.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends BetFindFirstArgs>(args?: SelectSubset<T, BetFindFirstArgs<ExtArgs>>): Prisma__BetClient<$Result.GetResult<Prisma.$BetPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first Bet that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BetFindFirstOrThrowArgs} args - Arguments to find a Bet
     * @example
     * // Get one Bet
     * const bet = await prisma.bet.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends BetFindFirstOrThrowArgs>(args?: SelectSubset<T, BetFindFirstOrThrowArgs<ExtArgs>>): Prisma__BetClient<$Result.GetResult<Prisma.$BetPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more Bets that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BetFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Bets
     * const bets = await prisma.bet.findMany()
     * 
     * // Get first 10 Bets
     * const bets = await prisma.bet.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const betWithIdOnly = await prisma.bet.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends BetFindManyArgs>(args?: SelectSubset<T, BetFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BetPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a Bet.
     * @param {BetCreateArgs} args - Arguments to create a Bet.
     * @example
     * // Create one Bet
     * const Bet = await prisma.bet.create({
     *   data: {
     *     // ... data to create a Bet
     *   }
     * })
     * 
     */
    create<T extends BetCreateArgs>(args: SelectSubset<T, BetCreateArgs<ExtArgs>>): Prisma__BetClient<$Result.GetResult<Prisma.$BetPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many Bets.
     * @param {BetCreateManyArgs} args - Arguments to create many Bets.
     * @example
     * // Create many Bets
     * const bet = await prisma.bet.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends BetCreateManyArgs>(args?: SelectSubset<T, BetCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Bets and returns the data saved in the database.
     * @param {BetCreateManyAndReturnArgs} args - Arguments to create many Bets.
     * @example
     * // Create many Bets
     * const bet = await prisma.bet.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Bets and only return the `id`
     * const betWithIdOnly = await prisma.bet.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends BetCreateManyAndReturnArgs>(args?: SelectSubset<T, BetCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$BetPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a Bet.
     * @param {BetDeleteArgs} args - Arguments to delete one Bet.
     * @example
     * // Delete one Bet
     * const Bet = await prisma.bet.delete({
     *   where: {
     *     // ... filter to delete one Bet
     *   }
     * })
     * 
     */
    delete<T extends BetDeleteArgs>(args: SelectSubset<T, BetDeleteArgs<ExtArgs>>): Prisma__BetClient<$Result.GetResult<Prisma.$BetPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one Bet.
     * @param {BetUpdateArgs} args - Arguments to update one Bet.
     * @example
     * // Update one Bet
     * const bet = await prisma.bet.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends BetUpdateArgs>(args: SelectSubset<T, BetUpdateArgs<ExtArgs>>): Prisma__BetClient<$Result.GetResult<Prisma.$BetPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more Bets.
     * @param {BetDeleteManyArgs} args - Arguments to filter Bets to delete.
     * @example
     * // Delete a few Bets
     * const { count } = await prisma.bet.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends BetDeleteManyArgs>(args?: SelectSubset<T, BetDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Bets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BetUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Bets
     * const bet = await prisma.bet.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends BetUpdateManyArgs>(args: SelectSubset<T, BetUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one Bet.
     * @param {BetUpsertArgs} args - Arguments to update or create a Bet.
     * @example
     * // Update or create a Bet
     * const bet = await prisma.bet.upsert({
     *   create: {
     *     // ... data to create a Bet
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Bet we want to update
     *   }
     * })
     */
    upsert<T extends BetUpsertArgs>(args: SelectSubset<T, BetUpsertArgs<ExtArgs>>): Prisma__BetClient<$Result.GetResult<Prisma.$BetPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of Bets.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BetCountArgs} args - Arguments to filter Bets to count.
     * @example
     * // Count the number of Bets
     * const count = await prisma.bet.count({
     *   where: {
     *     // ... the filter for the Bets we want to count
     *   }
     * })
    **/
    count<T extends BetCountArgs>(
      args?: Subset<T, BetCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], BetCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Bet.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BetAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends BetAggregateArgs>(args: Subset<T, BetAggregateArgs>): Prisma.PrismaPromise<GetBetAggregateType<T>>

    /**
     * Group by Bet.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {BetGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends BetGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: BetGroupByArgs['orderBy'] }
        : { orderBy?: BetGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, BetGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetBetGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Bet model
   */
  readonly fields: BetFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Bet.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__BetClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    run<T extends SimulationRunDefaultArgs<ExtArgs> = {}>(args?: Subset<T, SimulationRunDefaultArgs<ExtArgs>>): Prisma__SimulationRunClient<$Result.GetResult<Prisma.$SimulationRunPayload<ExtArgs>, T, "findUniqueOrThrow"> | Null, Null, ExtArgs>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Bet model
   */ 
  interface BetFieldRefs {
    readonly id: FieldRef<"Bet", 'String'>
    readonly userId: FieldRef<"Bet", 'String'>
    readonly runId: FieldRef<"Bet", 'String'>
    readonly direction: FieldRef<"Bet", 'BetDirection'>
    readonly confidence: FieldRef<"Bet", 'Int'>
    readonly stake: FieldRef<"Bet", 'Float'>
    readonly thesis: FieldRef<"Bet", 'String'>
    readonly status: FieldRef<"Bet", 'String'>
    readonly evalVersion: FieldRef<"Bet", 'String'>
    readonly isCorrect: FieldRef<"Bet", 'Boolean'>
    readonly pnl: FieldRef<"Bet", 'Float'>
    readonly settledAt: FieldRef<"Bet", 'DateTime'>
    readonly createdAt: FieldRef<"Bet", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Bet findUnique
   */
  export type BetFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Bet
     */
    select?: BetSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BetInclude<ExtArgs> | null
    /**
     * Filter, which Bet to fetch.
     */
    where: BetWhereUniqueInput
  }

  /**
   * Bet findUniqueOrThrow
   */
  export type BetFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Bet
     */
    select?: BetSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BetInclude<ExtArgs> | null
    /**
     * Filter, which Bet to fetch.
     */
    where: BetWhereUniqueInput
  }

  /**
   * Bet findFirst
   */
  export type BetFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Bet
     */
    select?: BetSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BetInclude<ExtArgs> | null
    /**
     * Filter, which Bet to fetch.
     */
    where?: BetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Bets to fetch.
     */
    orderBy?: BetOrderByWithRelationInput | BetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Bets.
     */
    cursor?: BetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Bets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Bets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Bets.
     */
    distinct?: BetScalarFieldEnum | BetScalarFieldEnum[]
  }

  /**
   * Bet findFirstOrThrow
   */
  export type BetFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Bet
     */
    select?: BetSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BetInclude<ExtArgs> | null
    /**
     * Filter, which Bet to fetch.
     */
    where?: BetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Bets to fetch.
     */
    orderBy?: BetOrderByWithRelationInput | BetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Bets.
     */
    cursor?: BetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Bets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Bets.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Bets.
     */
    distinct?: BetScalarFieldEnum | BetScalarFieldEnum[]
  }

  /**
   * Bet findMany
   */
  export type BetFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Bet
     */
    select?: BetSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BetInclude<ExtArgs> | null
    /**
     * Filter, which Bets to fetch.
     */
    where?: BetWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Bets to fetch.
     */
    orderBy?: BetOrderByWithRelationInput | BetOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Bets.
     */
    cursor?: BetWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Bets from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Bets.
     */
    skip?: number
    distinct?: BetScalarFieldEnum | BetScalarFieldEnum[]
  }

  /**
   * Bet create
   */
  export type BetCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Bet
     */
    select?: BetSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BetInclude<ExtArgs> | null
    /**
     * The data needed to create a Bet.
     */
    data: XOR<BetCreateInput, BetUncheckedCreateInput>
  }

  /**
   * Bet createMany
   */
  export type BetCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Bets.
     */
    data: BetCreateManyInput | BetCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Bet createManyAndReturn
   */
  export type BetCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Bet
     */
    select?: BetSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many Bets.
     */
    data: BetCreateManyInput | BetCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BetIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Bet update
   */
  export type BetUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Bet
     */
    select?: BetSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BetInclude<ExtArgs> | null
    /**
     * The data needed to update a Bet.
     */
    data: XOR<BetUpdateInput, BetUncheckedUpdateInput>
    /**
     * Choose, which Bet to update.
     */
    where: BetWhereUniqueInput
  }

  /**
   * Bet updateMany
   */
  export type BetUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Bets.
     */
    data: XOR<BetUpdateManyMutationInput, BetUncheckedUpdateManyInput>
    /**
     * Filter which Bets to update
     */
    where?: BetWhereInput
  }

  /**
   * Bet upsert
   */
  export type BetUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Bet
     */
    select?: BetSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BetInclude<ExtArgs> | null
    /**
     * The filter to search for the Bet to update in case it exists.
     */
    where: BetWhereUniqueInput
    /**
     * In case the Bet found by the `where` argument doesn't exist, create a new Bet with this data.
     */
    create: XOR<BetCreateInput, BetUncheckedCreateInput>
    /**
     * In case the Bet was found with the provided `where` argument, update it with this data.
     */
    update: XOR<BetUpdateInput, BetUncheckedUpdateInput>
  }

  /**
   * Bet delete
   */
  export type BetDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Bet
     */
    select?: BetSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BetInclude<ExtArgs> | null
    /**
     * Filter which Bet to delete.
     */
    where: BetWhereUniqueInput
  }

  /**
   * Bet deleteMany
   */
  export type BetDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Bets to delete
     */
    where?: BetWhereInput
  }

  /**
   * Bet without action
   */
  export type BetDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Bet
     */
    select?: BetSelect<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: BetInclude<ExtArgs> | null
  }


  /**
   * Model ImportRun
   */

  export type AggregateImportRun = {
    _count: ImportRunCountAggregateOutputType | null
    _min: ImportRunMinAggregateOutputType | null
    _max: ImportRunMaxAggregateOutputType | null
  }

  export type ImportRunMinAggregateOutputType = {
    id: string | null
    type: string | null
    sourceFilename: string | null
    sourceHash: string | null
    status: string | null
    startedAt: Date | null
    finishedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ImportRunMaxAggregateOutputType = {
    id: string | null
    type: string | null
    sourceFilename: string | null
    sourceHash: string | null
    status: string | null
    startedAt: Date | null
    finishedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ImportRunCountAggregateOutputType = {
    id: number
    type: number
    sourceFilename: number
    sourceHash: number
    status: number
    summaryJson: number
    errorJson: number
    startedAt: number
    finishedAt: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ImportRunMinAggregateInputType = {
    id?: true
    type?: true
    sourceFilename?: true
    sourceHash?: true
    status?: true
    startedAt?: true
    finishedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ImportRunMaxAggregateInputType = {
    id?: true
    type?: true
    sourceFilename?: true
    sourceHash?: true
    status?: true
    startedAt?: true
    finishedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ImportRunCountAggregateInputType = {
    id?: true
    type?: true
    sourceFilename?: true
    sourceHash?: true
    status?: true
    summaryJson?: true
    errorJson?: true
    startedAt?: true
    finishedAt?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ImportRunAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ImportRun to aggregate.
     */
    where?: ImportRunWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ImportRuns to fetch.
     */
    orderBy?: ImportRunOrderByWithRelationInput | ImportRunOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ImportRunWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ImportRuns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ImportRuns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ImportRuns
    **/
    _count?: true | ImportRunCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ImportRunMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ImportRunMaxAggregateInputType
  }

  export type GetImportRunAggregateType<T extends ImportRunAggregateArgs> = {
        [P in keyof T & keyof AggregateImportRun]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateImportRun[P]>
      : GetScalarType<T[P], AggregateImportRun[P]>
  }




  export type ImportRunGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ImportRunWhereInput
    orderBy?: ImportRunOrderByWithAggregationInput | ImportRunOrderByWithAggregationInput[]
    by: ImportRunScalarFieldEnum[] | ImportRunScalarFieldEnum
    having?: ImportRunScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ImportRunCountAggregateInputType | true
    _min?: ImportRunMinAggregateInputType
    _max?: ImportRunMaxAggregateInputType
  }

  export type ImportRunGroupByOutputType = {
    id: string
    type: string
    sourceFilename: string
    sourceHash: string
    status: string
    summaryJson: JsonValue | null
    errorJson: JsonValue | null
    startedAt: Date
    finishedAt: Date | null
    createdAt: Date
    updatedAt: Date
    _count: ImportRunCountAggregateOutputType | null
    _min: ImportRunMinAggregateOutputType | null
    _max: ImportRunMaxAggregateOutputType | null
  }

  type GetImportRunGroupByPayload<T extends ImportRunGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ImportRunGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ImportRunGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ImportRunGroupByOutputType[P]>
            : GetScalarType<T[P], ImportRunGroupByOutputType[P]>
        }
      >
    >


  export type ImportRunSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    type?: boolean
    sourceFilename?: boolean
    sourceHash?: boolean
    status?: boolean
    summaryJson?: boolean
    errorJson?: boolean
    startedAt?: boolean
    finishedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["importRun"]>

  export type ImportRunSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    type?: boolean
    sourceFilename?: boolean
    sourceHash?: boolean
    status?: boolean
    summaryJson?: boolean
    errorJson?: boolean
    startedAt?: boolean
    finishedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["importRun"]>

  export type ImportRunSelectScalar = {
    id?: boolean
    type?: boolean
    sourceFilename?: boolean
    sourceHash?: boolean
    status?: boolean
    summaryJson?: boolean
    errorJson?: boolean
    startedAt?: boolean
    finishedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }


  export type $ImportRunPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ImportRun"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      type: string
      sourceFilename: string
      sourceHash: string
      status: string
      summaryJson: Prisma.JsonValue | null
      errorJson: Prisma.JsonValue | null
      startedAt: Date
      finishedAt: Date | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["importRun"]>
    composites: {}
  }

  type ImportRunGetPayload<S extends boolean | null | undefined | ImportRunDefaultArgs> = $Result.GetResult<Prisma.$ImportRunPayload, S>

  type ImportRunCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = 
    Omit<ImportRunFindManyArgs, 'select' | 'include' | 'distinct'> & {
      select?: ImportRunCountAggregateInputType | true
    }

  export interface ImportRunDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ImportRun'], meta: { name: 'ImportRun' } }
    /**
     * Find zero or one ImportRun that matches the filter.
     * @param {ImportRunFindUniqueArgs} args - Arguments to find a ImportRun
     * @example
     * // Get one ImportRun
     * const importRun = await prisma.importRun.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ImportRunFindUniqueArgs>(args: SelectSubset<T, ImportRunFindUniqueArgs<ExtArgs>>): Prisma__ImportRunClient<$Result.GetResult<Prisma.$ImportRunPayload<ExtArgs>, T, "findUnique"> | null, null, ExtArgs>

    /**
     * Find one ImportRun that matches the filter or throw an error with `error.code='P2025'` 
     * if no matches were found.
     * @param {ImportRunFindUniqueOrThrowArgs} args - Arguments to find a ImportRun
     * @example
     * // Get one ImportRun
     * const importRun = await prisma.importRun.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ImportRunFindUniqueOrThrowArgs>(args: SelectSubset<T, ImportRunFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ImportRunClient<$Result.GetResult<Prisma.$ImportRunPayload<ExtArgs>, T, "findUniqueOrThrow">, never, ExtArgs>

    /**
     * Find the first ImportRun that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ImportRunFindFirstArgs} args - Arguments to find a ImportRun
     * @example
     * // Get one ImportRun
     * const importRun = await prisma.importRun.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ImportRunFindFirstArgs>(args?: SelectSubset<T, ImportRunFindFirstArgs<ExtArgs>>): Prisma__ImportRunClient<$Result.GetResult<Prisma.$ImportRunPayload<ExtArgs>, T, "findFirst"> | null, null, ExtArgs>

    /**
     * Find the first ImportRun that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ImportRunFindFirstOrThrowArgs} args - Arguments to find a ImportRun
     * @example
     * // Get one ImportRun
     * const importRun = await prisma.importRun.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ImportRunFindFirstOrThrowArgs>(args?: SelectSubset<T, ImportRunFindFirstOrThrowArgs<ExtArgs>>): Prisma__ImportRunClient<$Result.GetResult<Prisma.$ImportRunPayload<ExtArgs>, T, "findFirstOrThrow">, never, ExtArgs>

    /**
     * Find zero or more ImportRuns that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ImportRunFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ImportRuns
     * const importRuns = await prisma.importRun.findMany()
     * 
     * // Get first 10 ImportRuns
     * const importRuns = await prisma.importRun.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const importRunWithIdOnly = await prisma.importRun.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ImportRunFindManyArgs>(args?: SelectSubset<T, ImportRunFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ImportRunPayload<ExtArgs>, T, "findMany">>

    /**
     * Create a ImportRun.
     * @param {ImportRunCreateArgs} args - Arguments to create a ImportRun.
     * @example
     * // Create one ImportRun
     * const ImportRun = await prisma.importRun.create({
     *   data: {
     *     // ... data to create a ImportRun
     *   }
     * })
     * 
     */
    create<T extends ImportRunCreateArgs>(args: SelectSubset<T, ImportRunCreateArgs<ExtArgs>>): Prisma__ImportRunClient<$Result.GetResult<Prisma.$ImportRunPayload<ExtArgs>, T, "create">, never, ExtArgs>

    /**
     * Create many ImportRuns.
     * @param {ImportRunCreateManyArgs} args - Arguments to create many ImportRuns.
     * @example
     * // Create many ImportRuns
     * const importRun = await prisma.importRun.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ImportRunCreateManyArgs>(args?: SelectSubset<T, ImportRunCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ImportRuns and returns the data saved in the database.
     * @param {ImportRunCreateManyAndReturnArgs} args - Arguments to create many ImportRuns.
     * @example
     * // Create many ImportRuns
     * const importRun = await prisma.importRun.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ImportRuns and only return the `id`
     * const importRunWithIdOnly = await prisma.importRun.createManyAndReturn({ 
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ImportRunCreateManyAndReturnArgs>(args?: SelectSubset<T, ImportRunCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ImportRunPayload<ExtArgs>, T, "createManyAndReturn">>

    /**
     * Delete a ImportRun.
     * @param {ImportRunDeleteArgs} args - Arguments to delete one ImportRun.
     * @example
     * // Delete one ImportRun
     * const ImportRun = await prisma.importRun.delete({
     *   where: {
     *     // ... filter to delete one ImportRun
     *   }
     * })
     * 
     */
    delete<T extends ImportRunDeleteArgs>(args: SelectSubset<T, ImportRunDeleteArgs<ExtArgs>>): Prisma__ImportRunClient<$Result.GetResult<Prisma.$ImportRunPayload<ExtArgs>, T, "delete">, never, ExtArgs>

    /**
     * Update one ImportRun.
     * @param {ImportRunUpdateArgs} args - Arguments to update one ImportRun.
     * @example
     * // Update one ImportRun
     * const importRun = await prisma.importRun.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ImportRunUpdateArgs>(args: SelectSubset<T, ImportRunUpdateArgs<ExtArgs>>): Prisma__ImportRunClient<$Result.GetResult<Prisma.$ImportRunPayload<ExtArgs>, T, "update">, never, ExtArgs>

    /**
     * Delete zero or more ImportRuns.
     * @param {ImportRunDeleteManyArgs} args - Arguments to filter ImportRuns to delete.
     * @example
     * // Delete a few ImportRuns
     * const { count } = await prisma.importRun.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ImportRunDeleteManyArgs>(args?: SelectSubset<T, ImportRunDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ImportRuns.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ImportRunUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ImportRuns
     * const importRun = await prisma.importRun.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ImportRunUpdateManyArgs>(args: SelectSubset<T, ImportRunUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create or update one ImportRun.
     * @param {ImportRunUpsertArgs} args - Arguments to update or create a ImportRun.
     * @example
     * // Update or create a ImportRun
     * const importRun = await prisma.importRun.upsert({
     *   create: {
     *     // ... data to create a ImportRun
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ImportRun we want to update
     *   }
     * })
     */
    upsert<T extends ImportRunUpsertArgs>(args: SelectSubset<T, ImportRunUpsertArgs<ExtArgs>>): Prisma__ImportRunClient<$Result.GetResult<Prisma.$ImportRunPayload<ExtArgs>, T, "upsert">, never, ExtArgs>


    /**
     * Count the number of ImportRuns.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ImportRunCountArgs} args - Arguments to filter ImportRuns to count.
     * @example
     * // Count the number of ImportRuns
     * const count = await prisma.importRun.count({
     *   where: {
     *     // ... the filter for the ImportRuns we want to count
     *   }
     * })
    **/
    count<T extends ImportRunCountArgs>(
      args?: Subset<T, ImportRunCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ImportRunCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ImportRun.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ImportRunAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ImportRunAggregateArgs>(args: Subset<T, ImportRunAggregateArgs>): Prisma.PrismaPromise<GetImportRunAggregateType<T>>

    /**
     * Group by ImportRun.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ImportRunGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ImportRunGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ImportRunGroupByArgs['orderBy'] }
        : { orderBy?: ImportRunGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ImportRunGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetImportRunGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ImportRun model
   */
  readonly fields: ImportRunFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ImportRun.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ImportRunClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ImportRun model
   */ 
  interface ImportRunFieldRefs {
    readonly id: FieldRef<"ImportRun", 'String'>
    readonly type: FieldRef<"ImportRun", 'String'>
    readonly sourceFilename: FieldRef<"ImportRun", 'String'>
    readonly sourceHash: FieldRef<"ImportRun", 'String'>
    readonly status: FieldRef<"ImportRun", 'String'>
    readonly summaryJson: FieldRef<"ImportRun", 'Json'>
    readonly errorJson: FieldRef<"ImportRun", 'Json'>
    readonly startedAt: FieldRef<"ImportRun", 'DateTime'>
    readonly finishedAt: FieldRef<"ImportRun", 'DateTime'>
    readonly createdAt: FieldRef<"ImportRun", 'DateTime'>
    readonly updatedAt: FieldRef<"ImportRun", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ImportRun findUnique
   */
  export type ImportRunFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ImportRun
     */
    select?: ImportRunSelect<ExtArgs> | null
    /**
     * Filter, which ImportRun to fetch.
     */
    where: ImportRunWhereUniqueInput
  }

  /**
   * ImportRun findUniqueOrThrow
   */
  export type ImportRunFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ImportRun
     */
    select?: ImportRunSelect<ExtArgs> | null
    /**
     * Filter, which ImportRun to fetch.
     */
    where: ImportRunWhereUniqueInput
  }

  /**
   * ImportRun findFirst
   */
  export type ImportRunFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ImportRun
     */
    select?: ImportRunSelect<ExtArgs> | null
    /**
     * Filter, which ImportRun to fetch.
     */
    where?: ImportRunWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ImportRuns to fetch.
     */
    orderBy?: ImportRunOrderByWithRelationInput | ImportRunOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ImportRuns.
     */
    cursor?: ImportRunWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ImportRuns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ImportRuns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ImportRuns.
     */
    distinct?: ImportRunScalarFieldEnum | ImportRunScalarFieldEnum[]
  }

  /**
   * ImportRun findFirstOrThrow
   */
  export type ImportRunFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ImportRun
     */
    select?: ImportRunSelect<ExtArgs> | null
    /**
     * Filter, which ImportRun to fetch.
     */
    where?: ImportRunWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ImportRuns to fetch.
     */
    orderBy?: ImportRunOrderByWithRelationInput | ImportRunOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ImportRuns.
     */
    cursor?: ImportRunWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ImportRuns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ImportRuns.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ImportRuns.
     */
    distinct?: ImportRunScalarFieldEnum | ImportRunScalarFieldEnum[]
  }

  /**
   * ImportRun findMany
   */
  export type ImportRunFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ImportRun
     */
    select?: ImportRunSelect<ExtArgs> | null
    /**
     * Filter, which ImportRuns to fetch.
     */
    where?: ImportRunWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ImportRuns to fetch.
     */
    orderBy?: ImportRunOrderByWithRelationInput | ImportRunOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ImportRuns.
     */
    cursor?: ImportRunWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ImportRuns from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ImportRuns.
     */
    skip?: number
    distinct?: ImportRunScalarFieldEnum | ImportRunScalarFieldEnum[]
  }

  /**
   * ImportRun create
   */
  export type ImportRunCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ImportRun
     */
    select?: ImportRunSelect<ExtArgs> | null
    /**
     * The data needed to create a ImportRun.
     */
    data: XOR<ImportRunCreateInput, ImportRunUncheckedCreateInput>
  }

  /**
   * ImportRun createMany
   */
  export type ImportRunCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ImportRuns.
     */
    data: ImportRunCreateManyInput | ImportRunCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ImportRun createManyAndReturn
   */
  export type ImportRunCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ImportRun
     */
    select?: ImportRunSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * The data used to create many ImportRuns.
     */
    data: ImportRunCreateManyInput | ImportRunCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ImportRun update
   */
  export type ImportRunUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ImportRun
     */
    select?: ImportRunSelect<ExtArgs> | null
    /**
     * The data needed to update a ImportRun.
     */
    data: XOR<ImportRunUpdateInput, ImportRunUncheckedUpdateInput>
    /**
     * Choose, which ImportRun to update.
     */
    where: ImportRunWhereUniqueInput
  }

  /**
   * ImportRun updateMany
   */
  export type ImportRunUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ImportRuns.
     */
    data: XOR<ImportRunUpdateManyMutationInput, ImportRunUncheckedUpdateManyInput>
    /**
     * Filter which ImportRuns to update
     */
    where?: ImportRunWhereInput
  }

  /**
   * ImportRun upsert
   */
  export type ImportRunUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ImportRun
     */
    select?: ImportRunSelect<ExtArgs> | null
    /**
     * The filter to search for the ImportRun to update in case it exists.
     */
    where: ImportRunWhereUniqueInput
    /**
     * In case the ImportRun found by the `where` argument doesn't exist, create a new ImportRun with this data.
     */
    create: XOR<ImportRunCreateInput, ImportRunUncheckedCreateInput>
    /**
     * In case the ImportRun was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ImportRunUpdateInput, ImportRunUncheckedUpdateInput>
  }

  /**
   * ImportRun delete
   */
  export type ImportRunDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ImportRun
     */
    select?: ImportRunSelect<ExtArgs> | null
    /**
     * Filter which ImportRun to delete.
     */
    where: ImportRunWhereUniqueInput
  }

  /**
   * ImportRun deleteMany
   */
  export type ImportRunDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ImportRuns to delete
     */
    where?: ImportRunWhereInput
  }

  /**
   * ImportRun without action
   */
  export type ImportRunDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ImportRun
     */
    select?: ImportRunSelect<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const ArchetypeScalarFieldEnum: {
    id: 'id',
    name: 'name',
    description: 'description',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ArchetypeScalarFieldEnum = (typeof ArchetypeScalarFieldEnum)[keyof typeof ArchetypeScalarFieldEnum]


  export const TraitDefinitionScalarFieldEnum: {
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

  export type TraitDefinitionScalarFieldEnum = (typeof TraitDefinitionScalarFieldEnum)[keyof typeof TraitDefinitionScalarFieldEnum]


  export const ArchetypeTraitProfileScalarFieldEnum: {
    archetypeId: 'archetypeId',
    traitDefinitionId: 'traitDefinitionId',
    baselineValue: 'baselineValue'
  };

  export type ArchetypeTraitProfileScalarFieldEnum = (typeof ArchetypeTraitProfileScalarFieldEnum)[keyof typeof ArchetypeTraitProfileScalarFieldEnum]


  export const AgentScalarFieldEnum: {
    id: 'id',
    displayName: 'displayName',
    archetypeId: 'archetypeId',
    stateJson: 'stateJson',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type AgentScalarFieldEnum = (typeof AgentScalarFieldEnum)[keyof typeof AgentScalarFieldEnum]


  export const SimulationRunScalarFieldEnum: {
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

  export type SimulationRunScalarFieldEnum = (typeof SimulationRunScalarFieldEnum)[keyof typeof SimulationRunScalarFieldEnum]


  export const RunDebugScalarFieldEnum: {
    runId: 'runId',
    prePersistHistogram: 'prePersistHistogram',
    samplePrePersistActions: 'samplePrePersistActions',
    createdAt: 'createdAt'
  };

  export type RunDebugScalarFieldEnum = (typeof RunDebugScalarFieldEnum)[keyof typeof RunDebugScalarFieldEnum]


  export const AgentExperienceScalarFieldEnum: {
    id: 'id',
    runId: 'runId',
    agentId: 'agentId',
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

  export type AgentExperienceScalarFieldEnum = (typeof AgentExperienceScalarFieldEnum)[keyof typeof AgentExperienceScalarFieldEnum]


  export const CrowdSnapshotScalarFieldEnum: {
    id: 'id',
    runId: 'runId',
    step: 'step',
    ts: 'ts',
    aggregationJson: 'aggregationJson',
    confidence: 'confidence'
  };

  export type CrowdSnapshotScalarFieldEnum = (typeof CrowdSnapshotScalarFieldEnum)[keyof typeof CrowdSnapshotScalarFieldEnum]


  export const UserProfileScalarFieldEnum: {
    userId: 'userId',
    displayName: 'displayName',
    createdAt: 'createdAt'
  };

  export type UserProfileScalarFieldEnum = (typeof UserProfileScalarFieldEnum)[keyof typeof UserProfileScalarFieldEnum]


  export const UserWalletScalarFieldEnum: {
    userId: 'userId',
    balance: 'balance',
    updatedAt: 'updatedAt'
  };

  export type UserWalletScalarFieldEnum = (typeof UserWalletScalarFieldEnum)[keyof typeof UserWalletScalarFieldEnum]


  export const BetScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    runId: 'runId',
    direction: 'direction',
    confidence: 'confidence',
    stake: 'stake',
    thesis: 'thesis',
    status: 'status',
    evalVersion: 'evalVersion',
    isCorrect: 'isCorrect',
    pnl: 'pnl',
    settledAt: 'settledAt',
    createdAt: 'createdAt'
  };

  export type BetScalarFieldEnum = (typeof BetScalarFieldEnum)[keyof typeof BetScalarFieldEnum]


  export const ImportRunScalarFieldEnum: {
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

  export type ImportRunScalarFieldEnum = (typeof ImportRunScalarFieldEnum)[keyof typeof ImportRunScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  /**
   * Field references 
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'SimulationRunStatus'
   */
  export type EnumSimulationRunStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'SimulationRunStatus'>
    


  /**
   * Reference to a field of type 'SimulationRunStatus[]'
   */
  export type ListEnumSimulationRunStatusFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'SimulationRunStatus[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'BetDirection'
   */
  export type EnumBetDirectionFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BetDirection'>
    


  /**
   * Reference to a field of type 'BetDirection[]'
   */
  export type ListEnumBetDirectionFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'BetDirection[]'>
    


  /**
   * Reference to a field of type 'Boolean'
   */
  export type BooleanFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Boolean'>
    
  /**
   * Deep Input Types
   */


  export type ArchetypeWhereInput = {
    AND?: ArchetypeWhereInput | ArchetypeWhereInput[]
    OR?: ArchetypeWhereInput[]
    NOT?: ArchetypeWhereInput | ArchetypeWhereInput[]
    id?: UuidFilter<"Archetype"> | string
    name?: StringFilter<"Archetype"> | string
    description?: StringNullableFilter<"Archetype"> | string | null
    createdAt?: DateTimeFilter<"Archetype"> | Date | string
    updatedAt?: DateTimeFilter<"Archetype"> | Date | string
    traitProfiles?: ArchetypeTraitProfileListRelationFilter
    agents?: AgentListRelationFilter
  }

  export type ArchetypeOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    traitProfiles?: ArchetypeTraitProfileOrderByRelationAggregateInput
    agents?: AgentOrderByRelationAggregateInput
  }

  export type ArchetypeWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    name?: string
    AND?: ArchetypeWhereInput | ArchetypeWhereInput[]
    OR?: ArchetypeWhereInput[]
    NOT?: ArchetypeWhereInput | ArchetypeWhereInput[]
    description?: StringNullableFilter<"Archetype"> | string | null
    createdAt?: DateTimeFilter<"Archetype"> | Date | string
    updatedAt?: DateTimeFilter<"Archetype"> | Date | string
    traitProfiles?: ArchetypeTraitProfileListRelationFilter
    agents?: AgentListRelationFilter
  }, "id" | "name">

  export type ArchetypeOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ArchetypeCountOrderByAggregateInput
    _max?: ArchetypeMaxOrderByAggregateInput
    _min?: ArchetypeMinOrderByAggregateInput
  }

  export type ArchetypeScalarWhereWithAggregatesInput = {
    AND?: ArchetypeScalarWhereWithAggregatesInput | ArchetypeScalarWhereWithAggregatesInput[]
    OR?: ArchetypeScalarWhereWithAggregatesInput[]
    NOT?: ArchetypeScalarWhereWithAggregatesInput | ArchetypeScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"Archetype"> | string
    name?: StringWithAggregatesFilter<"Archetype"> | string
    description?: StringNullableWithAggregatesFilter<"Archetype"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Archetype"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Archetype"> | Date | string
  }

  export type TraitDefinitionWhereInput = {
    AND?: TraitDefinitionWhereInput | TraitDefinitionWhereInput[]
    OR?: TraitDefinitionWhereInput[]
    NOT?: TraitDefinitionWhereInput | TraitDefinitionWhereInput[]
    id?: UuidFilter<"TraitDefinition"> | string
    key?: StringFilter<"TraitDefinition"> | string
    displayName?: StringFilter<"TraitDefinition"> | string
    description?: StringNullableFilter<"TraitDefinition"> | string | null
    valueRangeText?: StringNullableFilter<"TraitDefinition"> | string | null
    minValue?: FloatNullableFilter<"TraitDefinition"> | number | null
    maxValue?: FloatNullableFilter<"TraitDefinition"> | number | null
    createdAt?: DateTimeFilter<"TraitDefinition"> | Date | string
    updatedAt?: DateTimeFilter<"TraitDefinition"> | Date | string
    archetypeProfiles?: ArchetypeTraitProfileListRelationFilter
  }

  export type TraitDefinitionOrderByWithRelationInput = {
    id?: SortOrder
    key?: SortOrder
    displayName?: SortOrder
    description?: SortOrderInput | SortOrder
    valueRangeText?: SortOrderInput | SortOrder
    minValue?: SortOrderInput | SortOrder
    maxValue?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    archetypeProfiles?: ArchetypeTraitProfileOrderByRelationAggregateInput
  }

  export type TraitDefinitionWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    key?: string
    AND?: TraitDefinitionWhereInput | TraitDefinitionWhereInput[]
    OR?: TraitDefinitionWhereInput[]
    NOT?: TraitDefinitionWhereInput | TraitDefinitionWhereInput[]
    displayName?: StringFilter<"TraitDefinition"> | string
    description?: StringNullableFilter<"TraitDefinition"> | string | null
    valueRangeText?: StringNullableFilter<"TraitDefinition"> | string | null
    minValue?: FloatNullableFilter<"TraitDefinition"> | number | null
    maxValue?: FloatNullableFilter<"TraitDefinition"> | number | null
    createdAt?: DateTimeFilter<"TraitDefinition"> | Date | string
    updatedAt?: DateTimeFilter<"TraitDefinition"> | Date | string
    archetypeProfiles?: ArchetypeTraitProfileListRelationFilter
  }, "id" | "key">

  export type TraitDefinitionOrderByWithAggregationInput = {
    id?: SortOrder
    key?: SortOrder
    displayName?: SortOrder
    description?: SortOrderInput | SortOrder
    valueRangeText?: SortOrderInput | SortOrder
    minValue?: SortOrderInput | SortOrder
    maxValue?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: TraitDefinitionCountOrderByAggregateInput
    _avg?: TraitDefinitionAvgOrderByAggregateInput
    _max?: TraitDefinitionMaxOrderByAggregateInput
    _min?: TraitDefinitionMinOrderByAggregateInput
    _sum?: TraitDefinitionSumOrderByAggregateInput
  }

  export type TraitDefinitionScalarWhereWithAggregatesInput = {
    AND?: TraitDefinitionScalarWhereWithAggregatesInput | TraitDefinitionScalarWhereWithAggregatesInput[]
    OR?: TraitDefinitionScalarWhereWithAggregatesInput[]
    NOT?: TraitDefinitionScalarWhereWithAggregatesInput | TraitDefinitionScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"TraitDefinition"> | string
    key?: StringWithAggregatesFilter<"TraitDefinition"> | string
    displayName?: StringWithAggregatesFilter<"TraitDefinition"> | string
    description?: StringNullableWithAggregatesFilter<"TraitDefinition"> | string | null
    valueRangeText?: StringNullableWithAggregatesFilter<"TraitDefinition"> | string | null
    minValue?: FloatNullableWithAggregatesFilter<"TraitDefinition"> | number | null
    maxValue?: FloatNullableWithAggregatesFilter<"TraitDefinition"> | number | null
    createdAt?: DateTimeWithAggregatesFilter<"TraitDefinition"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"TraitDefinition"> | Date | string
  }

  export type ArchetypeTraitProfileWhereInput = {
    AND?: ArchetypeTraitProfileWhereInput | ArchetypeTraitProfileWhereInput[]
    OR?: ArchetypeTraitProfileWhereInput[]
    NOT?: ArchetypeTraitProfileWhereInput | ArchetypeTraitProfileWhereInput[]
    archetypeId?: UuidFilter<"ArchetypeTraitProfile"> | string
    traitDefinitionId?: UuidFilter<"ArchetypeTraitProfile"> | string
    baselineValue?: FloatFilter<"ArchetypeTraitProfile"> | number
    archetype?: XOR<ArchetypeRelationFilter, ArchetypeWhereInput>
    traitDefinition?: XOR<TraitDefinitionRelationFilter, TraitDefinitionWhereInput>
  }

  export type ArchetypeTraitProfileOrderByWithRelationInput = {
    archetypeId?: SortOrder
    traitDefinitionId?: SortOrder
    baselineValue?: SortOrder
    archetype?: ArchetypeOrderByWithRelationInput
    traitDefinition?: TraitDefinitionOrderByWithRelationInput
  }

  export type ArchetypeTraitProfileWhereUniqueInput = Prisma.AtLeast<{
    archetypeId_traitDefinitionId?: ArchetypeTraitProfileArchetypeIdTraitDefinitionIdCompoundUniqueInput
    AND?: ArchetypeTraitProfileWhereInput | ArchetypeTraitProfileWhereInput[]
    OR?: ArchetypeTraitProfileWhereInput[]
    NOT?: ArchetypeTraitProfileWhereInput | ArchetypeTraitProfileWhereInput[]
    archetypeId?: UuidFilter<"ArchetypeTraitProfile"> | string
    traitDefinitionId?: UuidFilter<"ArchetypeTraitProfile"> | string
    baselineValue?: FloatFilter<"ArchetypeTraitProfile"> | number
    archetype?: XOR<ArchetypeRelationFilter, ArchetypeWhereInput>
    traitDefinition?: XOR<TraitDefinitionRelationFilter, TraitDefinitionWhereInput>
  }, "archetypeId_traitDefinitionId">

  export type ArchetypeTraitProfileOrderByWithAggregationInput = {
    archetypeId?: SortOrder
    traitDefinitionId?: SortOrder
    baselineValue?: SortOrder
    _count?: ArchetypeTraitProfileCountOrderByAggregateInput
    _avg?: ArchetypeTraitProfileAvgOrderByAggregateInput
    _max?: ArchetypeTraitProfileMaxOrderByAggregateInput
    _min?: ArchetypeTraitProfileMinOrderByAggregateInput
    _sum?: ArchetypeTraitProfileSumOrderByAggregateInput
  }

  export type ArchetypeTraitProfileScalarWhereWithAggregatesInput = {
    AND?: ArchetypeTraitProfileScalarWhereWithAggregatesInput | ArchetypeTraitProfileScalarWhereWithAggregatesInput[]
    OR?: ArchetypeTraitProfileScalarWhereWithAggregatesInput[]
    NOT?: ArchetypeTraitProfileScalarWhereWithAggregatesInput | ArchetypeTraitProfileScalarWhereWithAggregatesInput[]
    archetypeId?: UuidWithAggregatesFilter<"ArchetypeTraitProfile"> | string
    traitDefinitionId?: UuidWithAggregatesFilter<"ArchetypeTraitProfile"> | string
    baselineValue?: FloatWithAggregatesFilter<"ArchetypeTraitProfile"> | number
  }

  export type AgentWhereInput = {
    AND?: AgentWhereInput | AgentWhereInput[]
    OR?: AgentWhereInput[]
    NOT?: AgentWhereInput | AgentWhereInput[]
    id?: UuidFilter<"Agent"> | string
    displayName?: StringFilter<"Agent"> | string
    archetypeId?: UuidFilter<"Agent"> | string
    stateJson?: JsonNullableFilter<"Agent">
    createdAt?: DateTimeFilter<"Agent"> | Date | string
    updatedAt?: DateTimeFilter<"Agent"> | Date | string
    archetype?: XOR<ArchetypeRelationFilter, ArchetypeWhereInput>
    experiences?: AgentExperienceListRelationFilter
  }

  export type AgentOrderByWithRelationInput = {
    id?: SortOrder
    displayName?: SortOrder
    archetypeId?: SortOrder
    stateJson?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    archetype?: ArchetypeOrderByWithRelationInput
    experiences?: AgentExperienceOrderByRelationAggregateInput
  }

  export type AgentWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: AgentWhereInput | AgentWhereInput[]
    OR?: AgentWhereInput[]
    NOT?: AgentWhereInput | AgentWhereInput[]
    displayName?: StringFilter<"Agent"> | string
    archetypeId?: UuidFilter<"Agent"> | string
    stateJson?: JsonNullableFilter<"Agent">
    createdAt?: DateTimeFilter<"Agent"> | Date | string
    updatedAt?: DateTimeFilter<"Agent"> | Date | string
    archetype?: XOR<ArchetypeRelationFilter, ArchetypeWhereInput>
    experiences?: AgentExperienceListRelationFilter
  }, "id">

  export type AgentOrderByWithAggregationInput = {
    id?: SortOrder
    displayName?: SortOrder
    archetypeId?: SortOrder
    stateJson?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: AgentCountOrderByAggregateInput
    _max?: AgentMaxOrderByAggregateInput
    _min?: AgentMinOrderByAggregateInput
  }

  export type AgentScalarWhereWithAggregatesInput = {
    AND?: AgentScalarWhereWithAggregatesInput | AgentScalarWhereWithAggregatesInput[]
    OR?: AgentScalarWhereWithAggregatesInput[]
    NOT?: AgentScalarWhereWithAggregatesInput | AgentScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"Agent"> | string
    displayName?: StringWithAggregatesFilter<"Agent"> | string
    archetypeId?: UuidWithAggregatesFilter<"Agent"> | string
    stateJson?: JsonNullableWithAggregatesFilter<"Agent">
    createdAt?: DateTimeWithAggregatesFilter<"Agent"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Agent"> | Date | string
  }

  export type SimulationRunWhereInput = {
    AND?: SimulationRunWhereInput | SimulationRunWhereInput[]
    OR?: SimulationRunWhereInput[]
    NOT?: SimulationRunWhereInput | SimulationRunWhereInput[]
    id?: UuidFilter<"SimulationRun"> | string
    name?: StringFilter<"SimulationRun"> | string
    status?: EnumSimulationRunStatusFilter<"SimulationRun"> | $Enums.SimulationRunStatus
    seed?: IntFilter<"SimulationRun"> | number
    modelVersion?: StringFilter<"SimulationRun"> | string
    datasetVersion?: StringFilter<"SimulationRun"> | string
    codeGitSha?: StringNullableFilter<"SimulationRun"> | string | null
    schemaVersion?: StringFilter<"SimulationRun"> | string
    startedAt?: DateTimeNullableFilter<"SimulationRun"> | Date | string | null
    finishedAt?: DateTimeNullableFilter<"SimulationRun"> | Date | string | null
    configJson?: JsonNullableFilter<"SimulationRun">
    createdAt?: DateTimeFilter<"SimulationRun"> | Date | string
    updatedAt?: DateTimeFilter<"SimulationRun"> | Date | string
    agentExperiences?: AgentExperienceListRelationFilter
    crowdSnapshots?: CrowdSnapshotListRelationFilter
    runDebug?: XOR<RunDebugNullableRelationFilter, RunDebugWhereInput> | null
    bets?: BetListRelationFilter
  }

  export type SimulationRunOrderByWithRelationInput = {
    id?: SortOrder
    name?: SortOrder
    status?: SortOrder
    seed?: SortOrder
    modelVersion?: SortOrder
    datasetVersion?: SortOrder
    codeGitSha?: SortOrderInput | SortOrder
    schemaVersion?: SortOrder
    startedAt?: SortOrderInput | SortOrder
    finishedAt?: SortOrderInput | SortOrder
    configJson?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    agentExperiences?: AgentExperienceOrderByRelationAggregateInput
    crowdSnapshots?: CrowdSnapshotOrderByRelationAggregateInput
    runDebug?: RunDebugOrderByWithRelationInput
    bets?: BetOrderByRelationAggregateInput
  }

  export type SimulationRunWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    name_datasetVersion?: SimulationRunNameDatasetVersionCompoundUniqueInput
    AND?: SimulationRunWhereInput | SimulationRunWhereInput[]
    OR?: SimulationRunWhereInput[]
    NOT?: SimulationRunWhereInput | SimulationRunWhereInput[]
    name?: StringFilter<"SimulationRun"> | string
    status?: EnumSimulationRunStatusFilter<"SimulationRun"> | $Enums.SimulationRunStatus
    seed?: IntFilter<"SimulationRun"> | number
    modelVersion?: StringFilter<"SimulationRun"> | string
    datasetVersion?: StringFilter<"SimulationRun"> | string
    codeGitSha?: StringNullableFilter<"SimulationRun"> | string | null
    schemaVersion?: StringFilter<"SimulationRun"> | string
    startedAt?: DateTimeNullableFilter<"SimulationRun"> | Date | string | null
    finishedAt?: DateTimeNullableFilter<"SimulationRun"> | Date | string | null
    configJson?: JsonNullableFilter<"SimulationRun">
    createdAt?: DateTimeFilter<"SimulationRun"> | Date | string
    updatedAt?: DateTimeFilter<"SimulationRun"> | Date | string
    agentExperiences?: AgentExperienceListRelationFilter
    crowdSnapshots?: CrowdSnapshotListRelationFilter
    runDebug?: XOR<RunDebugNullableRelationFilter, RunDebugWhereInput> | null
    bets?: BetListRelationFilter
  }, "id" | "name_datasetVersion">

  export type SimulationRunOrderByWithAggregationInput = {
    id?: SortOrder
    name?: SortOrder
    status?: SortOrder
    seed?: SortOrder
    modelVersion?: SortOrder
    datasetVersion?: SortOrder
    codeGitSha?: SortOrderInput | SortOrder
    schemaVersion?: SortOrder
    startedAt?: SortOrderInput | SortOrder
    finishedAt?: SortOrderInput | SortOrder
    configJson?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: SimulationRunCountOrderByAggregateInput
    _avg?: SimulationRunAvgOrderByAggregateInput
    _max?: SimulationRunMaxOrderByAggregateInput
    _min?: SimulationRunMinOrderByAggregateInput
    _sum?: SimulationRunSumOrderByAggregateInput
  }

  export type SimulationRunScalarWhereWithAggregatesInput = {
    AND?: SimulationRunScalarWhereWithAggregatesInput | SimulationRunScalarWhereWithAggregatesInput[]
    OR?: SimulationRunScalarWhereWithAggregatesInput[]
    NOT?: SimulationRunScalarWhereWithAggregatesInput | SimulationRunScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"SimulationRun"> | string
    name?: StringWithAggregatesFilter<"SimulationRun"> | string
    status?: EnumSimulationRunStatusWithAggregatesFilter<"SimulationRun"> | $Enums.SimulationRunStatus
    seed?: IntWithAggregatesFilter<"SimulationRun"> | number
    modelVersion?: StringWithAggregatesFilter<"SimulationRun"> | string
    datasetVersion?: StringWithAggregatesFilter<"SimulationRun"> | string
    codeGitSha?: StringNullableWithAggregatesFilter<"SimulationRun"> | string | null
    schemaVersion?: StringWithAggregatesFilter<"SimulationRun"> | string
    startedAt?: DateTimeNullableWithAggregatesFilter<"SimulationRun"> | Date | string | null
    finishedAt?: DateTimeNullableWithAggregatesFilter<"SimulationRun"> | Date | string | null
    configJson?: JsonNullableWithAggregatesFilter<"SimulationRun">
    createdAt?: DateTimeWithAggregatesFilter<"SimulationRun"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"SimulationRun"> | Date | string
  }

  export type RunDebugWhereInput = {
    AND?: RunDebugWhereInput | RunDebugWhereInput[]
    OR?: RunDebugWhereInput[]
    NOT?: RunDebugWhereInput | RunDebugWhereInput[]
    runId?: UuidFilter<"RunDebug"> | string
    prePersistHistogram?: JsonNullableFilter<"RunDebug">
    samplePrePersistActions?: JsonNullableFilter<"RunDebug">
    createdAt?: DateTimeFilter<"RunDebug"> | Date | string
    run?: XOR<SimulationRunRelationFilter, SimulationRunWhereInput>
  }

  export type RunDebugOrderByWithRelationInput = {
    runId?: SortOrder
    prePersistHistogram?: SortOrderInput | SortOrder
    samplePrePersistActions?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    run?: SimulationRunOrderByWithRelationInput
  }

  export type RunDebugWhereUniqueInput = Prisma.AtLeast<{
    runId?: string
    AND?: RunDebugWhereInput | RunDebugWhereInput[]
    OR?: RunDebugWhereInput[]
    NOT?: RunDebugWhereInput | RunDebugWhereInput[]
    prePersistHistogram?: JsonNullableFilter<"RunDebug">
    samplePrePersistActions?: JsonNullableFilter<"RunDebug">
    createdAt?: DateTimeFilter<"RunDebug"> | Date | string
    run?: XOR<SimulationRunRelationFilter, SimulationRunWhereInput>
  }, "runId">

  export type RunDebugOrderByWithAggregationInput = {
    runId?: SortOrder
    prePersistHistogram?: SortOrderInput | SortOrder
    samplePrePersistActions?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: RunDebugCountOrderByAggregateInput
    _max?: RunDebugMaxOrderByAggregateInput
    _min?: RunDebugMinOrderByAggregateInput
  }

  export type RunDebugScalarWhereWithAggregatesInput = {
    AND?: RunDebugScalarWhereWithAggregatesInput | RunDebugScalarWhereWithAggregatesInput[]
    OR?: RunDebugScalarWhereWithAggregatesInput[]
    NOT?: RunDebugScalarWhereWithAggregatesInput | RunDebugScalarWhereWithAggregatesInput[]
    runId?: UuidWithAggregatesFilter<"RunDebug"> | string
    prePersistHistogram?: JsonNullableWithAggregatesFilter<"RunDebug">
    samplePrePersistActions?: JsonNullableWithAggregatesFilter<"RunDebug">
    createdAt?: DateTimeWithAggregatesFilter<"RunDebug"> | Date | string
  }

  export type AgentExperienceWhereInput = {
    AND?: AgentExperienceWhereInput | AgentExperienceWhereInput[]
    OR?: AgentExperienceWhereInput[]
    NOT?: AgentExperienceWhereInput | AgentExperienceWhereInput[]
    id?: UuidFilter<"AgentExperience"> | string
    runId?: UuidFilter<"AgentExperience"> | string
    agentId?: UuidFilter<"AgentExperience"> | string
    step?: IntFilter<"AgentExperience"> | number
    ts?: DateTimeFilter<"AgentExperience"> | Date | string
    actionJson?: JsonNullableFilter<"AgentExperience">
    signalsJson?: JsonNullableFilter<"AgentExperience">
    pnl?: FloatNullableFilter<"AgentExperience"> | number | null
    drawdown?: FloatNullableFilter<"AgentExperience"> | number | null
    reward?: FloatNullableFilter<"AgentExperience"> | number | null
    learningMetaJson?: JsonNullableFilter<"AgentExperience">
    stateBeforeJson?: JsonNullableFilter<"AgentExperience">
    stateAfterJson?: JsonNullableFilter<"AgentExperience">
    run?: XOR<SimulationRunRelationFilter, SimulationRunWhereInput>
    agent?: XOR<AgentRelationFilter, AgentWhereInput>
  }

  export type AgentExperienceOrderByWithRelationInput = {
    id?: SortOrder
    runId?: SortOrder
    agentId?: SortOrder
    step?: SortOrder
    ts?: SortOrder
    actionJson?: SortOrderInput | SortOrder
    signalsJson?: SortOrderInput | SortOrder
    pnl?: SortOrderInput | SortOrder
    drawdown?: SortOrderInput | SortOrder
    reward?: SortOrderInput | SortOrder
    learningMetaJson?: SortOrderInput | SortOrder
    stateBeforeJson?: SortOrderInput | SortOrder
    stateAfterJson?: SortOrderInput | SortOrder
    run?: SimulationRunOrderByWithRelationInput
    agent?: AgentOrderByWithRelationInput
  }

  export type AgentExperienceWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: AgentExperienceWhereInput | AgentExperienceWhereInput[]
    OR?: AgentExperienceWhereInput[]
    NOT?: AgentExperienceWhereInput | AgentExperienceWhereInput[]
    runId?: UuidFilter<"AgentExperience"> | string
    agentId?: UuidFilter<"AgentExperience"> | string
    step?: IntFilter<"AgentExperience"> | number
    ts?: DateTimeFilter<"AgentExperience"> | Date | string
    actionJson?: JsonNullableFilter<"AgentExperience">
    signalsJson?: JsonNullableFilter<"AgentExperience">
    pnl?: FloatNullableFilter<"AgentExperience"> | number | null
    drawdown?: FloatNullableFilter<"AgentExperience"> | number | null
    reward?: FloatNullableFilter<"AgentExperience"> | number | null
    learningMetaJson?: JsonNullableFilter<"AgentExperience">
    stateBeforeJson?: JsonNullableFilter<"AgentExperience">
    stateAfterJson?: JsonNullableFilter<"AgentExperience">
    run?: XOR<SimulationRunRelationFilter, SimulationRunWhereInput>
    agent?: XOR<AgentRelationFilter, AgentWhereInput>
  }, "id">

  export type AgentExperienceOrderByWithAggregationInput = {
    id?: SortOrder
    runId?: SortOrder
    agentId?: SortOrder
    step?: SortOrder
    ts?: SortOrder
    actionJson?: SortOrderInput | SortOrder
    signalsJson?: SortOrderInput | SortOrder
    pnl?: SortOrderInput | SortOrder
    drawdown?: SortOrderInput | SortOrder
    reward?: SortOrderInput | SortOrder
    learningMetaJson?: SortOrderInput | SortOrder
    stateBeforeJson?: SortOrderInput | SortOrder
    stateAfterJson?: SortOrderInput | SortOrder
    _count?: AgentExperienceCountOrderByAggregateInput
    _avg?: AgentExperienceAvgOrderByAggregateInput
    _max?: AgentExperienceMaxOrderByAggregateInput
    _min?: AgentExperienceMinOrderByAggregateInput
    _sum?: AgentExperienceSumOrderByAggregateInput
  }

  export type AgentExperienceScalarWhereWithAggregatesInput = {
    AND?: AgentExperienceScalarWhereWithAggregatesInput | AgentExperienceScalarWhereWithAggregatesInput[]
    OR?: AgentExperienceScalarWhereWithAggregatesInput[]
    NOT?: AgentExperienceScalarWhereWithAggregatesInput | AgentExperienceScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"AgentExperience"> | string
    runId?: UuidWithAggregatesFilter<"AgentExperience"> | string
    agentId?: UuidWithAggregatesFilter<"AgentExperience"> | string
    step?: IntWithAggregatesFilter<"AgentExperience"> | number
    ts?: DateTimeWithAggregatesFilter<"AgentExperience"> | Date | string
    actionJson?: JsonNullableWithAggregatesFilter<"AgentExperience">
    signalsJson?: JsonNullableWithAggregatesFilter<"AgentExperience">
    pnl?: FloatNullableWithAggregatesFilter<"AgentExperience"> | number | null
    drawdown?: FloatNullableWithAggregatesFilter<"AgentExperience"> | number | null
    reward?: FloatNullableWithAggregatesFilter<"AgentExperience"> | number | null
    learningMetaJson?: JsonNullableWithAggregatesFilter<"AgentExperience">
    stateBeforeJson?: JsonNullableWithAggregatesFilter<"AgentExperience">
    stateAfterJson?: JsonNullableWithAggregatesFilter<"AgentExperience">
  }

  export type CrowdSnapshotWhereInput = {
    AND?: CrowdSnapshotWhereInput | CrowdSnapshotWhereInput[]
    OR?: CrowdSnapshotWhereInput[]
    NOT?: CrowdSnapshotWhereInput | CrowdSnapshotWhereInput[]
    id?: UuidFilter<"CrowdSnapshot"> | string
    runId?: UuidFilter<"CrowdSnapshot"> | string
    step?: IntFilter<"CrowdSnapshot"> | number
    ts?: DateTimeFilter<"CrowdSnapshot"> | Date | string
    aggregationJson?: JsonNullableFilter<"CrowdSnapshot">
    confidence?: FloatNullableFilter<"CrowdSnapshot"> | number | null
    run?: XOR<SimulationRunRelationFilter, SimulationRunWhereInput>
  }

  export type CrowdSnapshotOrderByWithRelationInput = {
    id?: SortOrder
    runId?: SortOrder
    step?: SortOrder
    ts?: SortOrder
    aggregationJson?: SortOrderInput | SortOrder
    confidence?: SortOrderInput | SortOrder
    run?: SimulationRunOrderByWithRelationInput
  }

  export type CrowdSnapshotWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    runId_step?: CrowdSnapshotRunIdStepCompoundUniqueInput
    AND?: CrowdSnapshotWhereInput | CrowdSnapshotWhereInput[]
    OR?: CrowdSnapshotWhereInput[]
    NOT?: CrowdSnapshotWhereInput | CrowdSnapshotWhereInput[]
    runId?: UuidFilter<"CrowdSnapshot"> | string
    step?: IntFilter<"CrowdSnapshot"> | number
    ts?: DateTimeFilter<"CrowdSnapshot"> | Date | string
    aggregationJson?: JsonNullableFilter<"CrowdSnapshot">
    confidence?: FloatNullableFilter<"CrowdSnapshot"> | number | null
    run?: XOR<SimulationRunRelationFilter, SimulationRunWhereInput>
  }, "id" | "runId_step">

  export type CrowdSnapshotOrderByWithAggregationInput = {
    id?: SortOrder
    runId?: SortOrder
    step?: SortOrder
    ts?: SortOrder
    aggregationJson?: SortOrderInput | SortOrder
    confidence?: SortOrderInput | SortOrder
    _count?: CrowdSnapshotCountOrderByAggregateInput
    _avg?: CrowdSnapshotAvgOrderByAggregateInput
    _max?: CrowdSnapshotMaxOrderByAggregateInput
    _min?: CrowdSnapshotMinOrderByAggregateInput
    _sum?: CrowdSnapshotSumOrderByAggregateInput
  }

  export type CrowdSnapshotScalarWhereWithAggregatesInput = {
    AND?: CrowdSnapshotScalarWhereWithAggregatesInput | CrowdSnapshotScalarWhereWithAggregatesInput[]
    OR?: CrowdSnapshotScalarWhereWithAggregatesInput[]
    NOT?: CrowdSnapshotScalarWhereWithAggregatesInput | CrowdSnapshotScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"CrowdSnapshot"> | string
    runId?: UuidWithAggregatesFilter<"CrowdSnapshot"> | string
    step?: IntWithAggregatesFilter<"CrowdSnapshot"> | number
    ts?: DateTimeWithAggregatesFilter<"CrowdSnapshot"> | Date | string
    aggregationJson?: JsonNullableWithAggregatesFilter<"CrowdSnapshot">
    confidence?: FloatNullableWithAggregatesFilter<"CrowdSnapshot"> | number | null
  }

  export type UserProfileWhereInput = {
    AND?: UserProfileWhereInput | UserProfileWhereInput[]
    OR?: UserProfileWhereInput[]
    NOT?: UserProfileWhereInput | UserProfileWhereInput[]
    userId?: StringFilter<"UserProfile"> | string
    displayName?: StringFilter<"UserProfile"> | string
    createdAt?: DateTimeFilter<"UserProfile"> | Date | string
  }

  export type UserProfileOrderByWithRelationInput = {
    userId?: SortOrder
    displayName?: SortOrder
    createdAt?: SortOrder
  }

  export type UserProfileWhereUniqueInput = Prisma.AtLeast<{
    userId?: string
    AND?: UserProfileWhereInput | UserProfileWhereInput[]
    OR?: UserProfileWhereInput[]
    NOT?: UserProfileWhereInput | UserProfileWhereInput[]
    displayName?: StringFilter<"UserProfile"> | string
    createdAt?: DateTimeFilter<"UserProfile"> | Date | string
  }, "userId">

  export type UserProfileOrderByWithAggregationInput = {
    userId?: SortOrder
    displayName?: SortOrder
    createdAt?: SortOrder
    _count?: UserProfileCountOrderByAggregateInput
    _max?: UserProfileMaxOrderByAggregateInput
    _min?: UserProfileMinOrderByAggregateInput
  }

  export type UserProfileScalarWhereWithAggregatesInput = {
    AND?: UserProfileScalarWhereWithAggregatesInput | UserProfileScalarWhereWithAggregatesInput[]
    OR?: UserProfileScalarWhereWithAggregatesInput[]
    NOT?: UserProfileScalarWhereWithAggregatesInput | UserProfileScalarWhereWithAggregatesInput[]
    userId?: StringWithAggregatesFilter<"UserProfile"> | string
    displayName?: StringWithAggregatesFilter<"UserProfile"> | string
    createdAt?: DateTimeWithAggregatesFilter<"UserProfile"> | Date | string
  }

  export type UserWalletWhereInput = {
    AND?: UserWalletWhereInput | UserWalletWhereInput[]
    OR?: UserWalletWhereInput[]
    NOT?: UserWalletWhereInput | UserWalletWhereInput[]
    userId?: StringFilter<"UserWallet"> | string
    balance?: FloatFilter<"UserWallet"> | number
    updatedAt?: DateTimeFilter<"UserWallet"> | Date | string
  }

  export type UserWalletOrderByWithRelationInput = {
    userId?: SortOrder
    balance?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserWalletWhereUniqueInput = Prisma.AtLeast<{
    userId?: string
    AND?: UserWalletWhereInput | UserWalletWhereInput[]
    OR?: UserWalletWhereInput[]
    NOT?: UserWalletWhereInput | UserWalletWhereInput[]
    balance?: FloatFilter<"UserWallet"> | number
    updatedAt?: DateTimeFilter<"UserWallet"> | Date | string
  }, "userId">

  export type UserWalletOrderByWithAggregationInput = {
    userId?: SortOrder
    balance?: SortOrder
    updatedAt?: SortOrder
    _count?: UserWalletCountOrderByAggregateInput
    _avg?: UserWalletAvgOrderByAggregateInput
    _max?: UserWalletMaxOrderByAggregateInput
    _min?: UserWalletMinOrderByAggregateInput
    _sum?: UserWalletSumOrderByAggregateInput
  }

  export type UserWalletScalarWhereWithAggregatesInput = {
    AND?: UserWalletScalarWhereWithAggregatesInput | UserWalletScalarWhereWithAggregatesInput[]
    OR?: UserWalletScalarWhereWithAggregatesInput[]
    NOT?: UserWalletScalarWhereWithAggregatesInput | UserWalletScalarWhereWithAggregatesInput[]
    userId?: StringWithAggregatesFilter<"UserWallet"> | string
    balance?: FloatWithAggregatesFilter<"UserWallet"> | number
    updatedAt?: DateTimeWithAggregatesFilter<"UserWallet"> | Date | string
  }

  export type BetWhereInput = {
    AND?: BetWhereInput | BetWhereInput[]
    OR?: BetWhereInput[]
    NOT?: BetWhereInput | BetWhereInput[]
    id?: UuidFilter<"Bet"> | string
    userId?: StringFilter<"Bet"> | string
    runId?: UuidFilter<"Bet"> | string
    direction?: EnumBetDirectionFilter<"Bet"> | $Enums.BetDirection
    confidence?: IntFilter<"Bet"> | number
    stake?: FloatFilter<"Bet"> | number
    thesis?: StringNullableFilter<"Bet"> | string | null
    status?: StringFilter<"Bet"> | string
    evalVersion?: StringNullableFilter<"Bet"> | string | null
    isCorrect?: BoolNullableFilter<"Bet"> | boolean | null
    pnl?: FloatNullableFilter<"Bet"> | number | null
    settledAt?: DateTimeNullableFilter<"Bet"> | Date | string | null
    createdAt?: DateTimeFilter<"Bet"> | Date | string
    run?: XOR<SimulationRunRelationFilter, SimulationRunWhereInput>
  }

  export type BetOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    runId?: SortOrder
    direction?: SortOrder
    confidence?: SortOrder
    stake?: SortOrder
    thesis?: SortOrderInput | SortOrder
    status?: SortOrder
    evalVersion?: SortOrderInput | SortOrder
    isCorrect?: SortOrderInput | SortOrder
    pnl?: SortOrderInput | SortOrder
    settledAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    run?: SimulationRunOrderByWithRelationInput
  }

  export type BetWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: BetWhereInput | BetWhereInput[]
    OR?: BetWhereInput[]
    NOT?: BetWhereInput | BetWhereInput[]
    userId?: StringFilter<"Bet"> | string
    runId?: UuidFilter<"Bet"> | string
    direction?: EnumBetDirectionFilter<"Bet"> | $Enums.BetDirection
    confidence?: IntFilter<"Bet"> | number
    stake?: FloatFilter<"Bet"> | number
    thesis?: StringNullableFilter<"Bet"> | string | null
    status?: StringFilter<"Bet"> | string
    evalVersion?: StringNullableFilter<"Bet"> | string | null
    isCorrect?: BoolNullableFilter<"Bet"> | boolean | null
    pnl?: FloatNullableFilter<"Bet"> | number | null
    settledAt?: DateTimeNullableFilter<"Bet"> | Date | string | null
    createdAt?: DateTimeFilter<"Bet"> | Date | string
    run?: XOR<SimulationRunRelationFilter, SimulationRunWhereInput>
  }, "id">

  export type BetOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    runId?: SortOrder
    direction?: SortOrder
    confidence?: SortOrder
    stake?: SortOrder
    thesis?: SortOrderInput | SortOrder
    status?: SortOrder
    evalVersion?: SortOrderInput | SortOrder
    isCorrect?: SortOrderInput | SortOrder
    pnl?: SortOrderInput | SortOrder
    settledAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: BetCountOrderByAggregateInput
    _avg?: BetAvgOrderByAggregateInput
    _max?: BetMaxOrderByAggregateInput
    _min?: BetMinOrderByAggregateInput
    _sum?: BetSumOrderByAggregateInput
  }

  export type BetScalarWhereWithAggregatesInput = {
    AND?: BetScalarWhereWithAggregatesInput | BetScalarWhereWithAggregatesInput[]
    OR?: BetScalarWhereWithAggregatesInput[]
    NOT?: BetScalarWhereWithAggregatesInput | BetScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"Bet"> | string
    userId?: StringWithAggregatesFilter<"Bet"> | string
    runId?: UuidWithAggregatesFilter<"Bet"> | string
    direction?: EnumBetDirectionWithAggregatesFilter<"Bet"> | $Enums.BetDirection
    confidence?: IntWithAggregatesFilter<"Bet"> | number
    stake?: FloatWithAggregatesFilter<"Bet"> | number
    thesis?: StringNullableWithAggregatesFilter<"Bet"> | string | null
    status?: StringWithAggregatesFilter<"Bet"> | string
    evalVersion?: StringNullableWithAggregatesFilter<"Bet"> | string | null
    isCorrect?: BoolNullableWithAggregatesFilter<"Bet"> | boolean | null
    pnl?: FloatNullableWithAggregatesFilter<"Bet"> | number | null
    settledAt?: DateTimeNullableWithAggregatesFilter<"Bet"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Bet"> | Date | string
  }

  export type ImportRunWhereInput = {
    AND?: ImportRunWhereInput | ImportRunWhereInput[]
    OR?: ImportRunWhereInput[]
    NOT?: ImportRunWhereInput | ImportRunWhereInput[]
    id?: UuidFilter<"ImportRun"> | string
    type?: StringFilter<"ImportRun"> | string
    sourceFilename?: StringFilter<"ImportRun"> | string
    sourceHash?: StringFilter<"ImportRun"> | string
    status?: StringFilter<"ImportRun"> | string
    summaryJson?: JsonNullableFilter<"ImportRun">
    errorJson?: JsonNullableFilter<"ImportRun">
    startedAt?: DateTimeFilter<"ImportRun"> | Date | string
    finishedAt?: DateTimeNullableFilter<"ImportRun"> | Date | string | null
    createdAt?: DateTimeFilter<"ImportRun"> | Date | string
    updatedAt?: DateTimeFilter<"ImportRun"> | Date | string
  }

  export type ImportRunOrderByWithRelationInput = {
    id?: SortOrder
    type?: SortOrder
    sourceFilename?: SortOrder
    sourceHash?: SortOrder
    status?: SortOrder
    summaryJson?: SortOrderInput | SortOrder
    errorJson?: SortOrderInput | SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ImportRunWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ImportRunWhereInput | ImportRunWhereInput[]
    OR?: ImportRunWhereInput[]
    NOT?: ImportRunWhereInput | ImportRunWhereInput[]
    type?: StringFilter<"ImportRun"> | string
    sourceFilename?: StringFilter<"ImportRun"> | string
    sourceHash?: StringFilter<"ImportRun"> | string
    status?: StringFilter<"ImportRun"> | string
    summaryJson?: JsonNullableFilter<"ImportRun">
    errorJson?: JsonNullableFilter<"ImportRun">
    startedAt?: DateTimeFilter<"ImportRun"> | Date | string
    finishedAt?: DateTimeNullableFilter<"ImportRun"> | Date | string | null
    createdAt?: DateTimeFilter<"ImportRun"> | Date | string
    updatedAt?: DateTimeFilter<"ImportRun"> | Date | string
  }, "id">

  export type ImportRunOrderByWithAggregationInput = {
    id?: SortOrder
    type?: SortOrder
    sourceFilename?: SortOrder
    sourceHash?: SortOrder
    status?: SortOrder
    summaryJson?: SortOrderInput | SortOrder
    errorJson?: SortOrderInput | SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ImportRunCountOrderByAggregateInput
    _max?: ImportRunMaxOrderByAggregateInput
    _min?: ImportRunMinOrderByAggregateInput
  }

  export type ImportRunScalarWhereWithAggregatesInput = {
    AND?: ImportRunScalarWhereWithAggregatesInput | ImportRunScalarWhereWithAggregatesInput[]
    OR?: ImportRunScalarWhereWithAggregatesInput[]
    NOT?: ImportRunScalarWhereWithAggregatesInput | ImportRunScalarWhereWithAggregatesInput[]
    id?: UuidWithAggregatesFilter<"ImportRun"> | string
    type?: StringWithAggregatesFilter<"ImportRun"> | string
    sourceFilename?: StringWithAggregatesFilter<"ImportRun"> | string
    sourceHash?: StringWithAggregatesFilter<"ImportRun"> | string
    status?: StringWithAggregatesFilter<"ImportRun"> | string
    summaryJson?: JsonNullableWithAggregatesFilter<"ImportRun">
    errorJson?: JsonNullableWithAggregatesFilter<"ImportRun">
    startedAt?: DateTimeWithAggregatesFilter<"ImportRun"> | Date | string
    finishedAt?: DateTimeNullableWithAggregatesFilter<"ImportRun"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"ImportRun"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"ImportRun"> | Date | string
  }

  export type ArchetypeCreateInput = {
    id?: string
    name: string
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    traitProfiles?: ArchetypeTraitProfileCreateNestedManyWithoutArchetypeInput
    agents?: AgentCreateNestedManyWithoutArchetypeInput
  }

  export type ArchetypeUncheckedCreateInput = {
    id?: string
    name: string
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    traitProfiles?: ArchetypeTraitProfileUncheckedCreateNestedManyWithoutArchetypeInput
    agents?: AgentUncheckedCreateNestedManyWithoutArchetypeInput
  }

  export type ArchetypeUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    traitProfiles?: ArchetypeTraitProfileUpdateManyWithoutArchetypeNestedInput
    agents?: AgentUpdateManyWithoutArchetypeNestedInput
  }

  export type ArchetypeUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    traitProfiles?: ArchetypeTraitProfileUncheckedUpdateManyWithoutArchetypeNestedInput
    agents?: AgentUncheckedUpdateManyWithoutArchetypeNestedInput
  }

  export type ArchetypeCreateManyInput = {
    id?: string
    name: string
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ArchetypeUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ArchetypeUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TraitDefinitionCreateInput = {
    id?: string
    key: string
    displayName: string
    description?: string | null
    valueRangeText?: string | null
    minValue?: number | null
    maxValue?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    archetypeProfiles?: ArchetypeTraitProfileCreateNestedManyWithoutTraitDefinitionInput
  }

  export type TraitDefinitionUncheckedCreateInput = {
    id?: string
    key: string
    displayName: string
    description?: string | null
    valueRangeText?: string | null
    minValue?: number | null
    maxValue?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
    archetypeProfiles?: ArchetypeTraitProfileUncheckedCreateNestedManyWithoutTraitDefinitionInput
  }

  export type TraitDefinitionUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    valueRangeText?: NullableStringFieldUpdateOperationsInput | string | null
    minValue?: NullableFloatFieldUpdateOperationsInput | number | null
    maxValue?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    archetypeProfiles?: ArchetypeTraitProfileUpdateManyWithoutTraitDefinitionNestedInput
  }

  export type TraitDefinitionUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    valueRangeText?: NullableStringFieldUpdateOperationsInput | string | null
    minValue?: NullableFloatFieldUpdateOperationsInput | number | null
    maxValue?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    archetypeProfiles?: ArchetypeTraitProfileUncheckedUpdateManyWithoutTraitDefinitionNestedInput
  }

  export type TraitDefinitionCreateManyInput = {
    id?: string
    key: string
    displayName: string
    description?: string | null
    valueRangeText?: string | null
    minValue?: number | null
    maxValue?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TraitDefinitionUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    valueRangeText?: NullableStringFieldUpdateOperationsInput | string | null
    minValue?: NullableFloatFieldUpdateOperationsInput | number | null
    maxValue?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TraitDefinitionUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    valueRangeText?: NullableStringFieldUpdateOperationsInput | string | null
    minValue?: NullableFloatFieldUpdateOperationsInput | number | null
    maxValue?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ArchetypeTraitProfileCreateInput = {
    baselineValue: number
    archetype: ArchetypeCreateNestedOneWithoutTraitProfilesInput
    traitDefinition: TraitDefinitionCreateNestedOneWithoutArchetypeProfilesInput
  }

  export type ArchetypeTraitProfileUncheckedCreateInput = {
    archetypeId: string
    traitDefinitionId: string
    baselineValue: number
  }

  export type ArchetypeTraitProfileUpdateInput = {
    baselineValue?: FloatFieldUpdateOperationsInput | number
    archetype?: ArchetypeUpdateOneRequiredWithoutTraitProfilesNestedInput
    traitDefinition?: TraitDefinitionUpdateOneRequiredWithoutArchetypeProfilesNestedInput
  }

  export type ArchetypeTraitProfileUncheckedUpdateInput = {
    archetypeId?: StringFieldUpdateOperationsInput | string
    traitDefinitionId?: StringFieldUpdateOperationsInput | string
    baselineValue?: FloatFieldUpdateOperationsInput | number
  }

  export type ArchetypeTraitProfileCreateManyInput = {
    archetypeId: string
    traitDefinitionId: string
    baselineValue: number
  }

  export type ArchetypeTraitProfileUpdateManyMutationInput = {
    baselineValue?: FloatFieldUpdateOperationsInput | number
  }

  export type ArchetypeTraitProfileUncheckedUpdateManyInput = {
    archetypeId?: StringFieldUpdateOperationsInput | string
    traitDefinitionId?: StringFieldUpdateOperationsInput | string
    baselineValue?: FloatFieldUpdateOperationsInput | number
  }

  export type AgentCreateInput = {
    id?: string
    displayName: string
    stateJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    archetype: ArchetypeCreateNestedOneWithoutAgentsInput
    experiences?: AgentExperienceCreateNestedManyWithoutAgentInput
  }

  export type AgentUncheckedCreateInput = {
    id?: string
    displayName: string
    archetypeId: string
    stateJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    experiences?: AgentExperienceUncheckedCreateNestedManyWithoutAgentInput
  }

  export type AgentUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    stateJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    archetype?: ArchetypeUpdateOneRequiredWithoutAgentsNestedInput
    experiences?: AgentExperienceUpdateManyWithoutAgentNestedInput
  }

  export type AgentUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    archetypeId?: StringFieldUpdateOperationsInput | string
    stateJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    experiences?: AgentExperienceUncheckedUpdateManyWithoutAgentNestedInput
  }

  export type AgentCreateManyInput = {
    id?: string
    displayName: string
    archetypeId: string
    stateJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AgentUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    stateJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AgentUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    archetypeId?: StringFieldUpdateOperationsInput | string
    stateJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SimulationRunCreateInput = {
    id?: string
    name: string
    status?: $Enums.SimulationRunStatus
    seed: number
    modelVersion: string
    datasetVersion: string
    codeGitSha?: string | null
    schemaVersion: string
    startedAt?: Date | string | null
    finishedAt?: Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    agentExperiences?: AgentExperienceCreateNestedManyWithoutRunInput
    crowdSnapshots?: CrowdSnapshotCreateNestedManyWithoutRunInput
    runDebug?: RunDebugCreateNestedOneWithoutRunInput
    bets?: BetCreateNestedManyWithoutRunInput
  }

  export type SimulationRunUncheckedCreateInput = {
    id?: string
    name: string
    status?: $Enums.SimulationRunStatus
    seed: number
    modelVersion: string
    datasetVersion: string
    codeGitSha?: string | null
    schemaVersion: string
    startedAt?: Date | string | null
    finishedAt?: Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    agentExperiences?: AgentExperienceUncheckedCreateNestedManyWithoutRunInput
    crowdSnapshots?: CrowdSnapshotUncheckedCreateNestedManyWithoutRunInput
    runDebug?: RunDebugUncheckedCreateNestedOneWithoutRunInput
    bets?: BetUncheckedCreateNestedManyWithoutRunInput
  }

  export type SimulationRunUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: EnumSimulationRunStatusFieldUpdateOperationsInput | $Enums.SimulationRunStatus
    seed?: IntFieldUpdateOperationsInput | number
    modelVersion?: StringFieldUpdateOperationsInput | string
    datasetVersion?: StringFieldUpdateOperationsInput | string
    codeGitSha?: NullableStringFieldUpdateOperationsInput | string | null
    schemaVersion?: StringFieldUpdateOperationsInput | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    agentExperiences?: AgentExperienceUpdateManyWithoutRunNestedInput
    crowdSnapshots?: CrowdSnapshotUpdateManyWithoutRunNestedInput
    runDebug?: RunDebugUpdateOneWithoutRunNestedInput
    bets?: BetUpdateManyWithoutRunNestedInput
  }

  export type SimulationRunUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: EnumSimulationRunStatusFieldUpdateOperationsInput | $Enums.SimulationRunStatus
    seed?: IntFieldUpdateOperationsInput | number
    modelVersion?: StringFieldUpdateOperationsInput | string
    datasetVersion?: StringFieldUpdateOperationsInput | string
    codeGitSha?: NullableStringFieldUpdateOperationsInput | string | null
    schemaVersion?: StringFieldUpdateOperationsInput | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    agentExperiences?: AgentExperienceUncheckedUpdateManyWithoutRunNestedInput
    crowdSnapshots?: CrowdSnapshotUncheckedUpdateManyWithoutRunNestedInput
    runDebug?: RunDebugUncheckedUpdateOneWithoutRunNestedInput
    bets?: BetUncheckedUpdateManyWithoutRunNestedInput
  }

  export type SimulationRunCreateManyInput = {
    id?: string
    name: string
    status?: $Enums.SimulationRunStatus
    seed: number
    modelVersion: string
    datasetVersion: string
    codeGitSha?: string | null
    schemaVersion: string
    startedAt?: Date | string | null
    finishedAt?: Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SimulationRunUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: EnumSimulationRunStatusFieldUpdateOperationsInput | $Enums.SimulationRunStatus
    seed?: IntFieldUpdateOperationsInput | number
    modelVersion?: StringFieldUpdateOperationsInput | string
    datasetVersion?: StringFieldUpdateOperationsInput | string
    codeGitSha?: NullableStringFieldUpdateOperationsInput | string | null
    schemaVersion?: StringFieldUpdateOperationsInput | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SimulationRunUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: EnumSimulationRunStatusFieldUpdateOperationsInput | $Enums.SimulationRunStatus
    seed?: IntFieldUpdateOperationsInput | number
    modelVersion?: StringFieldUpdateOperationsInput | string
    datasetVersion?: StringFieldUpdateOperationsInput | string
    codeGitSha?: NullableStringFieldUpdateOperationsInput | string | null
    schemaVersion?: StringFieldUpdateOperationsInput | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RunDebugCreateInput = {
    prePersistHistogram?: NullableJsonNullValueInput | InputJsonValue
    samplePrePersistActions?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    run: SimulationRunCreateNestedOneWithoutRunDebugInput
  }

  export type RunDebugUncheckedCreateInput = {
    runId: string
    prePersistHistogram?: NullableJsonNullValueInput | InputJsonValue
    samplePrePersistActions?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type RunDebugUpdateInput = {
    prePersistHistogram?: NullableJsonNullValueInput | InputJsonValue
    samplePrePersistActions?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    run?: SimulationRunUpdateOneRequiredWithoutRunDebugNestedInput
  }

  export type RunDebugUncheckedUpdateInput = {
    runId?: StringFieldUpdateOperationsInput | string
    prePersistHistogram?: NullableJsonNullValueInput | InputJsonValue
    samplePrePersistActions?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RunDebugCreateManyInput = {
    runId: string
    prePersistHistogram?: NullableJsonNullValueInput | InputJsonValue
    samplePrePersistActions?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type RunDebugUpdateManyMutationInput = {
    prePersistHistogram?: NullableJsonNullValueInput | InputJsonValue
    samplePrePersistActions?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RunDebugUncheckedUpdateManyInput = {
    runId?: StringFieldUpdateOperationsInput | string
    prePersistHistogram?: NullableJsonNullValueInput | InputJsonValue
    samplePrePersistActions?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type AgentExperienceCreateInput = {
    id?: string
    step: number
    ts: Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: number | null
    drawdown?: number | null
    reward?: number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
    run: SimulationRunCreateNestedOneWithoutAgentExperiencesInput
    agent: AgentCreateNestedOneWithoutExperiencesInput
  }

  export type AgentExperienceUncheckedCreateInput = {
    id?: string
    runId: string
    agentId: string
    step: number
    ts: Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: number | null
    drawdown?: number | null
    reward?: number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
  }

  export type AgentExperienceUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    step?: IntFieldUpdateOperationsInput | number
    ts?: DateTimeFieldUpdateOperationsInput | Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    drawdown?: NullableFloatFieldUpdateOperationsInput | number | null
    reward?: NullableFloatFieldUpdateOperationsInput | number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
    run?: SimulationRunUpdateOneRequiredWithoutAgentExperiencesNestedInput
    agent?: AgentUpdateOneRequiredWithoutExperiencesNestedInput
  }

  export type AgentExperienceUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    runId?: StringFieldUpdateOperationsInput | string
    agentId?: StringFieldUpdateOperationsInput | string
    step?: IntFieldUpdateOperationsInput | number
    ts?: DateTimeFieldUpdateOperationsInput | Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    drawdown?: NullableFloatFieldUpdateOperationsInput | number | null
    reward?: NullableFloatFieldUpdateOperationsInput | number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
  }

  export type AgentExperienceCreateManyInput = {
    id?: string
    runId: string
    agentId: string
    step: number
    ts: Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: number | null
    drawdown?: number | null
    reward?: number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
  }

  export type AgentExperienceUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    step?: IntFieldUpdateOperationsInput | number
    ts?: DateTimeFieldUpdateOperationsInput | Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    drawdown?: NullableFloatFieldUpdateOperationsInput | number | null
    reward?: NullableFloatFieldUpdateOperationsInput | number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
  }

  export type AgentExperienceUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    runId?: StringFieldUpdateOperationsInput | string
    agentId?: StringFieldUpdateOperationsInput | string
    step?: IntFieldUpdateOperationsInput | number
    ts?: DateTimeFieldUpdateOperationsInput | Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    drawdown?: NullableFloatFieldUpdateOperationsInput | number | null
    reward?: NullableFloatFieldUpdateOperationsInput | number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
  }

  export type CrowdSnapshotCreateInput = {
    id?: string
    step: number
    ts: Date | string
    aggregationJson?: NullableJsonNullValueInput | InputJsonValue
    confidence?: number | null
    run: SimulationRunCreateNestedOneWithoutCrowdSnapshotsInput
  }

  export type CrowdSnapshotUncheckedCreateInput = {
    id?: string
    runId: string
    step: number
    ts: Date | string
    aggregationJson?: NullableJsonNullValueInput | InputJsonValue
    confidence?: number | null
  }

  export type CrowdSnapshotUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    step?: IntFieldUpdateOperationsInput | number
    ts?: DateTimeFieldUpdateOperationsInput | Date | string
    aggregationJson?: NullableJsonNullValueInput | InputJsonValue
    confidence?: NullableFloatFieldUpdateOperationsInput | number | null
    run?: SimulationRunUpdateOneRequiredWithoutCrowdSnapshotsNestedInput
  }

  export type CrowdSnapshotUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    runId?: StringFieldUpdateOperationsInput | string
    step?: IntFieldUpdateOperationsInput | number
    ts?: DateTimeFieldUpdateOperationsInput | Date | string
    aggregationJson?: NullableJsonNullValueInput | InputJsonValue
    confidence?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type CrowdSnapshotCreateManyInput = {
    id?: string
    runId: string
    step: number
    ts: Date | string
    aggregationJson?: NullableJsonNullValueInput | InputJsonValue
    confidence?: number | null
  }

  export type CrowdSnapshotUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    step?: IntFieldUpdateOperationsInput | number
    ts?: DateTimeFieldUpdateOperationsInput | Date | string
    aggregationJson?: NullableJsonNullValueInput | InputJsonValue
    confidence?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type CrowdSnapshotUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    runId?: StringFieldUpdateOperationsInput | string
    step?: IntFieldUpdateOperationsInput | number
    ts?: DateTimeFieldUpdateOperationsInput | Date | string
    aggregationJson?: NullableJsonNullValueInput | InputJsonValue
    confidence?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type UserProfileCreateInput = {
    userId: string
    displayName: string
    createdAt?: Date | string
  }

  export type UserProfileUncheckedCreateInput = {
    userId: string
    displayName: string
    createdAt?: Date | string
  }

  export type UserProfileUpdateInput = {
    userId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserProfileUncheckedUpdateInput = {
    userId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserProfileCreateManyInput = {
    userId: string
    displayName: string
    createdAt?: Date | string
  }

  export type UserProfileUpdateManyMutationInput = {
    userId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserProfileUncheckedUpdateManyInput = {
    userId?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserWalletCreateInput = {
    userId: string
    balance?: number
    updatedAt?: Date | string
  }

  export type UserWalletUncheckedCreateInput = {
    userId: string
    balance?: number
    updatedAt?: Date | string
  }

  export type UserWalletUpdateInput = {
    userId?: StringFieldUpdateOperationsInput | string
    balance?: FloatFieldUpdateOperationsInput | number
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserWalletUncheckedUpdateInput = {
    userId?: StringFieldUpdateOperationsInput | string
    balance?: FloatFieldUpdateOperationsInput | number
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserWalletCreateManyInput = {
    userId: string
    balance?: number
    updatedAt?: Date | string
  }

  export type UserWalletUpdateManyMutationInput = {
    userId?: StringFieldUpdateOperationsInput | string
    balance?: FloatFieldUpdateOperationsInput | number
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserWalletUncheckedUpdateManyInput = {
    userId?: StringFieldUpdateOperationsInput | string
    balance?: FloatFieldUpdateOperationsInput | number
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BetCreateInput = {
    id?: string
    userId: string
    direction: $Enums.BetDirection
    confidence: number
    stake: number
    thesis?: string | null
    status?: string
    evalVersion?: string | null
    isCorrect?: boolean | null
    pnl?: number | null
    settledAt?: Date | string | null
    createdAt?: Date | string
    run: SimulationRunCreateNestedOneWithoutBetsInput
  }

  export type BetUncheckedCreateInput = {
    id?: string
    userId: string
    runId: string
    direction: $Enums.BetDirection
    confidence: number
    stake: number
    thesis?: string | null
    status?: string
    evalVersion?: string | null
    isCorrect?: boolean | null
    pnl?: number | null
    settledAt?: Date | string | null
    createdAt?: Date | string
  }

  export type BetUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    direction?: EnumBetDirectionFieldUpdateOperationsInput | $Enums.BetDirection
    confidence?: IntFieldUpdateOperationsInput | number
    stake?: FloatFieldUpdateOperationsInput | number
    thesis?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    evalVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isCorrect?: NullableBoolFieldUpdateOperationsInput | boolean | null
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    settledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    run?: SimulationRunUpdateOneRequiredWithoutBetsNestedInput
  }

  export type BetUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    runId?: StringFieldUpdateOperationsInput | string
    direction?: EnumBetDirectionFieldUpdateOperationsInput | $Enums.BetDirection
    confidence?: IntFieldUpdateOperationsInput | number
    stake?: FloatFieldUpdateOperationsInput | number
    thesis?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    evalVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isCorrect?: NullableBoolFieldUpdateOperationsInput | boolean | null
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    settledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BetCreateManyInput = {
    id?: string
    userId: string
    runId: string
    direction: $Enums.BetDirection
    confidence: number
    stake: number
    thesis?: string | null
    status?: string
    evalVersion?: string | null
    isCorrect?: boolean | null
    pnl?: number | null
    settledAt?: Date | string | null
    createdAt?: Date | string
  }

  export type BetUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    direction?: EnumBetDirectionFieldUpdateOperationsInput | $Enums.BetDirection
    confidence?: IntFieldUpdateOperationsInput | number
    stake?: FloatFieldUpdateOperationsInput | number
    thesis?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    evalVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isCorrect?: NullableBoolFieldUpdateOperationsInput | boolean | null
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    settledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BetUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    runId?: StringFieldUpdateOperationsInput | string
    direction?: EnumBetDirectionFieldUpdateOperationsInput | $Enums.BetDirection
    confidence?: IntFieldUpdateOperationsInput | number
    stake?: FloatFieldUpdateOperationsInput | number
    thesis?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    evalVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isCorrect?: NullableBoolFieldUpdateOperationsInput | boolean | null
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    settledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ImportRunCreateInput = {
    id?: string
    type: string
    sourceFilename: string
    sourceHash: string
    status: string
    summaryJson?: NullableJsonNullValueInput | InputJsonValue
    errorJson?: NullableJsonNullValueInput | InputJsonValue
    startedAt: Date | string
    finishedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ImportRunUncheckedCreateInput = {
    id?: string
    type: string
    sourceFilename: string
    sourceHash: string
    status: string
    summaryJson?: NullableJsonNullValueInput | InputJsonValue
    errorJson?: NullableJsonNullValueInput | InputJsonValue
    startedAt: Date | string
    finishedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ImportRunUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    sourceFilename?: StringFieldUpdateOperationsInput | string
    sourceHash?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    summaryJson?: NullableJsonNullValueInput | InputJsonValue
    errorJson?: NullableJsonNullValueInput | InputJsonValue
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ImportRunUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    sourceFilename?: StringFieldUpdateOperationsInput | string
    sourceHash?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    summaryJson?: NullableJsonNullValueInput | InputJsonValue
    errorJson?: NullableJsonNullValueInput | InputJsonValue
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ImportRunCreateManyInput = {
    id?: string
    type: string
    sourceFilename: string
    sourceHash: string
    status: string
    summaryJson?: NullableJsonNullValueInput | InputJsonValue
    errorJson?: NullableJsonNullValueInput | InputJsonValue
    startedAt: Date | string
    finishedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ImportRunUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    sourceFilename?: StringFieldUpdateOperationsInput | string
    sourceHash?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    summaryJson?: NullableJsonNullValueInput | InputJsonValue
    errorJson?: NullableJsonNullValueInput | InputJsonValue
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ImportRunUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    sourceFilename?: StringFieldUpdateOperationsInput | string
    sourceHash?: StringFieldUpdateOperationsInput | string
    status?: StringFieldUpdateOperationsInput | string
    summaryJson?: NullableJsonNullValueInput | InputJsonValue
    errorJson?: NullableJsonNullValueInput | InputJsonValue
    startedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UuidFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedUuidFilter<$PrismaModel> | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type ArchetypeTraitProfileListRelationFilter = {
    every?: ArchetypeTraitProfileWhereInput
    some?: ArchetypeTraitProfileWhereInput
    none?: ArchetypeTraitProfileWhereInput
  }

  export type AgentListRelationFilter = {
    every?: AgentWhereInput
    some?: AgentWhereInput
    none?: AgentWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type ArchetypeTraitProfileOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type AgentOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ArchetypeCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ArchetypeMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ArchetypeMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    description?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UuidWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedUuidWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type FloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type TraitDefinitionCountOrderByAggregateInput = {
    id?: SortOrder
    key?: SortOrder
    displayName?: SortOrder
    description?: SortOrder
    valueRangeText?: SortOrder
    minValue?: SortOrder
    maxValue?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TraitDefinitionAvgOrderByAggregateInput = {
    minValue?: SortOrder
    maxValue?: SortOrder
  }

  export type TraitDefinitionMaxOrderByAggregateInput = {
    id?: SortOrder
    key?: SortOrder
    displayName?: SortOrder
    description?: SortOrder
    valueRangeText?: SortOrder
    minValue?: SortOrder
    maxValue?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TraitDefinitionMinOrderByAggregateInput = {
    id?: SortOrder
    key?: SortOrder
    displayName?: SortOrder
    description?: SortOrder
    valueRangeText?: SortOrder
    minValue?: SortOrder
    maxValue?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type TraitDefinitionSumOrderByAggregateInput = {
    minValue?: SortOrder
    maxValue?: SortOrder
  }

  export type FloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type ArchetypeRelationFilter = {
    is?: ArchetypeWhereInput
    isNot?: ArchetypeWhereInput
  }

  export type TraitDefinitionRelationFilter = {
    is?: TraitDefinitionWhereInput
    isNot?: TraitDefinitionWhereInput
  }

  export type ArchetypeTraitProfileArchetypeIdTraitDefinitionIdCompoundUniqueInput = {
    archetypeId: string
    traitDefinitionId: string
  }

  export type ArchetypeTraitProfileCountOrderByAggregateInput = {
    archetypeId?: SortOrder
    traitDefinitionId?: SortOrder
    baselineValue?: SortOrder
  }

  export type ArchetypeTraitProfileAvgOrderByAggregateInput = {
    baselineValue?: SortOrder
  }

  export type ArchetypeTraitProfileMaxOrderByAggregateInput = {
    archetypeId?: SortOrder
    traitDefinitionId?: SortOrder
    baselineValue?: SortOrder
  }

  export type ArchetypeTraitProfileMinOrderByAggregateInput = {
    archetypeId?: SortOrder
    traitDefinitionId?: SortOrder
    baselineValue?: SortOrder
  }

  export type ArchetypeTraitProfileSumOrderByAggregateInput = {
    baselineValue?: SortOrder
  }

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }
  export type JsonNullableFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type AgentExperienceListRelationFilter = {
    every?: AgentExperienceWhereInput
    some?: AgentExperienceWhereInput
    none?: AgentExperienceWhereInput
  }

  export type AgentExperienceOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type AgentCountOrderByAggregateInput = {
    id?: SortOrder
    displayName?: SortOrder
    archetypeId?: SortOrder
    stateJson?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AgentMaxOrderByAggregateInput = {
    id?: SortOrder
    displayName?: SortOrder
    archetypeId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type AgentMinOrderByAggregateInput = {
    id?: SortOrder
    displayName?: SortOrder
    archetypeId?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type EnumSimulationRunStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.SimulationRunStatus | EnumSimulationRunStatusFieldRefInput<$PrismaModel>
    in?: $Enums.SimulationRunStatus[] | ListEnumSimulationRunStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.SimulationRunStatus[] | ListEnumSimulationRunStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumSimulationRunStatusFilter<$PrismaModel> | $Enums.SimulationRunStatus
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type CrowdSnapshotListRelationFilter = {
    every?: CrowdSnapshotWhereInput
    some?: CrowdSnapshotWhereInput
    none?: CrowdSnapshotWhereInput
  }

  export type RunDebugNullableRelationFilter = {
    is?: RunDebugWhereInput | null
    isNot?: RunDebugWhereInput | null
  }

  export type BetListRelationFilter = {
    every?: BetWhereInput
    some?: BetWhereInput
    none?: BetWhereInput
  }

  export type CrowdSnapshotOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type BetOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type SimulationRunNameDatasetVersionCompoundUniqueInput = {
    name: string
    datasetVersion: string
  }

  export type SimulationRunCountOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    status?: SortOrder
    seed?: SortOrder
    modelVersion?: SortOrder
    datasetVersion?: SortOrder
    codeGitSha?: SortOrder
    schemaVersion?: SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrder
    configJson?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SimulationRunAvgOrderByAggregateInput = {
    seed?: SortOrder
  }

  export type SimulationRunMaxOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    status?: SortOrder
    seed?: SortOrder
    modelVersion?: SortOrder
    datasetVersion?: SortOrder
    codeGitSha?: SortOrder
    schemaVersion?: SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SimulationRunMinOrderByAggregateInput = {
    id?: SortOrder
    name?: SortOrder
    status?: SortOrder
    seed?: SortOrder
    modelVersion?: SortOrder
    datasetVersion?: SortOrder
    codeGitSha?: SortOrder
    schemaVersion?: SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SimulationRunSumOrderByAggregateInput = {
    seed?: SortOrder
  }

  export type EnumSimulationRunStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.SimulationRunStatus | EnumSimulationRunStatusFieldRefInput<$PrismaModel>
    in?: $Enums.SimulationRunStatus[] | ListEnumSimulationRunStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.SimulationRunStatus[] | ListEnumSimulationRunStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumSimulationRunStatusWithAggregatesFilter<$PrismaModel> | $Enums.SimulationRunStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumSimulationRunStatusFilter<$PrismaModel>
    _max?: NestedEnumSimulationRunStatusFilter<$PrismaModel>
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type SimulationRunRelationFilter = {
    is?: SimulationRunWhereInput
    isNot?: SimulationRunWhereInput
  }

  export type RunDebugCountOrderByAggregateInput = {
    runId?: SortOrder
    prePersistHistogram?: SortOrder
    samplePrePersistActions?: SortOrder
    createdAt?: SortOrder
  }

  export type RunDebugMaxOrderByAggregateInput = {
    runId?: SortOrder
    createdAt?: SortOrder
  }

  export type RunDebugMinOrderByAggregateInput = {
    runId?: SortOrder
    createdAt?: SortOrder
  }

  export type AgentRelationFilter = {
    is?: AgentWhereInput
    isNot?: AgentWhereInput
  }

  export type AgentExperienceCountOrderByAggregateInput = {
    id?: SortOrder
    runId?: SortOrder
    agentId?: SortOrder
    step?: SortOrder
    ts?: SortOrder
    actionJson?: SortOrder
    signalsJson?: SortOrder
    pnl?: SortOrder
    drawdown?: SortOrder
    reward?: SortOrder
    learningMetaJson?: SortOrder
    stateBeforeJson?: SortOrder
    stateAfterJson?: SortOrder
  }

  export type AgentExperienceAvgOrderByAggregateInput = {
    step?: SortOrder
    pnl?: SortOrder
    drawdown?: SortOrder
    reward?: SortOrder
  }

  export type AgentExperienceMaxOrderByAggregateInput = {
    id?: SortOrder
    runId?: SortOrder
    agentId?: SortOrder
    step?: SortOrder
    ts?: SortOrder
    pnl?: SortOrder
    drawdown?: SortOrder
    reward?: SortOrder
  }

  export type AgentExperienceMinOrderByAggregateInput = {
    id?: SortOrder
    runId?: SortOrder
    agentId?: SortOrder
    step?: SortOrder
    ts?: SortOrder
    pnl?: SortOrder
    drawdown?: SortOrder
    reward?: SortOrder
  }

  export type AgentExperienceSumOrderByAggregateInput = {
    step?: SortOrder
    pnl?: SortOrder
    drawdown?: SortOrder
    reward?: SortOrder
  }

  export type CrowdSnapshotRunIdStepCompoundUniqueInput = {
    runId: string
    step: number
  }

  export type CrowdSnapshotCountOrderByAggregateInput = {
    id?: SortOrder
    runId?: SortOrder
    step?: SortOrder
    ts?: SortOrder
    aggregationJson?: SortOrder
    confidence?: SortOrder
  }

  export type CrowdSnapshotAvgOrderByAggregateInput = {
    step?: SortOrder
    confidence?: SortOrder
  }

  export type CrowdSnapshotMaxOrderByAggregateInput = {
    id?: SortOrder
    runId?: SortOrder
    step?: SortOrder
    ts?: SortOrder
    confidence?: SortOrder
  }

  export type CrowdSnapshotMinOrderByAggregateInput = {
    id?: SortOrder
    runId?: SortOrder
    step?: SortOrder
    ts?: SortOrder
    confidence?: SortOrder
  }

  export type CrowdSnapshotSumOrderByAggregateInput = {
    step?: SortOrder
    confidence?: SortOrder
  }

  export type UserProfileCountOrderByAggregateInput = {
    userId?: SortOrder
    displayName?: SortOrder
    createdAt?: SortOrder
  }

  export type UserProfileMaxOrderByAggregateInput = {
    userId?: SortOrder
    displayName?: SortOrder
    createdAt?: SortOrder
  }

  export type UserProfileMinOrderByAggregateInput = {
    userId?: SortOrder
    displayName?: SortOrder
    createdAt?: SortOrder
  }

  export type UserWalletCountOrderByAggregateInput = {
    userId?: SortOrder
    balance?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserWalletAvgOrderByAggregateInput = {
    balance?: SortOrder
  }

  export type UserWalletMaxOrderByAggregateInput = {
    userId?: SortOrder
    balance?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserWalletMinOrderByAggregateInput = {
    userId?: SortOrder
    balance?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserWalletSumOrderByAggregateInput = {
    balance?: SortOrder
  }

  export type EnumBetDirectionFilter<$PrismaModel = never> = {
    equals?: $Enums.BetDirection | EnumBetDirectionFieldRefInput<$PrismaModel>
    in?: $Enums.BetDirection[] | ListEnumBetDirectionFieldRefInput<$PrismaModel>
    notIn?: $Enums.BetDirection[] | ListEnumBetDirectionFieldRefInput<$PrismaModel>
    not?: NestedEnumBetDirectionFilter<$PrismaModel> | $Enums.BetDirection
  }

  export type BoolNullableFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableFilter<$PrismaModel> | boolean | null
  }

  export type BetCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    runId?: SortOrder
    direction?: SortOrder
    confidence?: SortOrder
    stake?: SortOrder
    thesis?: SortOrder
    status?: SortOrder
    evalVersion?: SortOrder
    isCorrect?: SortOrder
    pnl?: SortOrder
    settledAt?: SortOrder
    createdAt?: SortOrder
  }

  export type BetAvgOrderByAggregateInput = {
    confidence?: SortOrder
    stake?: SortOrder
    pnl?: SortOrder
  }

  export type BetMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    runId?: SortOrder
    direction?: SortOrder
    confidence?: SortOrder
    stake?: SortOrder
    thesis?: SortOrder
    status?: SortOrder
    evalVersion?: SortOrder
    isCorrect?: SortOrder
    pnl?: SortOrder
    settledAt?: SortOrder
    createdAt?: SortOrder
  }

  export type BetMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    runId?: SortOrder
    direction?: SortOrder
    confidence?: SortOrder
    stake?: SortOrder
    thesis?: SortOrder
    status?: SortOrder
    evalVersion?: SortOrder
    isCorrect?: SortOrder
    pnl?: SortOrder
    settledAt?: SortOrder
    createdAt?: SortOrder
  }

  export type BetSumOrderByAggregateInput = {
    confidence?: SortOrder
    stake?: SortOrder
    pnl?: SortOrder
  }

  export type EnumBetDirectionWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.BetDirection | EnumBetDirectionFieldRefInput<$PrismaModel>
    in?: $Enums.BetDirection[] | ListEnumBetDirectionFieldRefInput<$PrismaModel>
    notIn?: $Enums.BetDirection[] | ListEnumBetDirectionFieldRefInput<$PrismaModel>
    not?: NestedEnumBetDirectionWithAggregatesFilter<$PrismaModel> | $Enums.BetDirection
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumBetDirectionFilter<$PrismaModel>
    _max?: NestedEnumBetDirectionFilter<$PrismaModel>
  }

  export type BoolNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableWithAggregatesFilter<$PrismaModel> | boolean | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedBoolNullableFilter<$PrismaModel>
    _max?: NestedBoolNullableFilter<$PrismaModel>
  }

  export type ImportRunCountOrderByAggregateInput = {
    id?: SortOrder
    type?: SortOrder
    sourceFilename?: SortOrder
    sourceHash?: SortOrder
    status?: SortOrder
    summaryJson?: SortOrder
    errorJson?: SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ImportRunMaxOrderByAggregateInput = {
    id?: SortOrder
    type?: SortOrder
    sourceFilename?: SortOrder
    sourceHash?: SortOrder
    status?: SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ImportRunMinOrderByAggregateInput = {
    id?: SortOrder
    type?: SortOrder
    sourceFilename?: SortOrder
    sourceHash?: SortOrder
    status?: SortOrder
    startedAt?: SortOrder
    finishedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ArchetypeTraitProfileCreateNestedManyWithoutArchetypeInput = {
    create?: XOR<ArchetypeTraitProfileCreateWithoutArchetypeInput, ArchetypeTraitProfileUncheckedCreateWithoutArchetypeInput> | ArchetypeTraitProfileCreateWithoutArchetypeInput[] | ArchetypeTraitProfileUncheckedCreateWithoutArchetypeInput[]
    connectOrCreate?: ArchetypeTraitProfileCreateOrConnectWithoutArchetypeInput | ArchetypeTraitProfileCreateOrConnectWithoutArchetypeInput[]
    createMany?: ArchetypeTraitProfileCreateManyArchetypeInputEnvelope
    connect?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
  }

  export type AgentCreateNestedManyWithoutArchetypeInput = {
    create?: XOR<AgentCreateWithoutArchetypeInput, AgentUncheckedCreateWithoutArchetypeInput> | AgentCreateWithoutArchetypeInput[] | AgentUncheckedCreateWithoutArchetypeInput[]
    connectOrCreate?: AgentCreateOrConnectWithoutArchetypeInput | AgentCreateOrConnectWithoutArchetypeInput[]
    createMany?: AgentCreateManyArchetypeInputEnvelope
    connect?: AgentWhereUniqueInput | AgentWhereUniqueInput[]
  }

  export type ArchetypeTraitProfileUncheckedCreateNestedManyWithoutArchetypeInput = {
    create?: XOR<ArchetypeTraitProfileCreateWithoutArchetypeInput, ArchetypeTraitProfileUncheckedCreateWithoutArchetypeInput> | ArchetypeTraitProfileCreateWithoutArchetypeInput[] | ArchetypeTraitProfileUncheckedCreateWithoutArchetypeInput[]
    connectOrCreate?: ArchetypeTraitProfileCreateOrConnectWithoutArchetypeInput | ArchetypeTraitProfileCreateOrConnectWithoutArchetypeInput[]
    createMany?: ArchetypeTraitProfileCreateManyArchetypeInputEnvelope
    connect?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
  }

  export type AgentUncheckedCreateNestedManyWithoutArchetypeInput = {
    create?: XOR<AgentCreateWithoutArchetypeInput, AgentUncheckedCreateWithoutArchetypeInput> | AgentCreateWithoutArchetypeInput[] | AgentUncheckedCreateWithoutArchetypeInput[]
    connectOrCreate?: AgentCreateOrConnectWithoutArchetypeInput | AgentCreateOrConnectWithoutArchetypeInput[]
    createMany?: AgentCreateManyArchetypeInputEnvelope
    connect?: AgentWhereUniqueInput | AgentWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type ArchetypeTraitProfileUpdateManyWithoutArchetypeNestedInput = {
    create?: XOR<ArchetypeTraitProfileCreateWithoutArchetypeInput, ArchetypeTraitProfileUncheckedCreateWithoutArchetypeInput> | ArchetypeTraitProfileCreateWithoutArchetypeInput[] | ArchetypeTraitProfileUncheckedCreateWithoutArchetypeInput[]
    connectOrCreate?: ArchetypeTraitProfileCreateOrConnectWithoutArchetypeInput | ArchetypeTraitProfileCreateOrConnectWithoutArchetypeInput[]
    upsert?: ArchetypeTraitProfileUpsertWithWhereUniqueWithoutArchetypeInput | ArchetypeTraitProfileUpsertWithWhereUniqueWithoutArchetypeInput[]
    createMany?: ArchetypeTraitProfileCreateManyArchetypeInputEnvelope
    set?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
    disconnect?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
    delete?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
    connect?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
    update?: ArchetypeTraitProfileUpdateWithWhereUniqueWithoutArchetypeInput | ArchetypeTraitProfileUpdateWithWhereUniqueWithoutArchetypeInput[]
    updateMany?: ArchetypeTraitProfileUpdateManyWithWhereWithoutArchetypeInput | ArchetypeTraitProfileUpdateManyWithWhereWithoutArchetypeInput[]
    deleteMany?: ArchetypeTraitProfileScalarWhereInput | ArchetypeTraitProfileScalarWhereInput[]
  }

  export type AgentUpdateManyWithoutArchetypeNestedInput = {
    create?: XOR<AgentCreateWithoutArchetypeInput, AgentUncheckedCreateWithoutArchetypeInput> | AgentCreateWithoutArchetypeInput[] | AgentUncheckedCreateWithoutArchetypeInput[]
    connectOrCreate?: AgentCreateOrConnectWithoutArchetypeInput | AgentCreateOrConnectWithoutArchetypeInput[]
    upsert?: AgentUpsertWithWhereUniqueWithoutArchetypeInput | AgentUpsertWithWhereUniqueWithoutArchetypeInput[]
    createMany?: AgentCreateManyArchetypeInputEnvelope
    set?: AgentWhereUniqueInput | AgentWhereUniqueInput[]
    disconnect?: AgentWhereUniqueInput | AgentWhereUniqueInput[]
    delete?: AgentWhereUniqueInput | AgentWhereUniqueInput[]
    connect?: AgentWhereUniqueInput | AgentWhereUniqueInput[]
    update?: AgentUpdateWithWhereUniqueWithoutArchetypeInput | AgentUpdateWithWhereUniqueWithoutArchetypeInput[]
    updateMany?: AgentUpdateManyWithWhereWithoutArchetypeInput | AgentUpdateManyWithWhereWithoutArchetypeInput[]
    deleteMany?: AgentScalarWhereInput | AgentScalarWhereInput[]
  }

  export type ArchetypeTraitProfileUncheckedUpdateManyWithoutArchetypeNestedInput = {
    create?: XOR<ArchetypeTraitProfileCreateWithoutArchetypeInput, ArchetypeTraitProfileUncheckedCreateWithoutArchetypeInput> | ArchetypeTraitProfileCreateWithoutArchetypeInput[] | ArchetypeTraitProfileUncheckedCreateWithoutArchetypeInput[]
    connectOrCreate?: ArchetypeTraitProfileCreateOrConnectWithoutArchetypeInput | ArchetypeTraitProfileCreateOrConnectWithoutArchetypeInput[]
    upsert?: ArchetypeTraitProfileUpsertWithWhereUniqueWithoutArchetypeInput | ArchetypeTraitProfileUpsertWithWhereUniqueWithoutArchetypeInput[]
    createMany?: ArchetypeTraitProfileCreateManyArchetypeInputEnvelope
    set?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
    disconnect?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
    delete?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
    connect?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
    update?: ArchetypeTraitProfileUpdateWithWhereUniqueWithoutArchetypeInput | ArchetypeTraitProfileUpdateWithWhereUniqueWithoutArchetypeInput[]
    updateMany?: ArchetypeTraitProfileUpdateManyWithWhereWithoutArchetypeInput | ArchetypeTraitProfileUpdateManyWithWhereWithoutArchetypeInput[]
    deleteMany?: ArchetypeTraitProfileScalarWhereInput | ArchetypeTraitProfileScalarWhereInput[]
  }

  export type AgentUncheckedUpdateManyWithoutArchetypeNestedInput = {
    create?: XOR<AgentCreateWithoutArchetypeInput, AgentUncheckedCreateWithoutArchetypeInput> | AgentCreateWithoutArchetypeInput[] | AgentUncheckedCreateWithoutArchetypeInput[]
    connectOrCreate?: AgentCreateOrConnectWithoutArchetypeInput | AgentCreateOrConnectWithoutArchetypeInput[]
    upsert?: AgentUpsertWithWhereUniqueWithoutArchetypeInput | AgentUpsertWithWhereUniqueWithoutArchetypeInput[]
    createMany?: AgentCreateManyArchetypeInputEnvelope
    set?: AgentWhereUniqueInput | AgentWhereUniqueInput[]
    disconnect?: AgentWhereUniqueInput | AgentWhereUniqueInput[]
    delete?: AgentWhereUniqueInput | AgentWhereUniqueInput[]
    connect?: AgentWhereUniqueInput | AgentWhereUniqueInput[]
    update?: AgentUpdateWithWhereUniqueWithoutArchetypeInput | AgentUpdateWithWhereUniqueWithoutArchetypeInput[]
    updateMany?: AgentUpdateManyWithWhereWithoutArchetypeInput | AgentUpdateManyWithWhereWithoutArchetypeInput[]
    deleteMany?: AgentScalarWhereInput | AgentScalarWhereInput[]
  }

  export type ArchetypeTraitProfileCreateNestedManyWithoutTraitDefinitionInput = {
    create?: XOR<ArchetypeTraitProfileCreateWithoutTraitDefinitionInput, ArchetypeTraitProfileUncheckedCreateWithoutTraitDefinitionInput> | ArchetypeTraitProfileCreateWithoutTraitDefinitionInput[] | ArchetypeTraitProfileUncheckedCreateWithoutTraitDefinitionInput[]
    connectOrCreate?: ArchetypeTraitProfileCreateOrConnectWithoutTraitDefinitionInput | ArchetypeTraitProfileCreateOrConnectWithoutTraitDefinitionInput[]
    createMany?: ArchetypeTraitProfileCreateManyTraitDefinitionInputEnvelope
    connect?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
  }

  export type ArchetypeTraitProfileUncheckedCreateNestedManyWithoutTraitDefinitionInput = {
    create?: XOR<ArchetypeTraitProfileCreateWithoutTraitDefinitionInput, ArchetypeTraitProfileUncheckedCreateWithoutTraitDefinitionInput> | ArchetypeTraitProfileCreateWithoutTraitDefinitionInput[] | ArchetypeTraitProfileUncheckedCreateWithoutTraitDefinitionInput[]
    connectOrCreate?: ArchetypeTraitProfileCreateOrConnectWithoutTraitDefinitionInput | ArchetypeTraitProfileCreateOrConnectWithoutTraitDefinitionInput[]
    createMany?: ArchetypeTraitProfileCreateManyTraitDefinitionInputEnvelope
    connect?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
  }

  export type NullableFloatFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type ArchetypeTraitProfileUpdateManyWithoutTraitDefinitionNestedInput = {
    create?: XOR<ArchetypeTraitProfileCreateWithoutTraitDefinitionInput, ArchetypeTraitProfileUncheckedCreateWithoutTraitDefinitionInput> | ArchetypeTraitProfileCreateWithoutTraitDefinitionInput[] | ArchetypeTraitProfileUncheckedCreateWithoutTraitDefinitionInput[]
    connectOrCreate?: ArchetypeTraitProfileCreateOrConnectWithoutTraitDefinitionInput | ArchetypeTraitProfileCreateOrConnectWithoutTraitDefinitionInput[]
    upsert?: ArchetypeTraitProfileUpsertWithWhereUniqueWithoutTraitDefinitionInput | ArchetypeTraitProfileUpsertWithWhereUniqueWithoutTraitDefinitionInput[]
    createMany?: ArchetypeTraitProfileCreateManyTraitDefinitionInputEnvelope
    set?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
    disconnect?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
    delete?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
    connect?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
    update?: ArchetypeTraitProfileUpdateWithWhereUniqueWithoutTraitDefinitionInput | ArchetypeTraitProfileUpdateWithWhereUniqueWithoutTraitDefinitionInput[]
    updateMany?: ArchetypeTraitProfileUpdateManyWithWhereWithoutTraitDefinitionInput | ArchetypeTraitProfileUpdateManyWithWhereWithoutTraitDefinitionInput[]
    deleteMany?: ArchetypeTraitProfileScalarWhereInput | ArchetypeTraitProfileScalarWhereInput[]
  }

  export type ArchetypeTraitProfileUncheckedUpdateManyWithoutTraitDefinitionNestedInput = {
    create?: XOR<ArchetypeTraitProfileCreateWithoutTraitDefinitionInput, ArchetypeTraitProfileUncheckedCreateWithoutTraitDefinitionInput> | ArchetypeTraitProfileCreateWithoutTraitDefinitionInput[] | ArchetypeTraitProfileUncheckedCreateWithoutTraitDefinitionInput[]
    connectOrCreate?: ArchetypeTraitProfileCreateOrConnectWithoutTraitDefinitionInput | ArchetypeTraitProfileCreateOrConnectWithoutTraitDefinitionInput[]
    upsert?: ArchetypeTraitProfileUpsertWithWhereUniqueWithoutTraitDefinitionInput | ArchetypeTraitProfileUpsertWithWhereUniqueWithoutTraitDefinitionInput[]
    createMany?: ArchetypeTraitProfileCreateManyTraitDefinitionInputEnvelope
    set?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
    disconnect?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
    delete?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
    connect?: ArchetypeTraitProfileWhereUniqueInput | ArchetypeTraitProfileWhereUniqueInput[]
    update?: ArchetypeTraitProfileUpdateWithWhereUniqueWithoutTraitDefinitionInput | ArchetypeTraitProfileUpdateWithWhereUniqueWithoutTraitDefinitionInput[]
    updateMany?: ArchetypeTraitProfileUpdateManyWithWhereWithoutTraitDefinitionInput | ArchetypeTraitProfileUpdateManyWithWhereWithoutTraitDefinitionInput[]
    deleteMany?: ArchetypeTraitProfileScalarWhereInput | ArchetypeTraitProfileScalarWhereInput[]
  }

  export type ArchetypeCreateNestedOneWithoutTraitProfilesInput = {
    create?: XOR<ArchetypeCreateWithoutTraitProfilesInput, ArchetypeUncheckedCreateWithoutTraitProfilesInput>
    connectOrCreate?: ArchetypeCreateOrConnectWithoutTraitProfilesInput
    connect?: ArchetypeWhereUniqueInput
  }

  export type TraitDefinitionCreateNestedOneWithoutArchetypeProfilesInput = {
    create?: XOR<TraitDefinitionCreateWithoutArchetypeProfilesInput, TraitDefinitionUncheckedCreateWithoutArchetypeProfilesInput>
    connectOrCreate?: TraitDefinitionCreateOrConnectWithoutArchetypeProfilesInput
    connect?: TraitDefinitionWhereUniqueInput
  }

  export type FloatFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type ArchetypeUpdateOneRequiredWithoutTraitProfilesNestedInput = {
    create?: XOR<ArchetypeCreateWithoutTraitProfilesInput, ArchetypeUncheckedCreateWithoutTraitProfilesInput>
    connectOrCreate?: ArchetypeCreateOrConnectWithoutTraitProfilesInput
    upsert?: ArchetypeUpsertWithoutTraitProfilesInput
    connect?: ArchetypeWhereUniqueInput
    update?: XOR<XOR<ArchetypeUpdateToOneWithWhereWithoutTraitProfilesInput, ArchetypeUpdateWithoutTraitProfilesInput>, ArchetypeUncheckedUpdateWithoutTraitProfilesInput>
  }

  export type TraitDefinitionUpdateOneRequiredWithoutArchetypeProfilesNestedInput = {
    create?: XOR<TraitDefinitionCreateWithoutArchetypeProfilesInput, TraitDefinitionUncheckedCreateWithoutArchetypeProfilesInput>
    connectOrCreate?: TraitDefinitionCreateOrConnectWithoutArchetypeProfilesInput
    upsert?: TraitDefinitionUpsertWithoutArchetypeProfilesInput
    connect?: TraitDefinitionWhereUniqueInput
    update?: XOR<XOR<TraitDefinitionUpdateToOneWithWhereWithoutArchetypeProfilesInput, TraitDefinitionUpdateWithoutArchetypeProfilesInput>, TraitDefinitionUncheckedUpdateWithoutArchetypeProfilesInput>
  }

  export type ArchetypeCreateNestedOneWithoutAgentsInput = {
    create?: XOR<ArchetypeCreateWithoutAgentsInput, ArchetypeUncheckedCreateWithoutAgentsInput>
    connectOrCreate?: ArchetypeCreateOrConnectWithoutAgentsInput
    connect?: ArchetypeWhereUniqueInput
  }

  export type AgentExperienceCreateNestedManyWithoutAgentInput = {
    create?: XOR<AgentExperienceCreateWithoutAgentInput, AgentExperienceUncheckedCreateWithoutAgentInput> | AgentExperienceCreateWithoutAgentInput[] | AgentExperienceUncheckedCreateWithoutAgentInput[]
    connectOrCreate?: AgentExperienceCreateOrConnectWithoutAgentInput | AgentExperienceCreateOrConnectWithoutAgentInput[]
    createMany?: AgentExperienceCreateManyAgentInputEnvelope
    connect?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
  }

  export type AgentExperienceUncheckedCreateNestedManyWithoutAgentInput = {
    create?: XOR<AgentExperienceCreateWithoutAgentInput, AgentExperienceUncheckedCreateWithoutAgentInput> | AgentExperienceCreateWithoutAgentInput[] | AgentExperienceUncheckedCreateWithoutAgentInput[]
    connectOrCreate?: AgentExperienceCreateOrConnectWithoutAgentInput | AgentExperienceCreateOrConnectWithoutAgentInput[]
    createMany?: AgentExperienceCreateManyAgentInputEnvelope
    connect?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
  }

  export type ArchetypeUpdateOneRequiredWithoutAgentsNestedInput = {
    create?: XOR<ArchetypeCreateWithoutAgentsInput, ArchetypeUncheckedCreateWithoutAgentsInput>
    connectOrCreate?: ArchetypeCreateOrConnectWithoutAgentsInput
    upsert?: ArchetypeUpsertWithoutAgentsInput
    connect?: ArchetypeWhereUniqueInput
    update?: XOR<XOR<ArchetypeUpdateToOneWithWhereWithoutAgentsInput, ArchetypeUpdateWithoutAgentsInput>, ArchetypeUncheckedUpdateWithoutAgentsInput>
  }

  export type AgentExperienceUpdateManyWithoutAgentNestedInput = {
    create?: XOR<AgentExperienceCreateWithoutAgentInput, AgentExperienceUncheckedCreateWithoutAgentInput> | AgentExperienceCreateWithoutAgentInput[] | AgentExperienceUncheckedCreateWithoutAgentInput[]
    connectOrCreate?: AgentExperienceCreateOrConnectWithoutAgentInput | AgentExperienceCreateOrConnectWithoutAgentInput[]
    upsert?: AgentExperienceUpsertWithWhereUniqueWithoutAgentInput | AgentExperienceUpsertWithWhereUniqueWithoutAgentInput[]
    createMany?: AgentExperienceCreateManyAgentInputEnvelope
    set?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
    disconnect?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
    delete?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
    connect?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
    update?: AgentExperienceUpdateWithWhereUniqueWithoutAgentInput | AgentExperienceUpdateWithWhereUniqueWithoutAgentInput[]
    updateMany?: AgentExperienceUpdateManyWithWhereWithoutAgentInput | AgentExperienceUpdateManyWithWhereWithoutAgentInput[]
    deleteMany?: AgentExperienceScalarWhereInput | AgentExperienceScalarWhereInput[]
  }

  export type AgentExperienceUncheckedUpdateManyWithoutAgentNestedInput = {
    create?: XOR<AgentExperienceCreateWithoutAgentInput, AgentExperienceUncheckedCreateWithoutAgentInput> | AgentExperienceCreateWithoutAgentInput[] | AgentExperienceUncheckedCreateWithoutAgentInput[]
    connectOrCreate?: AgentExperienceCreateOrConnectWithoutAgentInput | AgentExperienceCreateOrConnectWithoutAgentInput[]
    upsert?: AgentExperienceUpsertWithWhereUniqueWithoutAgentInput | AgentExperienceUpsertWithWhereUniqueWithoutAgentInput[]
    createMany?: AgentExperienceCreateManyAgentInputEnvelope
    set?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
    disconnect?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
    delete?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
    connect?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
    update?: AgentExperienceUpdateWithWhereUniqueWithoutAgentInput | AgentExperienceUpdateWithWhereUniqueWithoutAgentInput[]
    updateMany?: AgentExperienceUpdateManyWithWhereWithoutAgentInput | AgentExperienceUpdateManyWithWhereWithoutAgentInput[]
    deleteMany?: AgentExperienceScalarWhereInput | AgentExperienceScalarWhereInput[]
  }

  export type AgentExperienceCreateNestedManyWithoutRunInput = {
    create?: XOR<AgentExperienceCreateWithoutRunInput, AgentExperienceUncheckedCreateWithoutRunInput> | AgentExperienceCreateWithoutRunInput[] | AgentExperienceUncheckedCreateWithoutRunInput[]
    connectOrCreate?: AgentExperienceCreateOrConnectWithoutRunInput | AgentExperienceCreateOrConnectWithoutRunInput[]
    createMany?: AgentExperienceCreateManyRunInputEnvelope
    connect?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
  }

  export type CrowdSnapshotCreateNestedManyWithoutRunInput = {
    create?: XOR<CrowdSnapshotCreateWithoutRunInput, CrowdSnapshotUncheckedCreateWithoutRunInput> | CrowdSnapshotCreateWithoutRunInput[] | CrowdSnapshotUncheckedCreateWithoutRunInput[]
    connectOrCreate?: CrowdSnapshotCreateOrConnectWithoutRunInput | CrowdSnapshotCreateOrConnectWithoutRunInput[]
    createMany?: CrowdSnapshotCreateManyRunInputEnvelope
    connect?: CrowdSnapshotWhereUniqueInput | CrowdSnapshotWhereUniqueInput[]
  }

  export type RunDebugCreateNestedOneWithoutRunInput = {
    create?: XOR<RunDebugCreateWithoutRunInput, RunDebugUncheckedCreateWithoutRunInput>
    connectOrCreate?: RunDebugCreateOrConnectWithoutRunInput
    connect?: RunDebugWhereUniqueInput
  }

  export type BetCreateNestedManyWithoutRunInput = {
    create?: XOR<BetCreateWithoutRunInput, BetUncheckedCreateWithoutRunInput> | BetCreateWithoutRunInput[] | BetUncheckedCreateWithoutRunInput[]
    connectOrCreate?: BetCreateOrConnectWithoutRunInput | BetCreateOrConnectWithoutRunInput[]
    createMany?: BetCreateManyRunInputEnvelope
    connect?: BetWhereUniqueInput | BetWhereUniqueInput[]
  }

  export type AgentExperienceUncheckedCreateNestedManyWithoutRunInput = {
    create?: XOR<AgentExperienceCreateWithoutRunInput, AgentExperienceUncheckedCreateWithoutRunInput> | AgentExperienceCreateWithoutRunInput[] | AgentExperienceUncheckedCreateWithoutRunInput[]
    connectOrCreate?: AgentExperienceCreateOrConnectWithoutRunInput | AgentExperienceCreateOrConnectWithoutRunInput[]
    createMany?: AgentExperienceCreateManyRunInputEnvelope
    connect?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
  }

  export type CrowdSnapshotUncheckedCreateNestedManyWithoutRunInput = {
    create?: XOR<CrowdSnapshotCreateWithoutRunInput, CrowdSnapshotUncheckedCreateWithoutRunInput> | CrowdSnapshotCreateWithoutRunInput[] | CrowdSnapshotUncheckedCreateWithoutRunInput[]
    connectOrCreate?: CrowdSnapshotCreateOrConnectWithoutRunInput | CrowdSnapshotCreateOrConnectWithoutRunInput[]
    createMany?: CrowdSnapshotCreateManyRunInputEnvelope
    connect?: CrowdSnapshotWhereUniqueInput | CrowdSnapshotWhereUniqueInput[]
  }

  export type RunDebugUncheckedCreateNestedOneWithoutRunInput = {
    create?: XOR<RunDebugCreateWithoutRunInput, RunDebugUncheckedCreateWithoutRunInput>
    connectOrCreate?: RunDebugCreateOrConnectWithoutRunInput
    connect?: RunDebugWhereUniqueInput
  }

  export type BetUncheckedCreateNestedManyWithoutRunInput = {
    create?: XOR<BetCreateWithoutRunInput, BetUncheckedCreateWithoutRunInput> | BetCreateWithoutRunInput[] | BetUncheckedCreateWithoutRunInput[]
    connectOrCreate?: BetCreateOrConnectWithoutRunInput | BetCreateOrConnectWithoutRunInput[]
    createMany?: BetCreateManyRunInputEnvelope
    connect?: BetWhereUniqueInput | BetWhereUniqueInput[]
  }

  export type EnumSimulationRunStatusFieldUpdateOperationsInput = {
    set?: $Enums.SimulationRunStatus
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type AgentExperienceUpdateManyWithoutRunNestedInput = {
    create?: XOR<AgentExperienceCreateWithoutRunInput, AgentExperienceUncheckedCreateWithoutRunInput> | AgentExperienceCreateWithoutRunInput[] | AgentExperienceUncheckedCreateWithoutRunInput[]
    connectOrCreate?: AgentExperienceCreateOrConnectWithoutRunInput | AgentExperienceCreateOrConnectWithoutRunInput[]
    upsert?: AgentExperienceUpsertWithWhereUniqueWithoutRunInput | AgentExperienceUpsertWithWhereUniqueWithoutRunInput[]
    createMany?: AgentExperienceCreateManyRunInputEnvelope
    set?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
    disconnect?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
    delete?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
    connect?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
    update?: AgentExperienceUpdateWithWhereUniqueWithoutRunInput | AgentExperienceUpdateWithWhereUniqueWithoutRunInput[]
    updateMany?: AgentExperienceUpdateManyWithWhereWithoutRunInput | AgentExperienceUpdateManyWithWhereWithoutRunInput[]
    deleteMany?: AgentExperienceScalarWhereInput | AgentExperienceScalarWhereInput[]
  }

  export type CrowdSnapshotUpdateManyWithoutRunNestedInput = {
    create?: XOR<CrowdSnapshotCreateWithoutRunInput, CrowdSnapshotUncheckedCreateWithoutRunInput> | CrowdSnapshotCreateWithoutRunInput[] | CrowdSnapshotUncheckedCreateWithoutRunInput[]
    connectOrCreate?: CrowdSnapshotCreateOrConnectWithoutRunInput | CrowdSnapshotCreateOrConnectWithoutRunInput[]
    upsert?: CrowdSnapshotUpsertWithWhereUniqueWithoutRunInput | CrowdSnapshotUpsertWithWhereUniqueWithoutRunInput[]
    createMany?: CrowdSnapshotCreateManyRunInputEnvelope
    set?: CrowdSnapshotWhereUniqueInput | CrowdSnapshotWhereUniqueInput[]
    disconnect?: CrowdSnapshotWhereUniqueInput | CrowdSnapshotWhereUniqueInput[]
    delete?: CrowdSnapshotWhereUniqueInput | CrowdSnapshotWhereUniqueInput[]
    connect?: CrowdSnapshotWhereUniqueInput | CrowdSnapshotWhereUniqueInput[]
    update?: CrowdSnapshotUpdateWithWhereUniqueWithoutRunInput | CrowdSnapshotUpdateWithWhereUniqueWithoutRunInput[]
    updateMany?: CrowdSnapshotUpdateManyWithWhereWithoutRunInput | CrowdSnapshotUpdateManyWithWhereWithoutRunInput[]
    deleteMany?: CrowdSnapshotScalarWhereInput | CrowdSnapshotScalarWhereInput[]
  }

  export type RunDebugUpdateOneWithoutRunNestedInput = {
    create?: XOR<RunDebugCreateWithoutRunInput, RunDebugUncheckedCreateWithoutRunInput>
    connectOrCreate?: RunDebugCreateOrConnectWithoutRunInput
    upsert?: RunDebugUpsertWithoutRunInput
    disconnect?: RunDebugWhereInput | boolean
    delete?: RunDebugWhereInput | boolean
    connect?: RunDebugWhereUniqueInput
    update?: XOR<XOR<RunDebugUpdateToOneWithWhereWithoutRunInput, RunDebugUpdateWithoutRunInput>, RunDebugUncheckedUpdateWithoutRunInput>
  }

  export type BetUpdateManyWithoutRunNestedInput = {
    create?: XOR<BetCreateWithoutRunInput, BetUncheckedCreateWithoutRunInput> | BetCreateWithoutRunInput[] | BetUncheckedCreateWithoutRunInput[]
    connectOrCreate?: BetCreateOrConnectWithoutRunInput | BetCreateOrConnectWithoutRunInput[]
    upsert?: BetUpsertWithWhereUniqueWithoutRunInput | BetUpsertWithWhereUniqueWithoutRunInput[]
    createMany?: BetCreateManyRunInputEnvelope
    set?: BetWhereUniqueInput | BetWhereUniqueInput[]
    disconnect?: BetWhereUniqueInput | BetWhereUniqueInput[]
    delete?: BetWhereUniqueInput | BetWhereUniqueInput[]
    connect?: BetWhereUniqueInput | BetWhereUniqueInput[]
    update?: BetUpdateWithWhereUniqueWithoutRunInput | BetUpdateWithWhereUniqueWithoutRunInput[]
    updateMany?: BetUpdateManyWithWhereWithoutRunInput | BetUpdateManyWithWhereWithoutRunInput[]
    deleteMany?: BetScalarWhereInput | BetScalarWhereInput[]
  }

  export type AgentExperienceUncheckedUpdateManyWithoutRunNestedInput = {
    create?: XOR<AgentExperienceCreateWithoutRunInput, AgentExperienceUncheckedCreateWithoutRunInput> | AgentExperienceCreateWithoutRunInput[] | AgentExperienceUncheckedCreateWithoutRunInput[]
    connectOrCreate?: AgentExperienceCreateOrConnectWithoutRunInput | AgentExperienceCreateOrConnectWithoutRunInput[]
    upsert?: AgentExperienceUpsertWithWhereUniqueWithoutRunInput | AgentExperienceUpsertWithWhereUniqueWithoutRunInput[]
    createMany?: AgentExperienceCreateManyRunInputEnvelope
    set?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
    disconnect?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
    delete?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
    connect?: AgentExperienceWhereUniqueInput | AgentExperienceWhereUniqueInput[]
    update?: AgentExperienceUpdateWithWhereUniqueWithoutRunInput | AgentExperienceUpdateWithWhereUniqueWithoutRunInput[]
    updateMany?: AgentExperienceUpdateManyWithWhereWithoutRunInput | AgentExperienceUpdateManyWithWhereWithoutRunInput[]
    deleteMany?: AgentExperienceScalarWhereInput | AgentExperienceScalarWhereInput[]
  }

  export type CrowdSnapshotUncheckedUpdateManyWithoutRunNestedInput = {
    create?: XOR<CrowdSnapshotCreateWithoutRunInput, CrowdSnapshotUncheckedCreateWithoutRunInput> | CrowdSnapshotCreateWithoutRunInput[] | CrowdSnapshotUncheckedCreateWithoutRunInput[]
    connectOrCreate?: CrowdSnapshotCreateOrConnectWithoutRunInput | CrowdSnapshotCreateOrConnectWithoutRunInput[]
    upsert?: CrowdSnapshotUpsertWithWhereUniqueWithoutRunInput | CrowdSnapshotUpsertWithWhereUniqueWithoutRunInput[]
    createMany?: CrowdSnapshotCreateManyRunInputEnvelope
    set?: CrowdSnapshotWhereUniqueInput | CrowdSnapshotWhereUniqueInput[]
    disconnect?: CrowdSnapshotWhereUniqueInput | CrowdSnapshotWhereUniqueInput[]
    delete?: CrowdSnapshotWhereUniqueInput | CrowdSnapshotWhereUniqueInput[]
    connect?: CrowdSnapshotWhereUniqueInput | CrowdSnapshotWhereUniqueInput[]
    update?: CrowdSnapshotUpdateWithWhereUniqueWithoutRunInput | CrowdSnapshotUpdateWithWhereUniqueWithoutRunInput[]
    updateMany?: CrowdSnapshotUpdateManyWithWhereWithoutRunInput | CrowdSnapshotUpdateManyWithWhereWithoutRunInput[]
    deleteMany?: CrowdSnapshotScalarWhereInput | CrowdSnapshotScalarWhereInput[]
  }

  export type RunDebugUncheckedUpdateOneWithoutRunNestedInput = {
    create?: XOR<RunDebugCreateWithoutRunInput, RunDebugUncheckedCreateWithoutRunInput>
    connectOrCreate?: RunDebugCreateOrConnectWithoutRunInput
    upsert?: RunDebugUpsertWithoutRunInput
    disconnect?: RunDebugWhereInput | boolean
    delete?: RunDebugWhereInput | boolean
    connect?: RunDebugWhereUniqueInput
    update?: XOR<XOR<RunDebugUpdateToOneWithWhereWithoutRunInput, RunDebugUpdateWithoutRunInput>, RunDebugUncheckedUpdateWithoutRunInput>
  }

  export type BetUncheckedUpdateManyWithoutRunNestedInput = {
    create?: XOR<BetCreateWithoutRunInput, BetUncheckedCreateWithoutRunInput> | BetCreateWithoutRunInput[] | BetUncheckedCreateWithoutRunInput[]
    connectOrCreate?: BetCreateOrConnectWithoutRunInput | BetCreateOrConnectWithoutRunInput[]
    upsert?: BetUpsertWithWhereUniqueWithoutRunInput | BetUpsertWithWhereUniqueWithoutRunInput[]
    createMany?: BetCreateManyRunInputEnvelope
    set?: BetWhereUniqueInput | BetWhereUniqueInput[]
    disconnect?: BetWhereUniqueInput | BetWhereUniqueInput[]
    delete?: BetWhereUniqueInput | BetWhereUniqueInput[]
    connect?: BetWhereUniqueInput | BetWhereUniqueInput[]
    update?: BetUpdateWithWhereUniqueWithoutRunInput | BetUpdateWithWhereUniqueWithoutRunInput[]
    updateMany?: BetUpdateManyWithWhereWithoutRunInput | BetUpdateManyWithWhereWithoutRunInput[]
    deleteMany?: BetScalarWhereInput | BetScalarWhereInput[]
  }

  export type SimulationRunCreateNestedOneWithoutRunDebugInput = {
    create?: XOR<SimulationRunCreateWithoutRunDebugInput, SimulationRunUncheckedCreateWithoutRunDebugInput>
    connectOrCreate?: SimulationRunCreateOrConnectWithoutRunDebugInput
    connect?: SimulationRunWhereUniqueInput
  }

  export type SimulationRunUpdateOneRequiredWithoutRunDebugNestedInput = {
    create?: XOR<SimulationRunCreateWithoutRunDebugInput, SimulationRunUncheckedCreateWithoutRunDebugInput>
    connectOrCreate?: SimulationRunCreateOrConnectWithoutRunDebugInput
    upsert?: SimulationRunUpsertWithoutRunDebugInput
    connect?: SimulationRunWhereUniqueInput
    update?: XOR<XOR<SimulationRunUpdateToOneWithWhereWithoutRunDebugInput, SimulationRunUpdateWithoutRunDebugInput>, SimulationRunUncheckedUpdateWithoutRunDebugInput>
  }

  export type SimulationRunCreateNestedOneWithoutAgentExperiencesInput = {
    create?: XOR<SimulationRunCreateWithoutAgentExperiencesInput, SimulationRunUncheckedCreateWithoutAgentExperiencesInput>
    connectOrCreate?: SimulationRunCreateOrConnectWithoutAgentExperiencesInput
    connect?: SimulationRunWhereUniqueInput
  }

  export type AgentCreateNestedOneWithoutExperiencesInput = {
    create?: XOR<AgentCreateWithoutExperiencesInput, AgentUncheckedCreateWithoutExperiencesInput>
    connectOrCreate?: AgentCreateOrConnectWithoutExperiencesInput
    connect?: AgentWhereUniqueInput
  }

  export type SimulationRunUpdateOneRequiredWithoutAgentExperiencesNestedInput = {
    create?: XOR<SimulationRunCreateWithoutAgentExperiencesInput, SimulationRunUncheckedCreateWithoutAgentExperiencesInput>
    connectOrCreate?: SimulationRunCreateOrConnectWithoutAgentExperiencesInput
    upsert?: SimulationRunUpsertWithoutAgentExperiencesInput
    connect?: SimulationRunWhereUniqueInput
    update?: XOR<XOR<SimulationRunUpdateToOneWithWhereWithoutAgentExperiencesInput, SimulationRunUpdateWithoutAgentExperiencesInput>, SimulationRunUncheckedUpdateWithoutAgentExperiencesInput>
  }

  export type AgentUpdateOneRequiredWithoutExperiencesNestedInput = {
    create?: XOR<AgentCreateWithoutExperiencesInput, AgentUncheckedCreateWithoutExperiencesInput>
    connectOrCreate?: AgentCreateOrConnectWithoutExperiencesInput
    upsert?: AgentUpsertWithoutExperiencesInput
    connect?: AgentWhereUniqueInput
    update?: XOR<XOR<AgentUpdateToOneWithWhereWithoutExperiencesInput, AgentUpdateWithoutExperiencesInput>, AgentUncheckedUpdateWithoutExperiencesInput>
  }

  export type SimulationRunCreateNestedOneWithoutCrowdSnapshotsInput = {
    create?: XOR<SimulationRunCreateWithoutCrowdSnapshotsInput, SimulationRunUncheckedCreateWithoutCrowdSnapshotsInput>
    connectOrCreate?: SimulationRunCreateOrConnectWithoutCrowdSnapshotsInput
    connect?: SimulationRunWhereUniqueInput
  }

  export type SimulationRunUpdateOneRequiredWithoutCrowdSnapshotsNestedInput = {
    create?: XOR<SimulationRunCreateWithoutCrowdSnapshotsInput, SimulationRunUncheckedCreateWithoutCrowdSnapshotsInput>
    connectOrCreate?: SimulationRunCreateOrConnectWithoutCrowdSnapshotsInput
    upsert?: SimulationRunUpsertWithoutCrowdSnapshotsInput
    connect?: SimulationRunWhereUniqueInput
    update?: XOR<XOR<SimulationRunUpdateToOneWithWhereWithoutCrowdSnapshotsInput, SimulationRunUpdateWithoutCrowdSnapshotsInput>, SimulationRunUncheckedUpdateWithoutCrowdSnapshotsInput>
  }

  export type SimulationRunCreateNestedOneWithoutBetsInput = {
    create?: XOR<SimulationRunCreateWithoutBetsInput, SimulationRunUncheckedCreateWithoutBetsInput>
    connectOrCreate?: SimulationRunCreateOrConnectWithoutBetsInput
    connect?: SimulationRunWhereUniqueInput
  }

  export type EnumBetDirectionFieldUpdateOperationsInput = {
    set?: $Enums.BetDirection
  }

  export type NullableBoolFieldUpdateOperationsInput = {
    set?: boolean | null
  }

  export type SimulationRunUpdateOneRequiredWithoutBetsNestedInput = {
    create?: XOR<SimulationRunCreateWithoutBetsInput, SimulationRunUncheckedCreateWithoutBetsInput>
    connectOrCreate?: SimulationRunCreateOrConnectWithoutBetsInput
    upsert?: SimulationRunUpsertWithoutBetsInput
    connect?: SimulationRunWhereUniqueInput
    update?: XOR<XOR<SimulationRunUpdateToOneWithWhereWithoutBetsInput, SimulationRunUpdateWithoutBetsInput>, SimulationRunUncheckedUpdateWithoutBetsInput>
  }

  export type NestedUuidFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedUuidFilter<$PrismaModel> | string
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedUuidWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedUuidWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedFloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> = 
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type NestedEnumSimulationRunStatusFilter<$PrismaModel = never> = {
    equals?: $Enums.SimulationRunStatus | EnumSimulationRunStatusFieldRefInput<$PrismaModel>
    in?: $Enums.SimulationRunStatus[] | ListEnumSimulationRunStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.SimulationRunStatus[] | ListEnumSimulationRunStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumSimulationRunStatusFilter<$PrismaModel> | $Enums.SimulationRunStatus
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedEnumSimulationRunStatusWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.SimulationRunStatus | EnumSimulationRunStatusFieldRefInput<$PrismaModel>
    in?: $Enums.SimulationRunStatus[] | ListEnumSimulationRunStatusFieldRefInput<$PrismaModel>
    notIn?: $Enums.SimulationRunStatus[] | ListEnumSimulationRunStatusFieldRefInput<$PrismaModel>
    not?: NestedEnumSimulationRunStatusWithAggregatesFilter<$PrismaModel> | $Enums.SimulationRunStatus
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumSimulationRunStatusFilter<$PrismaModel>
    _max?: NestedEnumSimulationRunStatusFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type NestedEnumBetDirectionFilter<$PrismaModel = never> = {
    equals?: $Enums.BetDirection | EnumBetDirectionFieldRefInput<$PrismaModel>
    in?: $Enums.BetDirection[] | ListEnumBetDirectionFieldRefInput<$PrismaModel>
    notIn?: $Enums.BetDirection[] | ListEnumBetDirectionFieldRefInput<$PrismaModel>
    not?: NestedEnumBetDirectionFilter<$PrismaModel> | $Enums.BetDirection
  }

  export type NestedBoolNullableFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableFilter<$PrismaModel> | boolean | null
  }

  export type NestedEnumBetDirectionWithAggregatesFilter<$PrismaModel = never> = {
    equals?: $Enums.BetDirection | EnumBetDirectionFieldRefInput<$PrismaModel>
    in?: $Enums.BetDirection[] | ListEnumBetDirectionFieldRefInput<$PrismaModel>
    notIn?: $Enums.BetDirection[] | ListEnumBetDirectionFieldRefInput<$PrismaModel>
    not?: NestedEnumBetDirectionWithAggregatesFilter<$PrismaModel> | $Enums.BetDirection
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedEnumBetDirectionFilter<$PrismaModel>
    _max?: NestedEnumBetDirectionFilter<$PrismaModel>
  }

  export type NestedBoolNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: boolean | BooleanFieldRefInput<$PrismaModel> | null
    not?: NestedBoolNullableWithAggregatesFilter<$PrismaModel> | boolean | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedBoolNullableFilter<$PrismaModel>
    _max?: NestedBoolNullableFilter<$PrismaModel>
  }

  export type ArchetypeTraitProfileCreateWithoutArchetypeInput = {
    baselineValue: number
    traitDefinition: TraitDefinitionCreateNestedOneWithoutArchetypeProfilesInput
  }

  export type ArchetypeTraitProfileUncheckedCreateWithoutArchetypeInput = {
    traitDefinitionId: string
    baselineValue: number
  }

  export type ArchetypeTraitProfileCreateOrConnectWithoutArchetypeInput = {
    where: ArchetypeTraitProfileWhereUniqueInput
    create: XOR<ArchetypeTraitProfileCreateWithoutArchetypeInput, ArchetypeTraitProfileUncheckedCreateWithoutArchetypeInput>
  }

  export type ArchetypeTraitProfileCreateManyArchetypeInputEnvelope = {
    data: ArchetypeTraitProfileCreateManyArchetypeInput | ArchetypeTraitProfileCreateManyArchetypeInput[]
    skipDuplicates?: boolean
  }

  export type AgentCreateWithoutArchetypeInput = {
    id?: string
    displayName: string
    stateJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    experiences?: AgentExperienceCreateNestedManyWithoutAgentInput
  }

  export type AgentUncheckedCreateWithoutArchetypeInput = {
    id?: string
    displayName: string
    stateJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    experiences?: AgentExperienceUncheckedCreateNestedManyWithoutAgentInput
  }

  export type AgentCreateOrConnectWithoutArchetypeInput = {
    where: AgentWhereUniqueInput
    create: XOR<AgentCreateWithoutArchetypeInput, AgentUncheckedCreateWithoutArchetypeInput>
  }

  export type AgentCreateManyArchetypeInputEnvelope = {
    data: AgentCreateManyArchetypeInput | AgentCreateManyArchetypeInput[]
    skipDuplicates?: boolean
  }

  export type ArchetypeTraitProfileUpsertWithWhereUniqueWithoutArchetypeInput = {
    where: ArchetypeTraitProfileWhereUniqueInput
    update: XOR<ArchetypeTraitProfileUpdateWithoutArchetypeInput, ArchetypeTraitProfileUncheckedUpdateWithoutArchetypeInput>
    create: XOR<ArchetypeTraitProfileCreateWithoutArchetypeInput, ArchetypeTraitProfileUncheckedCreateWithoutArchetypeInput>
  }

  export type ArchetypeTraitProfileUpdateWithWhereUniqueWithoutArchetypeInput = {
    where: ArchetypeTraitProfileWhereUniqueInput
    data: XOR<ArchetypeTraitProfileUpdateWithoutArchetypeInput, ArchetypeTraitProfileUncheckedUpdateWithoutArchetypeInput>
  }

  export type ArchetypeTraitProfileUpdateManyWithWhereWithoutArchetypeInput = {
    where: ArchetypeTraitProfileScalarWhereInput
    data: XOR<ArchetypeTraitProfileUpdateManyMutationInput, ArchetypeTraitProfileUncheckedUpdateManyWithoutArchetypeInput>
  }

  export type ArchetypeTraitProfileScalarWhereInput = {
    AND?: ArchetypeTraitProfileScalarWhereInput | ArchetypeTraitProfileScalarWhereInput[]
    OR?: ArchetypeTraitProfileScalarWhereInput[]
    NOT?: ArchetypeTraitProfileScalarWhereInput | ArchetypeTraitProfileScalarWhereInput[]
    archetypeId?: UuidFilter<"ArchetypeTraitProfile"> | string
    traitDefinitionId?: UuidFilter<"ArchetypeTraitProfile"> | string
    baselineValue?: FloatFilter<"ArchetypeTraitProfile"> | number
  }

  export type AgentUpsertWithWhereUniqueWithoutArchetypeInput = {
    where: AgentWhereUniqueInput
    update: XOR<AgentUpdateWithoutArchetypeInput, AgentUncheckedUpdateWithoutArchetypeInput>
    create: XOR<AgentCreateWithoutArchetypeInput, AgentUncheckedCreateWithoutArchetypeInput>
  }

  export type AgentUpdateWithWhereUniqueWithoutArchetypeInput = {
    where: AgentWhereUniqueInput
    data: XOR<AgentUpdateWithoutArchetypeInput, AgentUncheckedUpdateWithoutArchetypeInput>
  }

  export type AgentUpdateManyWithWhereWithoutArchetypeInput = {
    where: AgentScalarWhereInput
    data: XOR<AgentUpdateManyMutationInput, AgentUncheckedUpdateManyWithoutArchetypeInput>
  }

  export type AgentScalarWhereInput = {
    AND?: AgentScalarWhereInput | AgentScalarWhereInput[]
    OR?: AgentScalarWhereInput[]
    NOT?: AgentScalarWhereInput | AgentScalarWhereInput[]
    id?: UuidFilter<"Agent"> | string
    displayName?: StringFilter<"Agent"> | string
    archetypeId?: UuidFilter<"Agent"> | string
    stateJson?: JsonNullableFilter<"Agent">
    createdAt?: DateTimeFilter<"Agent"> | Date | string
    updatedAt?: DateTimeFilter<"Agent"> | Date | string
  }

  export type ArchetypeTraitProfileCreateWithoutTraitDefinitionInput = {
    baselineValue: number
    archetype: ArchetypeCreateNestedOneWithoutTraitProfilesInput
  }

  export type ArchetypeTraitProfileUncheckedCreateWithoutTraitDefinitionInput = {
    archetypeId: string
    baselineValue: number
  }

  export type ArchetypeTraitProfileCreateOrConnectWithoutTraitDefinitionInput = {
    where: ArchetypeTraitProfileWhereUniqueInput
    create: XOR<ArchetypeTraitProfileCreateWithoutTraitDefinitionInput, ArchetypeTraitProfileUncheckedCreateWithoutTraitDefinitionInput>
  }

  export type ArchetypeTraitProfileCreateManyTraitDefinitionInputEnvelope = {
    data: ArchetypeTraitProfileCreateManyTraitDefinitionInput | ArchetypeTraitProfileCreateManyTraitDefinitionInput[]
    skipDuplicates?: boolean
  }

  export type ArchetypeTraitProfileUpsertWithWhereUniqueWithoutTraitDefinitionInput = {
    where: ArchetypeTraitProfileWhereUniqueInput
    update: XOR<ArchetypeTraitProfileUpdateWithoutTraitDefinitionInput, ArchetypeTraitProfileUncheckedUpdateWithoutTraitDefinitionInput>
    create: XOR<ArchetypeTraitProfileCreateWithoutTraitDefinitionInput, ArchetypeTraitProfileUncheckedCreateWithoutTraitDefinitionInput>
  }

  export type ArchetypeTraitProfileUpdateWithWhereUniqueWithoutTraitDefinitionInput = {
    where: ArchetypeTraitProfileWhereUniqueInput
    data: XOR<ArchetypeTraitProfileUpdateWithoutTraitDefinitionInput, ArchetypeTraitProfileUncheckedUpdateWithoutTraitDefinitionInput>
  }

  export type ArchetypeTraitProfileUpdateManyWithWhereWithoutTraitDefinitionInput = {
    where: ArchetypeTraitProfileScalarWhereInput
    data: XOR<ArchetypeTraitProfileUpdateManyMutationInput, ArchetypeTraitProfileUncheckedUpdateManyWithoutTraitDefinitionInput>
  }

  export type ArchetypeCreateWithoutTraitProfilesInput = {
    id?: string
    name: string
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    agents?: AgentCreateNestedManyWithoutArchetypeInput
  }

  export type ArchetypeUncheckedCreateWithoutTraitProfilesInput = {
    id?: string
    name: string
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    agents?: AgentUncheckedCreateNestedManyWithoutArchetypeInput
  }

  export type ArchetypeCreateOrConnectWithoutTraitProfilesInput = {
    where: ArchetypeWhereUniqueInput
    create: XOR<ArchetypeCreateWithoutTraitProfilesInput, ArchetypeUncheckedCreateWithoutTraitProfilesInput>
  }

  export type TraitDefinitionCreateWithoutArchetypeProfilesInput = {
    id?: string
    key: string
    displayName: string
    description?: string | null
    valueRangeText?: string | null
    minValue?: number | null
    maxValue?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TraitDefinitionUncheckedCreateWithoutArchetypeProfilesInput = {
    id?: string
    key: string
    displayName: string
    description?: string | null
    valueRangeText?: string | null
    minValue?: number | null
    maxValue?: number | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type TraitDefinitionCreateOrConnectWithoutArchetypeProfilesInput = {
    where: TraitDefinitionWhereUniqueInput
    create: XOR<TraitDefinitionCreateWithoutArchetypeProfilesInput, TraitDefinitionUncheckedCreateWithoutArchetypeProfilesInput>
  }

  export type ArchetypeUpsertWithoutTraitProfilesInput = {
    update: XOR<ArchetypeUpdateWithoutTraitProfilesInput, ArchetypeUncheckedUpdateWithoutTraitProfilesInput>
    create: XOR<ArchetypeCreateWithoutTraitProfilesInput, ArchetypeUncheckedCreateWithoutTraitProfilesInput>
    where?: ArchetypeWhereInput
  }

  export type ArchetypeUpdateToOneWithWhereWithoutTraitProfilesInput = {
    where?: ArchetypeWhereInput
    data: XOR<ArchetypeUpdateWithoutTraitProfilesInput, ArchetypeUncheckedUpdateWithoutTraitProfilesInput>
  }

  export type ArchetypeUpdateWithoutTraitProfilesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    agents?: AgentUpdateManyWithoutArchetypeNestedInput
  }

  export type ArchetypeUncheckedUpdateWithoutTraitProfilesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    agents?: AgentUncheckedUpdateManyWithoutArchetypeNestedInput
  }

  export type TraitDefinitionUpsertWithoutArchetypeProfilesInput = {
    update: XOR<TraitDefinitionUpdateWithoutArchetypeProfilesInput, TraitDefinitionUncheckedUpdateWithoutArchetypeProfilesInput>
    create: XOR<TraitDefinitionCreateWithoutArchetypeProfilesInput, TraitDefinitionUncheckedCreateWithoutArchetypeProfilesInput>
    where?: TraitDefinitionWhereInput
  }

  export type TraitDefinitionUpdateToOneWithWhereWithoutArchetypeProfilesInput = {
    where?: TraitDefinitionWhereInput
    data: XOR<TraitDefinitionUpdateWithoutArchetypeProfilesInput, TraitDefinitionUncheckedUpdateWithoutArchetypeProfilesInput>
  }

  export type TraitDefinitionUpdateWithoutArchetypeProfilesInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    valueRangeText?: NullableStringFieldUpdateOperationsInput | string | null
    minValue?: NullableFloatFieldUpdateOperationsInput | number | null
    maxValue?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TraitDefinitionUncheckedUpdateWithoutArchetypeProfilesInput = {
    id?: StringFieldUpdateOperationsInput | string
    key?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    valueRangeText?: NullableStringFieldUpdateOperationsInput | string | null
    minValue?: NullableFloatFieldUpdateOperationsInput | number | null
    maxValue?: NullableFloatFieldUpdateOperationsInput | number | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ArchetypeCreateWithoutAgentsInput = {
    id?: string
    name: string
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    traitProfiles?: ArchetypeTraitProfileCreateNestedManyWithoutArchetypeInput
  }

  export type ArchetypeUncheckedCreateWithoutAgentsInput = {
    id?: string
    name: string
    description?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    traitProfiles?: ArchetypeTraitProfileUncheckedCreateNestedManyWithoutArchetypeInput
  }

  export type ArchetypeCreateOrConnectWithoutAgentsInput = {
    where: ArchetypeWhereUniqueInput
    create: XOR<ArchetypeCreateWithoutAgentsInput, ArchetypeUncheckedCreateWithoutAgentsInput>
  }

  export type AgentExperienceCreateWithoutAgentInput = {
    id?: string
    step: number
    ts: Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: number | null
    drawdown?: number | null
    reward?: number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
    run: SimulationRunCreateNestedOneWithoutAgentExperiencesInput
  }

  export type AgentExperienceUncheckedCreateWithoutAgentInput = {
    id?: string
    runId: string
    step: number
    ts: Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: number | null
    drawdown?: number | null
    reward?: number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
  }

  export type AgentExperienceCreateOrConnectWithoutAgentInput = {
    where: AgentExperienceWhereUniqueInput
    create: XOR<AgentExperienceCreateWithoutAgentInput, AgentExperienceUncheckedCreateWithoutAgentInput>
  }

  export type AgentExperienceCreateManyAgentInputEnvelope = {
    data: AgentExperienceCreateManyAgentInput | AgentExperienceCreateManyAgentInput[]
    skipDuplicates?: boolean
  }

  export type ArchetypeUpsertWithoutAgentsInput = {
    update: XOR<ArchetypeUpdateWithoutAgentsInput, ArchetypeUncheckedUpdateWithoutAgentsInput>
    create: XOR<ArchetypeCreateWithoutAgentsInput, ArchetypeUncheckedCreateWithoutAgentsInput>
    where?: ArchetypeWhereInput
  }

  export type ArchetypeUpdateToOneWithWhereWithoutAgentsInput = {
    where?: ArchetypeWhereInput
    data: XOR<ArchetypeUpdateWithoutAgentsInput, ArchetypeUncheckedUpdateWithoutAgentsInput>
  }

  export type ArchetypeUpdateWithoutAgentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    traitProfiles?: ArchetypeTraitProfileUpdateManyWithoutArchetypeNestedInput
  }

  export type ArchetypeUncheckedUpdateWithoutAgentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    description?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    traitProfiles?: ArchetypeTraitProfileUncheckedUpdateManyWithoutArchetypeNestedInput
  }

  export type AgentExperienceUpsertWithWhereUniqueWithoutAgentInput = {
    where: AgentExperienceWhereUniqueInput
    update: XOR<AgentExperienceUpdateWithoutAgentInput, AgentExperienceUncheckedUpdateWithoutAgentInput>
    create: XOR<AgentExperienceCreateWithoutAgentInput, AgentExperienceUncheckedCreateWithoutAgentInput>
  }

  export type AgentExperienceUpdateWithWhereUniqueWithoutAgentInput = {
    where: AgentExperienceWhereUniqueInput
    data: XOR<AgentExperienceUpdateWithoutAgentInput, AgentExperienceUncheckedUpdateWithoutAgentInput>
  }

  export type AgentExperienceUpdateManyWithWhereWithoutAgentInput = {
    where: AgentExperienceScalarWhereInput
    data: XOR<AgentExperienceUpdateManyMutationInput, AgentExperienceUncheckedUpdateManyWithoutAgentInput>
  }

  export type AgentExperienceScalarWhereInput = {
    AND?: AgentExperienceScalarWhereInput | AgentExperienceScalarWhereInput[]
    OR?: AgentExperienceScalarWhereInput[]
    NOT?: AgentExperienceScalarWhereInput | AgentExperienceScalarWhereInput[]
    id?: UuidFilter<"AgentExperience"> | string
    runId?: UuidFilter<"AgentExperience"> | string
    agentId?: UuidFilter<"AgentExperience"> | string
    step?: IntFilter<"AgentExperience"> | number
    ts?: DateTimeFilter<"AgentExperience"> | Date | string
    actionJson?: JsonNullableFilter<"AgentExperience">
    signalsJson?: JsonNullableFilter<"AgentExperience">
    pnl?: FloatNullableFilter<"AgentExperience"> | number | null
    drawdown?: FloatNullableFilter<"AgentExperience"> | number | null
    reward?: FloatNullableFilter<"AgentExperience"> | number | null
    learningMetaJson?: JsonNullableFilter<"AgentExperience">
    stateBeforeJson?: JsonNullableFilter<"AgentExperience">
    stateAfterJson?: JsonNullableFilter<"AgentExperience">
  }

  export type AgentExperienceCreateWithoutRunInput = {
    id?: string
    step: number
    ts: Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: number | null
    drawdown?: number | null
    reward?: number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
    agent: AgentCreateNestedOneWithoutExperiencesInput
  }

  export type AgentExperienceUncheckedCreateWithoutRunInput = {
    id?: string
    agentId: string
    step: number
    ts: Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: number | null
    drawdown?: number | null
    reward?: number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
  }

  export type AgentExperienceCreateOrConnectWithoutRunInput = {
    where: AgentExperienceWhereUniqueInput
    create: XOR<AgentExperienceCreateWithoutRunInput, AgentExperienceUncheckedCreateWithoutRunInput>
  }

  export type AgentExperienceCreateManyRunInputEnvelope = {
    data: AgentExperienceCreateManyRunInput | AgentExperienceCreateManyRunInput[]
    skipDuplicates?: boolean
  }

  export type CrowdSnapshotCreateWithoutRunInput = {
    id?: string
    step: number
    ts: Date | string
    aggregationJson?: NullableJsonNullValueInput | InputJsonValue
    confidence?: number | null
  }

  export type CrowdSnapshotUncheckedCreateWithoutRunInput = {
    id?: string
    step: number
    ts: Date | string
    aggregationJson?: NullableJsonNullValueInput | InputJsonValue
    confidence?: number | null
  }

  export type CrowdSnapshotCreateOrConnectWithoutRunInput = {
    where: CrowdSnapshotWhereUniqueInput
    create: XOR<CrowdSnapshotCreateWithoutRunInput, CrowdSnapshotUncheckedCreateWithoutRunInput>
  }

  export type CrowdSnapshotCreateManyRunInputEnvelope = {
    data: CrowdSnapshotCreateManyRunInput | CrowdSnapshotCreateManyRunInput[]
    skipDuplicates?: boolean
  }

  export type RunDebugCreateWithoutRunInput = {
    prePersistHistogram?: NullableJsonNullValueInput | InputJsonValue
    samplePrePersistActions?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type RunDebugUncheckedCreateWithoutRunInput = {
    prePersistHistogram?: NullableJsonNullValueInput | InputJsonValue
    samplePrePersistActions?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
  }

  export type RunDebugCreateOrConnectWithoutRunInput = {
    where: RunDebugWhereUniqueInput
    create: XOR<RunDebugCreateWithoutRunInput, RunDebugUncheckedCreateWithoutRunInput>
  }

  export type BetCreateWithoutRunInput = {
    id?: string
    userId: string
    direction: $Enums.BetDirection
    confidence: number
    stake: number
    thesis?: string | null
    status?: string
    evalVersion?: string | null
    isCorrect?: boolean | null
    pnl?: number | null
    settledAt?: Date | string | null
    createdAt?: Date | string
  }

  export type BetUncheckedCreateWithoutRunInput = {
    id?: string
    userId: string
    direction: $Enums.BetDirection
    confidence: number
    stake: number
    thesis?: string | null
    status?: string
    evalVersion?: string | null
    isCorrect?: boolean | null
    pnl?: number | null
    settledAt?: Date | string | null
    createdAt?: Date | string
  }

  export type BetCreateOrConnectWithoutRunInput = {
    where: BetWhereUniqueInput
    create: XOR<BetCreateWithoutRunInput, BetUncheckedCreateWithoutRunInput>
  }

  export type BetCreateManyRunInputEnvelope = {
    data: BetCreateManyRunInput | BetCreateManyRunInput[]
    skipDuplicates?: boolean
  }

  export type AgentExperienceUpsertWithWhereUniqueWithoutRunInput = {
    where: AgentExperienceWhereUniqueInput
    update: XOR<AgentExperienceUpdateWithoutRunInput, AgentExperienceUncheckedUpdateWithoutRunInput>
    create: XOR<AgentExperienceCreateWithoutRunInput, AgentExperienceUncheckedCreateWithoutRunInput>
  }

  export type AgentExperienceUpdateWithWhereUniqueWithoutRunInput = {
    where: AgentExperienceWhereUniqueInput
    data: XOR<AgentExperienceUpdateWithoutRunInput, AgentExperienceUncheckedUpdateWithoutRunInput>
  }

  export type AgentExperienceUpdateManyWithWhereWithoutRunInput = {
    where: AgentExperienceScalarWhereInput
    data: XOR<AgentExperienceUpdateManyMutationInput, AgentExperienceUncheckedUpdateManyWithoutRunInput>
  }

  export type CrowdSnapshotUpsertWithWhereUniqueWithoutRunInput = {
    where: CrowdSnapshotWhereUniqueInput
    update: XOR<CrowdSnapshotUpdateWithoutRunInput, CrowdSnapshotUncheckedUpdateWithoutRunInput>
    create: XOR<CrowdSnapshotCreateWithoutRunInput, CrowdSnapshotUncheckedCreateWithoutRunInput>
  }

  export type CrowdSnapshotUpdateWithWhereUniqueWithoutRunInput = {
    where: CrowdSnapshotWhereUniqueInput
    data: XOR<CrowdSnapshotUpdateWithoutRunInput, CrowdSnapshotUncheckedUpdateWithoutRunInput>
  }

  export type CrowdSnapshotUpdateManyWithWhereWithoutRunInput = {
    where: CrowdSnapshotScalarWhereInput
    data: XOR<CrowdSnapshotUpdateManyMutationInput, CrowdSnapshotUncheckedUpdateManyWithoutRunInput>
  }

  export type CrowdSnapshotScalarWhereInput = {
    AND?: CrowdSnapshotScalarWhereInput | CrowdSnapshotScalarWhereInput[]
    OR?: CrowdSnapshotScalarWhereInput[]
    NOT?: CrowdSnapshotScalarWhereInput | CrowdSnapshotScalarWhereInput[]
    id?: UuidFilter<"CrowdSnapshot"> | string
    runId?: UuidFilter<"CrowdSnapshot"> | string
    step?: IntFilter<"CrowdSnapshot"> | number
    ts?: DateTimeFilter<"CrowdSnapshot"> | Date | string
    aggregationJson?: JsonNullableFilter<"CrowdSnapshot">
    confidence?: FloatNullableFilter<"CrowdSnapshot"> | number | null
  }

  export type RunDebugUpsertWithoutRunInput = {
    update: XOR<RunDebugUpdateWithoutRunInput, RunDebugUncheckedUpdateWithoutRunInput>
    create: XOR<RunDebugCreateWithoutRunInput, RunDebugUncheckedCreateWithoutRunInput>
    where?: RunDebugWhereInput
  }

  export type RunDebugUpdateToOneWithWhereWithoutRunInput = {
    where?: RunDebugWhereInput
    data: XOR<RunDebugUpdateWithoutRunInput, RunDebugUncheckedUpdateWithoutRunInput>
  }

  export type RunDebugUpdateWithoutRunInput = {
    prePersistHistogram?: NullableJsonNullValueInput | InputJsonValue
    samplePrePersistActions?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type RunDebugUncheckedUpdateWithoutRunInput = {
    prePersistHistogram?: NullableJsonNullValueInput | InputJsonValue
    samplePrePersistActions?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BetUpsertWithWhereUniqueWithoutRunInput = {
    where: BetWhereUniqueInput
    update: XOR<BetUpdateWithoutRunInput, BetUncheckedUpdateWithoutRunInput>
    create: XOR<BetCreateWithoutRunInput, BetUncheckedCreateWithoutRunInput>
  }

  export type BetUpdateWithWhereUniqueWithoutRunInput = {
    where: BetWhereUniqueInput
    data: XOR<BetUpdateWithoutRunInput, BetUncheckedUpdateWithoutRunInput>
  }

  export type BetUpdateManyWithWhereWithoutRunInput = {
    where: BetScalarWhereInput
    data: XOR<BetUpdateManyMutationInput, BetUncheckedUpdateManyWithoutRunInput>
  }

  export type BetScalarWhereInput = {
    AND?: BetScalarWhereInput | BetScalarWhereInput[]
    OR?: BetScalarWhereInput[]
    NOT?: BetScalarWhereInput | BetScalarWhereInput[]
    id?: UuidFilter<"Bet"> | string
    userId?: StringFilter<"Bet"> | string
    runId?: UuidFilter<"Bet"> | string
    direction?: EnumBetDirectionFilter<"Bet"> | $Enums.BetDirection
    confidence?: IntFilter<"Bet"> | number
    stake?: FloatFilter<"Bet"> | number
    thesis?: StringNullableFilter<"Bet"> | string | null
    status?: StringFilter<"Bet"> | string
    evalVersion?: StringNullableFilter<"Bet"> | string | null
    isCorrect?: BoolNullableFilter<"Bet"> | boolean | null
    pnl?: FloatNullableFilter<"Bet"> | number | null
    settledAt?: DateTimeNullableFilter<"Bet"> | Date | string | null
    createdAt?: DateTimeFilter<"Bet"> | Date | string
  }

  export type SimulationRunCreateWithoutRunDebugInput = {
    id?: string
    name: string
    status?: $Enums.SimulationRunStatus
    seed: number
    modelVersion: string
    datasetVersion: string
    codeGitSha?: string | null
    schemaVersion: string
    startedAt?: Date | string | null
    finishedAt?: Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    agentExperiences?: AgentExperienceCreateNestedManyWithoutRunInput
    crowdSnapshots?: CrowdSnapshotCreateNestedManyWithoutRunInput
    bets?: BetCreateNestedManyWithoutRunInput
  }

  export type SimulationRunUncheckedCreateWithoutRunDebugInput = {
    id?: string
    name: string
    status?: $Enums.SimulationRunStatus
    seed: number
    modelVersion: string
    datasetVersion: string
    codeGitSha?: string | null
    schemaVersion: string
    startedAt?: Date | string | null
    finishedAt?: Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    agentExperiences?: AgentExperienceUncheckedCreateNestedManyWithoutRunInput
    crowdSnapshots?: CrowdSnapshotUncheckedCreateNestedManyWithoutRunInput
    bets?: BetUncheckedCreateNestedManyWithoutRunInput
  }

  export type SimulationRunCreateOrConnectWithoutRunDebugInput = {
    where: SimulationRunWhereUniqueInput
    create: XOR<SimulationRunCreateWithoutRunDebugInput, SimulationRunUncheckedCreateWithoutRunDebugInput>
  }

  export type SimulationRunUpsertWithoutRunDebugInput = {
    update: XOR<SimulationRunUpdateWithoutRunDebugInput, SimulationRunUncheckedUpdateWithoutRunDebugInput>
    create: XOR<SimulationRunCreateWithoutRunDebugInput, SimulationRunUncheckedCreateWithoutRunDebugInput>
    where?: SimulationRunWhereInput
  }

  export type SimulationRunUpdateToOneWithWhereWithoutRunDebugInput = {
    where?: SimulationRunWhereInput
    data: XOR<SimulationRunUpdateWithoutRunDebugInput, SimulationRunUncheckedUpdateWithoutRunDebugInput>
  }

  export type SimulationRunUpdateWithoutRunDebugInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: EnumSimulationRunStatusFieldUpdateOperationsInput | $Enums.SimulationRunStatus
    seed?: IntFieldUpdateOperationsInput | number
    modelVersion?: StringFieldUpdateOperationsInput | string
    datasetVersion?: StringFieldUpdateOperationsInput | string
    codeGitSha?: NullableStringFieldUpdateOperationsInput | string | null
    schemaVersion?: StringFieldUpdateOperationsInput | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    agentExperiences?: AgentExperienceUpdateManyWithoutRunNestedInput
    crowdSnapshots?: CrowdSnapshotUpdateManyWithoutRunNestedInput
    bets?: BetUpdateManyWithoutRunNestedInput
  }

  export type SimulationRunUncheckedUpdateWithoutRunDebugInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: EnumSimulationRunStatusFieldUpdateOperationsInput | $Enums.SimulationRunStatus
    seed?: IntFieldUpdateOperationsInput | number
    modelVersion?: StringFieldUpdateOperationsInput | string
    datasetVersion?: StringFieldUpdateOperationsInput | string
    codeGitSha?: NullableStringFieldUpdateOperationsInput | string | null
    schemaVersion?: StringFieldUpdateOperationsInput | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    agentExperiences?: AgentExperienceUncheckedUpdateManyWithoutRunNestedInput
    crowdSnapshots?: CrowdSnapshotUncheckedUpdateManyWithoutRunNestedInput
    bets?: BetUncheckedUpdateManyWithoutRunNestedInput
  }

  export type SimulationRunCreateWithoutAgentExperiencesInput = {
    id?: string
    name: string
    status?: $Enums.SimulationRunStatus
    seed: number
    modelVersion: string
    datasetVersion: string
    codeGitSha?: string | null
    schemaVersion: string
    startedAt?: Date | string | null
    finishedAt?: Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    crowdSnapshots?: CrowdSnapshotCreateNestedManyWithoutRunInput
    runDebug?: RunDebugCreateNestedOneWithoutRunInput
    bets?: BetCreateNestedManyWithoutRunInput
  }

  export type SimulationRunUncheckedCreateWithoutAgentExperiencesInput = {
    id?: string
    name: string
    status?: $Enums.SimulationRunStatus
    seed: number
    modelVersion: string
    datasetVersion: string
    codeGitSha?: string | null
    schemaVersion: string
    startedAt?: Date | string | null
    finishedAt?: Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    crowdSnapshots?: CrowdSnapshotUncheckedCreateNestedManyWithoutRunInput
    runDebug?: RunDebugUncheckedCreateNestedOneWithoutRunInput
    bets?: BetUncheckedCreateNestedManyWithoutRunInput
  }

  export type SimulationRunCreateOrConnectWithoutAgentExperiencesInput = {
    where: SimulationRunWhereUniqueInput
    create: XOR<SimulationRunCreateWithoutAgentExperiencesInput, SimulationRunUncheckedCreateWithoutAgentExperiencesInput>
  }

  export type AgentCreateWithoutExperiencesInput = {
    id?: string
    displayName: string
    stateJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    archetype: ArchetypeCreateNestedOneWithoutAgentsInput
  }

  export type AgentUncheckedCreateWithoutExperiencesInput = {
    id?: string
    displayName: string
    archetypeId: string
    stateJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type AgentCreateOrConnectWithoutExperiencesInput = {
    where: AgentWhereUniqueInput
    create: XOR<AgentCreateWithoutExperiencesInput, AgentUncheckedCreateWithoutExperiencesInput>
  }

  export type SimulationRunUpsertWithoutAgentExperiencesInput = {
    update: XOR<SimulationRunUpdateWithoutAgentExperiencesInput, SimulationRunUncheckedUpdateWithoutAgentExperiencesInput>
    create: XOR<SimulationRunCreateWithoutAgentExperiencesInput, SimulationRunUncheckedCreateWithoutAgentExperiencesInput>
    where?: SimulationRunWhereInput
  }

  export type SimulationRunUpdateToOneWithWhereWithoutAgentExperiencesInput = {
    where?: SimulationRunWhereInput
    data: XOR<SimulationRunUpdateWithoutAgentExperiencesInput, SimulationRunUncheckedUpdateWithoutAgentExperiencesInput>
  }

  export type SimulationRunUpdateWithoutAgentExperiencesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: EnumSimulationRunStatusFieldUpdateOperationsInput | $Enums.SimulationRunStatus
    seed?: IntFieldUpdateOperationsInput | number
    modelVersion?: StringFieldUpdateOperationsInput | string
    datasetVersion?: StringFieldUpdateOperationsInput | string
    codeGitSha?: NullableStringFieldUpdateOperationsInput | string | null
    schemaVersion?: StringFieldUpdateOperationsInput | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    crowdSnapshots?: CrowdSnapshotUpdateManyWithoutRunNestedInput
    runDebug?: RunDebugUpdateOneWithoutRunNestedInput
    bets?: BetUpdateManyWithoutRunNestedInput
  }

  export type SimulationRunUncheckedUpdateWithoutAgentExperiencesInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: EnumSimulationRunStatusFieldUpdateOperationsInput | $Enums.SimulationRunStatus
    seed?: IntFieldUpdateOperationsInput | number
    modelVersion?: StringFieldUpdateOperationsInput | string
    datasetVersion?: StringFieldUpdateOperationsInput | string
    codeGitSha?: NullableStringFieldUpdateOperationsInput | string | null
    schemaVersion?: StringFieldUpdateOperationsInput | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    crowdSnapshots?: CrowdSnapshotUncheckedUpdateManyWithoutRunNestedInput
    runDebug?: RunDebugUncheckedUpdateOneWithoutRunNestedInput
    bets?: BetUncheckedUpdateManyWithoutRunNestedInput
  }

  export type AgentUpsertWithoutExperiencesInput = {
    update: XOR<AgentUpdateWithoutExperiencesInput, AgentUncheckedUpdateWithoutExperiencesInput>
    create: XOR<AgentCreateWithoutExperiencesInput, AgentUncheckedCreateWithoutExperiencesInput>
    where?: AgentWhereInput
  }

  export type AgentUpdateToOneWithWhereWithoutExperiencesInput = {
    where?: AgentWhereInput
    data: XOR<AgentUpdateWithoutExperiencesInput, AgentUncheckedUpdateWithoutExperiencesInput>
  }

  export type AgentUpdateWithoutExperiencesInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    stateJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    archetype?: ArchetypeUpdateOneRequiredWithoutAgentsNestedInput
  }

  export type AgentUncheckedUpdateWithoutExperiencesInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    archetypeId?: StringFieldUpdateOperationsInput | string
    stateJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SimulationRunCreateWithoutCrowdSnapshotsInput = {
    id?: string
    name: string
    status?: $Enums.SimulationRunStatus
    seed: number
    modelVersion: string
    datasetVersion: string
    codeGitSha?: string | null
    schemaVersion: string
    startedAt?: Date | string | null
    finishedAt?: Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    agentExperiences?: AgentExperienceCreateNestedManyWithoutRunInput
    runDebug?: RunDebugCreateNestedOneWithoutRunInput
    bets?: BetCreateNestedManyWithoutRunInput
  }

  export type SimulationRunUncheckedCreateWithoutCrowdSnapshotsInput = {
    id?: string
    name: string
    status?: $Enums.SimulationRunStatus
    seed: number
    modelVersion: string
    datasetVersion: string
    codeGitSha?: string | null
    schemaVersion: string
    startedAt?: Date | string | null
    finishedAt?: Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    agentExperiences?: AgentExperienceUncheckedCreateNestedManyWithoutRunInput
    runDebug?: RunDebugUncheckedCreateNestedOneWithoutRunInput
    bets?: BetUncheckedCreateNestedManyWithoutRunInput
  }

  export type SimulationRunCreateOrConnectWithoutCrowdSnapshotsInput = {
    where: SimulationRunWhereUniqueInput
    create: XOR<SimulationRunCreateWithoutCrowdSnapshotsInput, SimulationRunUncheckedCreateWithoutCrowdSnapshotsInput>
  }

  export type SimulationRunUpsertWithoutCrowdSnapshotsInput = {
    update: XOR<SimulationRunUpdateWithoutCrowdSnapshotsInput, SimulationRunUncheckedUpdateWithoutCrowdSnapshotsInput>
    create: XOR<SimulationRunCreateWithoutCrowdSnapshotsInput, SimulationRunUncheckedCreateWithoutCrowdSnapshotsInput>
    where?: SimulationRunWhereInput
  }

  export type SimulationRunUpdateToOneWithWhereWithoutCrowdSnapshotsInput = {
    where?: SimulationRunWhereInput
    data: XOR<SimulationRunUpdateWithoutCrowdSnapshotsInput, SimulationRunUncheckedUpdateWithoutCrowdSnapshotsInput>
  }

  export type SimulationRunUpdateWithoutCrowdSnapshotsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: EnumSimulationRunStatusFieldUpdateOperationsInput | $Enums.SimulationRunStatus
    seed?: IntFieldUpdateOperationsInput | number
    modelVersion?: StringFieldUpdateOperationsInput | string
    datasetVersion?: StringFieldUpdateOperationsInput | string
    codeGitSha?: NullableStringFieldUpdateOperationsInput | string | null
    schemaVersion?: StringFieldUpdateOperationsInput | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    agentExperiences?: AgentExperienceUpdateManyWithoutRunNestedInput
    runDebug?: RunDebugUpdateOneWithoutRunNestedInput
    bets?: BetUpdateManyWithoutRunNestedInput
  }

  export type SimulationRunUncheckedUpdateWithoutCrowdSnapshotsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: EnumSimulationRunStatusFieldUpdateOperationsInput | $Enums.SimulationRunStatus
    seed?: IntFieldUpdateOperationsInput | number
    modelVersion?: StringFieldUpdateOperationsInput | string
    datasetVersion?: StringFieldUpdateOperationsInput | string
    codeGitSha?: NullableStringFieldUpdateOperationsInput | string | null
    schemaVersion?: StringFieldUpdateOperationsInput | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    agentExperiences?: AgentExperienceUncheckedUpdateManyWithoutRunNestedInput
    runDebug?: RunDebugUncheckedUpdateOneWithoutRunNestedInput
    bets?: BetUncheckedUpdateManyWithoutRunNestedInput
  }

  export type SimulationRunCreateWithoutBetsInput = {
    id?: string
    name: string
    status?: $Enums.SimulationRunStatus
    seed: number
    modelVersion: string
    datasetVersion: string
    codeGitSha?: string | null
    schemaVersion: string
    startedAt?: Date | string | null
    finishedAt?: Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    agentExperiences?: AgentExperienceCreateNestedManyWithoutRunInput
    crowdSnapshots?: CrowdSnapshotCreateNestedManyWithoutRunInput
    runDebug?: RunDebugCreateNestedOneWithoutRunInput
  }

  export type SimulationRunUncheckedCreateWithoutBetsInput = {
    id?: string
    name: string
    status?: $Enums.SimulationRunStatus
    seed: number
    modelVersion: string
    datasetVersion: string
    codeGitSha?: string | null
    schemaVersion: string
    startedAt?: Date | string | null
    finishedAt?: Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
    agentExperiences?: AgentExperienceUncheckedCreateNestedManyWithoutRunInput
    crowdSnapshots?: CrowdSnapshotUncheckedCreateNestedManyWithoutRunInput
    runDebug?: RunDebugUncheckedCreateNestedOneWithoutRunInput
  }

  export type SimulationRunCreateOrConnectWithoutBetsInput = {
    where: SimulationRunWhereUniqueInput
    create: XOR<SimulationRunCreateWithoutBetsInput, SimulationRunUncheckedCreateWithoutBetsInput>
  }

  export type SimulationRunUpsertWithoutBetsInput = {
    update: XOR<SimulationRunUpdateWithoutBetsInput, SimulationRunUncheckedUpdateWithoutBetsInput>
    create: XOR<SimulationRunCreateWithoutBetsInput, SimulationRunUncheckedCreateWithoutBetsInput>
    where?: SimulationRunWhereInput
  }

  export type SimulationRunUpdateToOneWithWhereWithoutBetsInput = {
    where?: SimulationRunWhereInput
    data: XOR<SimulationRunUpdateWithoutBetsInput, SimulationRunUncheckedUpdateWithoutBetsInput>
  }

  export type SimulationRunUpdateWithoutBetsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: EnumSimulationRunStatusFieldUpdateOperationsInput | $Enums.SimulationRunStatus
    seed?: IntFieldUpdateOperationsInput | number
    modelVersion?: StringFieldUpdateOperationsInput | string
    datasetVersion?: StringFieldUpdateOperationsInput | string
    codeGitSha?: NullableStringFieldUpdateOperationsInput | string | null
    schemaVersion?: StringFieldUpdateOperationsInput | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    agentExperiences?: AgentExperienceUpdateManyWithoutRunNestedInput
    crowdSnapshots?: CrowdSnapshotUpdateManyWithoutRunNestedInput
    runDebug?: RunDebugUpdateOneWithoutRunNestedInput
  }

  export type SimulationRunUncheckedUpdateWithoutBetsInput = {
    id?: StringFieldUpdateOperationsInput | string
    name?: StringFieldUpdateOperationsInput | string
    status?: EnumSimulationRunStatusFieldUpdateOperationsInput | $Enums.SimulationRunStatus
    seed?: IntFieldUpdateOperationsInput | number
    modelVersion?: StringFieldUpdateOperationsInput | string
    datasetVersion?: StringFieldUpdateOperationsInput | string
    codeGitSha?: NullableStringFieldUpdateOperationsInput | string | null
    schemaVersion?: StringFieldUpdateOperationsInput | string
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    finishedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    configJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    agentExperiences?: AgentExperienceUncheckedUpdateManyWithoutRunNestedInput
    crowdSnapshots?: CrowdSnapshotUncheckedUpdateManyWithoutRunNestedInput
    runDebug?: RunDebugUncheckedUpdateOneWithoutRunNestedInput
  }

  export type ArchetypeTraitProfileCreateManyArchetypeInput = {
    traitDefinitionId: string
    baselineValue: number
  }

  export type AgentCreateManyArchetypeInput = {
    id?: string
    displayName: string
    stateJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ArchetypeTraitProfileUpdateWithoutArchetypeInput = {
    baselineValue?: FloatFieldUpdateOperationsInput | number
    traitDefinition?: TraitDefinitionUpdateOneRequiredWithoutArchetypeProfilesNestedInput
  }

  export type ArchetypeTraitProfileUncheckedUpdateWithoutArchetypeInput = {
    traitDefinitionId?: StringFieldUpdateOperationsInput | string
    baselineValue?: FloatFieldUpdateOperationsInput | number
  }

  export type ArchetypeTraitProfileUncheckedUpdateManyWithoutArchetypeInput = {
    traitDefinitionId?: StringFieldUpdateOperationsInput | string
    baselineValue?: FloatFieldUpdateOperationsInput | number
  }

  export type AgentUpdateWithoutArchetypeInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    stateJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    experiences?: AgentExperienceUpdateManyWithoutAgentNestedInput
  }

  export type AgentUncheckedUpdateWithoutArchetypeInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    stateJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    experiences?: AgentExperienceUncheckedUpdateManyWithoutAgentNestedInput
  }

  export type AgentUncheckedUpdateManyWithoutArchetypeInput = {
    id?: StringFieldUpdateOperationsInput | string
    displayName?: StringFieldUpdateOperationsInput | string
    stateJson?: NullableJsonNullValueInput | InputJsonValue
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ArchetypeTraitProfileCreateManyTraitDefinitionInput = {
    archetypeId: string
    baselineValue: number
  }

  export type ArchetypeTraitProfileUpdateWithoutTraitDefinitionInput = {
    baselineValue?: FloatFieldUpdateOperationsInput | number
    archetype?: ArchetypeUpdateOneRequiredWithoutTraitProfilesNestedInput
  }

  export type ArchetypeTraitProfileUncheckedUpdateWithoutTraitDefinitionInput = {
    archetypeId?: StringFieldUpdateOperationsInput | string
    baselineValue?: FloatFieldUpdateOperationsInput | number
  }

  export type ArchetypeTraitProfileUncheckedUpdateManyWithoutTraitDefinitionInput = {
    archetypeId?: StringFieldUpdateOperationsInput | string
    baselineValue?: FloatFieldUpdateOperationsInput | number
  }

  export type AgentExperienceCreateManyAgentInput = {
    id?: string
    runId: string
    step: number
    ts: Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: number | null
    drawdown?: number | null
    reward?: number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
  }

  export type AgentExperienceUpdateWithoutAgentInput = {
    id?: StringFieldUpdateOperationsInput | string
    step?: IntFieldUpdateOperationsInput | number
    ts?: DateTimeFieldUpdateOperationsInput | Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    drawdown?: NullableFloatFieldUpdateOperationsInput | number | null
    reward?: NullableFloatFieldUpdateOperationsInput | number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
    run?: SimulationRunUpdateOneRequiredWithoutAgentExperiencesNestedInput
  }

  export type AgentExperienceUncheckedUpdateWithoutAgentInput = {
    id?: StringFieldUpdateOperationsInput | string
    runId?: StringFieldUpdateOperationsInput | string
    step?: IntFieldUpdateOperationsInput | number
    ts?: DateTimeFieldUpdateOperationsInput | Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    drawdown?: NullableFloatFieldUpdateOperationsInput | number | null
    reward?: NullableFloatFieldUpdateOperationsInput | number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
  }

  export type AgentExperienceUncheckedUpdateManyWithoutAgentInput = {
    id?: StringFieldUpdateOperationsInput | string
    runId?: StringFieldUpdateOperationsInput | string
    step?: IntFieldUpdateOperationsInput | number
    ts?: DateTimeFieldUpdateOperationsInput | Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    drawdown?: NullableFloatFieldUpdateOperationsInput | number | null
    reward?: NullableFloatFieldUpdateOperationsInput | number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
  }

  export type AgentExperienceCreateManyRunInput = {
    id?: string
    agentId: string
    step: number
    ts: Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: number | null
    drawdown?: number | null
    reward?: number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
  }

  export type CrowdSnapshotCreateManyRunInput = {
    id?: string
    step: number
    ts: Date | string
    aggregationJson?: NullableJsonNullValueInput | InputJsonValue
    confidence?: number | null
  }

  export type BetCreateManyRunInput = {
    id?: string
    userId: string
    direction: $Enums.BetDirection
    confidence: number
    stake: number
    thesis?: string | null
    status?: string
    evalVersion?: string | null
    isCorrect?: boolean | null
    pnl?: number | null
    settledAt?: Date | string | null
    createdAt?: Date | string
  }

  export type AgentExperienceUpdateWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    step?: IntFieldUpdateOperationsInput | number
    ts?: DateTimeFieldUpdateOperationsInput | Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    drawdown?: NullableFloatFieldUpdateOperationsInput | number | null
    reward?: NullableFloatFieldUpdateOperationsInput | number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
    agent?: AgentUpdateOneRequiredWithoutExperiencesNestedInput
  }

  export type AgentExperienceUncheckedUpdateWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    agentId?: StringFieldUpdateOperationsInput | string
    step?: IntFieldUpdateOperationsInput | number
    ts?: DateTimeFieldUpdateOperationsInput | Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    drawdown?: NullableFloatFieldUpdateOperationsInput | number | null
    reward?: NullableFloatFieldUpdateOperationsInput | number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
  }

  export type AgentExperienceUncheckedUpdateManyWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    agentId?: StringFieldUpdateOperationsInput | string
    step?: IntFieldUpdateOperationsInput | number
    ts?: DateTimeFieldUpdateOperationsInput | Date | string
    actionJson?: NullableJsonNullValueInput | InputJsonValue
    signalsJson?: NullableJsonNullValueInput | InputJsonValue
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    drawdown?: NullableFloatFieldUpdateOperationsInput | number | null
    reward?: NullableFloatFieldUpdateOperationsInput | number | null
    learningMetaJson?: NullableJsonNullValueInput | InputJsonValue
    stateBeforeJson?: NullableJsonNullValueInput | InputJsonValue
    stateAfterJson?: NullableJsonNullValueInput | InputJsonValue
  }

  export type CrowdSnapshotUpdateWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    step?: IntFieldUpdateOperationsInput | number
    ts?: DateTimeFieldUpdateOperationsInput | Date | string
    aggregationJson?: NullableJsonNullValueInput | InputJsonValue
    confidence?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type CrowdSnapshotUncheckedUpdateWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    step?: IntFieldUpdateOperationsInput | number
    ts?: DateTimeFieldUpdateOperationsInput | Date | string
    aggregationJson?: NullableJsonNullValueInput | InputJsonValue
    confidence?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type CrowdSnapshotUncheckedUpdateManyWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    step?: IntFieldUpdateOperationsInput | number
    ts?: DateTimeFieldUpdateOperationsInput | Date | string
    aggregationJson?: NullableJsonNullValueInput | InputJsonValue
    confidence?: NullableFloatFieldUpdateOperationsInput | number | null
  }

  export type BetUpdateWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    direction?: EnumBetDirectionFieldUpdateOperationsInput | $Enums.BetDirection
    confidence?: IntFieldUpdateOperationsInput | number
    stake?: FloatFieldUpdateOperationsInput | number
    thesis?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    evalVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isCorrect?: NullableBoolFieldUpdateOperationsInput | boolean | null
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    settledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BetUncheckedUpdateWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    direction?: EnumBetDirectionFieldUpdateOperationsInput | $Enums.BetDirection
    confidence?: IntFieldUpdateOperationsInput | number
    stake?: FloatFieldUpdateOperationsInput | number
    thesis?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    evalVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isCorrect?: NullableBoolFieldUpdateOperationsInput | boolean | null
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    settledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type BetUncheckedUpdateManyWithoutRunInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    direction?: EnumBetDirectionFieldUpdateOperationsInput | $Enums.BetDirection
    confidence?: IntFieldUpdateOperationsInput | number
    stake?: FloatFieldUpdateOperationsInput | number
    thesis?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    evalVersion?: NullableStringFieldUpdateOperationsInput | string | null
    isCorrect?: NullableBoolFieldUpdateOperationsInput | boolean | null
    pnl?: NullableFloatFieldUpdateOperationsInput | number | null
    settledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Aliases for legacy arg types
   */
    /**
     * @deprecated Use ArchetypeCountOutputTypeDefaultArgs instead
     */
    export type ArchetypeCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ArchetypeCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use TraitDefinitionCountOutputTypeDefaultArgs instead
     */
    export type TraitDefinitionCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = TraitDefinitionCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use AgentCountOutputTypeDefaultArgs instead
     */
    export type AgentCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = AgentCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use SimulationRunCountOutputTypeDefaultArgs instead
     */
    export type SimulationRunCountOutputTypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = SimulationRunCountOutputTypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ArchetypeDefaultArgs instead
     */
    export type ArchetypeArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ArchetypeDefaultArgs<ExtArgs>
    /**
     * @deprecated Use TraitDefinitionDefaultArgs instead
     */
    export type TraitDefinitionArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = TraitDefinitionDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ArchetypeTraitProfileDefaultArgs instead
     */
    export type ArchetypeTraitProfileArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ArchetypeTraitProfileDefaultArgs<ExtArgs>
    /**
     * @deprecated Use AgentDefaultArgs instead
     */
    export type AgentArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = AgentDefaultArgs<ExtArgs>
    /**
     * @deprecated Use SimulationRunDefaultArgs instead
     */
    export type SimulationRunArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = SimulationRunDefaultArgs<ExtArgs>
    /**
     * @deprecated Use RunDebugDefaultArgs instead
     */
    export type RunDebugArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = RunDebugDefaultArgs<ExtArgs>
    /**
     * @deprecated Use AgentExperienceDefaultArgs instead
     */
    export type AgentExperienceArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = AgentExperienceDefaultArgs<ExtArgs>
    /**
     * @deprecated Use CrowdSnapshotDefaultArgs instead
     */
    export type CrowdSnapshotArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = CrowdSnapshotDefaultArgs<ExtArgs>
    /**
     * @deprecated Use UserProfileDefaultArgs instead
     */
    export type UserProfileArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = UserProfileDefaultArgs<ExtArgs>
    /**
     * @deprecated Use UserWalletDefaultArgs instead
     */
    export type UserWalletArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = UserWalletDefaultArgs<ExtArgs>
    /**
     * @deprecated Use BetDefaultArgs instead
     */
    export type BetArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = BetDefaultArgs<ExtArgs>
    /**
     * @deprecated Use ImportRunDefaultArgs instead
     */
    export type ImportRunArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = ImportRunDefaultArgs<ExtArgs>

  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}