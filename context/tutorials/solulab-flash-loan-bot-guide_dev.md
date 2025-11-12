**Source:** https://www.solulab.com/how-to-build-crypto-arbitrage-flash-loan-bot/
**Date:** 2024-2025


# Flash Loan Bot Technical Implementation - Level 2
**Technical Level:** Advanced
**Focus:** API Usage, Implementation Details, Best Practices

## Technical Architecture

### System Components

```
┌─────────────────────────────────────────────────────┐
│                 Flash Loan Bot System                │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────┐         ┌──────────────┐          │
│  │  Price Feed  │────────▶│  Arbitrage   │          │
│  │   Monitor    │         │   Detector   │          │
│  └──────────────┘         └──────┬───────┘          │
│         │                        │                   │
│         │                        ▼                   │
│         │              ┌──────────────┐              │
│         │              │ Profitability│              │
│         └─────────────▶│  Calculator  │              │
│                        └──────┬───────┘              │
│                               │                      │
│                               ▼                      │
│                     ┌──────────────────┐             │
│                     │  Smart Contract  │             │
│                     │   Flash Loan     │             │
│                     │   Executor       │             │
│                     └──────────────────┘             │
│                                                       │
└─────────────────────────────────────────────────────┘
```

## Smart Contract Implementation

### Base Flash Loan Contract Structure

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract FlashLoanArbitrage is FlashLoanSimpleReceiverBase {
    address private immutable owner;
    IUniswapV2Router02 private immutable uniswapRouter;
    IUniswapV2Router02 private immutable sushiswapRouter;

    // Events for monitoring
    event ArbitrageExecuted(
        address indexed token,
        uint256 amount,
        uint256 profit,
        uint256 timestamp
    );

    event FlashLoanRequested(
        address indexed token,
        uint256 amount,
        uint256 timestamp
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

    /**
     * @dev Initiates flash loan
     * @param asset Address of token to borrow
     * @param amount Amount to borrow
     */
    function requestFlashLoan(
        address asset,
        uint256 amount
    ) external onlyOwner {
        emit FlashLoanRequested(asset, amount, block.timestamp);

        bytes memory params = "";
        uint16 referralCode = 0;

        POOL.flashLoanSimple(
            address(this),
            asset,
            amount,
            params,
            referralCode
        );
    }

    /**
     * @dev Callback function called by Aave after receiving flash loan
     * @param asset Address of borrowed asset
     * @param amount Amount borrowed
     * @param premium Fee amount
     * @param initiator Address that initiated flash loan
     * @param params Additional parameters
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == address(POOL), "Caller must be POOL");
        require(initiator == address(this), "Invalid initiator");

        // Total amount to repay
        uint256 amountOwed = amount + premium;

        // Execute arbitrage logic
        uint256 profit = _executeArbitrage(asset, amount);

        // Ensure profitability
        require(profit > premium, "Unprofitable arbitrage");

        // Approve repayment
        IERC20(asset).approve(address(POOL), amountOwed);

        emit ArbitrageExecuted(asset, amount, profit - premium, block.timestamp);

        return true;
    }

    /**
     * @dev Internal arbitrage execution logic
     * @param asset Token address
     * @param amount Amount to trade
     * @return Gross profit before fees
     */
    function _executeArbitrage(
        address asset,
        uint256 amount
    ) internal returns (uint256) {
        uint256 balanceBefore = IERC20(asset).balanceOf(address(this));

        // Path for swaps
        address[] memory path = new address[](2);
        path[0] = asset;
        path[1] = _getCounterAsset(asset); // e.g., WETH, USDC

        // Step 1: Buy on Uniswap (assuming lower price)
        IERC20(asset).approve(address(uniswapRouter), amount);

        uint256[] memory amountsOut1 = uniswapRouter.swapExactTokensForTokens(
            amount,
            0, // Accept any amount (in production, calculate minimum)
            path,
            address(this),
            block.timestamp + 300
        );

        // Step 2: Sell on SushiSwap (assuming higher price)
        uint256 receivedAmount = amountsOut1[1];

        // Reverse path
        address[] memory pathReverse = new address[](2);
        pathReverse[0] = path[1];
        pathReverse[1] = asset;

        IERC20(path[1]).approve(address(sushiswapRouter), receivedAmount);

        uniswapRouter.swapExactTokensForTokens(
            receivedAmount,
            amount, // Must receive at least original amount + profit
            pathReverse,
            address(this),
            block.timestamp + 300
        );

        uint256 balanceAfter = IERC20(asset).balanceOf(address(this));

        return balanceAfter - balanceBefore;
    }

    /**
     * @dev Get counter asset for trading pair
     */
    function _getCounterAsset(address asset) internal pure returns (address) {
        // Logic to determine counter asset (WETH, USDC, etc.)
        // Implementation depends on your strategy
    }

    /**
     * @dev Emergency withdrawal function
     */
    function withdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner, balance);
    }

    /**
     * @dev Receive ETH
     */
    receive() external payable {}
}
```

## Off-Chain Bot Implementation

### Node.js Bot Architecture

```javascript
// bot.js - Main bot orchestrator
const ethers = require('ethers');
const config = require('./config');
const PriceMonitor = require('./modules/priceMonitor');
const ArbitrageDetector = require('./modules/arbitrageDetector');
const TransactionExecutor = require('./modules/transactionExecutor');

