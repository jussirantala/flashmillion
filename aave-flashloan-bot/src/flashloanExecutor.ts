import { ethers } from 'ethers';
import { config } from './config';
import { ArbitrageOpportunity, ExecutionResult } from './types';
import { Logger } from './utils/logger';

const FLASHLOAN_ARBITRAGE_ABI = [
  'function executeArbitrage(address asset, uint256 amount, uint8 buyDex, uint8 sellDex, address[] calldata path) external',
  'function simulateArbitrage(address asset, uint256 amount, uint8 buyDex, uint8 sellDex, address[] calldata path) external view returns (uint256 estimatedProfit, uint256 totalCost)',
  'function withdraw(address token, uint256 amount) external',
  'function withdrawETH() external'
];

export class FlashloanExecutor {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private contract?: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    Logger.info(`Executor wallet: ${this.wallet.address}`);
  }

  setContract(contractAddress: string) {
    this.contract = new ethers.Contract(
      contractAddress,
      FLASHLOAN_ARBITRAGE_ABI,
      this.wallet
    );
    Logger.success(`Flashloan contract set: ${contractAddress}`);
  }

  async executeArbitrage(opportunity: ArbitrageOpportunity): Promise<ExecutionResult> {
    if (config.dryRun) {
      Logger.info('DRY RUN MODE - Would execute arbitrage but execution disabled');
      return this.simulateExecution(opportunity);
    }

    if (!this.contract) {
      return {
        success: false,
        error: 'Contract not set'
      };
    }

    try {
      Logger.info('Executing flashloan arbitrage...');

      // Convert DEX names to indices
      const buyDex = this.getDexIndex(opportunity.buyDex);
      const sellDex = this.getDexIndex(opportunity.sellDex);

      // Build path
      const path = [opportunity.tokenBorrow, config.tokens.WETH]; // Simplified

      // Simulate first to verify profitability
      const [estimatedProfit] = await this.contract.simulateArbitrage(
        opportunity.tokenBorrow,
        opportunity.amount,
        buyDex,
        sellDex,
        path
      );

      Logger.info(`Simulation result: ${estimatedProfit} profit`);

      if (estimatedProfit <= 0n) {
        return {
          success: false,
          error: 'Simulation shows no profit'
        };
      }

      // Execute the arbitrage
      const tx = await this.contract.executeArbitrage(
        opportunity.tokenBorrow,
        opportunity.amount,
        buyDex,
        sellDex,
        path,
        {
          gasLimit: 1000000n,
          gasPrice: await this.getGasPrice()
        }
      );

      Logger.info(`Transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        const gasUsed = receipt.gasUsed * receipt.gasPrice;
        const actualProfit = estimatedProfit - gasUsed;

        Logger.success(`Arbitrage executed successfully!`);
        Logger.success(`Gas used: ${ethers.formatEther(gasUsed)} ETH`);
        Logger.success(`Actual profit: ${actualProfit}`);

        return {
          success: true,
          txHash: tx.hash,
          profit: actualProfit,
          gasUsed
        };
      } else {
        return {
          success: false,
          error: 'Transaction reverted'
        };
      }

    } catch (error: any) {
      Logger.error('Error executing arbitrage:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  private async simulateExecution(opportunity: ArbitrageOpportunity): Promise<ExecutionResult> {
    if (!this.contract) {
      Logger.info('No contract set, showing theoretical execution:');
    } else {
      try {
        const buyDex = this.getDexIndex(opportunity.buyDex);
        const sellDex = this.getDexIndex(opportunity.sellDex);
        const path = [opportunity.tokenBorrow, config.tokens.WETH];

        const [estimatedProfit, totalCost] = await this.contract.simulateArbitrage(
          opportunity.tokenBorrow,
          opportunity.amount,
          buyDex,
          sellDex,
          path
        );

        Logger.info(`Simulation - Estimated profit: ${estimatedProfit}`);
        Logger.info(`Simulation - Total cost: ${totalCost}`);
      } catch (error) {
        Logger.warn('Could not simulate on-chain');
      }
    }

    Logger.info('Would execute:');
    Logger.info(`  1. Borrow ${opportunity.amount} ${opportunity.tokenBorrowSymbol} from Aave`);
    Logger.info(`  2. Swap on ${opportunity.buyDex}`);
    Logger.info(`  3. Swap back on ${opportunity.sellDex}`);
    Logger.info(`  4. Repay flashloan with ${opportunity.flashLoanFee} fee`);
    Logger.info(`  5. Keep profit of ${opportunity.netProfit}`);

    return {
      success: false,
      error: 'Dry run mode'
    };
  }

  private getDexIndex(dex: string): number {
    switch (dex) {
      case 'uniswapV2': return 0;
      case 'sushiswap': return 1;
      case 'uniswapV3': return 2;
      default: throw new Error(`Unknown DEX: ${dex}`);
    }
  }

  private async getGasPrice(): Promise<bigint> {
    const feeData = await this.provider.getFeeData();
    const baseGasPrice = feeData.gasPrice || 0n;
    return baseGasPrice * BigInt(Math.floor(config.gasPriceMultiplier * 100)) / 100n;
  }

  async checkBalance(): Promise<void> {
    const balance = await this.provider.getBalance(this.wallet.address);
    Logger.info(`Wallet balance: ${ethers.formatEther(balance)} ETH`);
  }
}
