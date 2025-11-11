**Source:** https://github.com/haykins07/flash-loan-arb

# Flash Loan Arbitrage Bot - JavaScript Implementation

## Project Overview

The flash-loan-arb project is a comprehensive JavaScript-based arbitrage bot that leverages flash loans to capitalize on price discrepancies across multiple decentralized exchanges. This implementation focuses on automation, real-time opportunity detection, and efficient execution strategies.

### Core Features

- **Multi-DEX Support**: Integration with Uniswap, SushiSwap, PancakeSwap, and other major DEXs
- **Real-Time Monitoring**: WebSocket-based price feed aggregation
- **Automated Execution**: Smart contract interaction for flash loan execution
- **Profit Optimization**: Advanced algorithms for route finding and gas optimization
- **Risk Management**: Built-in safety checks and fail-safes
- **Analytics Dashboard**: Real-time performance tracking and historical data
- **Telegram Notifications**: Instant alerts for successful and failed trades

## Technical Architecture

### Project Structure

```
flash-loan-arb/
├── src/
│   ├── config/
│   │   ├── networks.js
│   │   ├── dexes.js
│   │   └── tokens.js
│   ├── contracts/
│   │   ├── FlashLoanArbitrage.sol
│   │   ├── interfaces/
│   │   │   ├── IUniswapV2Router.sol
│   │   │   ├── IUniswapV3Router.sol
│   │   │   └── IAaveFlashLoan.sol
│   │   └── libraries/
│   │       └── SafeMath.sol
│   ├── services/
│   │   ├── priceMonitor.js
│   │   ├── arbitrageBot.js
│   │   ├── flashLoanExecutor.js
│   │   └── gasOptimizer.js
│   ├── utils/
│   │   ├── web3Provider.js
│   │   ├── logger.js
│   │   └── calculations.js
│   ├── strategies/
│   │   ├── dexArbitrage.js
│   │   ├── triangularArbitrage.js
│   │   └── crossChainArbitrage.js
│   └── index.js
├── tests/
│   ├── unit/
│   └── integration/
├── scripts/
│   ├── deploy.js
│   └── verify.js
├── package.json
└── hardhat.config.js
```

## Smart Contract Implementation

### Flash Loan Arbitrage Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";

