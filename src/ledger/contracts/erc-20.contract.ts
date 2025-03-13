import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '@Common';
import { BaseContract } from './base.contract';
import { Erc20, Erc20__factory } from './typechain';
import { ContractFactory } from '../ledger.types';
import { LedgerService } from '../ledger.service';

@Injectable()
export class Erc20Contract
  extends BaseContract<Erc20, ContractFactory<Erc20>>
  implements OnModuleInit
{
  constructor(
    readonly configService: ConfigService<EnvironmentVariables, true>,
    readonly ledgerService: LedgerService,
  ) {
    super(Erc20__factory, ledgerService);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  subscribeEvents(contract: Erc20): void {}
}
