import dotenv from 'dotenv';
dotenv.config();

export const config = {
  rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
  wsUrl: process.env.WS_URL || 'ws://127.0.0.1:8545',
  privateKey: process.env.PRIVATE_KEY || '',

  aavePool: process.env.AAVE_POOL || '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',

  uniswapV2Router: process.env.UNISWAP_V2_ROUTER || '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  sushiswapRouter: process.env.SUSHISWAP_ROUTER || '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',

  minProfitUsd: parseFloat(process.env.MIN_PROFIT_USD || '20'),
  monitorOperations: (process.env.MONITOR_OPERATIONS || 'borrow,liquidation,repay').split(','),

  enableExecution: process.env.ENABLE_EXECUTION === 'true',
  dryRun: process.env.DRY_RUN !== 'false',
};

if (config.enableExecution && !config.dryRun) {
  console.log('🚨 LIVE EXECUTION MODE');
} else {
  console.log('📊 DRY RUN MODE - Simulation only');
}
