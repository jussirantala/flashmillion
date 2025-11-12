**Source:** https://github.com/novustch/Arbitrage-Bot
**Date:** November 2024

# Arbitrage Bot by novustch - Technical Implementation Guide

## Overview

This document provides comprehensive technical analysis of the novustch Arbitrage-Bot implementation, including detailed code architecture, deployment procedures, integration patterns, optimization strategies, and production deployment guidelines for multi-chain DEX arbitrage.

**Repository:** https://github.com/novustch/Arbitrage-Bot
**Author:** novustch
**Stars:** 28
**Language Split:** JavaScript (84%), Solidity (16%)
**License:** MIT
**Status:** Active educational project for multi-chain arbitrage

## Complete Repository Structure

```
Arbitrage-Bot/
├── contracts/                      # Solidity smart contracts
│   ├── Arbitrage.sol              # Main arbitrage contract
│   ├── interfaces/                # DEX and token interfaces
│   │   ├── IUniswapV2Router.sol
│   │   ├── IUniswapV2Pair.sol
│   │   └── IERC20.sol
│   └── libraries/                 # Utility libraries
│       └── SafeMath.sol
│
├── scripts/                       # Deployment and testing scripts
│   ├── 1_deploy.js               # Contract deployment
│   ├── 2_manipulate.js           # Price manipulation for testing
│   └── utils/                    # Script utilities
│
├── helpers/                       # Bot helper functions
│   ├── server.js                 # Web server for monitoring
│   ├── initialization.js         # Setup and config loading
│   └── calculations.js           # Profit calculations
│
├── test/                         # Test suite
│   ├── arbitrage.test.js        # Contract tests
│   └── bot.test.js              # Bot logic tests
│
├── bot.js                        # Main bot execution file
├── config.json                   # Configuration parameters
├── hardhat.config.js            # Hardhat network setup
├── package.json                 # Node.js dependencies
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
├── LICENSE                      # MIT License
└── README.md                    # Documentation
```

## Smart Contract Architecture

### Arbitrage.sol - Core Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./interfaces/IUniswapV2Router.sol";
import "./interfaces/IERC20.sol";

/**
 * @title Arbitrage
 * @notice Executes arbitrage trades between DEXs
 * @dev Supports Uniswap V2 compatible exchanges
 */
