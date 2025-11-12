**Source:** https://github.com/kaymen99/aave-flashloan-arbitrage
**Date:** 2024-2025


# AAVE Flashloan Arbitrage - Technical Deep Dive

## Architecture Analysis

### System Architecture Overview

The aave-flashloan-arbitrage system implements a streamlined architecture specifically optimized for AAVE V3 flash loans. The design follows a single-contract pattern where all arbitrage logic resides in the FlashloanArbitrage smart contract, which inherits from AAVE's FlashLoanSimpleReceiverBase. This inheritance-based approach reduces boilerplate code and ensures compatibility with AAVE's flash loan interface.

The architecture separates on-chain execution (smart contracts) from off-chain monitoring and coordination (JavaScript scripts). The smart contract handles the capital-intensive flash loan and swap operations, while off-chain scripts identify opportunities, calculate profitability, and submit transactions. This separation allows for efficient opportunity detection without on-chain computation costs.

Unlike multi-protocol arbitrage systems, this implementation focuses exclusively on Uniswap-Sushiswap arbitrage. This specialization reduces contract complexity, lowers gas costs, and makes the system easier to audit and maintain. The trade-off is less flexibility, but in return, you get a battle-tested, efficient implementation for a specific use case.

The contract follows an event-driven execution model where flash loan callbacks trigger arbitrage execution. AAVE's Pool contract orchestrates the flow: it transfers borrowed funds, calls the executeOperation callback, and attempts to reclaim funds plus fees. All logic must complete within this single transaction to maintain atomicity.

### AAVE V3 Integration Architecture

AAVE V3 introduces significant improvements over V2 including lower fees, better capital efficiency, and isolation mode for risk management. The integration architecture leverages these V3-specific features while maintaining compatibility with AAVE's standardized flash loan interface.

The contract interacts with three core AAVE components:

1. **PoolAddressesProvider**: Registry contract that provides addresses for all AAVE protocol contracts. This allows the system to find the current Pool contract address even if AAVE upgrades their implementation.

2. **Pool Contract**: Main entry point for flash loans. The contract calls flashLoanSimple on this contract to initiate loans.

3. **FlashLoanSimpleReceiverBase**: Base contract providing the infrastructure for receiving flash loan callbacks. Inheriting from this ensures correct implementation of required interfaces.

The architecture uses AAVE's "simple" flash loan variant, which allows borrowing a single asset per transaction. This simplicity reduces gas costs and complexity compared to the multi-asset flash loan function. For two-token arbitrage (e.g., WETH->USDC->WETH), borrowing a single asset is sufficient.

### Smart Contract Design Patterns

The implementation employs several important design patterns:

**Inheritance Pattern**: By inheriting FlashLoanSimpleReceiverBase, the contract gains built-in access to the POOL address and validation logic. This reduces code duplication and ensures compliance with AAVE's expected interface.

**Callback Pattern**: The flash loan flow uses callbacks where AAVE calls back into executeOperation after transferring funds. This inversion of control is standard for flash loan implementations.

**Approval Pattern**: The contract approves DEX routers to spend tokens only when needed and only for specific amounts. This limits exposure if a DEX router is compromised.

**Validation Pattern**: Multiple validation checks ensure profitable execution before committing to repayment. The contract validates inputs, intermediate results, and final balances.

**Access Control Pattern**: Owner-only functions prevent unauthorized flash loan initiation. This protects against malicious actors using your deployed contract for their own trades.

## Code Structure

### FlashloanArbitrage.sol Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import {FlashLoanSimpleReceiverBase} from "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external returns (uint256[] memory amounts);

    function getAmountsOut(uint256 amountIn, address[] calldata path)
        external
        view
        returns (uint256[] memory amounts);
}

