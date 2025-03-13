import { registerAs } from '@nestjs/config';

export const ledgerConfigFactory = registerAs('ledger', () => ({
  provider: {
    devnet: {
      http: process.env.DEVNET_HTTP_PROVIDER,
      ws: process.env.DEVNET_WS_PROVIDER,
    },
    mainnet: {
      http: process.env.MAINNET_HTTP_PROVIDER,
      ws: process.env.MAINNET_WS_PROVIDER,
    },
    testnet: {
      http: process.env.TESTNET_HTTP_PROVIDER,
      ws: process.env.TESTNET_WS_PROVIDER,
    },
  },
  defaultSigningKey: process.env.SIGNING_KEY,
  signingKey: {
    devnet: process.env.DEVNET_SIGNING_KEY,
    mainnet: process.env.MAINNET_SIGNING_KEY,
    testnet: process.env.TESTNET_SIGNING_KEY,
  },
}));
