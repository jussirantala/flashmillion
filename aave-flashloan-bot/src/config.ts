import dotenv from 'dotenv';
dotenv.config();

export const config = {
  // Network
  rpcUrl: process.env.RPC_URL || 'http://127.0.0.1:8545',
  chainId: parseInt(process.env.CHAIN_ID || '1'),

  // Wallet
  privateKey: process.env.PRIVATE_KEY || '',

  // Aave V3
  aavePool: process.env.AAVE_POOL || '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
  aavePoolAddressesProvider: process.env.AAVE_POOL_ADDRESSES_PROVIDER || '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e',

  // DEX Routers
  uniswapV2Router: process.env.UNISWAP_V2_ROUTER || '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
  sushiswapRouter: process.env.SUSHISWAP_ROUTER || '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
  uniswapV3Router: process.env.UNISWAP_V3_ROUTER || '0xE592427A0AEce92De3Edee1F18E0157C05861564',

  // Tokens
  tokens: {
    WETH: process.env.WETH || '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: process.env.USDC || '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    DAI: process.env.DAI || '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    USDT: process.env.USDT || '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  },

  // Bot settings
  minProfitUsd: parseFloat(process.env.MIN_PROFIT_USD || '50'),
  maxLoanAmountUsd: parseFloat(process.env.MAX_LOAN_AMOUNT_USD || '100000'),
  gasPriceMultiplier: parseFloat(process.env.GAS_PRICE_MULTIPLIER || '1.1'),
  slippageTolerance: parseFloat(process.env.SLIPPAGE_TOLERANCE || '0.5'),

  // Safety
  enableExecution: process.env.ENABLE_EXECUTION === 'true',
  dryRun: process.env.DRY_RUN !== 'false',
};

// Validation
if (!config.privateKey) {
  console.warn('⚠️  WARNING: No PRIVATE_KEY set in .env file');
}

if (config.enableExecution && !config.dryRun) {
  console.log('🚨 LIVE EXECUTION MODE - Bot will execute real transactions!');
} else {
  console.log('📊 DRY RUN MODE - Bot will only simulate transactions');
}
