export class Logger {
  static info(message: string, ...args: any[]) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
  }

  static warn(message: string, ...args: any[]) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
  }

  static error(message: string, ...args: any[]) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
  }

  static success(message: string, ...args: any[]) {
    console.log(`[SUCCESS] ${new Date().toISOString()} - ${message}`, ...args);
  }

  static opportunity(opportunity: any) {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 SANDWICH OPPORTUNITY DETECTED');
    console.log('='.repeat(60));
    console.log(`Victim TX: ${opportunity.victimTx.hash}`);
    console.log(`Token Pair: ${opportunity.victimTx.tokenIn} -> ${opportunity.victimTx.tokenOut}`);
    console.log(`Victim Amount: ${opportunity.victimTx.amountIn}`);
    console.log(`Frontrun Amount: ${opportunity.frontrunAmount}`);
    console.log(`Estimated Profit: ${opportunity.netProfit} (${opportunity.profitPercentage.toFixed(2)}%)`);
    console.log(`Gas Cost: ${opportunity.estimatedGasCost}`);
    console.log('='.repeat(60) + '\n');
  }
}
