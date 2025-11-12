import { AaveEvent, BackrunOpportunity } from './types';
import { ethers } from 'ethers';
import { config } from './config';

export class OpportunityDetector {
  /**
   * Analyze Aave events for back-running opportunities
   */
  async analyzeEvent(event: AaveEvent): Promise<BackrunOpportunity | null> {
    switch (event.operation) {
      case 'borrow':
        return await this.analyzeBorrowEvent(event);
      case 'liquidation':
        return await this.analyzeLiquidationEvent(event);
      case 'repay':
        return await this.analyzeRepayEvent(event);
      default:
        return null;
    }
  }

  /**
   * Back-running borrows:
   * - Large borrow changes utilization rate
   * - Interest rates increase
   * - Arbitrage opportunity may appear
   */
  private async analyzeBorrowEvent(event: AaveEvent): Promise<BackrunOpportunity | null> {
    const estimatedProfit = event.amount / 500n; // 0.2% theoretical
    const gasEstimate = ethers.parseEther('0.01');
    const netProfit = estimatedProfit - gasEstimate;

    if (netProfit <= 0n) return null;

    return {
      triggerEvent: event,
      strategy: 'rate-arbitrage',
      expectedProfit: estimatedProfit,
      gasEstimate,
      netProfit,
      description: 'Arbitrage interest rate changes after large borrow',
      steps: [
        '1. Large borrow detected, utilization rate increases',
        '2. Interest rates adjust upward',
        '3. Supply to capture higher APY',
        '4. Profit from rate differential'
      ]
    };
  }

  /**
   * Back-running liquidations:
   * - After liquidation, collateral is swapped
   * - Price impact creates arbitrage opportunity
   * - Multiple liquidations can cascade
   */
  private async analyzeLiquidationEvent(event: AaveEvent): Promise<BackrunOpportunity | null> {
    const liquidationBonus = event.amount * 5n / 100n; // 5% bonus
    const estimatedProfit = liquidationBonus / 2n; // Arbitrage half the bonus
    const gasEstimate = ethers.parseEther('0.015');
    const netProfit = estimatedProfit - gasEstimate;

    if (netProfit <= 0n) return null;

    return {
      triggerEvent: event,
      strategy: 'liquidation-cascade',
      expectedProfit: estimatedProfit,
      gasEstimate,
      netProfit,
      description: 'Arbitrage price impact from liquidation',
      steps: [
        '1. Liquidation executes, collateral swapped',
        '2. Price impact creates temporary imbalance',
        '3. Arbitrage the price difference across DEXs',
        '4. Profit from price correction'
      ]
    };
  }

  /**
   * Back-running repayments:
   * - Large repayment reduces utilization
   * - Interest rates decrease
   * - Borrow at lower rate for arbitrage
   */
  private async analyzeRepayEvent(event: AaveEvent): Promise<BackrunOpportunity | null> {
    const estimatedProfit = event.amount / 1000n; // 0.1% theoretical
    const gasEstimate = ethers.parseEther('0.01');
    const netProfit = estimatedProfit - gasEstimate;

    if (netProfit <= 0n) return null;

    return {
      triggerEvent: event,
      strategy: 'rate-arbitrage',
      expectedProfit: estimatedProfit,
      gasEstimate,
      netProfit,
      description: 'Borrow at reduced rate after large repayment',
      steps: [
        '1. Large repayment detected, utilization decreases',
        '2. Interest rates adjust downward',
        '3. Borrow at new lower rate',
        '4. Arbitrage rate differential with other protocols'
      ]
    };
  }

  /**
   * Check if opportunity meets minimum profit threshold
   */
  isViable(opportunity: BackrunOpportunity): boolean {
    const minProfitWei = ethers.parseEther(config.minProfitUsd.toString()) / 1000n;
    return opportunity.netProfit >= minProfitWei;
  }
}
