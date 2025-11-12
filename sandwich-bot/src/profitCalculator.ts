import { ethers } from 'ethers';
import { config } from './config';
import { SwapTransaction, SandwichOpportunity } from './types';
import { Logger } from './utils/logger';

const UNISWAP_V2_PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)'
];

const UNISWAP_V2_FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)'
];

export class ProfitCalculator {
  private provider: ethers.JsonRpcProvider;
  private factoryContract: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.factoryContract = new ethers.Contract(
      config.uniswapV2Factory,
      UNISWAP_V2_FACTORY_ABI,
      this.provider
    );
  }

  async calculateSandwichProfit(victimTx: SwapTransaction): Promise<SandwichOpportunity | null> {
    try {
      // Get the pair address
      const pairAddress = await this.factoryContract.getPair(
        victimTx.tokenIn,
        victimTx.tokenOut
      );

      if (pairAddress === ethers.ZeroAddress) {
        return null;
      }

      const pairContract = new ethers.Contract(pairAddress, UNISWAP_V2_PAIR_ABI, this.provider);

      // Get current reserves
      const [reserve0, reserve1] = await pairContract.getReserves();
      const token0 = await pairContract.token0();

      // Determine which reserve is which token
      const [reserveIn, reserveOut] = token0.toLowerCase() === victimTx.tokenIn.toLowerCase()
        ? [reserve0, reserve1]
        : [reserve1, reserve0];

      // Calculate optimal frontrun amount (using a percentage of victim's trade)
      // This is a simplified approach - production bots use more sophisticated calculations
      const frontrunAmount = victimTx.amountIn / 10n; // 10% of victim's trade

      // Simulate the sandwich
      const simulation = this.simulateSandwich(
        reserveIn,
        reserveOut,
        frontrunAmount,
        victimTx.amountIn
      );

      if (!simulation) {
        return null;
      }

      // Estimate gas costs (in wei)
      // Frontrun tx: ~150k gas, Backrun tx: ~150k gas
      const totalGasUnits = 300000n;
      const gasPriceToUse = victimTx.gasPrice * 12n / 10n; // 120% of victim's gas price
      const estimatedGasCost = totalGasUnits * gasPriceToUse;

      const netProfit = simulation.profit - estimatedGasCost;

      // Calculate profit percentage
      const profitPercentage = Number(netProfit * 10000n / frontrunAmount) / 100;

      // Check if profitable
      if (netProfit <= 0n) {
        return null;
      }

      return {
        victimTx,
        frontrunAmount,
        backrunAmount: simulation.backrunAmount,
        estimatedProfit: simulation.profit,
        estimatedGasCost,
        netProfit,
        profitPercentage
      };

    } catch (error) {
      Logger.error('Error calculating sandwich profit:', error);
      return null;
    }
  }

  private simulateSandwich(
    reserveIn: bigint,
    reserveOut: bigint,
    frontrunAmount: bigint,
    victimAmount: bigint
  ): { profit: bigint; backrunAmount: bigint } | null {
    try {
      // Step 1: Frontrun - we buy tokenOut
      const frontrunOutput = this.getAmountOut(frontrunAmount, reserveIn, reserveOut);

      // Update reserves after frontrun
      let newReserveIn = reserveIn + frontrunAmount;
      let newReserveOut = reserveOut - frontrunOutput;

      // Step 2: Victim transaction executes
      const victimOutput = this.getAmountOut(victimAmount, newReserveIn, newReserveOut);

      // Update reserves after victim trade
      newReserveIn = newReserveIn + victimAmount;
      newReserveOut = newReserveOut - victimOutput;

      // Step 3: Backrun - we sell the tokenOut we bought
      const backrunOutput = this.getAmountOut(frontrunOutput, newReserveOut, newReserveIn);

      // Calculate profit (in tokenIn)
      const profit = backrunOutput - frontrunAmount;

      if (profit <= 0n) {
        return null;
      }

      return {
        profit,
        backrunAmount: frontrunOutput
      };

    } catch (error) {
      return null;
    }
  }

  // Uniswap V2 constant product formula: x * y = k
  // amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
  private getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
    if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) {
      throw new Error('Invalid reserves or amount');
    }

    const amountInWithFee = amountIn * 997n;
    const numerator = amountInWithFee * reserveOut;
    const denominator = (reserveIn * 1000n) + amountInWithFee;

    return numerator / denominator;
  }

  // Check if opportunity meets minimum profit threshold
  isOpportunityViable(opportunity: SandwichOpportunity): boolean {
    // Convert to USD (simplified - in production you'd use oracle prices)
    // For now, assume 1 wei = 1 USD for demonstration
    const minProfitWei = BigInt(config.minProfitUsd) * BigInt(1e18);

    return opportunity.netProfit >= minProfitWei;
  }
}
