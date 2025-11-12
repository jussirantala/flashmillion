**Source:** https://tas.co.in/how-to-build-a-flash-loan-arbitrage-bot-from-code-to-deployment-2025-guide/
**Date:** 2024-2025


# Flash Loan Bot 2025 Technical Implementation Guide - Level 2
**Technical Level:** Advanced
**Focus:** Development Environment, API Integration, Testing, Deployment

## Development Environment Setup

### Hardhat Configuration

```javascript
// hardhat.config.js
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-etherscan');
require('hardhat-gas-reporter');
require('solidity-coverage');
require('hardhat-contract-sizer');
require('dotenv').config();

module.exports = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true, // Enable IR-based code generator for better optimization
    },
  },
  networks: {
    hardhat: {
      forking: {
        url: process.env.MAINNET_RPC_URL,
        blockNumber: 18500000, // Pin to specific block for reproducibility
      },
      chainId: 1,
      accounts: {
        count: 10,
        accountsBalance: '10000000000000000000000', // 10000 ETH
      },
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
    goerli: {
      url: process.env.GOERLI_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 5,
      gasPrice: 'auto',
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 11155111,
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
      chainId: 1,
      gasPrice: 'auto',
      timeout: 300000, // 5 minutes
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    outputFile: 'gas-report.txt',
    noColors: true,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
  },
  mocha: {
    timeout: 200000, // 200 seconds
  },
};
```

### Ganache Local Blockchain Setup

```javascript
// ganache-config.js
module.exports = {
  server: {
    port: 8545,
    host: '127.0.0.1',
  },
  chain: {
    chainId: 1337,
    networkId: 1337,
    time: new Date(),
    hardfork: 'shanghai',
  },
  miner: {
    blockGasLimit: 30000000,
    defaultGasPrice: 20000000000, // 20 gwei
    blockTime: 12, // 12 second blocks like mainnet
  },
  wallet: {
    totalAccounts: 10,
    defaultBalance: 10000, // 10000 ETH
    mnemonic: process.env.MNEMONIC,
  },
  fork: {
    url: process.env.MAINNET_RPC_URL,
    blockNumber: 18500000,
  },
  logging: {
    verbose: true,
    quiet: false,
  },
};

// Start script
// scripts/start-ganache.js
const ganache = require('ganache');
const config = require('./ganache-config');

const server = ganache.server(config);
const PORT = config.server.port;

server.listen(PORT, async (err) => {
  if (err) {
    console.error('Ganache failed to start:', err);
    process.exit(1);
  }
  console.log(`Ganache started on port ${PORT}`);
  console.log(`Chain ID: ${config.chain.chainId}`);
  console.log(`Forked from: ${config.fork.url}`);
  console.log(`Block: ${config.fork.blockNumber}`);
});
```

### Package.json Dependencies

```json
{
  "name": "flash-loan-arbitrage-bot",
  "version": "2.0.0",
  "description": "Flash loan arbitrage bot for 2025",
  "main": "src/index.js",
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test",
    "test:coverage": "hardhat coverage",
    "test:gas": "REPORT_GAS=true hardhat test",
    "deploy:local": "hardhat run scripts/deploy.js --network localhost",
    "deploy:goerli": "hardhat run scripts/deploy.js --network goerli",
    "deploy:mainnet": "hardhat run scripts/deploy.js --network mainnet",
    "verify": "hardhat verify --network mainnet",
    "start:ganache": "node scripts/start-ganache.js",
    "start:bot": "node src/bot.js",
    "start:bot:dev": "nodemon src/bot.js",
    "lint": "eslint '**/*.js'",
    "lint:fix": "eslint '**/*.js' --fix",
    "format": "prettier --write '**/*.{js,json,md}'",
    "size": "hardhat size-contracts"
  },
  "dependencies": {
    "@aave/core-v3": "^1.19.0",
    "@chainlink/contracts": "^0.8.0",
    "@openzeppelin/contracts": "^5.0.0",
    "@uniswap/v2-core": "^1.0.1",
    "@uniswap/v2-periphery": "^1.1.0-beta.0",
    "@uniswap/v3-core": "^1.0.1",
    "@uniswap/v3-periphery": "^1.4.3",
    "dotenv": "^16.3.1",
    "ethers": "^6.9.0",
    "express": "^4.18.2",
    "graphql": "^16.8.1",
    "graphql-request": "^6.1.0",
    "mongoose": "^8.0.3",
    "node-telegram-bot-api": "^0.64.0",
    "pino": "^8.17.2",
    "pino-pretty": "^10.3.1",
    "redis": "^4.6.11",
    "web3": "^4.3.0",
    "winston": "^3.11.0"
  },
  "devDependencies": {
    "@flashbots/ethers-provider-bundle": "^1.0.0",
    "@nomicfoundation/hardhat-chai-matchers": "^2.0.0",
    "@nomicfoundation/hardhat-network-helpers": "^1.0.0",
    "@nomicfoundation/hardhat-verify": "^2.0.0",
    "@nomiclabs/hardhat-ethers": "^2.2.3",
    "@nomiclabs/hardhat-etherscan": "^3.1.7",
    "@nomiclabs/hardhat-waffle": "^2.0.6",
    "chai": "^4.3.10",
    "eslint": "^8.56.0",
    "ethereum-waffle": "^4.0.10",
    "ganache": "^7.9.2",
    "hardhat": "^2.19.4",
    "hardhat-contract-sizer": "^2.10.0",
    "hardhat-gas-reporter": "^1.0.9",
    "nodemon": "^3.0.2",
    "prettier": "^3.1.1",
    "prettier-plugin-solidity": "^1.3.1",
    "solhint": "^4.1.1",
    "solidity-coverage": "^0.8.5"
  }
}
```

