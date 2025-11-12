import { ethers } from 'ethers';
import { config } from './config';
import { DexPrices, TokenPair } from './types';
import { Logger } from './utils/logger';

const UNISWAP_V2_ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
];

export class PriceScanner {
  private provider: ethers.JsonRpcProvider;
  private uniswapV2Router: ethers.Contract;
  private sushiswapRouter: ethers.Contract;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.uniswapV2Router = new ethers.Contract(
      config.uniswapV2Router,
      UNISWAP_V2_ROUTER_ABI,
      this.provider
    );
    this.sushiswapRouter = new ethers.Contract(
      config.sushiswapRouter,
      UNISWAP_V2_ROUTER_ABI,
      this.provider
    );
  }

  /**
   * Get prices across all DEXs for a token pair
   */
  async getPrices(tokenIn: string, tokenOut: string, amountIn: bigint): Promise<DexPrices> {
    const path = [tokenIn, tokenOut];

    try {
      const [uniV2Price, sushiPrice] = await Promise.all([
        this.getUniswapV2Price(path, amountIn),
        this.getSushiswapPrice(path, amountIn),
      ]);

      return {
        uniswapV2: uniV2Price,
        sushiswap: sushiPrice,
        uniswapV3: 0n, // Simplified - would need V3 quoter
      };
    } catch (error) {
      Logger.error('Error fetching prices:', error);
      throw error;
    }
  }

  private async getUniswapV2Price(path: string[], amountIn: bigint): Promise<bigint> {
    try {
      const amounts = await this.uniswapV2Router.getAmountsOut(amountIn, path);
      return amounts[amounts.length - 1];
    } catch {
      return 0n;
    }
  }

  private async getSushiswapPrice(path: string[], amountIn: bigint): Promise<bigint> {
    try {
      const amounts = await this.sushiswapRouter.getAmountsOut(amountIn, path);
      return amounts[amounts.length - 1];
    } catch {
      return 0n;
    }
  }

  /**
   * Find best buy and sell prices
   */
  findBestPrices(prices: DexPrices): {
    bestBuy: { dex: 'uniswapV2' | 'sushiswap' | 'uniswapV3', price: bigint },
    bestSell: { dex: 'uniswapV2' | 'sushiswap' | 'uniswapV3', price: bigint }
  } {
    const dexes: Array<{ name: 'uniswapV2' | 'sushiswap' | 'uniswapV3', price: bigint }> = [
      { name: 'uniswapV2', price: prices.uniswapV2 },
      { name: 'sushiswap', price: prices.sushiswap },
      { name: 'uniswapV3', price: prices.uniswapV3 },
    ];

    // Filter out zero prices
    const validDexes = dexes.filter(d => d.price > 0n);

    if (validDexes.length < 2) {
      throw new Error('Not enough valid DEX prices');
    }

    // Best buy = highest output (most tokens received)
    const bestBuy = validDexes.reduce((max, curr) => curr.price > max.price ? curr : max);

    // Best sell = also highest output when selling back
    const bestSell = validDexes.reduce((max, curr) =>
      curr.price > max.price && curr.name !== bestBuy.name ? curr : max
    );

    return {
      bestBuy: { dex: bestBuy.name, price: bestBuy.price },
      bestSell: { dex: bestSell.name, price: bestSell.price }
    };
  }

  /**
   * Scan for arbitrage opportunities across multiple token pairs
   */
  async scanForOpportunities(pairs: TokenPair[], testAmount: bigint) {
    const opportunities = [];

    for (const pair of pairs) {
      try {
        const prices = await this.getPrices(pair.token0, pair.token1, testAmount);
        const { bestBuy, bestSell } = this.findBestPrices(prices);

        // Calculate potential profit
        const priceDiff = bestBuy.price - bestSell.price;
        const profitPercentage = Number(priceDiff * 10000n / bestSell.price) / 100;

        if (profitPercentage > 0.5) { // More than 0.5% difference
          opportunities.push({
            pair,
            buyDex: bestBuy.dex,
            sellDex: bestSell.dex,
            buyPrice: bestBuy.price,
            sellPrice: bestSell.price,
            profitPercentage
          });
        }
      } catch (error) {
        // Skip pairs with errors
      }
    }

    return opportunities;
  }
}
