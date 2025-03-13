import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '@Common';
import { BaseContract } from './base.contract';
import { Erc1155, Erc1155__factory } from './typechain';
import { ContractFactory } from '../ledger.types';
import { LedgerService } from '../ledger.service';

@Injectable()
export class Erc1155Contract
  extends BaseContract<Erc1155, ContractFactory<Erc1155>>
  implements OnModuleInit
{
  constructor(
    readonly configService: ConfigService<EnvironmentVariables, true>,
    readonly ledgerService: LedgerService,
  ) {
    super(Erc1155__factory, ledgerService);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  subscribeEvents(contract: Erc1155): void {}
}