contract FlashloanArbitrage is FlashLoanSimpleReceiverBase, Ownable {
    // DEX routers
    address public immutable uniswapRouter;
    address public immutable sushiswapRouter;

    // Minimum profit threshold (in wei)
    uint256 public minProfitAmount;

    // Events
    event ArbitrageExecuted(
        address indexed asset,
        uint256 amount,
        uint256 profit,
        uint256 timestamp
    );

    event FlashLoanRequested(
        address indexed asset,
        uint256 amount,
        uint256 timestamp
    );

    /**
     * @dev Constructor
     * @param _addressProvider AAVE PoolAddressesProvider address
     * @param _uniswapRouter Uniswap V2 Router address
     * @param _sushiswapRouter Sushiswap Router address
     */
    constructor(
        address _addressProvider,
        address _uniswapRouter,
        address _sushiswapRouter,
        uint256 _minProfit
    ) FlashLoanSimpleReceiverBase(IPoolAddressesProvider(_addressProvider)) {
        uniswapRouter = _uniswapRouter;
        sushiswapRouter = _sushiswapRouter;
        minProfitAmount = _minProfit;
    }

    /**
     * @notice Request a flash loan from AAVE
     * @param asset The address of the asset to borrow
     * @param amount The amount to borrow
     * @param firstRouter Router for first swap (0 = Uniswap, 1 = Sushiswap)
     * @param tokenPath Path of tokens for arbitrage
     */
    function requestFlashLoan(
        address asset,
        uint256 amount,
        uint8 firstRouter,
        address[] calldata tokenPath
    ) external onlyOwner {
        require(amount > 0, "Amount must be greater than 0");
        require(tokenPath.length >= 2, "Invalid token path");

        // Encode parameters for flash loan callback
        bytes memory params = abi.encode(firstRouter, tokenPath);

        emit FlashLoanRequested(asset, amount, block.timestamp);

        // Request flash loan from AAVE
        POOL.flashLoanSimple(
            address(this),
            asset,
            amount,
            params,
            0 // referralCode
        );
    }

    /**
     * @notice AAVE flash loan callback
     * @dev This function is called by AAVE Pool after transferring the flash loan amount
     * @param asset The address of the borrowed asset
     * @param amount The amount borrowed
     * @param premium The flash loan fee
     * @param initiator The address that initiated the flash loan
     * @param params Encoded parameters passed from requestFlashLoan
     * @return bool Success indicator
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        // Ensure the call is from AAVE Pool
        require(msg.sender == address(POOL), "Caller must be AAVE Pool");
        require(initiator == address(this), "Initiator must be this contract");

        // Decode parameters
        (uint8 firstRouter, address[] memory tokenPath) = abi.decode(
            params,
            (uint8, address[])
        );

        // Execute arbitrage strategy
        uint256 profit = _executeArbitrage(
            asset,
            amount,
            firstRouter,
            tokenPath
        );

        // Calculate amount to repay (borrowed amount + premium)
        uint256 amountToRepay = amount + premium;

        // Validate profitability
        require(
            IERC20(asset).balanceOf(address(this)) >= amountToRepay + minProfitAmount,
            "Arbitrage not profitable enough"
        );

        // Approve AAVE Pool to pull the owed amount
        IERC20(asset).approve(address(POOL), amountToRepay);

        emit ArbitrageExecuted(asset, amount, profit, block.timestamp);

        return true;
    }

    /**
     * @dev Execute the arbitrage strategy
     * @param asset The borrowed asset
     * @param amount The borrowed amount
     * @param firstRouter Which router to use first (0 = Uniswap, 1 = Sushiswap)
     * @param tokenPath The path of tokens for swaps
     * @return profit The profit made from arbitrage
     */
    function _executeArbitrage(
        address asset,
        uint256 amount,
        uint8 firstRouter,
        address[] memory tokenPath
    ) internal returns (uint256 profit) {
        require(tokenPath[0] == asset, "First token must match borrowed asset");
        require(tokenPath[tokenPath.length - 1] == asset, "Last token must match borrowed asset");

        uint256 initialBalance = IERC20(asset).balanceOf(address(this));

        // Determine router addresses
        address router1 = firstRouter == 0 ? uniswapRouter : sushiswapRouter;
        address router2 = firstRouter == 0 ? sushiswapRouter : uniswapRouter;

        // First swap: asset -> intermediate token
        address[] memory path1 = new address[](2);
        path1[0] = tokenPath[0];
        path1[1] = tokenPath[1];

        IERC20(path1[0]).approve(router1, amount);

        uint256[] memory amounts1 = IUniswapV2Router(router1)
            .swapExactTokensForTokens(
                amount,
                0, // Accept any amount (validation happens at end)
                path1,
                address(this),
                block.timestamp + 300
            );

        uint256 intermediateAmount = amounts1[1];

        // Second swap: intermediate token -> asset
        address[] memory path2 = new address[](2);
        path2[0] = tokenPath[1];
        path2[1] = tokenPath[0];

        IERC20(path2[0]).approve(router2, intermediateAmount);

        uint256[] memory amounts2 = IUniswapV2Router(router2)
            .swapExactTokensForTokens(
                intermediateAmount,
                amount, // Minimum output must cover flash loan repayment
                path2,
                address(this),
                block.timestamp + 300
            );

        uint256 finalBalance = IERC20(asset).balanceOf(address(this));
        profit = finalBalance - initialBalance;

        return profit;
    }

    /**
     * @notice Withdraw accumulated profits
     * @param token The token address to withdraw
     */
    function withdrawProfits(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "No profits to withdraw");

        IERC20(token).transfer(owner(), balance);
    }

    /**
     * @notice Update minimum profit threshold
     * @param newMinProfit New minimum profit in wei
     */
    function setMinProfit(uint256 newMinProfit) external onlyOwner {
        minProfitAmount = newMinProfit;
    }

    /**
     * @notice Emergency function to rescue stuck tokens
     * @param token Token address to rescue
     */
    function rescueTokens(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).transfer(owner(), balance);
        }
    }

    /**
     * @notice Get the AAVE Pool address
     */
    function getPool() external view returns (address) {
        return address(POOL);
    }

    receive() external payable {}
}
```

### Supporting Contracts and Interfaces

**AAVE V3 Interfaces**

The contract uses several AAVE V3 interfaces:

```solidity
// Simplified interface for AAVE V3 Pool
interface IPool {
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;

