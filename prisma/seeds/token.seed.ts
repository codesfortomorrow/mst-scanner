import { Prisma } from '@prisma/client';

export const tokens: Prisma.TokenCreateInput[] = [
  {
    address: '0xA7060B2ac04c9b4d6BfC2D688953fC959Ef07C6e'.toLowerCase(),
    name: 'ValidatorNodeFractionToken',
    symbol: 'VNFT',
    type: 'ERC721',
    syncedTillBlock: 0,
  },
];