## Web3.js vs Ethers.js API Usage

### Web3.js Implementation

```javascript
// web3-implementation.js
const Web3 = require('web3');

class Web3ArbitrageBot {
  constructor(config) {
    this.web3 = new Web3(config.rpcUrl);
    this.account = this.web3.eth.accounts.privateKeyToAccount(
      config.privateKey
    );
    this.web3.eth.accounts.wallet.add(this.account);

    this.contract = new this.web3.eth.Contract(
      config.abi,
      config.contractAddress
    );
  }

  async getPrices(tokenAddress, routers) {
    const prices = {};

    for (const [dexName, routerAddress] of Object.entries(routers)) {
      const routerContract = new this.web3.eth.Contract(
        ROUTER_ABI,
        routerAddress
      );

      try {
        const path = [tokenAddress, WETH_ADDRESS];
        const amountIn = this.web3.utils.toWei('1', 'ether');

        const amounts = await routerContract.methods
          .getAmountsOut(amountIn, path)
          .call();

        prices[dexName] = amounts[1];
      } catch (error) {
        console.error(`Error getting price from ${dexName}:`, error);
      }
    }

    return prices;
  }

  async executeFlashLoan(asset, amount) {
    const amountWei = this.web3.utils.toWei(amount.toString(), 'ether');

    // Estimate gas
    const gasEstimate = await this.contract.methods
      .requestFlashLoan(asset, amountWei)
      .estimateGas({ from: this.account.address });

    // Get current gas price
    const gasPrice = await this.web3.eth.getGasPrice();

    // Send transaction
    const tx = await this.contract.methods
      .requestFlashLoan(asset, amountWei)
      .send({
        from: this.account.address,
        gas: Math.floor(gasEstimate * 1.2), // 20% buffer
        gasPrice: Math.floor(gasPrice * 1.1), // 10% higher for priority
      });

    return tx;
  }

  async subscribeToBlocks(callback) {
    const subscription = await this.web3.eth.subscribe('newBlockHeaders');

    subscription.on('data', async (blockHeader) => {
      await callback(blockHeader);
    });

    subscription.on('error', (error) => {
      console.error('Block subscription error:', error);
    });

    return subscription;
  }

  async getTokenBalance(tokenAddress, walletAddress) {
    const tokenContract = new this.web3.eth.Contract(
      ERC20_ABI,
      tokenAddress
    );

    const balance = await tokenContract.methods
      .balanceOf(walletAddress)
      .call();

    const decimals = await tokenContract.methods.decimals().call();

    return this.web3.utils.fromWei(balance, decimals === 18 ? 'ether' : 'mwei');
  }
}

module.exports = Web3ArbitrageBot;
```

### Ethers.js Implementation (Recommended)