contract Arbitrage {
    // Owner address
    address public owner;

    // DEX router addresses
    IUniswapV2Router02 public immutable uniswapRouter;
    IUniswapV2Router02 public immutable sushiswapRouter;

    // Events
    event ArbitrageExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 profit
    );

    event OwnershipTransferred(
        address indexed previousOwner,
        address indexed newOwner
    );

    /**
     * @dev Constructor sets owner and router addresses
     * @param _uniswapRouter Uniswap V2 router address
     * @param _sushiswapRouter Sushiswap router address
     */
    constructor(
        address _uniswapRouter,
        address _sushiswapRouter
    ) {
        owner = msg.sender;
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        sushiswapRouter = IUniswapV2Router02(_sushiswapRouter);
    }

    /**
     * @dev Modifier to restrict access to owner
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /**
     * @dev Execute arbitrage between DEXs
     * @param tokenA First token address
     * @param tokenB Second token address
     * @param amount Amount to trade
     */
    function executeArbitrage(
        address tokenA,
        address tokenB,
        uint256 amount
    ) external onlyOwner {
        // Approve tokens for Uniswap
        IERC20(tokenA).approve(address(uniswapRouter), amount);

        // Swap on Uniswap (buy tokenB with tokenA)
        address[] memory path1 = new address[](2);
        path1[0] = tokenA;
        path1[1] = tokenB;

        uint256[] memory amounts1 = uniswapRouter.swapExactTokensForTokens(
            amount,
            0, // Accept any amount (for testing)
            path1,
            address(this),
            block.timestamp + 300
        );

        uint256 tokenBReceived = amounts1[1];

        // Approve tokens for Sushiswap
        IERC20(tokenB).approve(address(sushiswapRouter), tokenBReceived);

        // Swap on Sushiswap (sell tokenB for tokenA)
        address[] memory path2 = new address[](2);
        path2[0] = tokenB;
        path2[1] = tokenA;

        uint256[] memory amounts2 = sushiswapRouter.swapExactTokensForTokens(
            tokenBReceived,
            amount, // Minimum should be original amount
            path2,
            address(this),
            block.timestamp + 300
        );

        uint256 tokenAFinal = amounts2[1];

        // Calculate profit
        require(tokenAFinal > amount, "No profit");
        uint256 profit = tokenAFinal - amount;

        emit ArbitrageExecuted(tokenA, tokenB, amount, profit);
    }

    /**
     * @dev Get reserves from a pair
     * @param router DEX router address
     * @param tokenA First token
     * @param tokenB Second token
     */
    function getReserves(
        IUniswapV2Router02 router,
        address tokenA,
        address tokenB
    ) public view returns (uint256 reserveA, uint256 reserveB) {
        address factory = router.factory();
        address pair = IUniswapV2Factory(factory).getPair(tokenA, tokenB);

        (uint256 reserve0, uint256 reserve1,) = IUniswapV2Pair(pair).getReserves();

        (reserveA, reserveB) = tokenA < tokenB
            ? (reserve0, reserve1)
            : (reserve1, reserve0);
    }

    /**
     * @dev Calculate output amount for a given input
     * @param amountIn Input amount
     * @param reserveIn Input reserve
     * @param reserveOut Output reserve
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountOut) {
        require(amountIn > 0, "Invalid input amount");
        require(reserveIn > 0 && reserveOut > 0, "Invalid reserves");

        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
    }

    /**
     * @dev Withdraw tokens from contract
     * @param token Token address
     * @param amount Amount to withdraw
     */
    function withdraw(address token, uint256 amount) external onlyOwner {
        require(
            IERC20(token).transfer(owner, amount),
            "Transfer failed"
        );
    }

    /**
     * @dev Withdraw ETH from contract
     */
    function withdrawETH() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    /**
     * @dev Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    // Receive ETH
    receive() external payable {}
}
```

### Interface Definitions

**IUniswapV2Router.sol:**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IUniswapV2Router02 {
    function factory() external pure returns (address);
    function WETH() external pure returns (address);

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(
        uint256 amountIn,
        address[] calldata path
    ) external view returns (uint256[] memory amounts);

    function getAmountsIn(
        uint256 amountOut,
        address[] calldata path
    ) external view returns (uint256[] memory amounts);
}

interface IUniswapV2Factory {
    function getPair(
        address tokenA,
        address tokenB
    ) external view returns (address pair);
}

interface IUniswapV2Pair {
    function getReserves() external view returns (
        uint112 reserve0,
        uint112 reserve1,
        uint32 blockTimestampLast
    );

    function token0() external view returns (address);
    function token1() external view returns (address);
}
```

## Bot Implementation (bot.js)

### Main Bot Logic

```javascript
const { ethers } = require('ethers');
const config = require('./config.json');
require('dotenv').config();

// Contract ABI (simplified)
const ARBITRAGE_ABI = [
    "function executeArbitrage(address,address,uint256) external",
    "function getReserves(address,address,address) public view returns (uint256,uint256)",
    "function getAmountOut(uint256,uint256,uint256) public pure returns (uint256)",
    "event ArbitrageExecuted(address indexed,address indexed,uint256,uint256)"
];

class ArbitrageBot {
    constructor() {
        this.provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.contract = new ethers.Contract(
            config.arbitrageContractAddress,
            ARBITRAGE_ABI,
            this.wallet
        );

        this.config = config;
        this.isRunning = false;
        this.lastExecutionTime = 0;
        this.executionCount = 0;
        this.profitTotal = ethers.BigNumber.from(0);
    }

    /**
     * Initialize bot and start monitoring
     */
    async start() {
        console.log('Starting Arbitrage Bot...');
        console.log(`Wallet: ${this.wallet.address}`);
        console.log(`Contract: ${this.contract.address}`);

        this.isRunning = true;

        // Start monitoring loop
        this.monitorLoop();

        // Listen to events
        this.listenToEvents();
    }

    /**
     * Main monitoring loop
     */
    async monitorLoop() {
        while (this.isRunning) {
            try {
                // Check each token pair
                for (const pair of this.config.tokenPairs) {
                    await this.checkArbitrageOpportunity(pair);
                }

                // Wait before next check
                await this.sleep(this.config.checkInterval || 5000);

            } catch (error) {
                console.error('Error in monitor loop:', error);
                await this.sleep(10000); // Wait longer on error
            }
        }
    }

    /**
     * Check arbitrage opportunity for a token pair
     */
    async checkArbitrageOpportunity(pair) {
        const { tokenA, tokenB, amount } = pair;

        console.log(`\nChecking ${pair.name}...`);

        try {
            // Get reserves from both DEXs
            const [reservesUni, reservesSushi] = await Promise.all([
                this.contract.getReserves(
                    this.config.uniswapRouter,
                    tokenA,
                    tokenB
                ),
                this.contract.getReserves(
                    this.config.sushiswapRouter,
                    tokenA,
                    tokenB
                )
            ]);

            // Calculate expected outputs
            const outputUni = await this.contract.getAmountOut(
                amount,
                reservesUni[0],
                reservesUni[1]
            );

            const outputSushi = await this.contract.getAmountOut(
                outputUni,
                reservesSushi[1],
                reservesSushi[0]
            );

            // Calculate profit
            const profit = outputSushi.sub(amount);
            const profitPercentage = profit.mul(10000).div(amount);

            console.log(`Amount In: ${ethers.utils.formatEther(amount)} ETH`);
            console.log(`Expected Out (Uni->Sushi): ${ethers.utils.formatEther(outputSushi)} ETH`);
            console.log(`Profit: ${ethers.utils.formatEther(profit)} ETH (${profitPercentage.toNumber() / 100}%)`);

            // Check if profitable
            if (this.isProfitable(profit, amount)) {
                console.log('✅ PROFITABLE OPPORTUNITY FOUND!');
                await this.executeArbitrage(tokenA, tokenB, amount);
            } else {
                console.log('❌ Not profitable');
            }

        } catch (error) {
            console.error(`Error checking ${pair.name}:`, error.message);
        }
    }

    /**
     * Check if arbitrage is profitable after costs
     */
    isProfitable(profit, amount) {
        // Calculate gas cost
        const gasPrice = ethers.utils.parseUnits(
            this.config.maxGasPrice || '100',
            'gwei'
        );
        const estimatedGas = ethers.BigNumber.from(this.config.estimatedGas || 300000);
        const gasCost = gasPrice.mul(estimatedGas);

        // Net profit after gas
        const netProfit = profit.sub(gasCost);

        // Check minimum profit threshold
        const minProfit = ethers.utils.parseEther(
            this.config.minProfit || '0.01'
        );

        return netProfit.gt(minProfit);
    }

    /**
     * Execute arbitrage transaction
     */
    async executeArbitrage(tokenA, tokenB, amount) {
        console.log('\n🚀 EXECUTING ARBITRAGE...');

        try {
            // Estimate gas
            const gasLimit = await this.contract.estimateGas.executeArbitrage(
                tokenA,
                tokenB,
                amount
            );

            // Execute transaction
            const tx = await this.contract.executeArbitrage(
                tokenA,
                tokenB,
                amount,
                {
                    gasLimit: gasLimit.mul(120).div(100), // 20% buffer
                    gasPrice: ethers.utils.parseUnits(
                        this.config.maxGasPrice || '100',
                        'gwei'
                    )
                }
            );

            console.log(`Transaction sent: ${tx.hash}`);
            console.log('Waiting for confirmation...');

            // Wait for confirmation
            const receipt = await tx.wait();

            console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
            console.log(`Gas used: ${receipt.gasUsed.toString()}`);

            this.executionCount++;
            this.lastExecutionTime = Date.now();

            return receipt;

        } catch (error) {
            console.error('❌ Execution failed:', error.message);
            throw error;
        }
    }

    /**
     * Listen to contract events
     */
    listenToEvents() {
        this.contract.on('ArbitrageExecuted', (tokenIn, tokenOut, amountIn, profit, event) => {
            console.log('\n📊 ARBITRAGE EXECUTED EVENT:');
            console.log(`Token In: ${tokenIn}`);
            console.log(`Token Out: ${tokenOut}`);
            console.log(`Amount In: ${ethers.utils.formatEther(amountIn)} ETH`);
            console.log(`Profit: ${ethers.utils.formatEther(profit)} ETH`);
            console.log(`Block: ${event.blockNumber}`);
            console.log(`Tx: ${event.transactionHash}`);

            this.profitTotal = this.profitTotal.add(profit);
        });
    }

    /**
     * Stop bot
     */
    stop() {
        console.log('\nStopping bot...');
        this.isRunning = false;
        this.contract.removeAllListeners();
    }

    /**
     * Get bot statistics
     */
    getStats() {
        return {
            executionCount: this.executionCount,
            totalProfit: ethers.utils.formatEther(this.profitTotal),
            lastExecution: this.lastExecutionTime,
            isRunning: this.isRunning
        };
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Main execution
async function main() {
    const bot = new ArbitrageBot();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        bot.stop();
        console.log('\nBot stopped.');
        process.exit(0);
    });

    // Start bot
    await bot.start();
}

