import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '@Common';
import { BaseContract } from './base.contract';
import { Erc721, Erc721__factory } from './typechain';
import { ContractFactory } from '../ledger.types';
import { LedgerService } from '../ledger.service';

@Injectable()
export class Erc721Contract
  extends BaseContract<Erc721, ContractFactory<Erc721>>
  implements OnModuleInit
{
  constructor(
    readonly configService: ConfigService<EnvironmentVariables, true>,
    readonly ledgerService: LedgerService,
  ) {
    super(Erc721__factory, ledgerService);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  subscribeEvents(contract: Erc721): void {}
}