```javascript
// ethers-implementation.js
const { ethers } = require('ethers');

class EthersArbitrageBot {
  constructor(config) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);

    this.contract = new ethers.Contract(
      config.contractAddress,
      config.abi,
      this.wallet
    );
  }

  async getPrices(tokenAddress, routers) {
    const prices = {};

    for (const [dexName, routerAddress] of Object.entries(routers)) {
      const routerContract = new ethers.Contract(
        routerAddress,
        ROUTER_ABI,
        this.provider
      );

      try {
        const path = [tokenAddress, WETH_ADDRESS];
        const amountIn = ethers.parseEther('1');

        const amounts = await routerContract.getAmountsOut(amountIn, path);

        prices[dexName] = amounts[1];
      } catch (error) {
        console.error(`Error getting price from ${dexName}:`, error);
      }
    }

    return prices;
  }

  async executeFlashLoan(asset, amount) {
    const amountWei = ethers.parseEther(amount.toString());

    // Estimate gas
    const gasEstimate = await this.contract.requestFlashLoan.estimateGas(
      asset,
      amountWei
    );

    // Get current fee data
    const feeData = await this.provider.getFeeData();

    // Build transaction
    const tx = await this.contract.requestFlashLoan(asset, amountWei, {
      gasLimit: (gasEstimate * 12n) / 10n, // 20% buffer
      maxFeePerGas: (feeData.maxFeePerGas * 11n) / 10n, // 10% higher
      maxPriorityFeePerGas: (feeData.maxPriorityFeePerGas * 11n) / 10n,
    });

    // Wait for confirmation
    const receipt = await tx.wait();

    return receipt;
  }

  async subscribeToBlocks(callback) {
    this.provider.on('block', async (blockNumber) => {
      const block = await this.provider.getBlock(blockNumber);
      await callback(block);
    });
  }

  async getTokenBalance(tokenAddress, walletAddress) {
    const tokenContract = new ethers.Contract(
      tokenAddress,
      ERC20_ABI,
      this.provider
    );

    const [balance, decimals] = await Promise.all([
      tokenContract.balanceOf(walletAddress),
      tokenContract.decimals(),
    ]);

    return ethers.formatUnits(balance, decimals);
  }

  // Advanced: Batch multiple calls
  async batchGetPrices(tokens, routers) {
    const calls = [];

    for (const token of tokens) {
      for (const [dexName, routerAddress] of Object.entries(routers)) {
        const routerContract = new ethers.Contract(
          routerAddress,
          ROUTER_ABI,
          this.provider
        );

        const path = [token, WETH_ADDRESS];
        const amountIn = ethers.parseEther('1');

        calls.push(
          routerContract.getAmountsOut(amountIn, path)
            .then(amounts => ({
              token,
              dex: dexName,
              price: amounts[1],
            }))
            .catch(() => null)
        );
      }
    }

    const results = await Promise.all(calls);

    // Organize results
    const prices = {};
    for (const result of results.filter(r => r !== null)) {
      if (!prices[result.token]) {
        prices[result.token] = {};
      }
      prices[result.token][result.dex] = result.price;
    }

    return prices;
  }
}

module.exports = EthersArbitrageBot;
```

## Chainlink Oracle Integration

### Price Feed Integration