// Run if executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = ArbitrageBot;
```

## Configuration Management

### config.json Structure

```json
{
  "arbitrageContractAddress": "0x...",
  "uniswapRouter": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  "sushiswapRouter": "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",

  "tokenPairs": [
    {
      "name": "WETH/DAI",
      "tokenA": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "tokenB": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      "amount": "1000000000000000000"
    },
    {
      "name": "WETH/USDC",
      "tokenA": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "tokenB": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "amount": "1000000000000000000"
    }
  ],

  "checkInterval": 5000,
  "minProfit": "0.01",
  "maxGasPrice": "100",
  "estimatedGas": 300000,

  "networks": {
    "ethereum": {
      "chainId": 1,
      "name": "Ethereum Mainnet",
      "rpcUrl": "https://mainnet.infura.io/v3/YOUR_KEY"
    },
    "bsc": {
      "chainId": 56,
      "name": "BSC Mainnet",
      "rpcUrl": "https://bsc-dataseed1.binance.org"
    },
    "base": {
      "chainId": 8453,
      "name": "Base",
      "rpcUrl": "https://mainnet.base.org"
    }
  }
}
```

### Environment Variables (.env)

```bash
# Network Configuration
RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
CHAIN_ID=1

# Wallet Configuration
PRIVATE_KEY=your_private_key_here

