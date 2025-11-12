export interface AaveTransaction {
  hash: string;
  from: string;
  to: string;
  value: bigint;
  data: string;
  gasPrice: bigint;
  gasLimit: bigint;
  nonce: number;
  operation: 'deposit' | 'borrow' | 'repay' | 'withdraw' | 'liquidation' | 'unknown';
  params?: any;
}

export interface FrontrunOpportunity {
  victimTx: AaveTransaction;
  strategy: 'deposit' | 'borrow' | 'liquidation';
  expectedProfit: bigint;
  gasRequired: bigint;
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
}

export interface ExecutionResult {
  success: boolean;
  frontrunTx?: string;
  victimTx: string;
  profit?: bigint;
  error?: string;
}