```solidity
// contracts/ChainlinkIntegration.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ChainlinkPriceConsumer is Ownable {
    mapping(address => AggregatorV3Interface) public priceFeeds;

    // Mainnet price feed addresses
    address private constant ETH_USD = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
    address private constant BTC_USD = 0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c;
    address private constant USDC_USD = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;
    address private constant DAI_USD = 0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9;

    event PriceFeedAdded(address indexed token, address indexed feed);
    event PriceUpdated(address indexed token, int256 price, uint256 timestamp);

    constructor() Ownable(msg.sender) {
        // Initialize common price feeds
        priceFeeds[address(0)] = AggregatorV3Interface(ETH_USD); // ETH
    }

    /**
     * @dev Add or update price feed for token
     */
    function setPriceFeed(address token, address feed) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(feed != address(0), "Invalid feed");

        priceFeeds[token] = AggregatorV3Interface(feed);
        emit PriceFeedAdded(token, feed);
    }

    /**
     * @dev Get latest price for token
     * @return price Price in USD with 8 decimals
     * @return decimals Number of decimals
     */
    function getLatestPrice(address token)
        public
        view
        returns (int256 price, uint8 decimals)
    {
        AggregatorV3Interface feed = priceFeeds[token];
        require(address(feed) != address(0), "Price feed not found");

        (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        ) = feed.latestRoundData();

        require(answer > 0, "Invalid price");
        require(updatedAt > 0, "Round not complete");
        require(answeredInRound >= roundId, "Stale price");
        require(block.timestamp - updatedAt < 3600, "Price too old"); // 1 hour max

        decimals = feed.decimals();
        price = answer;
    }

    /**
     * @dev Get historical price at specific round
     */
    function getHistoricalPrice(address token, uint80 roundId)
        external
        view
        returns (int256 price, uint256 timestamp)
    {
        AggregatorV3Interface feed = priceFeeds[token];
        require(address(feed) != address(0), "Price feed not found");

        (
            ,
            int256 answer,
            ,
            uint256 updatedAt,

        ) = feed.getRoundData(roundId);

        require(answer > 0, "Invalid price");

        return (answer, updatedAt);
    }

    /**
     * @dev Compare price difference between two DEXs and Chainlink
     * @return priceDiff Percentage difference (in basis points)
     * @return isAnomalous True if difference exceeds threshold
     */
    function validateDexPrice(
        address token,
        uint256 dexPrice,
        uint256 thresholdBps
    ) external view returns (uint256 priceDiff, bool isAnomalous) {
        (int256 oraclePrice, uint8 decimals) = getLatestPrice(token);

        // Normalize prices to same decimals
        uint256 normalizedOracle = uint256(oraclePrice);

        // Calculate percentage difference
        uint256 diff = dexPrice > normalizedOracle
            ? dexPrice - normalizedOracle
            : normalizedOracle - dexPrice;

        priceDiff = (diff * 10000) / normalizedOracle;
        isAnomalous = priceDiff > thresholdBps;
    }
}
```

### JavaScript Client for Chainlink

```javascript
// modules/chainlinkClient.js
const { ethers } = require('ethers');

class ChainlinkClient {
  constructor(provider) {
    this.provider = provider;

    // Mainnet price feed addresses
    this.priceFeeds = {
      ETH: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
      BTC: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
      USDC: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
      DAI: '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9',
      LINK: '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c',
      UNI: '0x553303d460EE0afB37EdFf9bE42922D8FF63220e',
    };

    this.aggregatorABI = [
      'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
      'function decimals() external view returns (uint8)',
    ];
  }

  async getPrice(symbol) {
    const feedAddress = this.priceFeeds[symbol];
    if (!feedAddress) {
      throw new Error(`No price feed for ${symbol}`);
    }

    const aggregator = new ethers.Contract(
      feedAddress,
      this.aggregatorABI,
      this.provider
    );

    const [roundData, decimals] = await Promise.all([
      aggregator.latestRoundData(),
      aggregator.decimals(),
    ]);

    const { roundId, answer, updatedAt, answeredInRound } = roundData;

    // Validate data
    if (answer <= 0) throw new Error('Invalid price');
    if (answeredInRound < roundId) throw new Error('Stale price');

    const age = Date.now() / 1000 - Number(updatedAt);
    if (age > 3600) throw new Error('Price too old');

    const price = ethers.formatUnits(answer, decimals);

    return {
      symbol,
      price: parseFloat(price),
      decimals: Number(decimals),
      updatedAt: Number(updatedAt),
      age,
      roundId: Number(roundId),
    };
  }

  async getAllPrices() {
    const prices = {};

    const results = await Promise.allSettled(
      Object.keys(this.priceFeeds).map(symbol => this.getPrice(symbol))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { symbol, ...data } = result.value;
        prices[symbol] = data;
      }
    }

    return prices;
  }

  async compareDexToOracle(symbol, dexPrice) {
    const oracle = await this.getPrice(symbol);

    const diff = Math.abs(dexPrice - oracle.price);
    const diffPercent = (diff / oracle.price) * 100;

    return {
      dexPrice,
      oraclePrice: oracle.price,
      difference: diff,
      differencePercent: diffPercent,
      isAnomalous: diffPercent > 5, // 5% threshold
      oracleAge: oracle.age,
    };
  }
}

module.exports = ChainlinkClient;
```

## Flashbots SDK Implementation

### Flashbots Bundle Submission

