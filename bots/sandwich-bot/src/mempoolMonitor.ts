import { ethers } from 'ethers';
import { config } from './config';
import { Logger } from './utils/logger';
import { SwapTransaction } from './types';

const UNISWAP_V2_ROUTER_ABI = [
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)'
];

export class MempoolMonitor {
  private provider: ethers.WebSocketProvider;
  private routerInterface: ethers.Interface;

  constructor() {
    this.provider = new ethers.WebSocketProvider(config.wsUrl);
    this.routerInterface = new ethers.Interface(UNISWAP_V2_ROUTER_ABI);
    Logger.info('Mempool monitor initialized');
  }

  async start(onSwapDetected: (swap: SwapTransaction) => void) {
    Logger.info('Starting mempool monitoring...');

    // Listen to pending transactions
    this.provider.on('pending', async (txHash: string) => {
      try {
        const tx = await this.provider.getTransaction(txHash);

        if (!tx) return;

        // Check if it's a swap on Uniswap V2 Router
        if (tx.to?.toLowerCase() === config.uniswapV2Router.toLowerCase()) {
          const swapTx = this.parseSwapTransaction(tx);

          if (swapTx) {
            Logger.info(`Detected swap: ${txHash.substring(0, 10)}...`);
            onSwapDetected(swapTx);
          }
        }
      } catch (error) {
        // Ignore errors for individual transactions
        // (many pending txs may not be available)
      }
    });

    Logger.success('Mempool monitoring active');
  }

  private parseSwapTransaction(tx: ethers.TransactionResponse): SwapTransaction | null {
    try {
      const parsed = this.routerInterface.parseTransaction({
        data: tx.data,
        value: tx.value
      });

      if (!parsed) return null;

      // Handle different swap methods
      let tokenIn: string;
      let tokenOut: string;
      let amountIn: bigint;
      let amountOutMin: bigint;
      let deadline: number;

      switch (parsed.name) {
        case 'swapExactTokensForTokens':
        case 'swapExactTokensForETH':
          tokenIn = parsed.args.path[0];
          tokenOut = parsed.args.path[parsed.args.path.length - 1];
          amountIn = parsed.args.amountIn;
          amountOutMin = parsed.args.amountOutMin;
          deadline = parsed.args.deadline;
          break;

        case 'swapExactETHForTokens':
          tokenIn = config.wethAddress;
          tokenOut = parsed.args.path[parsed.args.path.length - 1];
          amountIn = tx.value;
          amountOutMin = parsed.args.amountOutMin;
          deadline = parsed.args.deadline;
          break;

        case 'swapTokensForExactTokens':
        case 'swapTokensForExactETH':
          tokenIn = parsed.args.path[0];
          tokenOut = parsed.args.path[parsed.args.path.length - 1];
          amountIn = parsed.args.amountInMax;
          amountOutMin = parsed.args.amountOut;
          deadline = parsed.args.deadline;
          break;

        case 'swapETHForExactTokens':
          tokenIn = config.wethAddress;
          tokenOut = parsed.args.path[parsed.args.path.length - 1];
          amountIn = tx.value;
          amountOutMin = parsed.args.amountOut;
          deadline = parsed.args.deadline;
          break;

        default:
          return null;
      }

      return {
        hash: tx.hash,
        from: tx.from,
        tokenIn,
        tokenOut,
        amountIn,
        amountOutMin,
        gasPrice: tx.gasPrice || 0n,
        deadline
      };

    } catch (error) {
      return null;
    }
  }

  async stop() {
    await this.provider.destroy();
    Logger.info('Mempool monitoring stopped');
  }
}
