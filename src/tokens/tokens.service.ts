import { ethers } from 'ethers';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Prisma, TokenType } from '@prisma/client';
import { Client } from 'pg';
import { BaseService, UtilsService } from '@Common';
import { Erc721Contract, LedgerService } from '../ledger';
import { PrismaService } from '../prisma';

type Log = { id: string; block_number: string; value: string };
type CurrentLog = Log & { old_value: string };

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
    // This will do periodic sync from blockchain to local database
    this.initSync();

    // This will read local database & sync VNFT token balances into the mst scanner
    // this.syncToScanner();
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

  private async syncToScanner(): Promise<void> {
    const client = new Client(process.env.SCANNER_DATABASE_URL);
    try {
      await client.connect();

      const transfers = await this.prisma.tokenTransfer.findMany({
        orderBy: [{ blockNumber: 'asc' }, { logIndex: 'asc' }],
        skip: 0, // Update skip if you want to resume (crash due to error) from the last sync position
      });

      console.log(
        'Sync started till',
        transfers[transfers.length - 1].blockNumber,
      );

      let count = 0;
      for (const transfer of transfers) {
        const time = Date.now();

        // If from is not zero address
        if (transfer.fromAddress !== ethers.ZeroAddress) {
          const lastLogQueryResponse = await client.query<Log>(`
            SELECT id, block_number, value FROM address_token_balances WHERE
            block_number < ${transfer.blockNumber}
            AND ENCODE(address_hash, 'hex') ILIKE '${transfer.fromAddress.slice(2)}'
            AND ENCODE(token_contract_address_hash, 'hex') ILIKE 'a7060b2ac04c9b4d6bfc2d688953fc959ef07c6e'
            ORDER BY block_number DESC
            LIMIT 1
          `);

          let lastLog: Log | null = null;
          if (lastLogQueryResponse.rows.length > 0) {
            lastLog = lastLogQueryResponse.rows[0];
          }

          const currentLogQueryResponse = await client.query<Log>(`
            SELECT id, block_number, value FROM address_token_balances WHERE
            block_number = ${transfer.blockNumber}
            AND ENCODE(address_hash, 'hex') ILIKE '${transfer.fromAddress.slice(2)}'
            AND ENCODE(token_contract_address_hash, 'hex') ILIKE 'a7060b2ac04c9b4d6bfc2d688953fc959ef07c6e'
          `);

          let currentLog: Log | null = null;
          if (currentLogQueryResponse.rows.length > 0) {
            currentLog = currentLogQueryResponse.rows[0];
          }

          if (!currentLog) {
            await client.query(`
              INSERT INTO address_token_balances (
                address_hash, block_number, token_contract_address_hash, value, value_fetched_at, inserted_at, updated_at, token_id, token_type
              )
              VALUES (
                DECODE('${transfer.fromAddress.slice(2)}', 'hex'), ${transfer.blockNumber}, DECODE('a7060b2ac04c9b4d6bfc2d688953fc959ef07c6e', 'hex'), ${Number(lastLog?.value || 0) - 1}, NOW(), NOW(), NOW(), NULL, 'ERC-721'
              )
            `);
          } else {
            await client.query(`
              UPDATE address_token_balances SET value = value - 1 WHERE id = ${currentLog.id};
            `);
          }
        }

        const lastLogQueryResponse = await client.query<Log>(`
          SELECT id, block_number, value FROM address_token_balances WHERE
          block_number < ${transfer.blockNumber}
          AND ENCODE(address_hash, 'hex') ILIKE '${transfer.toAddress.slice(2)}'
          AND ENCODE(token_contract_address_hash, 'hex') ILIKE 'a7060b2ac04c9b4d6bfc2d688953fc959ef07c6e'
          ORDER BY block_number DESC
          LIMIT 1
        `);

        let lastLog: Log | null = null;
        if (lastLogQueryResponse.rows.length > 0) {
          lastLog = lastLogQueryResponse.rows[0];
        }

        const currentLogQueryResponse = await client.query<Log>(`
          SELECT id, block_number, value FROM address_token_balances WHERE
          block_number = ${transfer.blockNumber}
          AND ENCODE(address_hash, 'hex') ILIKE '${transfer.toAddress.slice(2)}'
          AND ENCODE(token_contract_address_hash, 'hex') ILIKE 'a7060b2ac04c9b4d6bfc2d688953fc959ef07c6e'
        `);

        let currentLog: Log | null = null;
        if (currentLogQueryResponse.rows.length > 0) {
          currentLog = currentLogQueryResponse.rows[0];
        }

        if (!currentLog) {
          await client.query(`
            INSERT INTO address_token_balances (
              address_hash, block_number, token_contract_address_hash, value, value_fetched_at, inserted_at, updated_at, token_id, token_type
            )
            VALUES (
              DECODE('${transfer.toAddress.slice(2)}', 'hex'), ${transfer.blockNumber}, DECODE('a7060b2ac04c9b4d6bfc2d688953fc959ef07c6e', 'hex'), ${Number(lastLog?.value || 0) + 1}, NOW(), NOW(), NOW(), NULL, 'ERC-721'
            )
          `);
        } else {
          await client.query(`
            UPDATE address_token_balances SET value = value + 1 WHERE id = ${currentLog.id};
          `);
        }

        // Update token current balance
        if (transfer.fromAddress !== ethers.ZeroAddress) {
          const currentBalLogQueryResponse = await client.query<CurrentLog>(`
            SELECT id, block_number, value, old_value FROM address_current_token_balances WHERE
            ENCODE(address_hash, 'hex') ILIKE '${transfer.fromAddress.slice(2)}'
            AND ENCODE(token_contract_address_hash, 'hex') ILIKE 'a7060b2ac04c9b4d6bfc2d688953fc959ef07c6e'
          `);

          let currentBalLog: CurrentLog | null = null;
          if (currentBalLogQueryResponse.rows.length > 0) {
            currentBalLog = currentBalLogQueryResponse.rows[0];
          }

          if (!currentBalLog) {
            throw new Error(
              `Current balance log not found for ${transfer.fromAddress}`,
            );
          } else {
            if (
              Number(currentBalLog.block_number) ===
              Number(transfer.blockNumber)
            ) {
              await client.query(`
                UPDATE address_current_token_balances SET value = value - 1 WHERE id = ${currentBalLog.id};
              `);
            } else {
              await client.query(`
                UPDATE address_current_token_balances SET block_number = ${transfer.blockNumber}, value = ${Number(currentBalLog.value) - 1}, old_value = ${currentBalLog.value} WHERE id = ${currentBalLog.id};
              `);
            }
          }
        }

        const currentBalLogQueryResponse = await client.query<CurrentLog>(`
          SELECT id, block_number, value, old_value FROM address_current_token_balances WHERE
          ENCODE(address_hash, 'hex') ILIKE '${transfer.toAddress.slice(2)}'
          AND ENCODE(token_contract_address_hash, 'hex') ILIKE 'a7060b2ac04c9b4d6bfc2d688953fc959ef07c6e'
        `);

        let currentBalLog: CurrentLog | null = null;
        if (currentBalLogQueryResponse.rows.length > 0) {
          currentBalLog = currentBalLogQueryResponse.rows[0];
        }

        if (!currentBalLog) {
          await client.query(`
            INSERT INTO address_current_token_balances (
              address_hash, block_number, token_contract_address_hash, value, value_fetched_at, inserted_at, updated_at, old_value, token_id, token_type
            )
            VALUES (
              DECODE('${transfer.toAddress.slice(2)}', 'hex'), ${transfer.blockNumber}, DECODE('a7060b2ac04c9b4d6bfc2d688953fc959ef07c6e', 'hex'), 1, NOW(), NOW(), NOW(), NULL, NULL, 'ERC-721'
            )
          `);
        } else {
          if (
            Number(currentBalLog.block_number) === Number(transfer.blockNumber)
          ) {
            await client.query(`
              UPDATE address_current_token_balances SET value = value + 1 WHERE id = ${currentBalLog.id};
            `);
          } else {
            await client.query(`
              UPDATE address_current_token_balances SET block_number = ${transfer.blockNumber}, value = ${Number(currentBalLog.value) + 1}, old_value = ${currentBalLog.value} WHERE id = ${currentBalLog.id};
            `);
          }
        }

        count++;
        console.log(
          'Processed transfer log',
          count,
          transfer.txHash,
          `${Date.now() - time} ms`,
        );
      }
    } catch (err) {
      console.error('Error occurred on scanner sync', err);
    } finally {
      await client.end();
    }
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
