import dotenv from 'dotenv';
dotenv.config();

export const config = {
  rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
  wsUrl: process.env.WS_URL || 'ws://127.0.0.1:8545',
  privateKey: process.env.PRIVATE_KEY || '',

  aavePool: process.env.AAVE_POOL || '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',

  minTransactionValueEth: parseFloat(process.env.MIN_TRANSACTION_VALUE_ETH || '0.1'),
  targetOperations: (process.env.TARGET_OPERATIONS || 'deposit,borrow,liquidation').split(','),

  gasPriceMultiplier: parseFloat(process.env.GAS_PRICE_MULTIPLIER || '1.5'),
  maxPositionSizeEth: parseFloat(process.env.MAX_POSITION_SIZE_ETH || '5'),

  enableExecution: process.env.ENABLE_EXECUTION === 'true',
  dryRun: process.env.DRY_RUN !== 'false',
};

console.log('\n' + '='.repeat(70));
console.log('⚠️  FRONT-RUNNING BOT - EDUCATIONAL RESEARCH ONLY');
console.log('='.repeat(70));
console.log('WARNING: Front-running harms other users and may be ILLEGAL');
console.log('This bot is for EDUCATIONAL PURPOSES ONLY');
console.log('Do NOT use on mainnet or against real users');
console.log('='.repeat(70) + '\n');

if (config.enableExecution && !config.dryRun) {
  console.error('🚨 LIVE MODE DISABLED FOR SAFETY');
  console.error('This bot should NEVER execute real front-running attacks');
  process.exit(1);
}
