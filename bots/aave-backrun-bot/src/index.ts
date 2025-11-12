import { EventMonitor } from './eventMonitor';
import { OpportunityDetector } from './opportunityDetector';
import { config } from './config';

class AaveBackrunBot {
  private monitor: EventMonitor;
  private detector: OpportunityDetector;

  private stats = {
    totalEvents: 0,
    opportunities: 0,
    byStrategy: {
      arbitrage: 0,
      'liquidation-cascade': 0,
      'rate-arbitrage': 0
    }
  };

  constructor() {
    this.monitor = new EventMonitor();
    this.detector = new OpportunityDetector();
  }

  async start() {
    this.printBanner();

    await this.monitor.start(async (event) => {
      this.stats.totalEvents++;

      const opportunity = await this.detector.analyzeEvent(event);

      if (opportunity && this.detector.isViable(opportunity)) {
        this.stats.opportunities++;
        this.stats.byStrategy[opportunity.strategy]++;
        this.logOpportunity(opportunity);
      }
    });

    setInterval(() => this.printStats(), 60000);
  }

  private printBanner() {
    console.log('\n' + '='.repeat(70));
    console.log('         AAVE BACK-RUNNING BOT - EDUCATIONAL');
    console.log('='.repeat(70));
    console.log('⚠️  FOR EDUCATIONAL USE ONLY - PRIVATE BLOCKCHAIN ONLY');
    console.log('='.repeat(70));
    console.log('');
    console.log('What is Back-Running?');
    console.log('  Back-running executes transactions AFTER other transactions');
    console.log('  to capture opportunities created by state changes.');
    console.log('');
    console.log('Why is it different from Front-Running?');
    console.log('  ✅ Less harmful - doesn\'t directly harm users');
    console.log('  ✅ Often improves market efficiency');
    console.log('  ✅ Can provide liquidity and price corrections');
    console.log('  ⚠️  But still extracts value from the system');
    console.log('');
    console.log('Common Back-Running Strategies:');
    console.log('  1. Arbitrage after large trades (price normalization)');
    console.log('  2. Liquidation cascades (market efficiency)');
    console.log('  3. Interest rate arbitrage (cross-protocol)');
    console.log('');
    console.log('='.repeat(70) + '\n');
  }

  private logOpportunity(opp: any) {
    console.log('\n' + '='.repeat(70));
    console.log(`⚡ BACK-RUN OPPORTUNITY (${opp.strategy.toUpperCase()})`);
    console.log('='.repeat(70));
    console.log(`Trigger: ${opp.triggerEvent.operation} on ${opp.triggerEvent.asset.substring(0, 10)}...`);
    console.log(`Amount: ${opp.triggerEvent.amount}`);
    console.log(`Block: ${opp.triggerEvent.blockNumber}`);
    console.log(`TX: ${opp.triggerEvent.txHash}`);
    console.log('');
    console.log(`Strategy: ${opp.description}`);
    console.log(`Expected Profit: ${opp.expectedProfit}`);
    console.log(`Gas Estimate: ${opp.gasEstimate}`);
    console.log(`Net Profit: ${opp.netProfit}`);
    console.log('');
    console.log('📋 Execution Steps:');
    opp.steps.forEach((step: string) => console.log(`  ${step}`));
    console.log('');
    console.log('📚 Educational Notes:');
    console.log(this.getEducationalNotes(opp.strategy));
    console.log('='.repeat(70) + '\n');
  }

  private getEducationalNotes(strategy: string): string {
    const notes = {
      'arbitrage': '  - Back-running arbitrage helps normalize prices\n  - Provides market efficiency\n  - Less controversial than front-running\n  - Still extracts value from price impacts',
      'liquidation-cascade': '  - Liquidations create temporary price imbalances\n  - Back-running arbitrage corrects these\n  - Can trigger additional liquidations (cascades)\n  - Important for protocol health',
      'rate-arbitrage': '  - Interest rates fluctuate with utilization\n  - Back-running captures rate differentials\n  - Helps balance liquidity across protocols\n  - Generally considered acceptable MEV'
    };
    return notes[strategy as keyof typeof notes] || '  - Unknown strategy';
  }

  private printStats() {
    console.log('\n' + '-'.repeat(70));
    console.log('BOT STATISTICS');
    console.log('-'.repeat(70));
    console.log(`Total Events Monitored: ${this.stats.totalEvents}`);
    console.log(`Back-run Opportunities: ${this.stats.opportunities}`);
    console.log(`  - Arbitrage: ${this.stats.byStrategy.arbitrage}`);
    console.log(`  - Liquidation Cascade: ${this.stats.byStrategy['liquidation-cascade']}`);
    console.log(`  - Rate Arbitrage: ${this.stats.byStrategy['rate-arbitrage']}`);
    console.log('');
    console.log('Note: This bot only detects opportunities, does not execute');
    console.log('-'.repeat(70) + '\n');
  }

  async stop() {
    console.log('[INFO] Stopping bot...');
    await this.monitor.stop();
    this.printStats();
    console.log('[SUCCESS] Bot stopped');
  }
}

async function main() {
  const bot = new AaveBackrunBot();
  await bot.start();

  process.on('SIGINT', async () => {
    await bot.stop();
    process.exit(0);
  });
}

main().catch(console.error);
