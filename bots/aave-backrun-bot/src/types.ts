export interface AaveEvent {
  txHash: string;
  blockNumber: number;
  operation: 'borrow' | 'liquidation' | 'repay' | 'supply' | 'withdraw';
  user: string;
  asset: string;
  amount: bigint;
  timestamp: number;
}

export interface BackrunOpportunity {
  triggerEvent: AaveEvent;
  strategy: 'arbitrage' | 'liquidation-cascade' | 'rate-arbitrage';
  expectedProfit: bigint;
  gasEstimate: bigint;
  netProfit: bigint;
  description: string;
  steps: string[];
}

export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  profit?: bigint;
  gasUsed?: bigint;
  error?: string;
}