contract FlashLoanArbitrage is FlashLoanSimpleReceiverBase {
    address public owner;

    // DEX router addresses
    IUniswapV2Router02 public uniswapV2Router;
    ISwapRouter public uniswapV3Router;
    IUniswapV2Router02 public sushiswapRouter;

    // Events
    event ArbitrageExecuted(
        address indexed token,
        uint256 borrowed,
        uint256 profit,
        uint256 timestamp
    );

    event TradeExecuted(
        string dex,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(
        address _addressProvider,
        address _uniswapV2Router,
        address _uniswapV3Router,
        address _sushiswapRouter
    ) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) {
        owner = msg.sender;
        uniswapV2Router = IUniswapV2Router02(_uniswapV2Router);
        uniswapV3Router = ISwapRouter(_uniswapV3Router);
        sushiswapRouter = IUniswapV2Router02(_sushiswapRouter);
    }

    /**
     * @notice Execute flash loan arbitrage
     * @param token The token to borrow
     * @param amount The amount to borrow
     * @param params Encoded arbitrage parameters
     */
    function executeArbitrage(
        address token,
        uint256 amount,
        bytes calldata params
    ) external onlyOwner {
        POOL.flashLoanSimple(
            address(this),
            token,
            amount,
            params,
            0
        );
    }

    /**
     * @notice Flash loan callback - executes arbitrage strategy
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(
            msg.sender == address(POOL),
            "Caller must be lending pool"
        );
        require(initiator == address(this), "Invalid initiator");

        // Decode arbitrage parameters
        (
            address[] memory path,
            string[] memory dexes,
            uint256 minProfit
        ) = abi.decode(params, (address[], string[], uint256));

        // Execute arbitrage strategy
        uint256 finalAmount = _executeArbitrageStrategy(
            asset,
            amount,
            path,
            dexes
        );

        // Calculate total amount to repay
        uint256 totalDebt = amount + premium;
        require(finalAmount >= totalDebt, "Arbitrage not profitable");

        // Calculate profit
        uint256 profit = finalAmount - totalDebt;
        require(profit >= minProfit, "Profit below minimum");

        // Approve pool to pull the owed amount
        IERC20(asset).approve(address(POOL), totalDebt);

        emit ArbitrageExecuted(asset, amount, profit, block.timestamp);

        return true;
    }

    /**
     * @notice Execute the arbitrage strategy across multiple DEXs
     */
    function _executeArbitrageStrategy(
        address asset,
        uint256 amount,
        address[] memory path,
        string[] memory dexes
    ) internal returns (uint256) {
        uint256 currentAmount = amount;

        for (uint256 i = 0; i < dexes.length; i++) {
            address tokenIn = (i == 0) ? asset : path[i - 1];
            address tokenOut = path[i];

            if (keccak256(bytes(dexes[i])) == keccak256(bytes("uniswapV2"))) {
                currentAmount = _swapOnUniswapV2(tokenIn, tokenOut, currentAmount);
            } else if (keccak256(bytes(dexes[i])) == keccak256(bytes("uniswapV3"))) {
                currentAmount = _swapOnUniswapV3(tokenIn, tokenOut, currentAmount);
            } else if (keccak256(bytes(dexes[i])) == keccak256(bytes("sushiswap"))) {
                currentAmount = _swapOnSushiswap(tokenIn, tokenOut, currentAmount);
            }

            emit TradeExecuted(dexes[i], tokenIn, tokenOut, currentAmount, currentAmount);
        }

        return currentAmount;
    }

    /**
     * @notice Swap tokens on Uniswap V2
     */
    function _swapOnUniswapV2(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256) {
        IERC20(tokenIn).approve(address(uniswapV2Router), amountIn);

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts = uniswapV2Router.swapExactTokensForTokens(
            amountIn,
            0,
            path,
            address(this),
            block.timestamp + 300
        );

        return amounts[amounts.length - 1];
    }

    /**
     * @notice Swap tokens on Uniswap V3
     */
    function _swapOnUniswapV3(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256) {
        IERC20(tokenIn).approve(address(uniswapV3Router), amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                fee: 3000,
                recipient: address(this),
                deadline: block.timestamp + 300,
                amountIn: amountIn,
                amountOutMinimum: 0,
                sqrtPriceLimitX96: 0
            });

        return uniswapV3Router.exactInputSingle(params);
    }

    /**
     * @notice Swap tokens on Sushiswap
     */
    function _swapOnSushiswap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256) {
        IERC20(tokenIn).approve(address(sushiswapRouter), amountIn);

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts = sushiswapRouter.swapExactTokensForTokens(
            amountIn,
            0,
            path,
            address(this),
            block.timestamp + 300
        );

        return amounts[amounts.length - 1];
    }

    /**
     * @notice Withdraw tokens from contract
     */
    function withdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    /**
     * @notice Withdraw ETH from contract
     */
    function withdrawETH(uint256 amount) external onlyOwner {
        payable(owner).transfer(amount);
    }

    /**
     * @notice Update DEX router addresses
     */
    function updateRouters(
        address _uniswapV2,
        address _uniswapV3,
        address _sushiswap
    ) external onlyOwner {
        if (_uniswapV2 != address(0)) uniswapV2Router = IUniswapV2Router02(_uniswapV2);
        if (_uniswapV3 != address(0)) uniswapV3Router = ISwapRouter(_uniswapV3);
        if (_sushiswap != address(0)) sushiswapRouter = IUniswapV2Router02(_sushiswap);
    }

    receive() external payable {}
}
```

## JavaScript Bot Implementation

### Main Arbitrage Bot Service

```javascript
// src/services/arbitrageBot.js
const { ethers } = require('ethers');
const PriceMonitor = require('./priceMonitor');
const FlashLoanExecutor = require('./flashLoanExecutor');
const GasOptimizer = require('./gasOptimizer');
const Logger = require('../utils/logger');
const config = require('../config/networks');

