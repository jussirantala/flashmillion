import { ethers } from 'ethers';
import { config } from './config';
import { AaveTransaction } from './types';

const AAVE_POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external',
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) external',
  'function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) external returns (uint256)',
  'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
  'function liquidationCall(address collateralAsset, address debtAsset, address user, uint256 debtToCover, bool receiveAToken) external'
];

export class MempoolMonitor {
  private provider: ethers.WebSocketProvider;
  private poolInterface: ethers.Interface;

  constructor() {
    this.provider = new ethers.WebSocketProvider(config.wsUrl);
    this.poolInterface = new ethers.Interface(AAVE_POOL_ABI);
  }

  async start(onAaveTransaction: (tx: AaveTransaction) => void) {
    console.log('[INFO] Starting Aave mempool monitoring...');
    console.log('[INFO] Watching for: ' + config.targetOperations.join(', '));

    this.provider.on('pending', async (txHash: string) => {
      try {
        const tx = await this.provider.getTransaction(txHash);

        if (!tx) return;

        // Check if it's an Aave transaction
        if (tx.to?.toLowerCase() === config.aavePool.toLowerCase()) {
          const aaveTx = this.parseAaveTransaction(tx);

          if (aaveTx && this.isTargetOperation(aaveTx.operation)) {
            console.log(`[DETECTED] ${aaveTx.operation} transaction: ${txHash.substring(0, 10)}...`);
            onAaveTransaction(aaveTx);
          }
        }
      } catch (error) {
        // Ignore individual tx errors
      }
    });

    console.log('[SUCCESS] Mempool monitoring active');
  }

  private parseAaveTransaction(tx: ethers.TransactionResponse): AaveTransaction | null {
    try {
      const parsed = this.poolInterface.parseTransaction({
        data: tx.data,
        value: tx.value
      });

      if (!parsed) return null;

      let operation: AaveTransaction['operation'] = 'unknown';

      switch (parsed.name) {
        case 'supply':
          operation = 'deposit';
          break;
        case 'borrow':
          operation = 'borrow';
          break;
        case 'repay':
          operation = 'repay';
          break;
        case 'withdraw':
          operation = 'withdraw';
          break;
        case 'liquidationCall':
          operation = 'liquidation';
          break;
        default:
          return null;
      }

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        value: tx.value,
        data: tx.data,
        gasPrice: tx.gasPrice || 0n,
        gasLimit: tx.gasLimit,
        nonce: tx.nonce,
        operation,
        params: parsed.args
      };

    } catch (error) {
      return null;
    }
  }

  private isTargetOperation(operation: string): boolean {
    return config.targetOperations.includes(operation);
  }

  async stop() {
    await this.provider.destroy();
    console.log('[INFO] Mempool monitoring stopped');
  }
}
