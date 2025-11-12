import { MempoolMonitor } from './mempoolMonitor';
import { OpportunityAnalyzer } from './opportunityAnalyzer';
import { config } from './config';

class AaveFrontrunBot {
  private monitor: MempoolMonitor;
  private analyzer: OpportunityAnalyzer;

  private stats = {
    totalDetected: 0,
    opportunities: 0,
    deposits: 0,
    borrows: 0,
    liquidations: 0
  };

  constructor() {
    this.monitor = new MempoolMonitor();
    this.analyzer = new OpportunityAnalyzer();
  }

  async start() {
    this.printBanner();
    this.printWarning();

    await this.monitor.start(async (tx) => {
      this.stats.totalDetected++;

      const opportunity = this.analyzer.analyzeTransaction(tx);

      if (opportunity) {
        this.stats.opportunities++;
        this.stats[`${opportunity.strategy}s` as keyof typeof this.stats]++;
        this.logOpportunity(opportunity);
      }
    });

    setInterval(() => this.printStats(), 60000);
  }

  private printBanner() {
    console.log('\n' + '='.repeat(70));
    console.log('         AAVE FRONT-RUNNING BOT - EDUCATIONAL RESEARCH');
    console.log('='.repeat(70));
    console.log('⚠️  FOR EDUCATIONAL AND RESEARCH PURPOSES ONLY');
    console.log('='.repeat(70) + '\n');
  }

  private printWarning() {
    console.log('⚠️  ETHICAL AND LEGAL WARNING:');
    console.log('');
    console.log('Front-running is:');
    console.log('  1. HARMFUL to other users');
    console.log('  2. Potentially ILLEGAL in many jurisdictions');
    console.log('  3. Considered MARKET MANIPULATION');
    console.log('  4. BANNED on most legitimate platforms');
    console.log('');
    console.log('This bot is for:');
    console.log('  ✅ Understanding MEV mechanics');
    console.log('  ✅ Research and education');
    console.log('  ✅ Building MEV protections');
    console.log('  ✅ Private blockchain testing only');
    console.log('');
    console.log('  ❌ NOT for production use');
    console.log('  ❌ NOT for mainnet deployment');
    console.log('  ❌ NOT for harming real users');
    console.log('');
    console.log('='.repeat(70) + '\n');
  }

  private logOpportunity(opp: any) {
    console.log('\n' + '='.repeat(70));
    console.log(`⚡ FRONT-RUN OPPORTUNITY DETECTED (${opp.strategy.toUpperCase()})`);
    console.log('='.repeat(70));
    console.log(`Victim TX: ${opp.victimTx.hash}`);
    console.log(`Operation: ${opp.victimTx.operation}`);
    console.log(`Value: ${opp.victimTx.value}`);
    console.log(`Strategy: ${opp.description}`);
    console.log(`Expected Profit: ${opp.expectedProfit}`);
    console.log(`Gas Required: ${opp.gasRequired}`);
    console.log(`Risk Level: ${opp.riskLevel}`);
    console.log('');
    console.log('📊 EDUCATIONAL ANALYSIS:');
    console.log(`  How it works: ${this.explainStrategy(opp.strategy)}`);
    console.log(`  Why it\'s harmful: ${this.explainHarm(opp.strategy)}`);
    console.log('');
    console.log('🛡️  How to PROTECT against this:');
    console.log(this.explainProtection(opp.strategy));
    console.log('='.repeat(70) + '\n');
  }

  private explainStrategy(strategy: string): string {
    switch (strategy) {
      case 'deposit':
        return 'Submit deposit before victim to manipulate interest rates';
      case 'borrow':
        return 'Borrow liquidity before victim, forcing higher rates';
      case 'liquidation':
        return 'Execute liquidation before victim to capture bonus';
      default:
        return 'Unknown strategy';
    }
  }

  private explainHarm(strategy: string): string {
    switch (strategy) {
      case 'deposit':
        return 'Victim receives worse interest rate position';
      case 'borrow':
        return 'Victim pays higher interest or cannot borrow';
      case 'liquidation':
        return 'Victim loses liquidation bonus opportunity';
      default:
        return 'Unknown harm';
    }
  }

  private explainProtection(strategy: string): string {
    const protections = {
      deposit: '  - Use Flashbots Protect for private transactions\n  - Use limit orders with slippage protection\n  - Monitor for unusual gas price spikes',
      borrow: '  - Submit through private RPC (Flashbots, Eden)\n  - Use Aave\'s gas-less transactions (if available)\n  - Set reasonable slippage tolerance',
      liquidation: '  - Use MEV-Blocker or Flashbots RPC\n  - Submit liquidations via private relay\n  - Use bundled transactions'
    };
    return protections[strategy as keyof typeof protections] || 'Unknown protection';
  }

  private printStats() {
    console.log('\n' + '-'.repeat(70));
    console.log('BOT STATISTICS (EDUCATIONAL)');
    console.log('-'.repeat(70));
    console.log(`Total Aave TXs Detected: ${this.stats.totalDetected}`);
    console.log(`Front-run Opportunities: ${this.stats.opportunities}`);
    console.log(`  - Deposits: ${this.stats.deposits}`);
    console.log(`  - Borrows: ${this.stats.borrows}`);
    console.log(`  - Liquidations: ${this.stats.liquidations}`);
    console.log('');
    console.log('⚠️  Remember: This bot does NOT execute front-running');
    console.log('    It only detects and analyzes for educational purposes');
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
  const bot = new AaveFrontrunBot();
  await bot.start();

  process.on('SIGINT', async () => {
    await bot.stop();
    process.exit(0);
  });
}

main().catch(console.error);
