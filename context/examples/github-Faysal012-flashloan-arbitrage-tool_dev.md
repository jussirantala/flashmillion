**Source:** https://github.com/Faysal012/flashloan-arbitrage-tool
**Date:** 2024-2025


# flashloan-arbitrage-tool - Technical Implementation

## Architecture Deep Dive

### System Architecture Overview

The flashloan-arbitrage-tool follows a service-oriented architecture with clear separation between detection, execution, and monitoring concerns:

```
┌─────────────────────────────────────────────────┐
│           Arbitrage Bot Main Process            │
└───────────┬─────────────────────────┬───────────┘
            │                         │
    ┌───────▼────────┐       ┌────────▼──────────┐
    │  Price Monitor │       │  Event Listener   │
    │    Service     │       │     Service       │
    └───────┬────────┘       └────────┬──────────┘
            │                         │
    ┌───────▼──────────────────────────▼───────┐
    │       Arbitrage Detection Service        │
    └──────────────────┬───────────────────────┘
                       │
            ┌──────────▼──────────┐
            │  Profit Calculator  │
            └──────────┬──────────┘
                       │
            ┌──────────▼──────────┐
            │  Execution Engine   │
            └──────────┬──────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐  ┌──────▼──────┐  ┌───▼────┐
   │ Flash   │  │  Transaction│  │  Gas   │
   │ Loan    │  │   Manager   │  │ Oracle │
   │ Service │  │             │  │        │
   └─────────┘  └─────────────┘  └────────┘
```

### Core Module Architecture

The system is built around several key modules:

**Price Monitor Module**: Continuously fetches prices from multiple DEXs using concurrent async operations.

**Arbitrage Detector Module**: Analyzes price data to identify profitable opportunities based on configured thresholds.

**Profit Calculator Module**: Computes expected profits accounting for all fees (flash loan, DEX, gas) and slippage.

**Execution Engine**: Orchestrates flash loan requests and trade execution in atomic transactions.

**Transaction Manager**: Handles transaction building, signing, broadcasting, and monitoring.

### Event-Driven Architecture

The system uses Node.js EventEmitter for loose coupling:

```javascript
// src/index.js
const EventEmitter = require('events');

class FlashLoanArbitrageBot extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.running = false;

    // Initialize services
    this.priceMonitor = new PriceMonitor(config);
    this.detector = new ArbitrageDetector(config);
    this.executor = new ArbitrageExecutor(config);

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Price update events
    this.priceMonitor.on('priceUpdate', async (priceData) => {
      try {
        const opportunities = await this.detector.analyze(priceData);

        for (const opportunity of opportunities) {
          this.emit('opportunity', opportunity);

          if (this.config.autoExecute && opportunity.profitable) {
            await this.executeOpportunity(opportunity);
          }
        }
      } catch (error) {
        this.emit('error', error);
      }
    });

    // Execution events
    this.executor.on('executionStart', (txHash) => {
      this.emit('executionStart', txHash);
    });

    this.executor.on('executionComplete', (result) => {
      this.emit('execution', result);
    });

    this.executor.on('executionFailed', (error) => {
      this.emit('executionFailed', error);
    });
  }

  async start() {
    if (this.running) {
      throw new Error('Bot is already running');
    }

    this.running = true;
    this.emit('started');

    await this.priceMonitor.start();
  }

  async stop() {
    this.running = false;
    await this.priceMonitor.stop();
    this.emit('stopped');
  }

  async executeOpportunity(opportunity) {
    try {
      const result = await this.executor.execute(opportunity);
      return result;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }
}

module.exports = FlashLoanArbitrageBot;
```

## Code Analysis

### Price Monitoring Service

Efficient concurrent price fetching from multiple sources:

