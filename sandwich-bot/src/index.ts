import { MempoolMonitor } from './mempoolMonitor';
import { ProfitCalculator } from './profitCalculator';
import { SandwichExecutor } from './sandwichExecutor';
import { Logger } from './utils/logger';
import { config } from './config';

class SandwichBot {
  private monitor: MempoolMonitor;
  private calculator: ProfitCalculator;
  private executor: SandwichExecutor;
  private isRunning: boolean = false;

  // Statistics
  private stats = {
    totalDetected: 0,
    profitableOpportunities: 0,
    executed: 0,
    successful: 0,
    failed: 0
  };

  constructor() {
    this.monitor = new MempoolMonitor();
    this.calculator = new ProfitCalculator();
    this.executor = new SandwichExecutor();
  }

  async start(sandwichContractAddress?: string) {
    if (this.isRunning) {
      Logger.warn('Bot is already running');
      return;
    }

    Logger.info('Starting Sandwich Bot (Educational Version)...');
    this.printBanner();

    // Set sandwich contract if provided
    if (sandwichContractAddress) {
      this.executor.setSandwichContract(sandwichContractAddress);
    }

    // Check wallet balance
    await this.executor.checkBalance();

    // Start mempool monitoring
    await this.monitor.start(async (swapTx) => {
      await this.handleSwapTransaction(swapTx);
    });

    this.isRunning = true;

    // Print stats every 60 seconds
    setInterval(() => this.printStats(), 60000);

    Logger.success('Bot is now running and monitoring mempool...');
  }

  private async handleSwapTransaction(swapTx: any) {
    this.stats.totalDetected++;

    try {
      // Calculate potential profit
      const opportunity = await this.calculator.calculateSandwichProfit(swapTx);

      if (!opportunity) {
        return; // Not profitable
      }

      // Check if meets minimum threshold
      if (!this.calculator.isOpportunityViable(opportunity)) {
        Logger.info(`Opportunity found but below minimum profit threshold`);
        return;
      }

      this.stats.profitableOpportunities++;
      Logger.opportunity(opportunity);

      // Execute sandwich (if enabled)
      if (config.enableExecution) {
        this.stats.executed++;
        const result = await this.executor.executeSandwich(opportunity);

        if (result.success) {
          this.stats.successful++;
          Logger.success(`Sandwich executed successfully! Profit: ${result.actualProfit}`);
        } else {
          this.stats.failed++;
          Logger.error(`Sandwich execution failed: ${result.error}`);
        }
      } else {
        Logger.info('Would execute sandwich, but ENABLE_EXECUTION=false');
      }

    } catch (error: any) {
      Logger.error('Error handling swap transaction:', error.message);
    }
  }

  private printBanner() {
    console.log('\n' + '='.repeat(70));
    console.log('           SANDWICH ATTACK BOT - EDUCATIONAL VERSION');
    console.log('='.repeat(70));
    console.log('⚠️  FOR EDUCATIONAL USE ONLY - PRIVATE BLOCKCHAIN ONLY');
    console.log('⚠️  DO NOT USE ON MAINNET OR WITH REAL FUNDS');
    console.log('='.repeat(70));
    console.log(`Mode: ${config.enableExecution ? '🚨 EXECUTION ENABLED' : '📊 DRY RUN'}`);
    console.log(`Min Profit: $${config.minProfitUsd}`);
    console.log(`Max Gas Price: ${config.maxGasPriceGwei} gwei`);
    console.log(`Max Position: ${config.maxPositionSizeEth} ETH`);
    console.log('='.repeat(70) + '\n');
  }

  private printStats() {
    console.log('\n' + '-'.repeat(70));
    console.log('BOT STATISTICS');
    console.log('-'.repeat(70));
    console.log(`Total Swaps Detected: ${this.stats.totalDetected}`);
    console.log(`Profitable Opportunities: ${this.stats.profitableOpportunities}`);
    console.log(`Executed: ${this.stats.executed}`);
    console.log(`Successful: ${this.stats.successful}`);
    console.log(`Failed: ${this.stats.failed}`);
    if (this.stats.executed > 0) {
      const successRate = (this.stats.successful / this.stats.executed * 100).toFixed(2);
      console.log(`Success Rate: ${successRate}%`);
    }
    console.log('-'.repeat(70) + '\n');
  }

  async stop() {
    Logger.info('Stopping bot...');
    await this.monitor.stop();
    this.isRunning = false;
    this.printStats();
    Logger.success('Bot stopped');
  }
}

// Main execution
async function main() {
  const bot = new SandwichBot();

  // Get sandwich contract address from command line or environment
  const sandwichContractAddress = process.env.SANDWICH_CONTRACT_ADDRESS;

  if (!sandwichContractAddress && config.enableExecution) {
    Logger.warn('No SANDWICH_CONTRACT_ADDRESS provided. Execution will fail.');
    Logger.warn('Deploy the sandwich contract first and set the address in .env');
  }

  await bot.start(sandwichContractAddress);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    Logger.info('Received SIGINT signal');
    await bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    Logger.info('Received SIGTERM signal');
    await bot.stop();
    process.exit(0);
  });
}

// Start the bot
main().catch((error) => {
  Logger.error('Fatal error:', error);
  process.exit(1);
});