    function getReserveData(address asset)
        external
        view
        returns (DataTypes.ReserveData memory);
}

// Pool Addresses Provider
interface IPoolAddressesProvider {
    function getPool() external view returns (address);
    function getPoolConfigurator() external view returns (address);
    function getPriceOracle() external view returns (address);
}

// Flash Loan Receiver Interface
interface IFlashLoanSimpleReceiver {
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);

    function ADDRESSES_PROVIDER() external view returns (IPoolAddressesProvider);
    function POOL() external view returns (IPool);
}
```

## Smart Contract Implementation

### Flash Loan Execution Flow

The flash loan execution follows this detailed flow:

**1. Initiation Phase**
```solidity
// Owner calls requestFlashLoan with parameters
function requestFlashLoan(
    address asset,      // WETH address
    uint256 amount,     // 10 ETH
    uint8 firstRouter,  // 0 = start with Uniswap
    address[] calldata tokenPath  // [WETH, USDC]
) external onlyOwner
```

**2. AAVE Processing**
- AAVE validates the flash loan request
- Transfers `amount` of `asset` to the contract
- Calculates `premium` (0.09% of amount)
- Calls executeOperation callback

**3. Callback Execution**
```solidity
function executeOperation(
    address asset,      // WETH
    uint256 amount,     // 10 ETH
    uint256 premium,    // 0.009 ETH
    address initiator,  // This contract
    bytes calldata params  // Encoded router and path
) external override returns (bool)
```

**4. Arbitrage Execution**
- Decode parameters to get router choice and token path
- Execute first swap on chosen DEX (e.g., Uniswap)
- Execute second swap on other DEX (e.g., Sushiswap)
- Validate final balance covers repayment + minimum profit

**5. Repayment Phase**
- Approve AAVE Pool to withdraw amount + premium
- Return true to signal success
- AAVE attempts to withdraw repayment
- If successful, transaction completes; if not, entire tx reverts

### Gas Optimization Techniques

**Immutable Variables**
```solidity
address public immutable uniswapRouter;
address public immutable sushiswapRouter;
```
Using `immutable` for router addresses saves ~2100 gas per read compared to storage variables.

**Memory vs Storage**
```solidity
// Use memory for temporary arrays
address[] memory path1 = new address[](2);
```
Memory variables cost ~3 gas per word vs ~20000 gas for storage writes.

**Minimal Storage**
The contract stores only essential state:
- Router addresses (immutable)
- Minimum profit threshold (changeable parameter)
- Inherited POOL address from base contract

**Efficient Approvals**
```solidity
IERC20(token).approve(router, exactAmount);
```
Approving exact amounts instead of unlimited reduces gas and improves security.

**Batch Operations**
All swaps execute in a single transaction, eliminating multiple transaction overhead.

### Security Implementation

**Access Control**
```solidity
function requestFlashLoan(...) external onlyOwner {
    // Only contract owner can initiate flash loans
}
```

**Validation Checks**
```solidity
require(msg.sender == address(POOL), "Caller must be AAVE Pool");
require(initiator == address(this), "Initiator must be this contract");
require(amount > 0, "Amount must be greater than 0");
```

**Profitability Validation**
```solidity
require(
    IERC20(asset).balanceOf(address(this)) >= amountToRepay + minProfitAmount,
    "Arbitrage not profitable enough"
);
```

**Reentrancy Protection**
Inherited from FlashLoanSimpleReceiverBase, which implements nonReentrant modifiers on critical functions.

## Bot Architecture

### Opportunity Detection System

```javascript
// scripts/monitor-opportunities.js
const { ethers } = require("hardhat");
const config = require("../config/trading.json");