```javascript
// src/services/monitoring/priceMonitor.js
const EventEmitter = require('events');
const logger = require('../monitoring/logger');

class PriceMonitor extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.interval = null;
    this.dexAdapters = this.initializeDexAdapters();
    this.priceCache = new Map();
  }

  initializeDexAdapters() {
    const UniswapAdapter = require('../dex/uniswapAdapter');
    const SushiSwapAdapter = require('../dex/sushiswapAdapter');
    const CurveAdapter = require('../dex/curveAdapter');

    return {
      uniswap: new UniswapAdapter(this.config),
      sushiswap: new SushiSwapAdapter(this.config),
      curve: new CurveAdapter(this.config)
    };
  }

  async start() {
    logger.info('Starting price monitor');

    // Initial fetch
    await this.fetchPrices();

    // Set up interval
    this.interval = setInterval(
      () => this.fetchPrices(),
      this.config.checkInterval
    );
  }

  async stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    logger.info('Price monitor stopped');
  }

  async fetchPrices() {
    const pairs = this.config.tradingPairs;
    const dexs = this.config.monitoredDexs;

    try {
      // Fetch prices from all DEXs concurrently
      const pricePromises = [];

      for (const pair of pairs) {
        for (const dexName of dexs) {
          const adapter = this.dexAdapters[dexName];
          if (adapter) {
            pricePromises.push(
              this.fetchPriceWithRetry(adapter, pair, dexName)
            );
          }
        }
      }

      const results = await Promise.allSettled(pricePromises);

      // Process results
      const prices = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);

      // Update cache
      this.updateCache(prices);

      // Emit price update event
      this.emit('priceUpdate', {
        timestamp: Date.now(),
        prices: this.priceCache
      });

    } catch (error) {
      logger.error('Error fetching prices:', error);
      this.emit('error', error);
    }
  }

  async fetchPriceWithRetry(adapter, pair, dexName, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const price = await adapter.getPrice(pair);
        return {
          pair,
          dex: dexName,
          price: price.price,
          liquidity: price.liquidity,
          timestamp: Date.now()
        };
      } catch (error) {
        if (i === retries - 1) throw error;
        await this.delay(1000 * (i + 1));
      }
    }
  }

  updateCache(prices) {
    for (const priceData of prices) {
      const key = `${priceData.pair}:${priceData.dex}`;
      this.priceCache.set(key, priceData);
    }
  }

  getPrice(pair, dex) {
    const key = `${pair}:${dex}`;
    return this.priceCache.get(key);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = PriceMonitor;
```

### Arbitrage Detection Engine

Sophisticated opportunity detection with profit calculation:

```javascript
// src/services/arbitrage/detector.js
const BigNumber = require('bignumber.js');
const logger = require('../monitoring/logger');
const Calculator = require('./calculator');

class ArbitrageDetector {
  constructor(config) {
    this.config = config;
    this.calculator = new Calculator(config);
    this.minProfitThreshold = new BigNumber(config.minProfitThreshold);
  }

  async analyze(priceData) {
    const opportunities = [];
    const { prices } = priceData;

    // Group prices by trading pair
    const pairGroups = this.groupByPair(prices);

    for (const [pair, pairPrices] of pairGroups) {
      // Find price discrepancies
      const opportunity = await this.findBestOpportunity(pair, pairPrices);

      if (opportunity && opportunity.profitable) {
        opportunities.push(opportunity);
      }
    }

    // Sort by expected profit
    return opportunities.sort((a, b) =>
      b.expectedProfit.minus(a.expectedProfit).toNumber()
    );
  }

  groupByPair(priceMap) {
    const groups = new Map();

    for (const [key, priceData] of priceMap) {
      const pair = priceData.pair;
      if (!groups.has(pair)) {
        groups.set(pair, []);
      }
      groups.get(pair).push(priceData);
    }

    return groups;
  }

  async findBestOpportunity(pair, prices) {
    if (prices.length < 2) return null;

    // Find min and max prices
    let minPrice = prices[0];
    let maxPrice = prices[0];

    for (const price of prices) {
      if (new BigNumber(price.price).lt(minPrice.price)) {
        minPrice = price;
      }
      if (new BigNumber(price.price).gt(maxPrice.price)) {
        maxPrice = price;
      }
    }

    // Calculate spread
    const spread = new BigNumber(maxPrice.price)
      .minus(minPrice.price)
      .div(minPrice.price);

    // Check if spread exceeds minimum threshold
    if (spread.lt(this.config.minSpreadThreshold)) {
      return null;
    }

    // Calculate optimal trade amount
    const optimalAmount = await this.calculateOptimalAmount(
      pair,
      minPrice,
      maxPrice
    );

    // Calculate expected profit
    const profitAnalysis = await this.calculator.calculateProfit({
      pair,
      buyDex: minPrice.dex,
      sellDex: maxPrice.dex,
      buyPrice: minPrice.price,
      sellPrice: maxPrice.price,
      amount: optimalAmount,
      buyLiquidity: minPrice.liquidity,
      sellLiquidity: maxPrice.liquidity
    });

    return {
      id: this.generateId(),
      pair,
      buyDex: minPrice.dex,
      sellDex: maxPrice.dex,
      buyPrice: new BigNumber(minPrice.price),
      sellPrice: new BigNumber(maxPrice.price),
      spread,
      amount: optimalAmount,
      expectedProfit: profitAnalysis.netProfit,
      gasEstimate: profitAnalysis.gasCost,
      flashLoanFee: profitAnalysis.flashLoanFee,
      dexFees: profitAnalysis.dexFees,
      profitable: profitAnalysis.netProfit.gte(this.minProfitThreshold),
      timestamp: Date.now()
    };
  }

  async calculateOptimalAmount(pair, minPrice, maxPrice) {
    // Get available liquidity
    const minLiquidity = new BigNumber(minPrice.liquidity);
    const maxLiquidity = new BigNumber(maxPrice.liquidity);

    // Maximum amount is limited by smaller liquidity
    const maxAmount = BigNumber.min(
      minLiquidity.times(this.config.maxLiquidityUsagePercent).div(100),
      maxLiquidity.times(this.config.maxLiquidityUsagePercent).div(100)
    );

    // Binary search for optimal amount
    let low = maxAmount.div(100); // Start at 1% of max
    let high = maxAmount;
    let optimalAmount = low;
    let maxProfit = new BigNumber(0);

    while (high.minus(low).gt(this.config.amountPrecision || 1e15)) {
      const mid = low.plus(high).div(2);

      const profit = await this.estimateProfit(
        pair,
        minPrice,
        maxPrice,
        mid
      );

      if (profit.gt(maxProfit)) {
        maxProfit = profit;
        optimalAmount = mid;
        low = mid;
      } else {
        high = mid;
      }
    }

    return optimalAmount;
  }

  async estimateProfit(pair, minPrice, maxPrice, amount) {
    const profitAnalysis = await this.calculator.calculateProfit({
      pair,
      buyDex: minPrice.dex,
      sellDex: maxPrice.dex,
      buyPrice: minPrice.price,
      sellPrice: maxPrice.price,
      amount,
      buyLiquidity: minPrice.liquidity,
      sellLiquidity: maxPrice.liquidity
    });

    return profitAnalysis.netProfit;
  }

  generateId() {
    return `opp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = ArbitrageDetector;