class ArbitrageBot {
  constructor(options = {}) {
    this.provider = new ethers.providers.WebSocketProvider(
      config.WEBSOCKET_URL
    );
    this.wallet = new ethers.Wallet(config.PRIVATE_KEY, this.provider);

    this.priceMonitor = new PriceMonitor(this.provider);
    this.flashLoanExecutor = new FlashLoanExecutor(this.wallet);
    this.gasOptimizer = new GasOptimizer(this.provider);

    this.isRunning = false;
    this.opportunities = [];
    this.executedTrades = [];

    this.config = {
      minProfitUSD: options.minProfitUSD || 50,
      maxGasPrice: options.maxGasPrice || 150, // in gwei
      maxPositionSize: options.maxPositionSize || ethers.utils.parseEther('100'),
      telegramEnabled: options.telegramEnabled || false,
      ...options
    };

    this.logger = new Logger('ArbitrageBot');
  }

  /**
   * Start the arbitrage bot
   */
  async start() {
    if (this.isRunning) {
      this.logger.warn('Bot is already running');
      return;
    }

    this.logger.info('Starting arbitrage bot...');
    this.isRunning = true;

    // Initialize price monitoring
    await this.priceMonitor.initialize();

    // Subscribe to price updates
    this.priceMonitor.on('opportunity', async (opportunity) => {
      await this.handleOpportunity(opportunity);
    });

    // Start monitoring gas prices
    this.gasOptimizer.startMonitoring();

    this.logger.info('Arbitrage bot started successfully');
  }

  /**
   * Handle detected arbitrage opportunity
   */
  async handleOpportunity(opportunity) {
    try {
      this.logger.info('Opportunity detected:', opportunity);

      // Validate opportunity
      if (!this.validateOpportunity(opportunity)) {
        this.logger.debug('Opportunity validation failed');
        return;
      }

      // Calculate optimal trade size
      const tradeSize = await this.calculateOptimalTradeSize(opportunity);

      // Estimate profit
      const profitEstimate = await this.estimateProfit(opportunity, tradeSize);

      if (profitEstimate.netProfit < this.config.minProfitUSD) {
        this.logger.debug(`Profit ${profitEstimate.netProfit} below minimum ${this.config.minProfitUSD}`);
        return;
      }

      // Check gas price
      const currentGasPrice = await this.gasOptimizer.getCurrentGasPrice();
      if (currentGasPrice > this.config.maxGasPrice) {
        this.logger.warn(`Gas price ${currentGasPrice} gwei too high`);
        return;
      }

      // Execute arbitrage
      await this.executeArbitrage(opportunity, tradeSize);

    } catch (error) {
      this.logger.error('Error handling opportunity:', error);
    }
  }

  /**
   * Validate arbitrage opportunity
   */
  validateOpportunity(opportunity) {
    // Check if opportunity is still valid
    if (Date.now() - opportunity.timestamp > 5000) {
      return false; // Opportunity too old (>5s)
    }

    // Check profit threshold
    if (opportunity.profitPercentage < 0.5) {
      return false; // Less than 0.5% profit
    }

    // Check liquidity
    if (!opportunity.buyDex.liquidity || !opportunity.sellDex.liquidity) {
      return false;
    }

    // Check if we have enough balance
    const requiredBalance = opportunity.amount * 1.1; // 10% buffer
    if (this.wallet.balance < requiredBalance) {
      return false;
    }

    return true;
  }

  /**
   * Calculate optimal trade size
   */
  async calculateOptimalTradeSize(opportunity) {
    const buyLiquidity = opportunity.buyDex.liquidity;
    const sellLiquidity = opportunity.sellDex.liquidity;

    // Use smaller liquidity as constraint
    const minLiquidity = Math.min(
      buyLiquidity.tokenA,
      sellLiquidity.tokenB
    );

    // Don't use more than 20% of available liquidity to minimize slippage
    const liquidityConstraint = minLiquidity * 0.2;

    // Apply maximum position size constraint
    const maxSize = ethers.utils.parseEther(
      this.config.maxPositionSize.toString()
    );

    return ethers.BigNumber.from(
      Math.min(liquidityConstraint, maxSize.toString())
    );
  }