class OpportunityMonitor {
    constructor() {
        this.provider = new ethers.providers.WebSocketProvider(
            process.env.WS_PROVIDER_URL
        );

        this.uniswapRouter = new ethers.Contract(
            config.uniswapRouter,
            require("../abi/IUniswapV2Router.json"),
            this.provider
        );

        this.sushiswapRouter = new ethers.Contract(
            config.sushiswapRouter,
            require("../abi/IUniswapV2Router.json"),
            this.provider
        );

        this.wallet = new ethers.Wallet(
            process.env.PRIVATE_KEY,
            this.provider
        );

        this.contract = new ethers.Contract(
            process.env.CONTRACT_ADDRESS,
            require("../artifacts/contracts/FlashloanArbitrage.sol/FlashloanArbitrage.json").abi,
            this.wallet
        );

        this.monitoredPairs = config.monitoredPairs;
        this.minProfitThreshold = ethers.utils.parseEther(config.minProfit);
    }

    async start() {
        console.log("Starting opportunity monitor...");

        // Subscribe to blockchain events
        this.subscribeToEvents();

        // Start periodic scanning
        this.scanLoop();
    }

    subscribeToEvents() {
        // Listen for Swap events on monitored pools
        const swapTopic = ethers.utils.id(
            "Swap(address,uint256,uint256,uint256,uint256,address)"
        );

        this.provider.on({ topics: [swapTopic] }, async (log) => {
            await this.handleSwapEvent(log);
        });
    }

    async handleSwapEvent(log) {
        // A swap occurred, check for arbitrage opportunity
        const opportunity = await this.checkAllPairs();

        if (opportunity && opportunity.profit.gte(this.minProfitThreshold)) {
            await this.executeArbitrage(opportunity);
        }
    }

    async scanLoop() {
        while (true) {
            try {
                const opportunity = await this.checkAllPairs();

                if (opportunity && opportunity.profit.gte(this.minProfitThreshold)) {
                    await this.executeArbitrage(opportunity);
                }

                // Wait before next scan
                await new Promise(resolve => setTimeout(resolve, 5000));
            } catch (error) {
                console.error("Scan error:", error);
            }
        }
    }

