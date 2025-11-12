import { ethers } from 'ethers';
import { config } from './config';
import { SandwichOpportunity, ExecutionResult } from './types';
import { Logger } from './utils/logger';

const SANDWICH_CONTRACT_ABI = [
  'function executeSandwich(address tokenIn, address tokenOut, uint256 amountIn, uint256 minProfit) external payable',
  'function withdraw(address token, uint256 amount) external',
  'function withdrawETH() external'
];

export class SandwichExecutor {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private sandwichContract?: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    Logger.info(`Executor wallet: ${this.wallet.address}`);
  }

  setSandwichContract(contractAddress: string) {
    this.sandwichContract = new ethers.Contract(
      contractAddress,
      SANDWICH_CONTRACT_ABI,
      this.wallet
    );
    Logger.success(`Sandwich contract set: ${contractAddress}`);
  }

  async executeSandwich(opportunity: SandwichOpportunity): Promise<ExecutionResult> {
    if (!config.enableExecution) {
      Logger.info('DRY RUN MODE - Would execute sandwich but execution disabled');
      return {
        success: false,
        victimTx: opportunity.victimTx.hash,
        error: 'Execution disabled in config'
      };
    }

    if (!this.sandwichContract) {
      return {
        success: false,
        victimTx: opportunity.victimTx.hash,
        error: 'Sandwich contract not set'
      };
    }

    try {
      Logger.info('Executing sandwich attack...');

      // Calculate gas price (120% of victim's gas price to frontrun)
      const frontrunGasPrice = opportunity.victimTx.gasPrice * 12n / 10n;

      // IMPORTANT: In a real sandwich, you need to:
      // 1. Send frontrun tx with higher gas price
      // 2. Wait for victim tx to be included
      // 3. Send backrun tx in the same block

      // For educational purposes, we'll show the contract call
      const tx = await this.sandwichContract.executeSandwich(
        opportunity.victimTx.tokenIn,
        opportunity.victimTx.tokenOut,
        opportunity.frontrunAmount,
        opportunity.netProfit / 2n, // Minimum acceptable profit
        {
          gasPrice: frontrunGasPrice,
          gasLimit: 500000n
        }
      );

      Logger.info(`Sandwich transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        Logger.success(`Sandwich executed successfully! TX: ${tx.hash}`);
        return {
          success: true,
          frontrunTx: tx.hash,
          victimTx: opportunity.victimTx.hash,
          backrunTx: tx.hash, // In this simple example, it's one tx
          actualProfit: opportunity.netProfit
        };
      } else {
        Logger.error('Sandwich transaction failed');
        return {
          success: false,
          victimTx: opportunity.victimTx.hash,
          error: 'Transaction reverted'
        };
      }

    } catch (error: any) {
      Logger.error('Error executing sandwich:', error.message);
      return {
        success: false,
        victimTx: opportunity.victimTx.hash,
        error: error.message
      };
    }
  }

  // Advanced: Execute separate frontrun and backrun transactions
  async executeSandwichAdvanced(opportunity: SandwichOpportunity): Promise<ExecutionResult> {
    // This would implement:
    // 1. Frontrun transaction (buy)
    // 2. Monitor for victim tx confirmation
    // 3. Backrun transaction (sell) in next block

    // Left as an exercise - requires more complex block monitoring
    throw new Error('Advanced sandwich execution not implemented in educational version');
  }

  async checkBalance(): Promise<void> {
    const balance = await this.provider.getBalance(this.wallet.address);
    Logger.info(`Wallet balance: ${ethers.formatEther(balance)} ETH`);
  }
}