class FlashLoanBot {
    constructor() {
        this.provider = new ethers.providers.JsonRpcProvider(config.RPC_URL);
        this.wallet = new ethers.Wallet(config.PRIVATE_KEY, this.provider);

        this.contract = new ethers.Contract(
            config.CONTRACT_ADDRESS,
            config.CONTRACT_ABI,
            this.wallet
        );

        this.priceMonitor = new PriceMonitor(this.provider);
        this.arbitrageDetector = new ArbitrageDetector();
        this.executor = new TransactionExecutor(this.contract, this.wallet);

        this.isRunning = false;
        this.lastBlock = 0;
    }

    async start() {
        console.log('Starting Flash Loan Arbitrage Bot...');
        this.isRunning = true;

        // Subscribe to new blocks
        this.provider.on('block', async (blockNumber) => {
            if (blockNumber <= this.lastBlock) return;
            this.lastBlock = blockNumber;

            await this.scanForOpportunities();
        });

        // Also run continuous price monitoring
        setInterval(() => this.scanForOpportunities(), config.SCAN_INTERVAL);
    }

    async scanForOpportunities() {
        try {
            // Get current prices from multiple DEXs
            const prices = await this.priceMonitor.getAllPrices();

            // Detect arbitrage opportunities
            const opportunities = this.arbitrageDetector.findOpportunities(prices);

            // Execute profitable opportunities
            for (const opp of opportunities) {
                const isProfitable = await this.calculateProfitability(opp);

                if (isProfitable) {
                    await this.executor.execute(opp);
                }
            }
        } catch (error) {
            console.error('Error scanning opportunities:', error);
        }
    }

    async calculateProfitability(opportunity) {
        const {
            tokenIn,
            tokenOut,
            amountIn,
            expectedProfit,
            dexBuy,
            dexSell
        } = opportunity;

        // Calculate gas cost
        const gasPrice = await this.provider.getGasPrice();
        const estimatedGas = ethers.BigNumber.from('500000'); // Estimate
        const gasCost = gasPrice.mul(estimatedGas);

        // Calculate flash loan fee (0.09% for Aave)
        const flashLoanFee = amountIn.mul(9).div(10000);

        // Calculate net profit
        const netProfit = expectedProfit.sub(flashLoanFee).sub(gasCost);

        // Minimum profit threshold (e.g., $50)
        const minProfit = ethers.utils.parseEther('50');

        return netProfit.gt(minProfit);
    }

    stop() {
        this.isRunning = false;
        this.provider.removeAllListeners('block');
        console.log('Bot stopped');
    }
}

module.exports = FlashLoanBot;
```

### Price Monitor Module

```javascript
// modules/priceMonitor.js
const { ChainId, Token, WETH, Fetcher, Route } = require('@uniswap/sdk');
const ethers = require('ethers');

class PriceMonitor {
    constructor(provider) {
        this.provider = provider;
        this.cache = new Map();
        this.cacheTimeout = 5000; // 5 seconds

        // Initialize DEX routers
        this.dexes = {
            uniswap: {
                router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
                factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f'
            },
            sushiswap: {
                router: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
                factory: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac'
            },
            // Add more DEXs
        };
    }

    /**
     * Get prices from all monitored DEXs
     */
    async getAllPrices() {
        const tokens = config.MONITORED_TOKENS;
        const prices = {};

        for (const token of tokens) {
            prices[token.symbol] = {};

            for (const [dexName, dexConfig] of Object.entries(this.dexes)) {
                const price = await this.getPrice(token, dexName, dexConfig);
                prices[token.symbol][dexName] = price;
            }
        }

        return prices;
    }