# Contract Addresses (deployed)
ARBITRAGE_CONTRACT=0x...

# Optional: Multiple Networks
ETHEREUM_RPC=https://mainnet.infura.io/v3/YOUR_KEY
BSC_RPC=https://bsc-dataseed1.binance.org
BASE_RPC=https://mainnet.base.org

# Gas Configuration
MAX_GAS_PRICE=100
GAS_LIMIT=300000

# Profitability Thresholds
MIN_PROFIT_ETH=0.01
MIN_PROFIT_PERCENTAGE=0.5

# Monitoring Configuration
CHECK_INTERVAL_MS=5000
ENABLE_LOGGING=true
LOG_LEVEL=info

# Security
ENABLE_SLIPPAGE_PROTECTION=true
MAX_SLIPPAGE_PERCENTAGE=1.0
```

## Deployment Scripts

### 1_deploy.js - Contract Deployment

```javascript
const hre = require('hardhat');

async function main() {
    console.log('Deploying Arbitrage Contract...');

    // Get network configuration
    const network = hre.network.name;
    console.log(`Network: ${network}`);

    // Get deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Balance: ${await deployer.getBalance()}`);

    // Router addresses (update based on network)
    const UNISWAP_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
    const SUSHISWAP_ROUTER = '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F';

    // Deploy contract
    const Arbitrage = await hre.ethers.getContractFactory('Arbitrage');
    const arbitrage = await Arbitrage.deploy(
        UNISWAP_ROUTER,
        SUSHISWAP_ROUTER
    );

    await arbitrage.deployed();

    console.log(`\n✅ Contract deployed to: ${arbitrage.address}`);
    console.log(`\nUpdate config.json with this address!`);

    // Verify on Etherscan (if not local)
    if (network !== 'localhost' && network !== 'hardhat') {
        console.log('\nWaiting for block confirmations...');
        await arbitrage.deployTransaction.wait(6);

        console.log('Verifying contract on Etherscan...');
        await hre.run('verify:verify', {
            address: arbitrage.address,
            constructorArguments: [
                UNISWAP_ROUTER,
                SUSHISWAP_ROUTER
            ]
        });
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
```

### 2_manipulate.js - Price Manipulation (Testing)

```javascript
const hre = require('hardhat');
const { ethers } = require('ethers');

async function main() {
    console.log('Manipulating prices for testing...');

    const [signer] = await hre.ethers.getSigners();

    // Uniswap Router
    const uniswapRouter = await hre.ethers.getContractAt(
        'IUniswapV2Router02',
        '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
    );

    // Token addresses
    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';

    // Get token contracts
    const weth = await hre.ethers.getContractAt('IERC20', WETH);
    const dai = await hre.ethers.getContractAt('IERC20', DAI);

    // Amount to swap (creates price discrepancy)
    const amountIn = ethers.utils.parseEther('100');

    console.log('Approving WETH...');
    await weth.approve(uniswapRouter.address, amountIn);

    console.log('Executing large swap to create price difference...');
    const path = [WETH, DAI];
    const tx = await uniswapRouter.swapExactTokensForTokens(
        amountIn,
        0,
        path,
        signer.address,
        Date.now() + 1000 * 60 * 10
    );

    await tx.wait();
    console.log('✅ Price manipulation complete!');
    console.log('Now run bot.js to detect the arbitrage opportunity');
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
```

## Helper Functions

### calculations.js - Profit Calculations

```javascript
const { ethers } = require('ethers');

/**
 * Calculate expected output from Uniswap V2 formula
 */
function calculateAmountOut(amountIn, reserveIn, reserveOut) {
    const amountInWithFee = amountIn.mul(997);
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(1000).add(amountInWithFee);
    return numerator.div(denominator);
}

/**
 * Calculate optimal arbitrage amount
 */
function calculateOptimalAmount(
    reserveA1,
    reserveB1,
    reserveA2,
    reserveB2
) {
    // Simplified optimal amount calculation
    // Real implementation would use more complex math

    const price1 = reserveB1.mul(ethers.constants.WeiPerEther).div(reserveA1);
    const price2 = reserveB2.mul(ethers.constants.WeiPerEther).div(reserveA2);

    const priceDiff = price1.sub(price2).abs();
    const avgReserve = reserveA1.add(reserveA2).div(2);

    // Use small percentage of average reserve
    return avgReserve.mul(priceDiff).div(price1).div(100);
}

/**
 * Calculate profit after all fees
 */
function calculateNetProfit(
    amountIn,
    amountOut,
    gasPrice,
    gasLimit
) {
    const grossProfit = amountOut.sub(amountIn);
    const gasCost = gasPrice.mul(gasLimit);
    return grossProfit.sub(gasCost);
}

/**
 * Calculate price impact
 */
function calculatePriceImpact(
    amountIn,
    reserveIn,
    reserveOut
) {
    const amountOut = calculateAmountOut(amountIn, reserveIn, reserveOut);

    const priceBeforeswap = reserveOut.mul(ethers.constants.WeiPerEther).div(reserveIn);
    const newReserveIn = reserveIn.add(amountIn);
    const newReserveOut = reserveOut.sub(amountOut);
    const priceAfterSwap = newReserveOut.mul(ethers.constants.WeiPerEther).div(newReserveIn);

    const impact = priceBeforeswap.sub(priceAfterSwap).mul(10000).div(priceBeforeswap);
    return impact; // In basis points
}

module.exports = {
    calculateAmountOut,
    calculateOptimalAmount,
    calculateNetProfit,
    calculatePriceImpact
};
```

### initialization.js - Bot Initialization

```javascript
const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config();

/**
 * Load and validate configuration
 */
function loadConfig() {
    const configPath = './config.json';

    if (!fs.existsSync(configPath)) {
        throw new Error('config.json not found');
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Validate required fields
    const required = [
        'arbitrageContractAddress',
        'uniswapRouter',
        'sushiswapRouter',
        'tokenPairs'
    ];

    for (const field of required) {
        if (!config[field]) {
            throw new Error(`Missing required field: ${field}`);
        }
    }

    return config;
}

/**
 * Initialize Web3 provider
 */
function initializeProvider() {
    const rpcUrl = process.env.RPC_URL;

    if (!rpcUrl) {
        throw new Error('RPC_URL not set in .env');
    }

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    return provider;
}

/**
 * Initialize wallet
 */
function initializeWallet(provider) {
    const privateKey = process.env.PRIVATE_KEY;

    if (!privateKey) {
        throw new Error('PRIVATE_KEY not set in .env');
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    return wallet;
}

/**
 * Validate network connection
 */
async function validateNetwork(provider, expectedChainId) {
    const network = await provider.getNetwork();

    if (expectedChainId && network.chainId !== expectedChainId) {
        throw new Error(
            `Wrong network! Expected ${expectedChainId}, got ${network.chainId}`
        );
    }

    console.log(`Connected to ${network.name} (Chain ID: ${network.chainId})`);
    return network;
}

/**
 * Check wallet balance
 */
async function checkBalance(wallet, minBalance) {
    const balance = await wallet.getBalance();
    const minBalanceWei = ethers.utils.parseEther(minBalance || '0.1');

    if (balance.lt(minBalanceWei)) {
        console.warn(
            `⚠️  Low balance: ${ethers.utils.formatEther(balance)} ETH`
        );
    } else {
        console.log(`Balance: ${ethers.utils.formatEther(balance)} ETH`);
    }

    return balance;
}

module.exports = {
    loadConfig,
    initializeProvider,
    initializeWallet,
    validateNetwork,
    checkBalance
};
```

## Testing Suite

### arbitrage.test.js - Contract Tests

```javascript
const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('Arbitrage Contract', function () {
    let arbitrage;
    let owner;
    let addr1;

    const UNISWAP_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
    const SUSHISWAP_ROUTER = '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F';
    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';

    beforeEach(async function () {
        [owner, addr1] = await ethers.getSigners();

        const Arbitrage = await ethers.getContractFactory('Arbitrage');
        arbitrage = await Arbitrage.deploy(UNISWAP_ROUTER, SUSHISWAP_ROUTER);
        await arbitrage.deployed();
    });

    describe('Deployment', function () {
        it('Should set the right owner', async function () {
            expect(await arbitrage.owner()).to.equal(owner.address);
        });

        it('Should set router addresses', async function () {
            expect(await arbitrage.uniswapRouter()).to.equal(UNISWAP_ROUTER);
            expect(await arbitrage.sushiswapRouter()).to.equal(SUSHISWAP_ROUTER);
        });
    });

    describe('Arbitrage Execution', function () {
        it('Should only allow owner to execute', async function () {
            await expect(
                arbitrage.connect(addr1).executeArbitrage(
                    WETH,
                    DAI,
                    ethers.utils.parseEther('1')
                )
            ).to.be.revertedWith('Not owner');
        });

        it('Should execute arbitrage successfully', async function () {
            // This would require setting up test environment with liquidity
            // See full test suite in repository
        });
    });

    describe('Reserve Fetching', function () {
        it('Should fetch reserves correctly', async function () {
            const reserves = await arbitrage.getReserves(
                UNISWAP_ROUTER,
                WETH,
                DAI
            );

            expect(reserves[0]).to.be.gt(0);
            expect(reserves[1]).to.be.gt(0);
        });
    });

    describe('Amount Calculations', function () {
        it('Should calculate output amount correctly', async function () {
            const amountIn = ethers.utils.parseEther('1');
            const reserveIn = ethers.utils.parseEther('1000');
            const reserveOut = ethers.utils.parseEther('2000');

            const amountOut = await arbitrage.getAmountOut(
                amountIn,
                reserveIn,
                reserveOut
            );

            expect(amountOut).to.be.gt(0);
            expect(amountOut).to.be.lt(ethers.utils.parseEther('2'));
        });
    });

    describe('Withdrawals', function () {
        it('Should allow owner to withdraw tokens', async function () {
            // Test withdrawal functionality
        });

        it('Should allow owner to withdraw ETH', async function () {
            // Test ETH withdrawal
        });
    });

    describe('Ownership', function () {
        it('Should transfer ownership', async function () {
            await arbitrage.transferOwnership(addr1.address);
            expect(await arbitrage.owner()).to.equal(addr1.address);
        });

        it('Should emit OwnershipTransferred event', async function () {
            await expect(arbitrage.transferOwnership(addr1.address))
                .to.emit(arbitrage, 'OwnershipTransferred')
                .withArgs(owner.address, addr1.address);
        });
    });
});
```

## Hardhat Configuration

### hardhat.config.js

```javascript
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-etherscan');
require('dotenv').config();

module.exports = {
    solidity: {
        version: '0.8.17',
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },

    networks: {
        hardhat: {
            forking: {
                url: process.env.ETHEREUM_RPC || '',
                blockNumber: 15000000 // Pin to specific block for consistency
            }
        },

        localhost: {
            url: 'http://127.0.0.1:8545'
        },

        ethereum: {
            url: process.env.ETHEREUM_RPC || '',
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 1
        },

        bsc: {
            url: process.env.BSC_RPC || 'https://bsc-dataseed1.binance.org',
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 56
        },

        base: {
            url: process.env.BASE_RPC || 'https://mainnet.base.org',
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 8453
        }
    },

    etherscan: {
        apiKey: {
            mainnet: process.env.ETHERSCAN_API_KEY || '',
            bsc: process.env.BSCSCAN_API_KEY || '',
            base: process.env.BASESCAN_API_KEY || ''
        }
    },

    paths: {
        sources: './contracts',
        tests: './test',
        cache: './cache',
        artifacts: './artifacts'
    }
};
```

## Production Deployment Guide

### Step 1: Pre-Deployment Checklist

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your values

# 3. Compile contracts
npx hardhat compile

# 4. Run tests
npx hardhat test

# 5. Test on local fork
npx hardhat node
# In another terminal:
npx hardhat run --network localhost scripts/1_deploy.js
```

### Step 2: Testnet Deployment

```bash
# Deploy to testnet (e.g., Goerli)
npx hardhat run --network goerli scripts/1_deploy.js

# Verify contract
npx hardhat verify --network goerli CONTRACT_ADDRESS "ROUTER1" "ROUTER2"

# Test bot with testnet
node bot.js
```

### Step 3: Mainnet Deployment

```bash
# Double-check configuration
cat .env
cat config.json

# Deploy to mainnet
npx hardhat run --network ethereum scripts/1_deploy.js

# Verify on Etherscan
npx hardhat verify --network ethereum CONTRACT_ADDRESS "ROUTER1" "ROUTER2"

# Update config.json with deployed address
# Start bot in production mode
NODE_ENV=production node bot.js
```

## Optimization Strategies

### Gas Optimization

**Contract Level:**
```solidity
// Use immutable for constants
address public immutable uniswapRouter;

// Pack variables efficiently
struct Trade {
    address tokenA;    // 20 bytes
    address tokenB;    // 20 bytes
    uint96 amount;     // 12 bytes (fits in same slot)
}

// Use unchecked for safe operations
unchecked {
    profit = amountOut - amountIn; // Safe if amountOut > amountIn checked
}
```

**Bot Level:**
```javascript
// Batch RPC calls
const [reserves1, reserves2, gasPrice] = await Promise.all([
    contract.getReserves(router1, tokenA, tokenB),
    contract.getReserves(router2, tokenA, tokenB),
    provider.getGasPrice()
]);

// Use multicall for efficiency
const multicall = new ethers.Contract(MULTICALL_ADDRESS, MULTICALL_ABI, provider);
```

### Speed Optimization

**Infrastructure:**
- Use dedicated RPC node (not shared endpoints)
- Deploy bot close to RPC provider geographically
- Use WebSocket connections for events
- Implement mempool monitoring

**Code:**
```javascript
// Use WebSocket provider for real-time updates
const provider = new ethers.providers.WebSocketProvider(
    process.env.WSS_URL
);

// Subscribe to new blocks
provider.on('block', async (blockNumber) => {
    console.log(`New block: ${blockNumber}`);
    await checkOpportunities();
});

// Monitor pending transactions
provider.on('pending', async (txHash) => {
    // Analyze pending transactions for opportunities
});
```

### Profitability Optimization

**Dynamic Threshold Adjustment:**
```javascript
class DynamicThreshold {
    constructor(baseThreshold) {
        this.baseThreshold = baseThreshold;
        this.successRate = 0.5;
        this.avgProfit = ethers.BigNumber.from(0);
    }

    updateThreshold(gasPrice) {
        // Adjust based on gas price
        const gasCost = gasPrice.mul(300000);
        const minProfit = gasCost.mul(120).div(100); // 20% above gas cost

        // Adjust based on success rate
        if (this.successRate < 0.3) {
            return minProfit.mul(150).div(100); // Increase threshold
        }

        return minProfit;
    }
}
```

## Multi-Chain Deployment

### Chain-Specific Configurations

**Ethereum Mainnet:**
```javascript
const ETHEREUM_CONFIG = {
    chainId: 1,
    routers: {
        uniswap: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        sushiswap: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'
    },
    tokens: {
        weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        dai: '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    },
    minProfit: '0.01', // 0.01 ETH
    maxGasPrice: '100' // 100 gwei
};
```

**BSC:**
```javascript
const BSC_CONFIG = {
    chainId: 56,
    routers: {
        pancakeswap: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        biswap: '0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8'
    },
    tokens: {
        wbnb: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        busd: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'
    },
    minProfit: '0.01', // 0.01 BNB
    maxGasPrice: '5' // 5 gwei
};
```

**Base:**
```javascript
const BASE_CONFIG = {
    chainId: 8453,
    routers: {
        uniswap: '0x...',
        aerodrome: '0x...'
    },
    tokens: {
        weth: '0x...',
        usdc: '0x...'
    },
    minProfit: '0.001',
    maxGasPrice: '1'
};
```

## Advanced Features

### MEV Protection with Flashbots

```javascript
const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle');

async function setupFlashbots(provider, authSigner) {
    const flashbotsProvider = await FlashbotsBundleProvider.create(
        provider,
        authSigner,
        'https://relay.flashbots.net'
    );

    return flashbotsProvider;
}

async function sendPrivateTransaction(flashbotsProvider, signedTx, targetBlock) {
    const bundle = [{ signedTransaction: signedTx }];

    const bundleSubmission = await flashbotsProvider.sendBundle(
        bundle,
        targetBlock
    );

    const resolution = await bundleSubmission.wait();

    if (resolution === 0) {
        console.log('Bundle included in block');
    } else {
        console.log('Bundle not included');
    }
}
```

### Monitoring Dashboard

```javascript
const express = require('express');
const app = express();

class MonitoringServer {
    constructor(bot) {
        this.bot = bot;
        this.setupRoutes();
    }

    setupRoutes() {
        app.get('/stats', (req, res) => {
            res.json(this.bot.getStats());
        });

        app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage()
            });
        });

        app.post('/stop', (req, res) => {
            this.bot.stop();
            res.json({ message: 'Bot stopped' });
        });
    }

    start(port = 3000) {
        app.listen(port, () => {
            console.log(`Monitoring server running on port ${port}`);
        });
    }
}
```

## Troubleshooting Guide

### Common Issues

**1. Transaction Reverts:**
```
Error: execution reverted: No profit

Solution:
- Check if opportunity still exists
- Increase slippage tolerance
- Verify gas price not too high
- Check liquidity levels
```

**2. High Gas Costs:**
```
Issue: Gas costs eating all profits

Solutions:
- Increase minimum profit threshold
- Optimize contract code
- Use gas price estimation
- Consider L2 deployment
```

**3. Slow Execution:**
```
Issue: Opportunities disappear before execution

Solutions:
- Use WebSocket instead of HTTP
- Implement mempool monitoring
- Use private RPC endpoint
- Consider Flashbots
```

## Security Best Practices

1. **Never commit private keys**
2. **Use hardware wallet for large amounts**
3. **Test thoroughly on testnet**
4. **Start with small amounts**
5. **Implement circuit breakers**
6. **Monitor contract balance**
7. **Regular security audits**
8. **Keep dependencies updated**

## Conclusion

This implementation guide provides a complete foundation for building and deploying a multi-chain DEX arbitrage bot. The modular architecture allows for easy customization and enhancement based on specific requirements.

**Key Success Factors:**
- Thorough testing before mainnet deployment
- Proper infrastructure (fast RPC, reliable hosting)
- Continuous monitoring and optimization
- Risk management and safety mechanisms
- Understanding of MEV and competition

The repository serves as an excellent starting point for developers interested in DEX arbitrage, with clear documentation and practical examples for multi-chain deployment.