```

### Profit Calculator

Comprehensive profit calculation including all fees:

```javascript
// src/services/arbitrage/calculator.js
const BigNumber = require('bignumber.js');
const { ethers } = require('ethers');

class Calculator {
  constructor(config) {
    this.config = config;
    this.gasOracle = require('../blockchain/gasOracle')(config);
  }

  async calculateProfit(params) {
    const {
      pair,
      buyDex,
      sellDex,
      buyPrice,
      sellPrice,
      amount,
      buyLiquidity,
      sellLiquidity
    } = params;

    // Calculate amounts with slippage
    const buyAmountWithSlippage = this.calculateSlippage(
      amount,
      buyPrice,
      buyLiquidity,
      'buy'
    );

    const sellAmountWithSlippage = this.calculateSlippage(
      buyAmountWithSlippage,
      sellPrice,
      sellLiquidity,
      'sell'
    );

    // Calculate fees
    const flashLoanFee = amount.times(this.config.flashLoanFeePercent || 0.0009);

    const buyDexFee = amount.times(this.config.dexFeePercent || 0.003);
    const sellDexFee = sellAmountWithSlippage.times(this.config.dexFeePercent || 0.003);
    const totalDexFees = buyDexFee.plus(sellDexFee);

    // Estimate gas cost
    const gasCost = await this.estimateGasCost();

    // Calculate gross profit
    const grossProfit = sellAmountWithSlippage.minus(amount);

    // Calculate net profit
    const netProfit = grossProfit
      .minus(flashLoanFee)
      .minus(totalDexFees)
      .minus(gasCost);

    return {
      amount,
      buyAmountWithSlippage,
      sellAmountWithSlippage,
      flashLoanFee,
      dexFees: totalDexFees,
      gasCost,
      grossProfit,
      netProfit,
      profitPercentage: netProfit.div(amount).times(100)
    };
  }

  calculateSlippage(amount, price, liquidity, direction) {
    // Simple constant product formula approximation
    // For more accuracy, would need to query actual pool reserves

    const liquidityBN = new BigNumber(liquidity);
    const amountBN = new BigNumber(amount);
    const priceBN = new BigNumber(price);

    // Price impact approximation
    const priceImpact = amountBN.div(liquidityBN);

    let effectivePrice;
    if (direction === 'buy') {
      effectivePrice = priceBN.times(new BigNumber(1).plus(priceImpact));
    } else {
      effectivePrice = priceBN.times(new BigNumber(1).minus(priceImpact));
    }

    return amountBN.times(effectivePrice);
  }

  async estimateGasCost() {
    // Estimate gas for flash loan + 2 swaps
    const gasUnits = new BigNumber(
      this.config.estimatedGasUnits || 500000
    );

    const gasPrice = await this.gasOracle.getGasPrice();
    const gasPriceBN = new BigNumber(gasPrice.toString());

    // Gas cost in wei
    const gasCostWei = gasUnits.times(gasPriceBN);

    // Convert to token units if needed
    return gasCostWei;
  }