```javascript
// modules/flashbotsClient.js
const { ethers } = require('ethers');
const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle');

class FlashbotsClient {
  constructor(config) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.authSigner = new ethers.Wallet(config.flashbotsSignerKey);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);

    // Flashbots relay endpoints
    this.relayUrl = config.network === 'mainnet'
      ? 'https://relay.flashbots.net'
      : 'https://relay-goerli.flashbots.net';
  }

  async initialize() {
    this.flashbotsProvider = await FlashbotsBundleProvider.create(
      this.provider,
      this.authSigner,
      this.relayUrl
    );
  }

  async sendBundle(transactions, targetBlock) {
    // Sign all transactions
    const signedTransactions = [];
    for (const tx of transactions) {
      const signedTx = await this.wallet.signTransaction(tx);
      signedTransactions.push(signedTx);
    }

    // Submit bundle
    const bundleSubmission = await this.flashbotsProvider.sendRawBundle(
      signedTransactions,
      targetBlock
    );

    return bundleSubmission;
  }

  async simulateBundle(transactions, blockNumber) {
    const signedTransactions = [];
    for (const tx of transactions) {
      const signedTx = await this.wallet.signTransaction(tx);
      signedTransactions.push(signedTx);
    }

    // Simulate bundle
    const simulation = await this.flashbotsProvider.simulate(
      signedTransactions,
      blockNumber
    );

    if ('error' in simulation) {
      throw new Error(`Simulation error: ${simulation.error.message}`);
    }

    return {
      success: true,
      coinbaseDiff: ethers.formatEther(simulation.coinbaseDiff),
      gasUsed: simulation.totalGasUsed,
      results: simulation.results,
    };
  }

  async executeArbitrage(arbitrageParams) {
    const currentBlock = await this.provider.getBlockNumber();
    const targetBlock = currentBlock + 1;

    // Build transaction
    const tx = {
      to: arbitrageParams.contractAddress,
      data: arbitrageParams.data,
      gasLimit: 500000,
      maxFeePerGas: ethers.parseUnits('50', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
      nonce: await this.wallet.getNonce(),
      chainId: await this.provider.getNetwork().then(n => n.chainId),
      type: 2, // EIP-1559
    };

    // Simulate first
    console.log('Simulating bundle...');
    const simulation = await this.simulateBundle([tx], currentBlock);

    console.log('Simulation result:', simulation);

    if (!simulation.success || parseFloat(simulation.coinbaseDiff) <= 0) {
      throw new Error('Simulation failed or unprofitable');
    }

    // Submit bundle
    console.log(`Submitting bundle for block ${targetBlock}...`);
    const bundleSubmission = await this.sendBundle([tx], targetBlock);

    // Wait for bundle inclusion
    const receipt = await bundleSubmission.wait();

    if (receipt === 0) {
      console.log('Bundle included in block!');
      return {
        success: true,
        blockNumber: targetBlock,
      };
    } else {
      console.log('Bundle not included');
      return {
        success: false,
        reason: 'Not included',
      };
    }
  }

  async getBundleStats() {
    const stats = await this.flashbotsProvider.getUserStats();

    return {
      isHighPriority: stats.is_high_priority,
      allTimeGasSimulated: stats.all_time_gas_simulated,
      allTimeBundlesSubmitted: stats.all_time_bundles_submitted,
      lastSubmissionTimestamp: stats.last_submission_timestamp,
    };
  }
}

module.exports = FlashbotsClient;
```

### Bundle Strategy with MEV Protection

```javascript
// strategies/flashbotsStrategy.js
class FlashbotsStrategy {
  constructor(flashbotsClient, contract) {
    this.flashbots = flashbotsClient;
    this.contract = contract;
  }

  async executePrivateArbitrage(opportunity) {
    const currentBlock = await this.flashbots.provider.getBlockNumber();

    // Calculate coinbase payment (bribe to miner)
    const profitWei = ethers.parseEther(opportunity.profit.toString());
    const minerPayment = profitWei / 10n; // Pay 10% to miner

    // Build arbitrage transaction
    const arbTx = await this.contract.requestFlashLoan.populateTransaction(
      opportunity.asset,
      opportunity.amount
    );

    // Build coinbase payment transaction
    const paymentTx = {
      to: '0x0000000000000000000000000000000000000000', // Will be replaced by coinbase
      value: minerPayment,
      gasLimit: 21000,
    };

    // Bundle transactions
    const bundle = [
      {
        ...arbTx,
        gasLimit: 500000,
        maxFeePerGas: ethers.parseUnits('50', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
      },
      {
        ...paymentTx,
        maxFeePerGas: ethers.parseUnits('50', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
      },
    ];

    // Simulate bundle
    const simulation = await this.flashbots.simulateBundle(
      bundle,
      currentBlock
    );

    if (!simulation.success) {
      throw new Error('Bundle simulation failed');
    }

    console.log('Bundle simulation successful');
    console.log('Coinbase diff:', simulation.coinbaseDiff);
    console.log('Gas used:', simulation.gasUsed);

    // Submit for next 3 blocks
    const submissions = [];
    for (let i = 1; i <= 3; i++) {
      const targetBlock = currentBlock + i;
      const submission = await this.flashbots.sendBundle(bundle, targetBlock);
      submissions.push({ targetBlock, submission });
    }

    // Wait for any inclusion
    for (const { targetBlock, submission } of submissions) {
      const waitResult = await submission.wait();

      if (waitResult === 0) {
        console.log(`Bundle included in block ${targetBlock}`);
        return {
          success: true,
          blockNumber: targetBlock,
        };
      }
    }

    return {
      success: false,
      reason: 'Bundle not included in any target block',
    };
  }
}

module.exports = FlashbotsStrategy;
```

