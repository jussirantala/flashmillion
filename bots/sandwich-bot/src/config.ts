import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Network
  rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
  wsUrl: process.env.WS_URL || 'ws://127.0.0.1:8545',

  // Wallet
  privateKey: process.env.PRIVATE_KEY || '',

  // Uniswap V2
  uniswapV2Router: process.env.UNISWAP_V2_ROUTER || '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  uniswapV2Factory: process.env.UNISWAP_V2_FACTORY || '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
  wethAddress: process.env.WETH_ADDRESS || '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',

  // Bot settings
  minProfitUsd: parseFloat(process.env.MIN_PROFIT_USD || '10'),
  maxGasPriceGwei: parseFloat(process.env.MAX_GAS_PRICE_GWEI || '50'),
  slippageTolerance: parseFloat(process.env.SLIPPAGE_TOLERANCE || '0.5'),

  // Safety
  maxPositionSizeEth: parseFloat(process.env.MAX_POSITION_SIZE_ETH || '1'),
  enableExecution: process.env.ENABLE_EXECUTION === 'true',
};

// Validation
if (!config.privateKey) {
  console.warn('⚠️  WARNING: No PRIVATE_KEY set in .env file');
}

if (config.enableExecution) {
  console.log('🚨 EXECUTION ENABLED - Bot will execute trades!');
} else {
  console.log('📊 DRY RUN MODE - Bot will only simulate trades');
}