    /**
     * Get price for specific token on specific DEX
     */
    async getPrice(token, dexName, dexConfig) {
        const cacheKey = `${token.symbol}_${dexName}`;

        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.price;
            }
        }

        try {
            // Get price using Uniswap SDK or direct contract calls
            const routerContract = new ethers.Contract(
                dexConfig.router,
                [
                    'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
                ],
                this.provider
            );

            const amountIn = ethers.utils.parseUnits('1', token.decimals);
            const path = [token.address, config.WETH_ADDRESS];

            const amounts = await routerContract.getAmountsOut(amountIn, path);
            const price = amounts[1];

            // Cache result
            this.cache.set(cacheKey, {
                price,
                timestamp: Date.now()
            });

            return price;
        } catch (error) {
            console.error(`Error getting price for ${token.symbol} on ${dexName}:`, error);
            return null;
        }
    }

    /**
     * Get price impact for a specific trade
     */
    async getPriceImpact(token, dex, amount) {
        const routerContract = new ethers.Contract(
            this.dexes[dex].router,
            [
                'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)'
            ],
            this.provider
        );

        const path = [token.address, config.WETH_ADDRESS];

        // Get price for 1 token
        const baseAmount = ethers.utils.parseUnits('1', token.decimals);
        const baseAmounts = await routerContract.getAmountsOut(baseAmount, path);
        const basePrice = baseAmounts[1];

        // Get price for actual amount
        const actualAmounts = await routerContract.getAmountsOut(amount, path);
        const actualPrice = actualAmounts[1].div(amount);

        // Calculate impact
        const impact = basePrice.sub(actualPrice).mul(10000).div(basePrice);

        return impact; // In basis points
    }
}

module.exports = PriceMonitor;
```

### Arbitrage Detector Module

```javascript
// modules/arbitrageDetector.js
const ethers = require('ethers');

class ArbitrageDetector {
    constructor() {
        this.minProfitBps = 50; // 0.5% minimum profit
    }

    /**
     * Find arbitrage opportunities from price data
     */
    findOpportunities(prices) {
        const opportunities = [];

        for (const [tokenSymbol, dexPrices] of Object.entries(prices)) {
            const dexNames = Object.keys(dexPrices);

            // Compare all DEX pairs
            for (let i = 0; i < dexNames.length; i++) {
                for (let j = i + 1; j < dexNames.length; j++) {
                    const dex1 = dexNames[i];
                    const dex2 = dexNames[j];

                    const price1 = dexPrices[dex1];
                    const price2 = dexPrices[dex2];

                    if (!price1 || !price2) continue;

                    // Calculate price difference
                    const opportunity = this.calculateOpportunity(
                        tokenSymbol,
                        dex1,
                        price1,
                        dex2,
                        price2
                    );

                    if (opportunity && opportunity.profitBps >= this.minProfitBps) {
                        opportunities.push(opportunity);
                    }
                }
            }
        }

        // Sort by profitability
        opportunities.sort((a, b) => b.profitBps - a.profitBps);

        return opportunities;
    }

    /**
     * Calculate arbitrage opportunity details
     */
    calculateOpportunity(tokenSymbol, dex1, price1, dex2, price2) {
        let buyDex, sellDex, buyPrice, sellPrice;

        if (price1.lt(price2)) {
            buyDex = dex1;
            sellDex = dex2;
            buyPrice = price1;
            sellPrice = price2;
        } else {
            buyDex = dex2;
            sellDex = dex1;
            buyPrice = price2;
            sellPrice = price1;
        }

        // Calculate profit in basis points
        const profitBps = sellPrice.sub(buyPrice)
            .mul(10000)
            .div(buyPrice)
            .toNumber();

        // Determine optimal trade size
        const optimalSize = this.calculateOptimalSize(
            tokenSymbol,
            buyDex,
            sellDex,
            buyPrice,
            sellPrice
        );

        return {
            tokenSymbol,
            buyDex,
            sellDex,
            buyPrice,
            sellPrice,
            profitBps,
            optimalSize,
            timestamp: Date.now()
        };
    }

    /**
     * Calculate optimal trade size considering liquidity and slippage
     */
    calculateOptimalSize(tokenSymbol, buyDex, sellDex, buyPrice, sellPrice) {
        // Simplified calculation - in production, query actual liquidity
        const maxSize = ethers.utils.parseEther('100'); // Max 100 tokens

        // Factor in expected slippage
        // In production, call getAmountsOut with different sizes

        return maxSize;
    }

