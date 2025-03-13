import { Inject, Injectable } from '@nestjs/common';
import { ConfigService, ConfigType } from '@nestjs/config';
import {
  Block,
  JsonRpcApiProviderOptions,
  JsonRpcProvider,
  SigningKey,
  Wallet,
  WebSocketProvider,
  ContractTransactionReceipt,
} from 'ethers';
import { EnvironmentVariables } from '@Common';
import { ledgerConfigFactory } from '@Config';
import {
  ProviderKind,
  ProviderDictionary,
  SigningKeyDictionary,
} from './ledger.types';

@Injectable()
export class LedgerService {
  private static isTransactionProcessing = false;
  private static transactionPipeline: {
    executor: () => Promise<ContractTransactionReceipt>;
    onSuccess: (receipt: ContractTransactionReceipt) => void;
    onError: (err: Error) => void;
  }[] = [];

  readonly network;
  private readonly defaultSigningKey;
  private readonly signingKeyDictionary;
  private readonly providerDictionary;

  constructor(
    @Inject(ledgerConfigFactory.KEY)
    readonly config: ConfigType<typeof ledgerConfigFactory>,
    readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.network = configService.get('NETWORK', { infer: true });
    this.defaultSigningKey = config.defaultSigningKey;
    this.signingKeyDictionary = config.signingKey as SigningKeyDictionary;
    this.providerDictionary = config.provider as ProviderDictionary;
  }

  getSigner(strict = true): Wallet {
    let privateKey = this.defaultSigningKey;

    if (strict && typeof this.signingKeyDictionary !== 'object') {
      throw new Error(
        `Invalid signing key dictionary, found ${typeof this
          .signingKeyDictionary} expected object`,
      );
    }
    if (strict && typeof this.signingKeyDictionary[this.network] !== 'string') {
      throw new Error(`Signing key not configured for network ${this.network}`);
    }
    if (
      typeof this.signingKeyDictionary === 'object' &&
      typeof this.signingKeyDictionary[this.network] === 'string'
    ) {
      const signingKey = this.signingKeyDictionary[this.network];
      if (strict && typeof signingKey !== 'string') {
        throw new Error(
          `Invalid signing key for network ${this.network}, found ${signingKey}`,
        );
      }

      privateKey = signingKey || this.defaultSigningKey;
    }

    const signingKey = new SigningKey(privateKey || '0x');
    return new Wallet(signingKey);
  }

  getProvider<T extends JsonRpcProvider | WebSocketProvider>(
    kind = ProviderKind.Http,
    options?: {
      http?: JsonRpcApiProviderOptions;
    },
  ): T {
    if (typeof this.providerDictionary !== 'object') {
      throw new Error(
        `Invalid provider dictionary, found ${typeof this
          .providerDictionary} expected object`,
      );
    }

    const providerKindDictionary = this.providerDictionary[this.network];
    if (typeof providerKindDictionary !== 'object') {
      throw new Error(`Provider not configured for network ${this.network}`);
    }
    if (!providerKindDictionary[kind]) {
      throw new Error(
        `Provider kind ${kind} not configured for network ${this.network}`,
      );
    }

    const url = providerKindDictionary[kind] as string;

    if (kind === ProviderKind.Ws) {
      return new WebSocketProvider(url) as T;
    }

    return new JsonRpcProvider(url, undefined, options?.http) as T;
  }

  getLatestBlockNumber = async (): Promise<number> => {
    const provider = this.getProvider();
    return await provider.getBlockNumber();
  };

  getBlockByNumber = async (blockNumber: number): Promise<Block | null> => {
    const provider = this.getProvider();
    return await provider.getBlock(blockNumber);
  };

  private static async execTransaction(): Promise<void> {
    if (this.isTransactionProcessing) return;

    // Enable isTransactionProcessing flag
    this.isTransactionProcessing = true;

    // Process transactions in series
    while (this.transactionPipeline.length) {
      const tx = this.transactionPipeline.shift();
      if (tx) {
        try {
          const receipt = await tx.executor();
          tx.onSuccess(receipt);
        } catch (err) {
          tx.onError(err);
        }
      }
    }

    // Disable isTransactionProcessing flag
    this.isTransactionProcessing = false;
  }

  static async sendTransaction(
    executor: () => Promise<ContractTransactionReceipt>,
  ): Promise<ContractTransactionReceipt> {
    return await new Promise((resolve, reject) => {
      this.transactionPipeline.push({
        executor,
        onSuccess: resolve,
        onError: reject,
      });
      this.execTransaction();
    });
  }
}
