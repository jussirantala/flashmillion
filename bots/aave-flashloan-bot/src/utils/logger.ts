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

  static opportunity(opp: any) {
    console.log('\n' + '='.repeat(70));
    console.log('💰 ARBITRAGE OPPORTUNITY DETECTED');
    console.log('='.repeat(70));
    console.log(`Token: ${opp.tokenBorrowSymbol}`);
    console.log(`Amount: ${opp.amount}`);
    console.log(`Buy on: ${opp.buyDex} at price ${opp.buyPrice}`);
    console.log(`Sell on: ${opp.sellDex} at price ${opp.sellPrice}`);
    console.log(`Expected Profit: ${opp.expectedProfit}`);
    console.log(`Flashloan Fee (0.05%): ${opp.flashLoanFee}`);
    console.log(`Gas Estimate: ${opp.gasEstimate}`);
    console.log(`Net Profit: ${opp.netProfit} (${opp.profitPercentage.toFixed(2)}%)`);
    console.log('='.repeat(70) + '\n');
  }
}