    /**
     * Validate opportunity is still profitable
     */
    async validateOpportunity(opportunity, priceMonitor) {
        const currentPrices = await priceMonitor.getAllPrices();
        const tokenPrices = currentPrices[opportunity.tokenSymbol];

        if (!tokenPrices) return false;

        const buyPrice = tokenPrices[opportunity.buyDex];
        const sellPrice = tokenPrices[opportunity.sellDex];

        if (!buyPrice || !sellPrice) return false;

        const currentProfitBps = sellPrice.sub(buyPrice)
            .mul(10000)
            .div(buyPrice)
            .toNumber();

        return currentProfitBps >= this.minProfitBps;
    }
}

module.exports = ArbitrageDetector;
```

## API Integration

### Chainlink Price Feeds

```solidity
// contracts/interfaces/IPriceFeed.sol
interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

// Integration in contract
contract FlashLoanArbitrageWithOracle is FlashLoanArbitrage {
    mapping(address => AggregatorV3Interface) public priceFeeds;

    function setPriceFeed(address token, address feed) external onlyOwner {
        priceFeeds[token] = AggregatorV3Interface(feed);
    }

    function getChainlinkPrice(address token) public view returns (uint256) {
        AggregatorV3Interface feed = priceFeeds[token];
        require(address(feed) != address(0), "No price feed");

        (, int256 price, , uint256 updatedAt, ) = feed.latestRoundData();

        require(price > 0, "Invalid price");
        require(block.timestamp - updatedAt < 3600, "Stale price");

        return uint256(price);
    }
}
```

### The Graph API Integration

```javascript
// modules/graphqlClient.js
const { request, gql } = require('graphql-request');

class GraphQLClient {
    constructor() {
        this.endpoints = {
            uniswapV2: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
            uniswapV3: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
            sushiswap: 'https://api.thegraph.com/subgraphs/name/sushiswap/exchange'
        };
    }

    async getUniswapPairs(tokenAddress) {
        const query = gql`
            query GetPairs($token: String!) {
                pairs(
                    where: {
                        or: [
                            { token0: $token },
                            { token1: $token }
                        ]
                    }
                    orderBy: volumeUSD
                    orderDirection: desc
                    first: 10
                ) {
                    id
                    token0 {
                        id
                        symbol
                        decimals
                    }
                    token1 {
                        id
                        symbol
                        decimals
                    }
                    reserve0
                    reserve1
                    reserveUSD
                    volumeUSD
                    token0Price
                    token1Price
                }
            }
        `;

        const variables = { token: tokenAddress.toLowerCase() };
        const data = await request(this.endpoints.uniswapV2, query, variables);

        return data.pairs;
    }

    async getPoolLiquidity(pairAddress) {
        const query = gql`
            query GetPool($pair: String!) {
                pair(id: $pair) {
                    reserve0
                    reserve1
                    reserveUSD
                    volumeUSD
                    txCount
                }
            }
        `;

        const variables = { pair: pairAddress.toLowerCase() };
        const data = await request(this.endpoints.uniswapV2, query, variables);

        return data.pair;
    }
}

module.exports = GraphQLClient;
```

## Best Practices

### 1. Gas Optimization

```solidity
// Use immutable for values set in constructor
address private immutable owner;
IUniswapV2Router02 private immutable router;

// Pack variables to save storage slots
struct Trade {
    uint128 amountIn;      // Instead of uint256
    uint128 amountOut;
    address dex;           // 20 bytes
    uint48 timestamp;      // 6 bytes - fits in same slot
    bool executed;         // 1 byte
}

// Use unchecked for safe math
unchecked {
    uint256 total = amount + fee; // Safe when overflow impossible
}

// Cache array length
uint256 length = trades.length;
for (uint256 i = 0; i < length; i++) {
    // Process trades[i]
}

// Use custom errors (cheaper than require strings)
error InsufficientProfit();
error Unauthorized();

if (profit < minProfit) revert InsufficientProfit();
```

### 2. Security Best Practices

```solidity
// Reentrancy guard
uint256 private locked = 1;

modifier nonReentrant() {
    require(locked == 1, "Reentrant call");
    locked = 2;
    _;
    locked = 1;
}

