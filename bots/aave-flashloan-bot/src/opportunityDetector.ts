import { PriceScanner } from './priceScanner';
import { ArbitrageOpportunity, TokenPair } from './types';
import { config } from './config';
import { Logger } from './utils/logger';
import { ethers } from 'ethers';

export class OpportunityDetector {
  private scanner: PriceScanner;

  // Common trading pairs to monitor
  private readonly TRADING_PAIRS: TokenPair[] = [
    {
      token0: config.tokens.WETH,
      token1: config.tokens.USDC,
      token0Symbol: 'WETH',
      token1Symbol: 'USDC'
    },
    {
      token0: config.tokens.WETH,
      token1: config.tokens.DAI,
      token0Symbol: 'WETH',
      token1Symbol: 'DAI'
    },
    {
      token0: config.tokens.USDC,
      token1: config.tokens.DAI,
      token0Symbol: 'USDC',
      token1Symbol: 'DAI'
    },
    {
      token0: config.tokens.USDC,
      token1: config.tokens.USDT,
      token0Symbol: 'USDC',
      token1Symbol: 'USDT'
    },
  ];

  constructor() {
    this.scanner = new PriceScanner();
  }

  async detectOpportunities(): Promise<ArbitrageOpportunity[]> {
    Logger.info('Scanning for arbitrage opportunities...');
    const opportunities: ArbitrageOpportunity[] = [];

    // Test with different amounts
    const testAmounts = [
      ethers.parseEther('1'),    // 1 ETH or token
      ethers.parseEther('10'),   // 10 tokens
      ethers.parseEther('100'),  // 100 tokens
    ];

    for (const pair of this.TRADING_PAIRS) {
      for (const amount of testAmounts) {
        try {
          const opportunity = await this.checkPairArbitrage(pair, amount);
          if (opportunity) {
            opportunities.push(opportunity);
          }
        } catch (error) {
          // Continue with other pairs
        }
      }
    }

    return opportunities;
  }

  private async checkPairArbitrage(
    pair: TokenPair,
    amount: bigint
  ): Promise<ArbitrageOpportunity | null> {
    // Get prices on all DEXs
    const prices = await this.scanner.getPrices(pair.token0, pair.token1, amount);

    // Find best buy and sell venues
    const { bestBuy, bestSell } = this.scanner.findBestPrices(prices);

    // Must be different DEXs
    if (bestBuy.dex === bestSell.dex) {
      return null;
    }

    // Calculate expected profit
    const expectedProfit = bestBuy.price - amount;

    // Calculate Aave flashloan fee (0.05%)
    const flashLoanFee = (amount * 5n) / 10000n;

    // Estimate gas costs (simplified)
    const gasEstimate = ethers.parseEther('0.01'); // ~0.01 ETH gas

    // Calculate net profit
    const netProfit = expectedProfit - flashLoanFee - gasEstimate;

    // Calculate profit percentage
    const profitPercentage = Number(netProfit * 10000n / amount) / 100;

    // Check if profitable
    if (netProfit <= 0n) {
      return null;
    }

    // Check minimum profit threshold
    const minProfitWei = ethers.parseEther(config.minProfitUsd.toString()) / 1000n; // Simplified
    if (netProfit < minProfitWei) {
      return null;
    }

    return {
      tokenBorrow: pair.token0,
      tokenBorrowSymbol: pair.token0Symbol,
      amount,
      buyDex: bestBuy.dex,
      sellDex: bestSell.dex,
      buyPrice: bestBuy.price,
      sellPrice: bestSell.price,
      expectedProfit,
      flashLoanFee,
      gasEstimate,
      netProfit,
      profitPercentage
    };
  }

  /**
   * Continuously monitor for opportunities
   */
  async startMonitoring(callback: (opportunity: ArbitrageOpportunity) => void) {
    Logger.info('Starting continuous monitoring...');

    const scan = async () => {
      try {
        const opportunities = await this.detectOpportunities();

        for (const opp of opportunities) {
          Logger.opportunity(opp);
          callback(opp);
        }

        if (opportunities.length === 0) {
          Logger.info('No profitable opportunities found this scan');
        }
      } catch (error) {
        Logger.error('Error during scan:', error);
      }
    };

    // Initial scan
    await scan();

    // Scan every 30 seconds
    setInterval(scan, 30000);
  }
}
