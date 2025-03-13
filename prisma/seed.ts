import { Command } from 'commander';
import { PrismaClient } from '@prisma/client';
import { tokens } from './seeds';

const program = new Command();
program.option('--seed-only <name>', 'Specify a seed name').parse(process.argv);

const prisma = new PrismaClient();

async function main() {
  const options = program.opts();

  // Seed tokens
  if (!options.seedOnly || options.seedOnly === 'token') {
    if (await prisma.token.count()) {
      console.log('⚠ Skipping seed for `token`, due to non-empty table');
    } else {
      await prisma.token.createMany({
        data: tokens,
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