// Check-Effects-Interactions pattern
function executeArbitrage() external nonReentrant {
    // 1. Checks
    require(msg.sender == owner, "Not owner");
    require(amount > 0, "Invalid amount");

    // 2. Effects
    lastExecutionTime = block.timestamp;

    // 3. Interactions
    IERC20(token).transfer(recipient, amount);
}

// Circuit breaker
bool public paused = false;

modifier whenNotPaused() {
    require(!paused, "Contract paused");
    _;
}

function pause() external onlyOwner {
    paused = true;
}

// Time locks for critical operations
uint256 public constant TIMELOCK = 2 days;
mapping(bytes32 => uint256) public queuedTransactions;

function queueTransaction(address target, bytes memory data) external onlyOwner {
    bytes32 txHash = keccak256(abi.encode(target, data, block.timestamp));
    queuedTransactions[txHash] = block.timestamp + TIMELOCK;
}
```

### 3. Monitoring and Logging

```javascript
// modules/logger.js
const winston = require('winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Usage
logger.info('Opportunity detected', {
    token: 'USDC',
    profit: '1250',
    buyDex: 'Uniswap',
    sellDex: 'SushiSwap'
});

logger.error('Transaction failed', {
    error: error.message,
    opportunity: JSON.stringify(opp)
});
```

### 4. Error Handling

```javascript
class TransactionExecutor {
    async execute(opportunity) {
        let txHash;
        try {
            // Validate opportunity first
            await this.validateOpportunity(opportunity);

            // Estimate gas
            const gasEstimate = await this.estimateGas(opportunity);

            // Build transaction
            const tx = await this.buildTransaction(opportunity, gasEstimate);

            // Send transaction
            const txResponse = await this.wallet.sendTransaction(tx);
            txHash = txResponse.hash;

            logger.info(`Transaction sent: ${txHash}`);

            // Wait for confirmation
            const receipt = await txResponse.wait(1);

            if (receipt.status === 1) {
                logger.info(`Transaction successful: ${txHash}`);
                await this.recordSuccess(opportunity, receipt);
            } else {
                logger.error(`Transaction failed: ${txHash}`);
                await this.recordFailure(opportunity, receipt);
            }

            return receipt;

        } catch (error) {
            logger.error('Execution error', {
                error: error.message,
                stack: error.stack,
                opportunity: JSON.stringify(opportunity),
                txHash
            });

            await this.handleError(error, opportunity);
            throw error;
        }
    }

    async handleError(error, opportunity) {
        if (error.code === 'INSUFFICIENT_FUNDS') {
            logger.warn('Insufficient funds for gas');
            // Alert operator
        } else if (error.message.includes('execution reverted')) {
            logger.info('Transaction would revert - opportunity no longer profitable');
            // This is normal, don't alert
        } else {
            // Unknown error - alert immediately
            await this.sendAlert(error, opportunity);
        }
    }
}
```

### 5. Configuration Management

```javascript
// config.js
require('dotenv').config();

module.exports = {
    // Network
    RPC_URL: process.env.RPC_URL || 'https://eth-mainnet.alchemyapi.io/v2/YOUR-KEY',
    CHAIN_ID: parseInt(process.env.CHAIN_ID || '1'),

    // Wallet
    PRIVATE_KEY: process.env.PRIVATE_KEY,

    // Contracts
    CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS,
    WETH_ADDRESS: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',

    // DEX Routers
    UNISWAP_ROUTER: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    SUSHISWAP_ROUTER: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',

    // Trading Parameters
    MIN_PROFIT_USD: parseFloat(process.env.MIN_PROFIT_USD || '50'),
    MAX_TRADE_SIZE_ETH: parseFloat(process.env.MAX_TRADE_SIZE_ETH || '10'),
    SLIPPAGE_TOLERANCE_BPS: parseInt(process.env.SLIPPAGE_TOLERANCE_BPS || '100'), // 1%

    // Bot Behavior
    SCAN_INTERVAL: parseInt(process.env.SCAN_INTERVAL || '5000'), // ms
    MAX_GAS_PRICE_GWEI: parseInt(process.env.MAX_GAS_PRICE_GWEI || '100'),

    // Monitoring
    ENABLE_TELEGRAM_ALERTS: process.env.ENABLE_TELEGRAM_ALERTS === 'true',
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,

    // Tokens to monitor
    MONITORED_TOKENS: [
        {
            symbol: 'USDC',
            address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            decimals: 6
        },
        {
            symbol: 'DAI',
            address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            decimals: 18
        }
        // Add more tokens
    ]
};
```

## Testing Strategy

### Unit Tests

```javascript
// test/FlashLoanArbitrage.test.js
const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('FlashLoanArbitrage', function() {
    let contract, owner, addr1;

    beforeEach(async function() {
        [owner, addr1] = await ethers.getSigners();

        const FlashLoanArbitrage = await ethers.getContractFactory('FlashLoanArbitrage');
        contract = await FlashLoanArbitrage.deploy(
            AAVE_POOL_PROVIDER,
            UNISWAP_ROUTER,
            SUSHISWAP_ROUTER
        );
        await contract.deployed();
    });

    it('Should execute profitable arbitrage', async function() {
        const amount = ethers.utils.parseEther('1000');

        await expect(contract.requestFlashLoan(USDC_ADDRESS, amount))
            .to.emit(contract, 'ArbitrageExecuted')
            .withArgs(USDC_ADDRESS, amount, anyValue, anyValue);
    });

    it('Should revert on unprofitable arbitrage', async function() {
        // Set up unprofitable scenario
        const amount = ethers.utils.parseEther('10');

        await expect(contract.requestFlashLoan(USDC_ADDRESS, amount))
            .to.be.revertedWith('Unprofitable arbitrage');
    });
});
```

### Integration Tests with Mainnet Fork

```javascript
// test/integration.test.js
const { ethers, network } = require('hardhat');

describe('Integration Tests', function() {
    beforeEach(async function() {
        // Fork mainnet
        await network.provider.request({
            method: 'hardhat_reset',
            params: [{
                forking: {
                    jsonRpcUrl: process.env.MAINNET_RPC_URL,
                    blockNumber: 18000000
                }
            }]
        });
    });

    it('Should execute real arbitrage on mainnet fork', async function() {
        // Deploy contract
        const contract = await deployContract();

        // Fund contract with USDC
        await fundContract(contract.address, '10000', USDC_ADDRESS);

        // Execute flash loan
        const tx = await contract.requestFlashLoan(
            USDC_ADDRESS,
            ethers.utils.parseUnits('100000', 6)
        );

        const receipt = await tx.wait();
        expect(receipt.status).to.equal(1);
    });
});
```

## Deployment Checklist

- [ ] Smart contract audited by reputable firm
- [ ] Gas optimization reviewed
- [ ] Emergency pause mechanism tested
- [ ] Withdrawal function verified
- [ ] Access controls properly configured
- [ ] Event logging comprehensive
- [ ] Testnet deployment successful
- [ ] Mainnet fork testing passed
- [ ] Monitoring and alerting configured
- [ ] Backup RPC endpoints configured
- [ ] Private key secured (hardware wallet/HSM)
- [ ] Circuit breaker thresholds set
- [ ] Documentation complete

## Performance Optimization

### Database for Historical Data

```javascript
// modules/database.js
const mongoose = require('mongoose');

const opportunitySchema = new mongoose.Schema({
    tokenSymbol: String,
    buyDex: String,
    sellDex: String,
    profitBps: Number,
    executed: Boolean,
    txHash: String,
    actualProfit: String,
    gasUsed: Number,
    timestamp: Date
});

const Opportunity = mongoose.model('Opportunity', opportunitySchema);

class Database {
    async connect() {
        await mongoose.connect(process.env.MONGODB_URI);
    }

    async saveOpportunity(opp) {
        const doc = new Opportunity(opp);
        await doc.save();
    }

    async getSuccessRate(hours = 24) {
        const since = new Date(Date.now() - hours * 3600000);

        const total = await Opportunity.countDocuments({
            timestamp: { $gte: since },
            executed: true
        });

        const successful = await Opportunity.countDocuments({
            timestamp: { $gte: since },
            executed: true,
            actualProfit: { $gt: '0' }
        });

        return successful / total;
    }
}
```

## Key Takeaways

1. **Modular Architecture** - Separate concerns (monitoring, detection, execution)
2. **Comprehensive Testing** - Unit tests, integration tests, mainnet forks
3. **Gas Optimization** - Every wei counts in competitive arbitrage
4. **Security First** - Reentrancy guards, access controls, circuit breakers
5. **Robust Error Handling** - Log everything, fail gracefully
6. **Performance Monitoring** - Track success rates and profitability
7. **Configuration Management** - Environment-specific settings
8. **API Integration** - Leverage The Graph, Chainlink, DEX APIs
