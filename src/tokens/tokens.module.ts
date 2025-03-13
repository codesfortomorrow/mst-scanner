import { Module } from '@nestjs/common';
import { TokensService } from './tokens.service';
import { TokensController } from './tokens.controller';
import { LedgerModule } from '../ledger';
import { PrismaModule } from '../prisma';

@Module({
  imports: [LedgerModule, PrismaModule],
  controllers: [TokensController],
  providers: [TokensService],
})
export class TokensModule {}