## Testing Frameworks

### Comprehensive Test Suite

```javascript
// test/FlashLoanArbitrage.test.js
const { expect } = require('chai');
const { ethers } = require('hardhat');
const { loadFixture } = require('@nomicfoundation/hardhat-network-helpers');

describe('FlashLoanArbitrage', function () {
  // Fixture for deployment
  async function deployFixture() {
    const [owner, user1] = await ethers.getSigners();

    // Deploy contract
    const FlashLoanArbitrage = await ethers.getContractFactory('FlashLoanArbitrage');
    const contract = await FlashLoanArbitrage.deploy(
      '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e', // Aave Pool Provider
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', // Uniswap Router
      '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'  // SushiSwap Router
    );

    return { contract, owner, user1 };
  }

  describe('Deployment', function () {
    it('Should set the correct owner', async function () {
      const { contract, owner } = await loadFixture(deployFixture);
      // Test owner
    });

    it('Should have correct router addresses', async function () {
      const { contract } = await loadFixture(deployFixture);
      // Test routers
    });
  });

  describe('Flash Loan Execution', function () {
    it('Should execute profitable arbitrage', async function () {
      const { contract, owner } = await loadFixture(deployFixture);

      const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      const amount = ethers.parseUnits('100000', 6);

      await expect(contract.requestFlashLoan(USDC, amount))
        .to.emit(contract, 'ArbitrageExecuted');
    });

    it('Should revert on unprofitable arbitrage', async function () {
      const { contract } = await loadFixture(deployFixture);

      const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      const amount = ethers.parseUnits('100', 6); // Too small

      await expect(contract.requestFlashLoan(USDC, amount))
        .to.be.revertedWith('Unprofitable arbitrage');
    });
  });

  describe('Access Control', function () {
    it('Should only allow owner to request flash loans', async function () {
      const { contract, user1 } = await loadFixture(deployFixture);

      const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
      const amount = ethers.parseUnits('100000', 6);

      await expect(
        contract.connect(user1).requestFlashLoan(USDC, amount)
      ).to.be.revertedWith('Not owner');
    });
  });

  describe('Emergency Functions', function () {
    it('Should allow owner to withdraw funds', async function () {
      const { contract, owner } = await loadFixture(deployFixture);

      // Test withdrawal
    });
  });
});
```

### Mainnet Fork Testing

```javascript
// test/mainnet-fork.test.js
const { expect } = require('chai');
const { ethers, network } = require('hardhat');

describe('Mainnet Fork Integration Tests', function () {
  let contract;
  let owner;

  const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
  const USDC_WHALE = '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503'; // Binance

  before(async function () {
    // Fork mainnet
    await network.provider.request({
      method: 'hardhat_reset',
      params: [{
        forking: {
          jsonRpcUrl: process.env.MAINNET_RPC_URL,
          blockNumber: 18500000,
        },
      }],
    });

    [owner] = await ethers.getSigners();

    // Deploy contract
    const FlashLoanArbitrage = await ethers.getContractFactory('FlashLoanArbitrage');
    contract = await FlashLoanArbitrage.deploy(
      '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e',
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'
    );
  });

  it('Should execute real arbitrage on forked mainnet', async function () {
    this.timeout(120000);

    // Impersonate USDC whale
    await network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [USDC_WHALE],
    });

    const whale = await ethers.getSigner(USDC_WHALE);

    // Fund contract with USDC
    const usdc = await ethers.getContractAt('IERC20', USDC_ADDRESS);
    await usdc.connect(whale).transfer(
      await contract.getAddress(),
      ethers.parseUnits('10000', 6)
    );

    // Execute flash loan
    const amount = ethers.parseUnits('100000', 6);
    const tx = await contract.requestFlashLoan(USDC_ADDRESS, amount);
    const receipt = await tx.wait();

    expect(receipt.status).to.equal(1);
  });

  it('Should handle price impact correctly', async function () {
    // Test large trade impact
  });
});
```