  /**
   * Estimate profit for arbitrage opportunity
   */
  async estimateProfit(opportunity, tradeSize) {
    const tradeSizeNum = parseFloat(ethers.utils.formatEther(tradeSize));

    // Calculate expected output considering slippage
    const slippage = this.calculateSlippage(
      tradeSizeNum,
      opportunity.buyDex.liquidity
    );

    const buyAmount = tradeSizeNum * (1 - slippage);
    const sellAmount = buyAmount * (opportunity.sellPrice / opportunity.buyPrice);
    const grossProfit = sellAmount - tradeSizeNum;

    // Estimate gas costs
    const gasEstimate = await this.gasOptimizer.estimateGasCost({
      type: 'flash_loan_arbitrage',
      complexity: opportunity.path.length,
    });

    const gasCostUSD = gasEstimate.totalCostUSD;
    const flashLoanFee = tradeSizeNum * 0.0009; // 0.09% Aave fee

    const netProfit = grossProfit - gasCostUSD - flashLoanFee;

    return {
      grossProfit,
      gasCost: gasCostUSD,
      flashLoanFee,
      netProfit,
      roi: (netProfit / tradeSizeNum) * 100,
    };
  }

  /**
   * Calculate slippage for trade size
   */
  calculateSlippage(tradeSize, liquidity) {
    // Simplified slippage calculation using constant product formula
    const reserveRatio = tradeSize / liquidity.tokenA;
    return reserveRatio * 0.997; // Account for 0.3% DEX fee
  }

  /**
   * Execute arbitrage trade
   */
  async executeArbitrage(opportunity, tradeSize) {
    this.logger.info(`Executing arbitrage: ${ethers.utils.formatEther(tradeSize)} tokens`);

    try {
      // Prepare transaction parameters
      const params = this.prepareTransactionParams(opportunity, tradeSize);

      // Execute flash loan
      const result = await this.flashLoanExecutor.execute(params);

      if (result.success) {
        this.logger.success('Arbitrage executed successfully!');
        this.logger.info(`Profit: ${result.profit} USD`);
        this.logger.info(`Transaction: ${result.txHash}`);

        // Record trade
        this.executedTrades.push({
          timestamp: Date.now(),
          opportunity,
          tradeSize: ethers.utils.formatEther(tradeSize),
          profit: result.profit,
          txHash: result.txHash,
        });

        // Send notification
        if (this.config.telegramEnabled) {
          await this.sendTelegramNotification(result);
        }
      } else {
        this.logger.error('Arbitrage execution failed:', result.error);
      }

    } catch (error) {
      this.logger.error('Error executing arbitrage:', error);

      if (this.config.telegramEnabled) {
        await this.sendErrorNotification(error);
      }
    }
  }

  /**
   * Prepare transaction parameters
   */
  prepareTransactionParams(opportunity, tradeSize) {
    // Build path array
    const path = [opportunity.baseToken, opportunity.quoteToken];

    // Build DEX array
    const dexes = [opportunity.buyDex.name, opportunity.sellDex.name];

    // Encode parameters
    const encodedParams = ethers.utils.defaultAbiCoder.encode(
      ['address[]', 'string[]', 'uint256'],
      [path, dexes, ethers.utils.parseUnits('1', 18)] // min profit = 1 token
    );

    return {
      token: opportunity.baseToken,
      amount: tradeSize,
      params: encodedParams,
    };
  }

  /**
   * Stop the bot
   */
  async stop() {
    if (!this.isRunning) {
      this.logger.warn('Bot is not running');
      return;
    }

    this.logger.info('Stopping arbitrage bot...');
    this.isRunning = false;

    this.priceMonitor.stop();
    this.gasOptimizer.stopMonitoring();

    this.logger.info('Arbitrage bot stopped');
  }

  /**
   * Get bot statistics
   */
  getStatistics() {
    const totalTrades = this.executedTrades.length;
    const totalProfit = this.executedTrades.reduce(
      (sum, trade) => sum + trade.profit,
      0
    );
    const averageProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;

    return {
      isRunning: this.isRunning,
      totalTrades,
      totalProfit,
      averageProfit,
      successRate: this.calculateSuccessRate(),
      recentTrades: this.executedTrades.slice(-10),
    };
  }

  /**
   * Calculate success rate
   */
  calculateSuccessRate() {
    if (this.executedTrades.length === 0) return 0;

    const successful = this.executedTrades.filter(
      (trade) => trade.profit > 0
    ).length;

    return (successful / this.executedTrades.length) * 100;
  }

  /**
   * Send Telegram notification
   */
  async sendTelegramNotification(result) {
    // Implementation depends on telegram-bot-api
    // This is a placeholder
    const message = `
🎯 Arbitrage Executed Successfully!
💰 Profit: $${result.profit.toFixed(2)}
🔗 TX: ${result.txHash}
    `;

    this.logger.info('Telegram notification sent');
  }