  calculateMinimumProfit(amount) {
    // Minimum profit should cover at least 2x gas cost
    const baseCost = amount.times(0.0009); // Flash loan fee
    const bufferMultiplier = 2;

    return baseCost.times(bufferMultiplier);
  }
}

module.exports = Calculator;
```

### Flash Loan Execution Service

Handles flash loan requests and trade execution:

```javascript
// src/services/flashloan/flashLoanService.js
const { ethers } = require('ethers');
const logger = require('../monitoring/logger');

class FlashLoanService {
  constructor(config) {
    this.config = config;
    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);

    // Initialize flash loan provider
    this.initializeProvider();
  }

  initializeProvider() {
    const provider = this.config.flashLoanProvider.toLowerCase();

    switch(provider) {
      case 'aave':
        const AaveProvider = require('./aaveProvider');
        this.provider = new AaveProvider(this.config, this.wallet);
        break;
      case 'dydx':
        const DydxProvider = require('./dydxProvider');
        this.provider = new DydxProvider(this.config, this.wallet);
        break;
      default:
        throw new Error(`Unsupported flash loan provider: ${provider}`);
    }
  }

  async executeFlashLoan(opportunity) {
    logger.info(`Executing flash loan for opportunity ${opportunity.id}`);

    try {
      // Validate opportunity is still profitable
      await this.validateOpportunity(opportunity);

      // Build transaction parameters
      const params = this.buildFlashLoanParams(opportunity);

      // Execute flash loan
      const tx = await this.provider.requestFlashLoan(params);

      logger.info(`Flash loan transaction submitted: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait(this.config.confirmationBlocks || 2);

      if (receipt.status === 0) {
        throw new Error('Transaction failed');
      }

      logger.info(`Flash loan executed successfully. Gas used: ${receipt.gasUsed.toString()}`);

      // Parse profit from logs
      const profit = this.parseProfit(receipt);

      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        profit: profit.toString(),
        opportunity
      };

    } catch (error) {
      logger.error(`Flash loan execution failed: ${error.message}`);
      throw error;
    }
  }

  async validateOpportunity(opportunity) {
    // Re-check that opportunity is still valid
    // Prices may have changed since detection

    const currentGasPrice = await this.provider.getGasPrice();
    const maxGasPrice = ethers.utils.parseUnits(
      this.config.maxGasPrice.toString(),
      'gwei'
    );

    if (currentGasPrice.gt(maxGasPrice)) {
      throw new Error('Gas price too high');
    }

    // Additional validation checks...
  }

  buildFlashLoanParams(opportunity) {
    const [tokenIn, tokenOut] = opportunity.pair.split('/');

    return {
      asset: this.config.tokenAddresses[tokenIn],
      amount: opportunity.amount.toFixed(0),
      mode: 0, // No debt
      params: this.encodeArbitrageParams(opportunity)
    };
  }

  encodeArbitrageParams(opportunity) {
    // Encode the arbitrage trade parameters
    const abiCoder = new ethers.utils.AbiCoder();

    return abiCoder.encode(
      ['address', 'address', 'uint256', 'uint256'],
      [
        this.config.dexAddresses[opportunity.buyDex],
        this.config.dexAddresses[opportunity.sellDex],
        opportunity.amount.toFixed(0),
        opportunity.expectedProfit.times(0.95).toFixed(0) // 5% slippage tolerance
      ]
    );
  }

  parseProfit(receipt) {
    // Parse profit from transaction logs
    // This would depend on your smart contract implementation

    for (const log of receipt.logs) {
      try {
        // Decode log if it matches profit event
        // Return profit amount
      } catch (error) {
        // Continue to next log
      }
    }

    return ethers.BigNumber.from(0);
  }
}

module.exports = FlashLoanService;
```

### Aave Flash Loan Provider

Specific implementation for Aave protocol:

```javascript
// src/services/flashloan/aaveProvider.js
const { ethers } = require('ethers');
const LENDING_POOL_ABI = require('../../contracts/abis/aave.json');
const addresses = require('../../contracts/addresses/mainnet');

class AaveProvider {
  constructor(config, wallet) {
    this.config = config;
    this.wallet = wallet;

    this.lendingPool = new ethers.Contract(
      addresses.aave.lendingPool,
      LENDING_POOL_ABI,
      wallet
    );

    this.receiverAddress = addresses.flashLoanReceiver;
  }

  async requestFlashLoan(params) {
    const { asset, amount, mode, params: encodedParams } = params;

    // Estimate gas
    const gasEstimate = await this.lendingPool.estimateGas.flashLoan(
      this.receiverAddress,
      [asset],
      [amount],
      [mode],
      this.wallet.address,
      encodedParams,
      0 // referral code
    );

    // Add 20% buffer
    const gasLimit = gasEstimate.mul(120).div(100);

    // Get optimal gas price
    const gasPrice = await this.getOptimalGasPrice();

    // Execute flash loan
    const tx = await this.lendingPool.flashLoan(
      this.receiverAddress,
      [asset],
      [amount],
      [mode],
      this.wallet.address,
      encodedParams,
      0,
      {
        gasLimit,
        gasPrice
      }
    );

    return tx;
  }

  async getOptimalGasPrice() {
    const currentGasPrice = await this.wallet.provider.getGasPrice();

    // Add 10% for faster inclusion
    return currentGasPrice.mul(110).div(100);
  }

  async getAvailableLiquidity(asset) {
    const reserveData = await this.lendingPool.getReserveData(asset);
    return reserveData.availableLiquidity;
  }
}

module.exports = AaveProvider;
```

### DEX Adapter Pattern

Uniswap adapter implementation:

```javascript
// src/services/dex/uniswapAdapter.js
const { ethers } = require('ethers');
const ROUTER_ABI = require('../../contracts/abis/uniswap.json');
const FACTORY_ABI = require('../../contracts/abis/uniswapFactory.json');
const PAIR_ABI = require('../../contracts/abis/uniswapPair.json');
const addresses = require('../../contracts/addresses/mainnet');

class UniswapAdapter {
  constructor(config) {
    this.config = config;
    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);

    this.router = new ethers.Contract(
      addresses.uniswap.router,
      ROUTER_ABI,
      this.provider
    );

    this.factory = new ethers.Contract(
      addresses.uniswap.factory,
      FACTORY_ABI,
      this.provider
    );
  }

  async getPrice(pair) {
    const [token0, token1] = pair.split('/');
    const token0Address = this.config.tokenAddresses[token0];
    const token1Address = this.config.tokenAddresses[token1];

    // Get pair address
    const pairAddress = await this.factory.getPair(
      token0Address,
      token1Address
    );

    if (pairAddress === ethers.constants.AddressZero) {
      throw new Error(`Pair ${pair} does not exist on Uniswap`);
    }

    // Get reserves
    const pairContract = new ethers.Contract(
      pairAddress,
      PAIR_ABI,
      this.provider
    );

    const reserves = await pairContract.getReserves();

    // Calculate price
    const price = reserves._reserve1.mul(ethers.constants.WeiPerEther)
      .div(reserves._reserve0);

    return {
      price: ethers.utils.formatEther(price),
      liquidity: ethers.utils.formatEther(reserves._reserve0),
      pairAddress
    };
  }

  async getAmountOut(amountIn, path) {
    const amounts = await this.router.getAmountsOut(amountIn, path);
    return amounts[amounts.length - 1];
  }

  async getOptimalPath(tokenIn, tokenOut) {
    // Try direct path
    const directPath = [tokenIn, tokenOut];

    // Try path through WETH
    const wethPath = [tokenIn, this.config.tokenAddresses.WETH, tokenOut];

    // Try path through stablecoins
    const usdcPath = [tokenIn, this.config.tokenAddresses.USDC, tokenOut];

    const paths = [directPath, wethPath, usdcPath];
    const testAmount = ethers.utils.parseEther('1');

    let bestPath = directPath;
    let bestOutput = ethers.BigNumber.from(0);

    for (const path of paths) {
      try {
        const output = await this.getAmountOut(testAmount, path);
        if (output.gt(bestOutput)) {
          bestOutput = output;
          bestPath = path;
        }
      } catch (error) {
        // Path doesn't exist, continue
      }
    }

    return bestPath;
  }
}

module.exports = UniswapAdapter;
```

## Smart Contract Details

### Flash Loan Receiver Contract

The on-chain component that handles flash loan execution:

```solidity
// contracts/FlashLoanReceiver.sol
pragma solidity ^0.8.0;

import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract FlashLoanReceiver is FlashLoanSimpleReceiverBase {
    address private owner;

    IUniswapV2Router02 private uniswapRouter;
    IUniswapV2Router02 private sushiswapRouter;

    event ArbitrageExecuted(
        address indexed token,
        uint256 amount,
        uint256 profit
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(
        address _addressProvider,
        address _uniswapRouter,
        address _sushiswapRouter
    ) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) {
        owner = msg.sender;
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        sushiswapRouter = IUniswapV2Router02(_sushiswapRouter);
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(initiator == owner, "Unauthorized");

        // Decode parameters
        (
            address buyDex,
            address sellDex,
            uint256 tradeAmount,
            uint256 minProfit
        ) = abi.decode(params, (address, address, uint256, uint256));

        // Execute arbitrage
        uint256 finalAmount = executeArbitrage(
            asset,
            buyDex,
            sellDex,
            tradeAmount
        );

        // Calculate profit
        uint256 amountOwed = amount + premium;
        require(finalAmount >= amountOwed, "Insufficient profit");

        uint256 profit = finalAmount - amountOwed;
        require(profit >= minProfit, "Profit below minimum");

        // Approve repayment
        IERC20(asset).approve(address(POOL), amountOwed);

        // Transfer profit to owner
        IERC20(asset).transfer(owner, profit);

        emit ArbitrageExecuted(asset, amount, profit);

        return true;
    }

    function executeArbitrage(
        address token,
        address buyDex,
        address sellDex,
        uint256 amount
    ) private returns (uint256) {
        // Determine routers
        IUniswapV2Router02 buyRouter = buyDex == address(uniswapRouter)
            ? uniswapRouter
            : sushiswapRouter;

        IUniswapV2Router02 sellRouter = sellDex == address(uniswapRouter)
            ? uniswapRouter
            : sushiswapRouter;

        // Build paths (simplified - would be more complex in production)
        address[] memory buyPath = new address[](2);
        buyPath[0] = token;
        buyPath[1] = getIntermediateToken(token);

        address[] memory sellPath = new address[](2);
        sellPath[0] = getIntermediateToken(token);
        sellPath[1] = token;

        // Execute buy on first DEX
        IERC20(token).approve(address(buyRouter), amount);
        uint256[] memory buyAmounts = buyRouter.swapExactTokensForTokens(
            amount,
            0,
            buyPath,
            address(this),
            block.timestamp + 300
        );

        // Execute sell on second DEX
        uint256 intermediateAmount = buyAmounts[buyAmounts.length - 1];
        IERC20(buyPath[1]).approve(address(sellRouter), intermediateAmount);

        uint256[] memory sellAmounts = sellRouter.swapExactTokensForTokens(
            intermediateAmount,
            0,
            sellPath,
            address(this),
            block.timestamp + 300
        );

        return sellAmounts[sellAmounts.length - 1];
    }

    function getIntermediateToken(address token) private pure returns (address) {
        // Return appropriate intermediate token (e.g., WETH, USDC)
        // Simplified for example
        return token;
    }

    function withdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    receive() external payable {}
}
```

## API Integration

### Gas Oracle Service

Fetches optimal gas prices from multiple sources:

```javascript
// src/services/blockchain/gasOracle.js
const axios = require('axios');
const { ethers } = require('ethers');
const logger = require('../monitoring/logger');

class GasOracle {
  constructor(config) {
    this.config = config;
    this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
    this.cache = null;
    this.cacheTimestamp = 0;
    this.cacheTTL = 10000; // 10 seconds
  }

  async getGasPrice() {
    // Check cache
    if (this.cache && Date.now() - this.cacheTimestamp < this.cacheTTL) {
      return this.cache;
    }

    try {
      // Try multiple sources in parallel
      const [
        providerGasPrice,
        etherscanGasPrice,
        gasnowGasPrice
      ] = await Promise.allSettled([
        this.getProviderGasPrice(),
        this.getEtherscanGasPrice(),
        this.getGasNowPrice()
      ]);

      // Use the median of available prices
      const prices = [
        providerGasPrice,
        etherscanGasPrice,
        gasnowGasPrice
      ]
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
        .filter(p => p != null);

      if (prices.length === 0) {
        throw new Error('Failed to fetch gas price from all sources');
      }

      // Sort and get median
      prices.sort((a, b) => a.sub(b).toNumber());
      const median = prices[Math.floor(prices.length / 2)];

      // Cache result
      this.cache = median;
      this.cacheTimestamp = Date.now();

      return median;

    } catch (error) {
      logger.error('Error fetching gas price:', error);

      // Fallback to provider
      return await this.provider.getGasPrice();
    }
  }

  async getProviderGasPrice() {
    return await this.provider.getGasPrice();
  }

  async getEtherscanGasPrice() {
    if (!this.config.etherscanApiKey) return null;

    try {
      const response = await axios.get(
        'https://api.etherscan.io/api',
        {
          params: {
            module: 'gastracker',
            action: 'gasoracle',
            apikey: this.config.etherscanApiKey
          },
          timeout: 5000
        }
      );

      if (response.data.status === '1') {
        // Use "fast" gas price
        return ethers.utils.parseUnits(
          response.data.result.FastGasPrice,
          'gwei'
        );
      }
    } catch (error) {
      logger.warn('Etherscan gas price fetch failed:', error.message);
    }

    return null;
  }

  async getGasNowPrice() {
    try {
      const response = await axios.get(
        'https://www.gasnow.org/api/v3/gas/price',
        { timeout: 5000 }
      );

      // Use "fast" price
      return ethers.BigNumber.from(response.data.data.fast);
    } catch (error) {
      logger.warn('GasNow price fetch failed:', error.message);
    }

    return null;
  }

  async estimateGasCost(gasUnits) {
    const gasPrice = await this.getGasPrice();
    return gasPrice.mul(gasUnits);
  }
}

module.exports = (config) => new GasOracle(config);
```

### External Price APIs

Integration with price aggregators:

```javascript
// src/services/external/priceApi.js
const axios = require('axios');
const logger = require('../monitoring/logger');

class PriceAPI {
  constructor(config) {
    this.config = config;
    this.coingeckoBaseUrl = 'https://api.coingecko.com/api/v3';
  }

  async getTokenPrice(tokenSymbol) {
    try {
      const tokenId = this.getCoingeckoId(tokenSymbol);

      const response = await axios.get(
        `${this.coingeckoBaseUrl}/simple/price`,
        {
          params: {
            ids: tokenId,
            vs_currencies: 'usd'
          },
          timeout: 5000
        }
      );

      return response.data[tokenId].usd;
    } catch (error) {
      logger.error(`Failed to fetch price for ${tokenSymbol}:`, error);
      return null;
    }
  }

  async getMultipleTokenPrices(tokenSymbols) {
    const promises = tokenSymbols.map(symbol =>
      this.getTokenPrice(symbol)
    );

    const results = await Promise.allSettled(promises);

    return tokenSymbols.reduce((acc, symbol, index) => {
      const result = results[index];
      if (result.status === 'fulfilled' && result.value) {
        acc[symbol] = result.value;
      }
      return acc;
    }, {});
  }

  getCoingeckoId(symbol) {
    const mapping = {
      'WETH': 'weth',
      'ETH': 'ethereum',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'DAI': 'dai',
      'WBTC': 'wrapped-bitcoin'
    };

    return mapping[symbol] || symbol.toLowerCase();
  }
}

module.exports = PriceAPI;
```

## Configuration

### Environment Configuration

Complete configuration file structure:

```javascript
// src/config/settings.js
require('dotenv').config();

module.exports = {
  // Network Configuration
  network: process.env.NETWORK || 'mainnet',
  rpcUrl: process.env.RPC_URL,
  fallbackRpcUrl: process.env.FALLBACK_RPC_URL,
  chainId: parseInt(process.env.CHAIN_ID || '1'),

  // Wallet Configuration
  privateKey: process.env.PRIVATE_KEY,
  publicAddress: process.env.PUBLIC_ADDRESS,

  // Flash Loan Configuration
  flashLoanProvider: process.env.FLASH_LOAN_PROVIDER || 'aave',
  minProfitThreshold: parseFloat(process.env.MIN_PROFIT_THRESHOLD || '100'),
  maxLoanAmount: process.env.MAX_LOAN_AMOUNT,
  flashLoanFeePercent: 0.0009, // 0.09%

  // DEX Configuration
  monitoredDexs: (process.env.MONITORED_DEXS || 'uniswap,sushiswap').split(','),
  tradingPairs: (process.env.TRADING_PAIRS || 'WETH/USDC,WETH/DAI').split(','),
  dexFeePercent: 0.003, // 0.3%

  // Risk Management
  maxGasPrice: parseInt(process.env.MAX_GAS_PRICE || '150'),
  slippageTolerance: parseFloat(process.env.SLIPPAGE_TOLERANCE || '0.01'),
  minLiquidity: parseFloat(process.env.MIN_LIQUIDITY || '100000'),
  maxLiquidityUsagePercent: parseInt(process.env.MAX_LIQUIDITY_USAGE_PERCENT || '10'),
  minSpreadThreshold: parseFloat(process.env.MIN_SPREAD_THRESHOLD || '0.005'),

  // Execution Configuration
  autoExecute: process.env.AUTO_EXECUTE === 'true',
  confirmationBlocks: parseInt(process.env.CONFIRMATION_BLOCKS || '2'),
  estimatedGasUnits: parseInt(process.env.ESTIMATED_GAS_UNITS || '500000'),

  // Monitoring Configuration
  checkInterval: parseInt(process.env.CHECK_INTERVAL || '3000'),
  logLevel: process.env.LOG_LEVEL || 'info',
  enableAlerts: process.env.ENABLE_ALERTS === 'true',

  // API Keys
  etherscanApiKey: process.env.ETHERSCAN_API_KEY,
  infuraProjectId: process.env.INFURA_PROJECT_ID,
  alchemyApiKey: process.env.ALCHEMY_API_KEY,

  // Token Addresses
  tokenAddresses: require('./tokens')[process.env.NETWORK || 'mainnet'],

  // DEX Addresses
  dexAddresses: require('./dexs')[process.env.NETWORK || 'mainnet'],

  // Contract Addresses
  flashLoanReceiver: process.env.FLASH_LOAN_RECEIVER_ADDRESS
};
```

### Token Configuration

```javascript
// src/config/tokens.js
module.exports = {
  mainnet: {
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
  },
  polygon: {
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
  },
  bsc: {
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    ETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8'
  }
};
```

## Deployment Guide

### Local Development Setup

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your values

# Run tests
npm test

# Start in development mode
npm run dev

# Start in production mode
npm start
```

### PM2 Production Deployment

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start src/index.js --name flash-arbitrage-bot

# View logs
pm2 logs flash-arbitrage-bot

# Monitor
pm2 monit

# Restart
pm2 restart flash-arbitrage-bot

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:16-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["node", "src/index.js"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  flash-arbitrage-bot:
    build: .
    environment:
      - NETWORK=${NETWORK}
      - RPC_URL=${RPC_URL}
      - PRIVATE_KEY=${PRIVATE_KEY}
      - AUTO_EXECUTE=${AUTO_EXECUTE}
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Testing Strategy

### Unit Tests

```javascript
// tests/unit/calculator.test.js
const Calculator = require('../../src/services/arbitrage/calculator');
const BigNumber = require('bignumber.js');

describe('Calculator', () => {
  let calculator;

  beforeEach(() => {
    calculator = new Calculator({
      flashLoanFeePercent: 0.0009,
      dexFeePercent: 0.003,
      estimatedGasUnits: 500000
    });
  });

  describe('calculateProfit', () => {
    it('should calculate profit correctly', async () => {
      const params = {
        pair: 'WETH/USDC',
        buyDex: 'uniswap',
        sellDex: 'sushiswap',
        buyPrice: new BigNumber('2000'),
        sellPrice: new BigNumber('2020'),
        amount: new BigNumber('10'),
        buyLiquidity: new BigNumber('1000000'),
        sellLiquidity: new BigNumber('1000000')
      };

      const result = await calculator.calculateProfit(params);

      expect(result.grossProfit.gt(0)).toBe(true);
      expect(result.netProfit.lt(result.grossProfit)).toBe(true);
    });

    it('should account for all fees', async () => {
      // Test implementation...
    });
  });
});
```

### Integration Tests

```javascript
// tests/integration/flashloan.test.js
const FlashLoanArbitrageBot = require('../../src');

describe('Flash Loan Integration', () => {
  let bot;

  beforeAll(() => {
    bot = new FlashLoanArbitrageBot({
      network: 'goerli',
      rpcUrl: process.env.GOERLI_RPC_URL,
      privateKey: process.env.TEST_PRIVATE_KEY,
      autoExecute: false
    });
  });

  it('should detect opportunities', (done) => {
    bot.on('opportunity', (opportunity) => {
      expect(opportunity).toBeDefined();
      expect(opportunity.profitable).toBeDefined();
      done();
    });

    bot.start();
  }, 30000);
});
```

## Performance Optimization

### Connection Pooling

```javascript
// Reuse provider connections
const providers = new Map();

function getProvider(url) {
  if (!providers.has(url)) {
    providers.set(url, new ethers.providers.JsonRpcProvider(url));
  }
  return providers.get(url);
}
```

### Caching Strategy

```javascript
// Implement smart caching
class Cache {
  constructor(ttl = 5000) {
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }
}
```

## Security Considerations

### Private Key Management

```javascript
// Never log private keys
const sanitizeConfig = (config) => {
  const safe = { ...config };
  if (safe.privateKey) {
    safe.privateKey = '***REDACTED***';
  }
  return safe;
};

logger.info('Configuration:', sanitizeConfig(config));
```

### Input Validation

```javascript
// Validate all inputs
function validateConfig(config) {
  if (!config.rpcUrl) {
    throw new Error('RPC URL is required');
  }

  if (!config.privateKey || config.privateKey.length !== 66) {
    throw new Error('Valid private key is required');
  }

  if (config.maxGasPrice <= 0) {
    throw new Error('Max gas price must be positive');
  }
}
```

## Common Issues & Solutions

### Issue: High Gas Costs

```javascript
// Wait for favorable gas conditions
async function waitForLowGas(maxGasPrice) {
  while (true) {
    const currentGas = await provider.getGasPrice();
    if (currentGas.lte(ethers.utils.parseUnits(maxGasPrice.toString(), 'gwei'))) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
}
```

### Issue: RPC Rate Limiting

```javascript
// Implement exponential backoff
async function retryWithBackoff(fn, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

This comprehensive technical guide provides JavaScript developers with everything needed to understand, customize, and deploy the flash loan arbitrage tool effectively.
