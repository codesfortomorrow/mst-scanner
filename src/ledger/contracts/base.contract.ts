import { OnModuleInit } from '@nestjs/common';
import { BaseContract as Contract, ContractRunner, ethers } from 'ethers';
import {
  ProviderKind,
  AddressDictionary,
  ContractFactory,
} from '../ledger.types';
import { LedgerService } from '../ledger.service';

export abstract class BaseContract<
  T extends Contract,
  V extends ContractFactory<T>,
> implements OnModuleInit
{
  constructor(
    protected readonly factory: V,
    protected readonly ledgerService: LedgerService,
    protected readonly addressDictionary?: AddressDictionary,
  ) {}

  onModuleInit() {
    this.init();
  }

  abstract subscribeEvents(contract: T): void;

  getInstance(runner?: ContractRunner): T {
    return this.factory.connect(
      this.getAddress(),
      runner ? runner : this.ledgerService.getProvider(),
    );
  }

  getInstanceAt(address: string, runner?: ContractRunner): T {
    return this.factory.connect(
      address,
      runner ? runner : this.ledgerService.getProvider(),
    );
  }

  getAddress(strict = true): string {
    if (strict && typeof this.addressDictionary !== 'object') {
      throw new Error(
        `Invalid address dictionary, found ${typeof this
          .addressDictionary} expected object`,
      );
    }
    if (typeof this.addressDictionary === 'object') {
      const address = this.addressDictionary[this.ledgerService.network];
      if (
        strict &&
        (typeof address !== 'string' || !ethers.isAddress(address))
      ) {
        throw new Error(
          `Invalid address for network ${this.ledgerService.network}, found ${address}`,
        );
      }

      return ethers.isAddress(address) ? address : ethers.ZeroAddress;
    }

    return ethers.ZeroAddress;
  }

  private init() {
    if (
      typeof this.addressDictionary === 'object' &&
      typeof this.addressDictionary[this.ledgerService.network] === 'object'
    ) {
      const address = this.addressDictionary[this.ledgerService.network];
      if (
        typeof address === 'string' &&
        ethers.isAddress(address) &&
        address !== ethers.ZeroAddress
      ) {
        const provider = this.ledgerService.getProvider(ProviderKind.Ws);
        const contract = this.getInstance(provider);

        this.subscribeEvents(contract);

        // Reconnect after 5 minutes
        setTimeout(async () => {
          await provider.removeAllListeners();
          this.init();
        }, 300000);
      }
    }
  }
}