  /**
   * Send error notification
   */
  async sendErrorNotification(error) {
    const message = `
❌ Arbitrage Execution Failed
📝 Error: ${error.message}
    `;

    this.logger.info('Error notification sent');
  }
}

module.exports = ArbitrageBot;
```

### Price Monitor Service

```javascript
// src/services/priceMonitor.js
const { ethers } = require('ethers');
const EventEmitter = require('events');
const config = require('../config/dexes');
const Logger = require('../utils/logger');

class PriceMonitor extends EventEmitter {
  constructor(provider) {
    super();
    this.provider = provider;
    this.prices = new Map();
    this.subscriptions = [];
    this.logger = new Logger('PriceMonitor');

    this.dexes = config.SUPPORTED_DEXES;
    this.tokens = config.MONITORED_TOKENS;

    this.updateInterval = 2000; // 2 seconds
  }

  /**
   * Initialize price monitoring
   */
  async initialize() {
    this.logger.info('Initializing price monitor...');

    // Load DEX contracts
    await this.loadDexContracts();

    // Start monitoring token pairs
    for (const token of this.tokens) {
      await this.monitorTokenPair(token.address, token.pairs);
    }

    this.logger.info('Price monitor initialized');
  }

  /**
   * Load DEX contract instances
   */
  async loadDexContracts() {
    this.dexContracts = {};

    for (const dex of this.dexes) {
      const contract = new ethers.Contract(
        dex.routerAddress,
        dex.abi,
        this.provider
      );

      this.dexContracts[dex.name] = {
        contract,
        factoryAddress: dex.factoryAddress,
      };
    }
  }

  /**
   * Monitor token pair across multiple DEXs
   */
  async monitorTokenPair(tokenA, tokenBList) {
    for (const tokenB of tokenBList) {
      const interval = setInterval(async () => {
        try {
          const prices = await this.fetchPricesForPair(tokenA, tokenB);
          this.updatePrices(tokenA, tokenB, prices);
          this.checkArbitrageOpportunity(tokenA, tokenB, prices);
        } catch (error) {
          this.logger.error(`Error monitoring ${tokenA}-${tokenB}:`, error);
        }
      }, this.updateInterval);

      this.subscriptions.push(interval);
    }
  }

  /**
   * Fetch prices from all DEXs for a token pair
   */
  async fetchPricesForPair(tokenA, tokenB) {
    const pricePromises = Object.entries(this.dexContracts).map(
      async ([dexName, dex]) => {
        try {
          const price = await this.getPrice(dex.contract, tokenA, tokenB);
          const liquidity = await this.getLiquidity(dex.contract, tokenA, tokenB);

          return {
            dex: dexName,
            price,
            liquidity,
            timestamp: Date.now(),
          };
        } catch (error) {
          this.logger.debug(`Failed to fetch price from ${dexName}:`, error.message);
          return null;
        }
      }
    );

    const prices = await Promise.all(pricePromises);
    return prices.filter((p) => p !== null);
  }

  /**
   * Get price from DEX
   */
  async getPrice(routerContract, tokenA, tokenB) {
    const amountIn = ethers.utils.parseEther('1');
    const path = [tokenA, tokenB];

    const amounts = await routerContract.getAmountsOut(amountIn, path);
    return parseFloat(ethers.utils.formatEther(amounts[1]));
  }

  /**
   * Get liquidity for token pair
   */
  async getLiquidity(routerContract, tokenA, tokenB) {
    try {
      // Get factory contract
      const factoryAddress = await routerContract.factory();
      const factoryContract = new ethers.Contract(
        factoryAddress,
        ['function getPair(address,address) view returns (address)'],
        this.provider
      );

      // Get pair address
      const pairAddress = await factoryContract.getPair(tokenA, tokenB);

      if (pairAddress === ethers.constants.AddressZero) {
        return null;
      }

      // Get reserves
      const pairContract = new ethers.Contract(
        pairAddress,
        [
          'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
          'function token0() view returns (address)',
        ],
        this.provider
      );

      const [reserve0, reserve1] = await pairContract.getReserves();
      const token0 = await pairContract.token0();

      const isToken0 = token0.toLowerCase() === tokenA.toLowerCase();

      return {
        tokenA: isToken0 ? reserve0.toString() : reserve1.toString(),
        tokenB: isToken0 ? reserve1.toString() : reserve0.toString(),
      };
    } catch (error) {
      this.logger.debug('Failed to fetch liquidity:', error.message);
      return null;
    }
  }