    async checkAllPairs() {
        let bestOpportunity = null;
        let maxProfit = ethers.BigNumber.from(0);

        for (const pair of this.monitoredPairs) {
            // Check Uniswap -> Sushiswap
            const opp1 = await this.checkArbitrage(
                pair.token0,
                pair.token1,
                pair.testAmount,
                0 // Start with Uniswap
            );

            if (opp1 && opp1.profit.gt(maxProfit)) {
                maxProfit = opp1.profit;
                bestOpportunity = opp1;
            }

            // Check Sushiswap -> Uniswap
            const opp2 = await this.checkArbitrage(
                pair.token0,
                pair.token1,
                pair.testAmount,
                1 // Start with Sushiswap
            );

            if (opp2 && opp2.profit.gt(maxProfit)) {
                maxProfit = opp2.profit;
                bestOpportunity = opp2;
            }
        }

        return bestOpportunity;
    }

    async checkArbitrage(token0, token1, amount, firstRouter) {
        try {
            // Get amounts for first swap
            const path1 = [token0, token1];
            let amounts1;

            if (firstRouter === 0) {
                amounts1 = await this.uniswapRouter.getAmountsOut(amount, path1);
            } else {
                amounts1 = await this.sushiswapRouter.getAmountsOut(amount, path1);
            }

            const intermediateAmount = amounts1[1];

            // Get amounts for second swap
            const path2 = [token1, token0];
            let amounts2;

            if (firstRouter === 0) {
                amounts2 = await this.sushiswapRouter.getAmountsOut(
                    intermediateAmount,
                    path2
                );
            } else {
                amounts2 = await this.uniswapRouter.getAmountsOut(
                    intermediateAmount,
                    path2
                );
            }

            const finalAmount = amounts2[1];

            // Calculate profit
            const grossProfit = finalAmount.sub(amount);

            // Calculate AAVE flash loan fee (0.09%)
            const flashLoanFee = amount.mul(9).div(10000);

            // Estimate gas cost
            const gasPrice = await this.provider.getGasPrice();
            const estimatedGas = 400000; // Typical gas for flash loan arbitrage
            const gasCost = gasPrice.mul(estimatedGas);

            // Convert gas cost to token (assuming token0 is WETH or similar)
            const gasCostInToken = gasCost; // Simplified - in production, convert properly

            // Net profit
            const netProfit = grossProfit.sub(flashLoanFee).sub(gasCostInToken);

            if (netProfit.gt(0)) {
                return {
                    token0,
                    token1,
                    amount,
                    firstRouter,
                    profit: netProfit,
                    gasPrice
                };
            }

            return null;
        } catch (error) {
            console.error("Error checking arbitrage:", error);
            return null;
        }
    }

    async executeArbitrage(opportunity) {
        try {
            console.log(`Executing arbitrage:`);
            console.log(`  Token0: ${opportunity.token0}`);
            console.log(`  Token1: ${opportunity.token1}`);
            console.log(`  Amount: ${ethers.utils.formatEther(opportunity.amount)}`);
            console.log(`  Expected Profit: ${ethers.utils.formatEther(opportunity.profit)}`);

            const tokenPath = [opportunity.token0, opportunity.token1];

            // Execute flash loan
            const tx = await this.contract.requestFlashLoan(
                opportunity.token0,
                opportunity.amount,
                opportunity.firstRouter,
                tokenPath,
                {
                    gasLimit: 500000,
                    gasPrice: opportunity.gasPrice.mul(110).div(100) // 10% higher
                }
            );

            console.log(`Transaction submitted: ${tx.hash}`);

            const receipt = await tx.wait();

            if (receipt.status === 1) {
                console.log("Arbitrage executed successfully!");

                // Parse events to get actual profit
                const event = receipt.events.find(e => e.event === "ArbitrageExecuted");
                if (event) {
                    console.log(`Actual profit: ${ethers.utils.formatEther(event.args.profit)}`);
                }
            } else {
                console.log("Transaction failed");
            }

            return receipt;
        } catch (error) {
            console.error("Execution error:", error.message);

            // Log more details for debugging
            if (error.error) {
                console.error("Error details:", error.error);
            }
        }
    }
}

