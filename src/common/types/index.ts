import { IsEnum, IsInt, IsString } from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum Network {
  Devnet = 'devnet',
  Testnet = 'testnet',
  Mainnet = 'mainnet',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsEnum(Environment)
  APP_ENV: Environment;

  @IsEnum(Network)
  NETWORK: Network;

  @IsInt()
  PORT: number;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  LOG_DIR: string;
}

/**
 * ExcludeUndefinedIf<ExcludeUndefined, T>
 *
 * If `ExcludeUndefined` is `true`, remove `undefined` from `T`.
 * Otherwise, constructs the type `T` with `undefined`.
 */
export type ExcludeUndefinedIf<
  ExcludeUndefined extends boolean,
  T,
> = ExcludeUndefined extends true ? Exclude<T, undefined> : T | undefined;