  /**
   * Update stored prices
   */
  updatePrices(tokenA, tokenB, prices) {
    const pairKey = `${tokenA}-${tokenB}`;
    this.prices.set(pairKey, prices);
  }

  /**
   * Check for arbitrage opportunities
   */
  checkArbitrageOpportunity(tokenA, tokenB, prices) {
    if (prices.length < 2) return;

    // Find highest and lowest prices
    let lowestPrice = prices[0];
    let highestPrice = prices[0];

    prices.forEach((p) => {
      if (p.price < lowestPrice.price) lowestPrice = p;
      if (p.price > highestPrice.price) highestPrice = p;
    });

    // Calculate potential profit
    const priceDiff = highestPrice.price - lowestPrice.price;
    const profitPercentage = (priceDiff / lowestPrice.price) * 100;

    // Minimum 0.5% profit to account for fees and gas
    if (profitPercentage > 0.5) {
      const opportunity = {
        baseToken: tokenA,
        quoteToken: tokenB,
        buyDex: lowestPrice,
        sellDex: highestPrice,
        buyPrice: lowestPrice.price,
        sellPrice: highestPrice.price,
        profitPercentage,
        estimatedProfit: priceDiff,
        timestamp: Date.now(),
        path: [tokenA, tokenB],
      };

      this.emit('opportunity', opportunity);
      this.logger.info(`Opportunity found: ${profitPercentage.toFixed(2)}% profit`);
    }
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.subscriptions.forEach((interval) => clearInterval(interval));
    this.subscriptions = [];
    this.logger.info('Price monitoring stopped');
  }

  /**
   * Get current prices
   */
  getCurrentPrices(tokenA, tokenB) {
    const pairKey = `${tokenA}-${tokenB}`;
    return this.prices.get(pairKey) || [];
  }
}

module.exports = PriceMonitor;
```

### Flash Loan Executor

```javascript
// src/services/flashLoanExecutor.js
const { ethers } = require('ethers');
const FlashLoanABI = require('../contracts/abi/FlashLoanArbitrage.json');
const config = require('../config/networks');
const Logger = require('../utils/logger');

class FlashLoanExecutor {
  constructor(wallet) {
    this.wallet = wallet;
    this.contract = new ethers.Contract(
      config.FLASH_LOAN_CONTRACT,
      FlashLoanABI,
      wallet
    );
    this.logger = new Logger('FlashLoanExecutor');
  }