## Deployment Scripts

### Production Deployment Script

```javascript
// scripts/deploy.js
const { ethers, network } = require('hardhat');
const fs = require('fs');

async function main() {
  console.log(`Deploying to ${network.name}...`);

  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'ETH');

  // Network-specific addresses
  const config = {
    mainnet: {
      aavePoolProvider: '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e',
      uniswapRouter: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      sushiswapRouter: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
    },
    goerli: {
      aavePoolProvider: '0xc4dCB5126a3AfEd129BC3668Ea19285A9f56D15D',
      uniswapRouter: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
      sushiswapRouter: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
    },
  };

  const addresses = config[network.name];
  if (!addresses) {
    throw new Error(`No config for network ${network.name}`);
  }

  // Deploy contract
  console.log('Deploying FlashLoanArbitrage...');
  const FlashLoanArbitrage = await ethers.getContractFactory('FlashLoanArbitrage');
  const contract = await FlashLoanArbitrage.deploy(
    addresses.aavePoolProvider,
    addresses.uniswapRouter,
    addresses.sushiswapRouter
  );

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();

  console.log('FlashLoanArbitrage deployed to:', contractAddress);

  // Save deployment info
  const deployment = {
    network: network.name,
    contractAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    blockNumber: await ethers.provider.getBlockNumber(),
    config: addresses,
  };

  const filename = `deployments/${network.name}-${Date.now()}.json`;
  fs.writeFileSync(filename, JSON.stringify(deployment, null, 2));
  console.log('Deployment info saved to:', filename);

  // Wait for confirmations before verifying
  if (network.name !== 'hardhat' && network.name !== 'localhost') {
    console.log('Waiting for block confirmations...');
    await contract.deploymentTransaction().wait(5);

    // Verify on Etherscan
    console.log('Verifying contract on Etherscan...');
    try {
      await hre.run('verify:verify', {
        address: contractAddress,
        constructorArguments: [
          addresses.aavePoolProvider,
          addresses.uniswapRouter,
          addresses.sushiswapRouter,
        ],
      });
      console.log('Contract verified!');
    } catch (error) {
      console.error('Verification failed:', error);
    }
  }

  console.log('Deployment complete!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

## Best Practices Summary

1. **Development Environment**
   - Use Hardhat for production
   - Fork mainnet for realistic testing
   - Enable gas reporting and coverage

2. **Library Choice**
   - Prefer Ethers.js over Web3.js (better TypeScript support, smaller bundle)
   - Use latest v6 Ethers.js for new projects

3. **Oracle Integration**
   - Always validate Chainlink data freshness
   - Use multiple oracle sources for critical decisions
   - Implement circuit breakers for anomalous prices

4. **MEV Protection**
   - Use Flashbots for competitive arbitrage
   - Simulate bundles before submission
   - Submit to multiple blocks for better inclusion

5. **Testing**
   - Test on mainnet forks with real liquidity
   - Use fixtures for efficient testing
   - Test all edge cases and failure modes

6. **Deployment**
   - Verify contracts on Etherscan
   - Save deployment artifacts
   - Use multi-sig for ownership on mainnet

## Troubleshooting Guide

### Common Issues

1. **Gas Estimation Failures**
```javascript
// Solution: Manual gas estimation with buffer
const gasEstimate = await contract.estimateGas.method();
const gasLimit = gasEstimate * 12n / 10n; // 20% buffer
```

2. **Nonce Too Low**
```javascript
// Solution: Manual nonce management
const nonce = await wallet.getNonce('pending');
```

3. **Transaction Underpriced**
```javascript
// Solution: Use higher gas price
const feeData = await provider.getFeeData();
const maxFeePerGas = feeData.maxFeePerGas * 15n / 10n; // 50% higher
```

4. **Slippage Too High**
```javascript
// Solution: Calculate minimum output
const minOutput = expectedOutput * 95n / 100n; // 5% slippage tolerance
```