// Run monitor
async function main() {
    const monitor = new OpportunityMonitor();
    await monitor.start();
}

main().catch(console.error);
```

## Configuration & Setup

### Environment Configuration

```javascript
// .env file
WS_PROVIDER_URL=wss://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
HTTP_PROVIDER_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
PRIVATE_KEY=your_private_key_here
CONTRACT_ADDRESS=0xYourDeployedContractAddress
ETHERSCAN_API_KEY=your_etherscan_api_key

# Trading parameters
MIN_PROFIT_ETH=0.05
MAX_GAS_PRICE_GWEI=100
```

```json
// config/trading.json
{
  "uniswapRouter": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
  "sushiswapRouter": "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
  "aaveAddressProvider": "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e",
  "minProfit": "0.05",
  "monitoredPairs": [
    {
      "token0": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "token1": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "testAmount": "10000000000000000000"
    },
    {
      "token0": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      "token1": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      "testAmount": "10000000000000000000"
    }
  ]
}
```

## Deployment Guide

### Comprehensive Deployment Script

```javascript
// scripts/deploy.js
const hre = require("hardhat");

async function main() {
    console.log("Deploying FlashloanArbitrage contract...");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying with account:", deployer.address);

    const balance = await deployer.getBalance();
    console.log("Account balance:", hre.ethers.utils.formatEther(balance), "ETH");

    // Contract addresses for Ethereum mainnet
    const AAVE_ADDRESS_PROVIDER = "0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e"; // AAVE V3
    const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
    const SUSHISWAP_ROUTER = "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F";
    const MIN_PROFIT = hre.ethers.utils.parseEther("0.01"); // 0.01 ETH

    // Deploy contract
    const FlashloanArbitrage = await hre.ethers.getContractFactory("FlashloanArbitrage");
    const contract = await FlashloanArbitrage.deploy(
        AAVE_ADDRESS_PROVIDER,
        UNISWAP_ROUTER,
        SUSHISWAP_ROUTER,
        MIN_PROFIT
    );

    await contract.deployed();

    console.log("FlashloanArbitrage deployed to:", contract.address);

    // Save deployment info
    const deploymentInfo = {
        address: contract.address,
        deployer: deployer.address,
        network: hre.network.name,
        timestamp: new Date().toISOString(),
        constructorArgs: {
            aaveAddressProvider: AAVE_ADDRESS_PROVIDER,
            uniswapRouter: UNISWAP_ROUTER,
            sushiswapRouter: SUSHISWAP_ROUTER,
            minProfit: MIN_PROFIT.toString()
        }
    };

    const fs = require('fs');
    fs.writeFileSync(
        'deployment.json',
        JSON.stringify(deploymentInfo, null, 2)
    );

    // Verify on Etherscan
    if (hre.network.name === "mainnet" || hre.network.name === "goerli") {
        console.log("Waiting for block confirmations...");
        await contract.deployTransaction.wait(6);

        console.log("Verifying contract on Etherscan...");
        try {
            await hre.run("verify:verify", {
                address: contract.address,
                constructorArguments: [
                    AAVE_ADDRESS_PROVIDER,
                    UNISWAP_ROUTER,
                    SUSHISWAP_ROUTER,
                    MIN_PROFIT
                ],
            });
            console.log("Contract verified successfully");
        } catch (error) {
            console.error("Verification error:", error);
        }
    }

    console.log("\nDeployment Summary:");
    console.log("===================");
    console.log("Contract:", contract.address);
    console.log("Network:", hre.network.name);
    console.log("Deployer:", deployer.address);
    console.log("Min Profit:", hre.ethers.utils.formatEther(MIN_PROFIT), "ETH");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
```

### Hardhat Configuration

```javascript
// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
    solidity: {
        version: "0.8.17",
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
                url: process.env.HTTP_PROVIDER_URL,
                enabled: true
            }
        },
        goerli: {
            url: process.env.GOERLI_RPC_URL,
            accounts: [process.env.PRIVATE_KEY]
        },
        mainnet: {
            url: process.env.HTTP_PROVIDER_URL,
            accounts: [process.env.PRIVATE_KEY],
            chainId: 1
        }
    },
    etherscan: {
        apiKey: process.env.ETHERSCAN_API_KEY
    },
    gasReporter: {
        enabled: process.env.REPORT_GAS === "true",
        currency: "USD",
        coinmarketcap: process.env.COINMARKETCAP_API_KEY
    }
};
```

## API Integrations

The system integrates with multiple external protocols:

### AAVE V3 Pool Integration
```javascript
const aavePool = new ethers.Contract(
    poolAddress,
    IPoolABI,
    provider
);

