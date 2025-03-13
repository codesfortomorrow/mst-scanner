import { ContractRunner } from 'ethers';
import { Network } from '@Common';

export enum ProviderKind {
  Http = 'http',
  Ws = 'ws',
}

export type ProviderDictionary = Partial<{
  [Network.Devnet]: Partial<{ [Key in ProviderKind]: string }>;
  [Network.Testnet]: Partial<{ [Key in ProviderKind]: string }>;
  [Network.Mainnet]: Partial<{ [Key in ProviderKind]: string }>;
}>;

export type AddressDictionary = Partial<{
  [Network.Devnet]: string;
  [Network.Testnet]: string;
  [Network.Mainnet]: string;
}>;

export type SigningKeyDictionary = Partial<{
  [Network.Devnet]: string;
  [Network.Testnet]: string;
  [Network.Mainnet]: string;
}>;

export interface ContractFactory<T> {
  connect(address: string, runner?: ContractRunner | null): T;
}
