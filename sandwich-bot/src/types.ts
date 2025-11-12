export interface PendingTransaction {
  hash: string;
  from: string;
  to: string;
  value: bigint;
  data: string;
  gasPrice: bigint;
  gasLimit: bigint;
  nonce: number;
}

export interface SwapTransaction {
  hash: string;
  from: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOutMin: bigint;
  gasPrice: bigint;
  deadline: number;
}

export interface SandwichOpportunity {
  victimTx: SwapTransaction;
  frontrunAmount: bigint;
  backrunAmount: bigint;
  estimatedProfit: bigint;
  estimatedGasCost: bigint;
  netProfit: bigint;
  profitPercentage: number;
}

export interface ExecutionResult {
  success: boolean;
  frontrunTx?: string;
  victimTx: string;
  backrunTx?: string;
  actualProfit?: bigint;
  error?: string;
}