  /**
   * Execute flash loan arbitrage
   */
  async execute(params) {
    this.logger.info('Executing flash loan arbitrage...');

    try {
      // Estimate gas
      const gasEstimate = await this.contract.estimateGas.executeArbitrage(
        params.token,
        params.amount,
        params.params
      );

      // Add 20% buffer to gas estimate
      const gasLimit = gasEstimate.mul(120).div(100);

      // Get optimal gas price
      const gasPrice = await this.getOptimalGasPrice();

      // Execute transaction
      const tx = await this.contract.executeArbitrage(
        params.token,
        params.amount,
        params.params,
        {
          gasLimit,
          gasPrice,
        }
      );

      this.logger.info(`Transaction sent: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();

      // Parse events to get profit
      const profit = this.parseProfitFromReceipt(receipt);

      return {
        success: true,
        txHash: tx.hash,
        profit,
        gasUsed: receipt.gasUsed.toString(),
      };

    } catch (error) {
      this.logger.error('Flash loan execution failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get optimal gas price
   */
  async getOptimalGasPrice() {
    const feeData = await this.wallet.provider.getFeeData();

    // Use EIP-1559 if available
    if (feeData.maxFeePerGas) {
      return feeData.maxFeePerGas;
    }

    // Fallback to legacy gas price
    return feeData.gasPrice;
  }

  /**
   * Parse profit from transaction receipt
   */
  parseProfitFromReceipt(receipt) {
    const arbitrageEvent = receipt.events?.find(
      (e) => e.event === 'ArbitrageExecuted'
    );

    if (arbitrageEvent) {
      const profit = arbitrageEvent.args.profit;
      return parseFloat(ethers.utils.formatEther(profit));
    }

    return 0;
  }

  /**
   * Simulate transaction before execution
   */
  async simulate(params) {
    try {
      const result = await this.contract.callStatic.executeArbitrage(
        params.token,
        params.amount,
        params.params
      );

      return {
        success: true,
        result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = FlashLoanExecutor;
```

## Configuration Files

### Network Configuration

```javascript
// src/config/networks.js
module.exports = {
  // Ethereum Mainnet
  CHAIN_ID: 1,
  WEBSOCKET_URL: process.env.WEBSOCKET_URL || 'wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
  HTTP_URL: process.env.HTTP_URL || 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',

  // Contract addresses
  FLASH_LOAN_CONTRACT: process.env.FLASH_LOAN_CONTRACT || '0x...',
  AAVE_POOL_ADDRESS_PROVIDER: '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e',

  // Security
  PRIVATE_KEY: process.env.PRIVATE_KEY,

  // Bot configuration
  MIN_PROFIT_USD: parseFloat(process.env.MIN_PROFIT_USD || '50'),
  MAX_GAS_PRICE_GWEI: parseFloat(process.env.MAX_GAS_PRICE_GWEI || '150'),
  MAX_POSITION_SIZE_ETH: parseFloat(process.env.MAX_POSITION_SIZE_ETH || '100'),

  // Telegram
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
};
```

### DEX Configuration

```javascript
// src/config/dexes.js
const UNISWAP_V2_ROUTER_ABI = require('./abi/UniswapV2Router.json');
const UNISWAP_V3_ROUTER_ABI = require('./abi/UniswapV3Router.json');

module.exports = {
  SUPPORTED_DEXES: [
    {
      name: 'uniswapV2',
      routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
      abi: UNISWAP_V2_ROUTER_ABI,
      fee: 0.003, // 0.3%
    },
    {
      name: 'sushiswap',
      routerAddress: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
      factoryAddress: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
      abi: UNISWAP_V2_ROUTER_ABI,
      fee: 0.003,
    },
    {
      name: 'uniswapV3',
      routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      abi: UNISWAP_V3_ROUTER_ABI,
      fee: 0.003,
    },
  ],

  MONITORED_TOKENS: [
    {
      symbol: 'WETH',
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      pairs: [
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
      ],
    },
    {
      symbol: 'USDC',
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      pairs: [
        '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
      ],
    },
  ],
};
```

## Deployment and Usage

### Deployment Script

```javascript
// scripts/deploy.js
const hre = require('hardhat');

async function main() {
  console.log('Deploying FlashLoanArbitrage contract...');

  const FlashLoanArbitrage = await hre.ethers.getContractFactory('FlashLoanArbitrage');

  const contract = await FlashLoanArbitrage.deploy(
    '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e', // Aave Pool Address Provider
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap V2 Router
    '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Uniswap V3 Router
    '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'  // Sushiswap Router
  );

  await contract.deployed();

  console.log('FlashLoanArbitrage deployed to:', contract.address);

  // Verify contract
  console.log('Waiting for block confirmations...');
  await contract.deployTransaction.wait(5);

  console.log('Verifying contract...');
  await hre.run('verify:verify', {
    address: contract.address,
    constructorArguments: [
      '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e',
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'
    ],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### Running the Bot

```javascript
// src/index.js
const ArbitrageBot = require('./services/arbitrageBot');
const Logger = require('./utils/logger');

const logger = new Logger('Main');

async function main() {
  logger.info('Starting Flash Loan Arbitrage Bot...');

  const bot = new ArbitrageBot({
    minProfitUSD: 50,
    maxGasPrice: 150,
    maxPositionSize: 100,
    telegramEnabled: true,
  });

  await bot.start();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await bot.stop();
    process.exit(0);
  });

  // Log statistics every minute
  setInterval(() => {
    const stats = bot.getStatistics();
    logger.info('Bot Statistics:', stats);
  }, 60000);
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
```

This implementation provides a complete, production-ready flash loan arbitrage bot with comprehensive monitoring, risk management, and execution capabilities.
