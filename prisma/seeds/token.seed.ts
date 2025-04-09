import { Prisma } from '@prisma/client';

export const tokens: Prisma.TokenCreateInput[] = [
  {
    address: '0xA7060B2ac04c9b4d6BfC2D688953fC959Ef07C6e'.toLowerCase(),
    name: 'ValidatorNodeFractionToken',
    symbol: 'VNFT',
    type: 'ERC721',
    syncedTillBlock: 0,
  },
  {
    address: '0xBBFf82a5a609967E10A786c8351bD9d23811C9f6'.toLowerCase(),
    name: 'Traveltor Token',
    symbol: 'TVTOR',
    totalSupply: '50000000000000000000000000000',
    type: 'ERC20',
    syncedTillBlock: 0,
  },
];