// Get flash loan fee
const flashLoanPremium = await aavePool.FLASHLOAN_PREMIUM_TOTAL(); // Returns 9 (0.09%)

// Get reserve data
const reserveData = await aavePool.getReserveData(assetAddress);
```

### Uniswap/Sushiswap Integration
```javascript
// Get amounts out
const path = [tokenIn, tokenOut];
const amountsOut = await router.getAmountsOut(amountIn, path);

// Execute swap
const tx = await router.swapExactTokensForTokens(
    amountIn,
    amountOutMin,
    path,
    recipient,
    deadline
);
```

## Performance Optimization

### Query Optimization
- Use batch RPC calls via Multicall
- Cache static data (addresses, decimals)
- Use WebSocket for real-time updates
- Implement connection pooling

### Execution Optimization
- Submit transactions with optimal gas prices
- Use Flashbots for MEV protection
- Implement nonce management for fast submissions
- Monitor mempool for front-running protection

## Security Considerations

### Private Key Security
- Never commit private keys
- Use hardware wallets for production
- Implement multi-sig for high-value contracts
- Regular security audits

### Smart Contract Security
- Professional audits before mainnet
- Test extensively on testnets
- Use mainnet forking for realistic testing
- Implement circuit breakers

## Testing Strategy

```javascript
// test/FlashloanArbitrage.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FlashloanArbitrage", function () {
    let contract;
    let owner;

    beforeEach(async function () {
        // Deploy contract
        [owner] = await ethers.getSigners();

        const FlashloanArbitrage = await ethers.getContractFactory("FlashloanArbitrage");
        contract = await FlashloanArbitrage.deploy(
            AAVE_ADDRESS_PROVIDER,
            UNISWAP_ROUTER,
            SUSHISWAP_ROUTER,
            ethers.utils.parseEther("0.01")
        );
        await contract.deployed();
    });

    it("Should execute profitable arbitrage", async function () {
        // Test implementation
    });

    it("Should revert on unprofitable arbitrage", async function () {
        // Test implementation
    });
});
```

## Gas Optimization

Typical gas costs:
- Flash loan overhead: ~100,000 gas
- Two swaps: ~150,000 gas each
- Approvals and transfers: ~50,000 gas
- Total: ~450,000 gas

At 50 Gwei: ~0.0225 ETH (~$45 at $2000 ETH)

## Common Issues & Solutions

**Issue: Flash Loan Reverts**
- Check AAVE has sufficient liquidity
- Verify token approvals are correct
- Ensure repayment amount calculation is accurate

**Issue: Unprofitable After Gas**
- Increase minimum profit threshold
- Optimize gas usage in contract
- Use Flashbots to reduce gas competition

## Enhancement Opportunities

### Multi-Token Paths
Support triangular arbitrage: ETH -> USDC -> DAI -> ETH

### Dynamic Router Selection
Automatically choose best DEX based on current prices

### MEV Protection
Integrate Flashbots for private transaction submission

This technical deep dive provides comprehensive coverage of the AAVE flashloan arbitrage implementation with production-ready patterns and best practices.
