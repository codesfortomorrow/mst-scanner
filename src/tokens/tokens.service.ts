import { ethers } from 'ethers';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Prisma, TokenType } from '@prisma/client';
import { BaseService, UtilsService } from '@Common';
import { Erc721Contract, LedgerService } from '../ledger';
import { PrismaService } from '../prisma';

@Injectable()
export class TokensService
  extends BaseService
  implements OnApplicationBootstrap
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledgerService: LedgerService,
    private readonly erc721Contract: Erc721Contract,
    private readonly utilsService: UtilsService,
  ) {
    super({ loggerDefaultMeta: { service: TokensService.name } });
  }

  onApplicationBootstrap() {
    this.initSync();
  }

  private async initSync(): Promise<void> {
    const tokens = await this.prisma.token.findMany({
      select: { address: true },
    });

    await Promise.allSettled(
      tokens.map(async (token) => await this.sync(token.address)),
    );

    // Periodic run
    setTimeout(() => this.initSync(), 5000);
  }

  private async sync(tokenAddress: string): Promise<void> {
    const token = await this.prisma.token.findUnique({
      where: { address: tokenAddress.toLowerCase() },
    });
    if (!token || token.type !== TokenType.ERC721) return;

    const tokenContract = await this.erc721Contract.getInstanceAt(
      tokenAddress,
      this.ledgerService.getProvider(),
    );

    const filter = tokenContract.filters.Transfer();
    const latestBlock = await this.ledgerService.getLatestBlockNumber();
    const syncTillBlock = Math.min(
      latestBlock,
      Number(token.syncedTillBlock) + 100000,
    );
    if (token.syncedTillBlock > syncTillBlock) return;

    const logs = await this.utilsService.retryable(
      async () =>
        await tokenContract.queryFilter(
          filter,
          Number(token.syncedTillBlock),
          syncTillBlock,
        ),
    );
    this.logger.info(
      `Syncing ${logs.length} logs of contract ${tokenAddress.toLowerCase()} from block ${Number(token.syncedTillBlock)} to block ${syncTillBlock}`,
    );

    for (const log of logs) {
      await this.utilsService.retryable(async () => {
        await this.prisma.$transaction(async (tx) => {
          const { from, to, tokenId } = log.args;

          let tokenTransfer = await tx.tokenTransfer.findUnique({
            where: {
              txHash_logIndex: {
                txHash: log.transactionHash.toLowerCase(),
                logIndex: log.index,
              },
            },
          });
          if (tokenTransfer) return;

          tokenTransfer = await tx.tokenTransfer.create({
            data: {
              blockNumber: log.blockNumber,
              txHash: log.transactionHash.toLowerCase(),
              logIndex: log.index,
              fromAddress: from.toLowerCase(),
              toAddress: to.toLowerCase(),
              tokenId: tokenId.toString(),
              tokenAddress: log.address.toLowerCase(),
            },
          });

          // Update token balance
          if (tokenTransfer.fromAddress === ethers.ZeroAddress) {
            await tx.tokenBalance.create({
              data: {
                account: tokenTransfer.toAddress,
                tokenAddress: tokenTransfer.tokenAddress,
                tokenId: tokenTransfer.tokenId,
                lastUpdateBlock: tokenTransfer.blockNumber,
              },
            });
          } else {
            await Promise.all([
              tx.tokenBalance.deleteMany({
                where: {
                  account: tokenTransfer.fromAddress,
                  tokenAddress: tokenTransfer.tokenAddress,
                  tokenId: tokenTransfer.tokenId,
                },
              }),
              tx.tokenBalance.create({
                data: {
                  account: tokenTransfer.toAddress,
                  tokenAddress: tokenTransfer.tokenAddress,
                  tokenId: tokenTransfer.tokenId,
                  lastUpdateBlock: tokenTransfer.blockNumber,
                },
              }),
            ]);
          }

          // Update token stats
          const totalHoldersResponse = await this.prisma.$queryRaw<
            { holders: bigint }[]
          >(
            Prisma.sql`SELECT COUNT(DISTINCT account) as holders FROM token_balance WHERE token_address ILIKE ${tokenTransfer.tokenAddress}`,
          );
          await tx.token.update({
            data: {
              totalSupply:
                tokenTransfer.fromAddress === ethers.ZeroAddress
                  ? {
                      increment: 1,
                    }
                  : undefined,
              totalHolders: totalHoldersResponse[0].holders,
              syncedTillBlock: tokenTransfer.blockNumber,
            },
            where: {
              address: tokenTransfer.tokenAddress,
            },
          });
        });
      });
    }

    await this.prisma.token.update({
      data: {
        syncedTillBlock: Math.min(latestBlock, syncTillBlock),
      },
      where: {
        address: token.address,
      },
    });
  }

  async getAll() {
    return await this.prisma.token.findMany();
  }

  async getInfo(address: string) {
    const token = await this.prisma.token.findUnique({
      where: { address: address.toLowerCase() },
    });
    if (!token) return null;

    const transfers = await this.prisma.tokenTransfer.count({
      where: { tokenAddress: token.address },
    });

    return { ...token, totalTransfers: transfers };
  }

  async getHoldersOf(
    address: string,
    options?: { skip?: number; take?: number },
  ) {
    const pagination = { skip: options?.skip || 0, take: options?.take || 100 };

    return await this.prisma.$queryRaw(
      Prisma.sql`SELECT account, COUNT(token_id) AS tokens FROM token_balance WHERE token_address = ${address.toLowerCase()} GROUP BY account ORDER BY tokens DESC OFFSET ${pagination.skip} LIMIT ${pagination.take};`,
    );
  }
}
