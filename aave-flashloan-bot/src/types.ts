export interface ArbitrageOpportunity {
  tokenBorrow: string;
  tokenBorrowSymbol: string;
  amount: bigint;
  buyDex: 'uniswapV2' | 'sushiswap' | 'uniswapV3';
  sellDex: 'uniswapV2' | 'sushiswap' | 'uniswapV3';
  buyPrice: bigint;
  sellPrice: bigint;
  expectedProfit: bigint;
  flashLoanFee: bigint;
  gasEstimate: bigint;
  netProfit: bigint;
  profitPercentage: number;
}

export interface FlashloanParams {
  token: string;
  amount: bigint;
  buyDex: string;
  sellDex: string;
  minProfit: bigint;
}

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  profit?: bigint;
  gasUsed?: bigint;
  error?: string;
}

export interface DexPrices {
  uniswapV2: bigint;
  sushiswap: bigint;
  uniswapV3: bigint;
}

export interface TokenPair {
  token0: string;
  token1: string;
  token0Symbol: string;
  token1Symbol: string;
}
