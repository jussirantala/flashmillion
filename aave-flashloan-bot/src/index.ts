import { OpportunityDetector } from './opportunityDetector';
import { FlashloanExecutor } from './flashloanExecutor';
import { Logger } from './utils/logger';
import { config } from './config';

class AaveFlashloanArbitrageBot {
  private detector: OpportunityDetector;
  private executor: FlashloanExecutor;
  private isRunning: boolean = false;

  private stats = {
    totalScans: 0,
    opportunitiesFound: 0,
    executed: 0,
    successful: 0,
    failed: 0,
    totalProfit: 0n
  };

  constructor() {
    this.detector = new OpportunityDetector();
    this.executor = new FlashloanExecutor();
  }

  async start(contractAddress?: string) {
    if (this.isRunning) {
      Logger.warn('Bot is already running');
      return;
    }

    Logger.info('Starting Aave Flashloan Arbitrage Bot...');
    this.printBanner();

    if (contractAddress) {
      this.executor.setContract(contractAddress);
    } else if (!config.dryRun) {
      Logger.warn('No contract address provided - running in simulation mode only');
    }

    await this.executor.checkBalance();

    // Start monitoring
    await this.detector.startMonitoring(async (opportunity) => {
      this.stats.opportunitiesFound++;
      await this.handleOpportunity(opportunity);
    });

    this.isRunning = true;

    // Print stats every 60 seconds
    setInterval(() => this.printStats(), 60000);

    Logger.success('Bot is now running and scanning for arbitrage...');
  }

  private async handleOpportunity(opportunity: any) {
    try {
      if (config.dryRun || !config.enableExecution) {
        this.stats.executed++;
        const result = await this.executor.executeArbitrage(opportunity);

        if (!result.success && result.error !== 'Dry run mode') {
          this.stats.failed++;
        }
      } else {
        this.stats.executed++;
        const result = await this.executor.executeArbitrage(opportunity);

        if (result.success) {
          this.stats.successful++;
          this.stats.totalProfit += result.profit || 0n;
          Logger.success(`PROFIT! ${result.profit} - TX: ${result.txHash}`);
        } else {
          this.stats.failed++;
          Logger.error(`Execution failed: ${result.error}`);
        }
      }
    } catch (error: any) {
      Logger.error('Error handling opportunity:', error.message);
      this.stats.failed++;
    }
  }

  private printBanner() {
    console.log('\n' + '='.repeat(70));
    console.log('        AAVE FLASHLOAN ARBITRAGE BOT - EDUCATIONAL');
    console.log('='.repeat(70));
    console.log('⚠️  FOR EDUCATIONAL USE ONLY - PRIVATE BLOCKCHAIN ONLY');
    console.log('='.repeat(70));
    console.log(`Mode: ${config.dryRun ? '📊 DRY RUN' : '🚨 LIVE EXECUTION'}`);
    console.log(`Min Profit: $${config.minProfitUsd}`);
    console.log(`Max Loan: $${config.maxLoanAmountUsd}`);
    console.log(`Aave Pool: ${config.aavePool}`);
    console.log('='.repeat(70) + '\n');
  }

  private printStats() {
    console.log('\n' + '-'.repeat(70));
    console.log('BOT STATISTICS');
    console.log('-'.repeat(70));
    console.log(`Total Scans: ${this.stats.totalScans}`);
    console.log(`Opportunities Found: ${this.stats.opportunitiesFound}`);
    console.log(`Executed: ${this.stats.executed}`);
    console.log(`Successful: ${this.stats.successful}`);
    console.log(`Failed: ${this.stats.failed}`);
    if (this.stats.totalProfit > 0n) {
      console.log(`Total Profit: ${this.stats.totalProfit}`);
    }
    if (this.stats.executed > 0) {
      const successRate = (this.stats.successful / this.stats.executed * 100).toFixed(2);
      console.log(`Success Rate: ${successRate}%`);
    }
    console.log('-'.repeat(70) + '\n');
  }

  async stop() {
    Logger.info('Stopping bot...');
    this.isRunning = false;
    this.printStats();
    Logger.success('Bot stopped');
  }
}

async function main() {
  const bot = new AaveFlashloanArbitrageBot();

  const contractAddress = process.env.FLASHLOAN_CONTRACT_ADDRESS;

  if (!contractAddress && config.enableExecution) {
    Logger.warn('No FLASHLOAN_CONTRACT_ADDRESS provided');
    Logger.warn('Deploy the contract first and set the address in .env');
  }

  await bot.start(contractAddress);

  // Graceful shutdown
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

main().catch((error) => {
  Logger.error('Fatal error:', error);
  process.exit(1);
});
