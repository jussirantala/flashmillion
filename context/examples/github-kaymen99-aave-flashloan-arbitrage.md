**Source:** https://github.com/kaymen99/aave-flashloan-arbitrage
**Date:** 2024-2025


# AAVE Flashloan Arbitrage by kaymen99

## Overview

The aave-flashloan-arbitrage repository is a specialized Solidity-based implementation focused on arbitrage trading between Uniswap and Sushiswap using AAVE's flash loan protocol. With 158 stars and recent updates through April 2024, this project represents a modern, production-oriented approach to flash loan arbitrage specifically targeting the AAVE V3 lending protocol.

This repository demonstrates the evolution of flash loan arbitrage by utilizing AAVE's newer, more efficient flash loan implementation instead of older protocols like DyDx. AAVE V3 offers several advantages including lower fees (0.09% vs DyDx's variable rates), support for more assets, and a cleaner, standardized interface through ERC-3156.

The implementation focuses on simplicity and clarity, making it an excellent learning resource for developers new to flash loan arbitrage. The smart contracts are well-structured with clear separation between the flash loan logic and DEX interaction logic. The repository includes comprehensive tests using Hardhat and demonstrates modern Solidity development practices.

What makes this repository particularly valuable is its focus on AAVE V3, the latest version of one of DeFi's most established lending protocols. AAVE's flash loans are widely used across the ecosystem, and understanding how to properly integrate with AAVE is essential knowledge for any DeFi developer.

## Repository Stats

- ⭐ Stars: 158
- 📅 Last Updated: April 2024
- 💻 Language: Solidity
- 🔗 URL: https://github.com/kaymen99/aave-flashloan-arbitrage
- 🛠️ Framework: Hardhat
- ⚡ Flash Loan Provider: AAVE V3
- 🎯 Target DEXes: Uniswap V2/V3, Sushiswap
- 💰 Loan Fee: 0.09% (AAVE V3)

## Key Features

### AAVE V3 Flash Loan Integration

The repository implements a complete integration with AAVE V3's flash loan functionality. AAVE V3 uses the ERC-3156 flash loan standard, which provides a cleaner, more standardized interface compared to proprietary implementations. The contract inherits from AAVE's FlashLoanSimpleReceiverBase, which handles much of the boilerplate code and provides built-in safety checks.

The AAVE integration supports borrowing any asset available in AAVE's lending pools, including WETH, USDC, DAI, USDT, and many other tokens. The 0.09% flash loan fee is competitive and often lower than gas costs for moving capital on-chain, making flash loans economically attractive for arbitrage strategies.

The implementation demonstrates proper callback handling through the executeOperation function, which AAVE calls after transferring the borrowed funds. This callback must complete all arbitrage trades and approve AAVE to withdraw the borrowed amount plus fees, all within the same transaction.

### Uniswap and Sushiswap Integration

The contract supports arbitrage between Uniswap and Sushiswap, two of Ethereum's largest decentralized exchanges. Both DEXes use similar AMM (Automated Market Maker) models, but price discrepancies can emerge due to different liquidity pools, trading volumes, and arbitrage efficiency.

The implementation includes router interfaces for both Uniswap V2 and V3, allowing flexibility in which pools to trade against. Uniswap V3's concentrated liquidity model sometimes offers better prices for certain trade sizes, while V2 provides more predictable pricing for others.

The contract handles token approvals, swap execution, and balance verification for both DEXes. It implements slippage protection through minimum output amount parameters and includes deadline checks to prevent transaction execution long after submission.

### Simplified Architecture

Unlike more complex multi-DEX arbitrage systems, this implementation focuses on the two-pool arbitrage pattern: borrow token A, swap A for B on DEX1, swap B back to A on DEX2, repay flash loan, and profit. This simplicity makes the code easier to understand, audit, and modify.

The simplified architecture reduces gas costs compared to more complex multi-hop strategies. With fewer DEX interactions and simpler logic, the contract's gas usage is optimized, increasing the range of profitable arbitrage opportunities.

### Comprehensive Testing Suite

The repository includes extensive tests written in JavaScript using Hardhat's testing framework. Tests cover successful arbitrage execution, handling of unprofitable opportunities, permission checks, and edge cases like insufficient liquidity or reverted swaps.

The tests use Hardhat's mainnet forking feature to test against real Uniswap and Sushiswap pools with actual liquidity. This realistic testing environment helps identify issues that might not appear in simulated environments, such as unexpected slippage or pool state changes.

### Gas-Optimized Implementation

The Solidity code employs gas optimization techniques including using immutable variables for frequently-accessed addresses, minimizing storage operations, and batching related operations. The contract is compiled with the Solidity optimizer enabled for maximum efficiency.

Gas optimization is critical for flash loan arbitrage because gas costs directly impact profitability. The implementation minimizes the number of external calls, uses memory instead of storage where possible, and avoids unnecessary computations.

### Configurable Parameters

The contract includes configurable parameters for slippage tolerance, minimum profit thresholds, and deadline settings. These parameters can be adjusted per transaction, allowing the operator to adapt to varying market conditions without redeploying contracts.

### Safety Mechanisms

The implementation includes multiple safety checks: profit validation before repaying the flash loan, slippage protection on all swaps, deadline enforcement to prevent stale transaction execution, and owner-only access control for flash loan initiation.

These safety mechanisms protect against common failure modes including front-running, sandwich attacks, failed swaps, and unauthorized usage of the deployed contract.

## Technology Stack

### Smart Contract Development

**Solidity 0.8+**: The contracts use Solidity version 0.8 or higher, benefiting from built-in overflow protection and improved error handling. The code follows current Solidity best practices and style guidelines.

**Hardhat**: The project uses Hardhat as its development framework, providing robust testing, deployment, and debugging capabilities. Hardhat's plugin ecosystem enables features like gas reporting, contract verification, and mainnet forking.

**OpenZeppelin Contracts**: Leverages OpenZeppelin's audited libraries for standard functionality like access control, reentrancy guards, and token interfaces. Using battle-tested libraries significantly reduces security risks.

### DeFi Protocol Integration

**AAVE V3 Protocol**: Direct integration with AAVE's latest flash loan implementation. The contract interacts with AAVE's Pool contract and implements the IFlashLoanSimpleReceiver interface for callbacks.

**Uniswap V2/V3**: Integration with both Uniswap V2 and V3 protocols. The contract can swap through either version depending on which offers better prices for the specific arbitrage opportunity.

**Sushiswap**: Integration with Sushiswap's router and factory contracts. Sushiswap uses the Uniswap V2 interface, making integration straightforward.

### Development Tools

**Ethers.js**: Used in testing and deployment scripts for blockchain interaction. Provides a complete and compact library for interacting with Ethereum.

**Hardhat Network**: Local blockchain simulation for development and testing. Supports mainnet forking to test against real protocol deployments.

**Chai**: Assertion library for writing readable test cases. Integrates seamlessly with Hardhat's testing framework.

## Project Structure

### Repository Organization

```
aave-flashloan-arbitrage/
├── contracts/
│   ├── FlashloanArbitrage.sol
│   ├── interfaces/
│   │   ├── IFlashLoanSimpleReceiver.sol
│   │   ├── IPoolAddressesProvider.sol
│   │   ├── IPool.sol
│   │   ├── IUniswapV2Router.sol
│   │   └── IUniswapV3Router.sol
│   └── libraries/
│       └── DataTypes.sol
├── scripts/
│   ├── deploy.js
│   ├── execute-arbitrage.js
│   └── helpers.js
├── test/
│   ├── FlashloanArbitrage.test.js
│   └── fixtures.js
├── hardhat.config.js
├── package.json
└── README.md
```

### Core Contract: FlashloanArbitrage.sol

The main contract implements the flash loan arbitrage strategy. It inherits from FlashLoanSimpleReceiverBase provided by AAVE, which includes built-in integration with AAVE's Pool contract and implements standard callback patterns.

Key components:
- Constructor initialization with AAVE Pool addresses and DEX router addresses
- `requestFlashLoan()`: Public function to initiate flash loans (owner-only)
- `executeOperation()`: Callback function executed by AAVE during the flash loan
- `_executeArbitrage()`: Internal function containing DEX swap logic
- `withdrawProfits()`: Function to withdraw accumulated profits

### Interface Contracts

The interfaces directory contains Solidity interfaces for all external protocols:

**IFlashLoanSimpleReceiver.sol**: Defines the callback interface that AAVE expects for simple flash loans. Implementing contracts must provide the executeOperation function.

**IPool.sol**: Interface for AAVE V3's main Pool contract, which provides lending, borrowing, and flash loan functionality.

**IUniswapV2Router.sol** and **IUniswapV3Router.sol**: Router interfaces for executing swaps on Uniswap. These define functions like swapExactTokensForTokens and related methods.

### Testing Framework

The test directory contains comprehensive test suites that verify contract behavior under various scenarios. Tests use Hardhat's mainnet forking to interact with real deployed contracts and liquidity pools.

The fixtures.js file sets up common test scenarios including mock token deployments, pool configurations, and account setups. This reduces boilerplate in individual test files.

## Implementation Approach

### AAVE V3 Flash Loan Flow

The flash loan process begins when the contract owner calls requestFlashLoan with parameters specifying which token to borrow, how much to borrow, and the DEX route to execute. This function constructs the necessary parameters and calls AAVE's Pool contract.

AAVE's Pool contract validates the request, transfers the requested tokens to the arbitrage contract, and immediately calls back into the executeOperation function. At this point, the contract holds the borrowed funds and must execute the arbitrage strategy.

The arbitrage logic executes within executeOperation: swap the borrowed tokens on the first DEX, swap the received tokens back on the second DEX, and verify that the final balance exceeds the borrowed amount plus AAVE's 0.09% fee.

After executeOperation completes, control returns to AAVE's Pool contract, which attempts to withdraw the borrowed amount plus fee from the arbitrage contract. If the contract doesn't have sufficient balance (indicating unprofitable arbitrage or failed swaps), the entire transaction reverts.

### DEX Arbitrage Execution

The arbitrage strategy follows a simple but effective pattern. Starting with the borrowed token (e.g., WETH), the contract approves the first DEX router to spend the tokens and executes a swap to the intermediate token (e.g., USDC).

For Uniswap V2 style swaps, the contract calls swapExactTokensForTokens specifying the input amount, minimum output amount (for slippage protection), token path, recipient address (the contract itself), and deadline. The function returns the actual amounts swapped.

After receiving the intermediate token, the contract approves the second DEX router and executes the reverse swap back to the original token. The minimum output amount for this second swap must be carefully calculated to ensure the final balance exceeds what's needed to repay the flash loan.

### Profit Calculation and Validation

Before executing any swaps, off-chain calculations estimate the expected profit by querying both DEXes' getAmountsOut functions. These simulations help identify whether an opportunity exists and what trade size would be optimal.

On-chain, after executing all swaps, the contract checks its final token balance. The balance must be greater than the initial borrowed amount plus AAVE's fee. Any amount above this threshold represents profit that can be withdrawn by the contract owner.

The profit validation is critical - it ensures the transaction only succeeds if profitable. This prevents scenarios where gas is wasted on unprofitable trades or where calculation errors lead to losses.

### Gas Cost Management

Gas costs are managed through multiple strategies. The contract is optimized for minimal gas usage, and the off-chain monitoring system only submits transactions where expected profit significantly exceeds gas costs.

The implementation uses immutable variables for frequently-accessed addresses, reducing storage reads. It minimizes external calls and uses efficient data structures. The Solidity compiler's optimizer is enabled with appropriate run settings.

### Security and Safety

The contract implements owner-only access control for flash loan initiation, preventing unauthorized usage. It includes reentrancy guards (inherited from AAVE's base contract) to prevent reentrancy attacks during callbacks.

All external calls are carefully ordered to prevent exploitation. Token approvals are limited to specific amounts needed for each swap rather than unlimited approvals. The contract includes emergency withdrawal functions to recover stuck funds.

## Use Cases

### Automated Arbitrage Trading

The primary use case is running an automated arbitrage system that monitors Uniswap and Sushiswap for price discrepancies. When profitable opportunities arise, the system executes flash loans to capitalize on them without requiring capital upfront.

### DeFi Education

The repository serves as an educational resource for learning about AAVE flash loans, DEX integration, and arbitrage mechanics. The clean code structure and comprehensive tests make it ideal for studying these concepts.

### Strategy Development

Developers can use this codebase as a foundation for more complex arbitrage strategies. The modular design makes it straightforward to add support for additional DEXes, implement multi-hop routes, or integrate with other DeFi protocols.

### Research and Analysis

Researchers can use the implementation to study DEX price efficiency, arbitrage dynamics, and the impact of flash loans on market structure. The ability to backtest strategies against historical data provides valuable insights.

## Getting Started

### Prerequisites

Required software and accounts:
- Node.js 16+ and npm
- Hardhat development environment
- Ethereum node access (Infura, Alchemy, or local node)
- Wallet with ETH for gas costs
- Basic understanding of Solidity and JavaScript

### Installation Steps

Clone the repository:
```bash
git clone https://github.com/kaymen99/aave-flashloan-arbitrage.git
cd aave-flashloan-arbitrage
```

Install dependencies:
```bash
npm install
```

Configure environment variables in .env:
```
INFURA_API_KEY=your_infura_key
PRIVATE_KEY=your_wallet_private_key
ETHERSCAN_API_KEY=your_etherscan_key
```

### Compiling Contracts

Compile the Solidity contracts:
```bash
npx hardhat compile
```

This generates artifacts in the artifacts/ directory and type definitions for contract interaction.

### Running Tests

Execute the test suite:
```bash
npx hardhat test
```

Run tests with gas reporting:
```bash
REPORT_GAS=true npx hardhat test
```

Test against mainnet fork:
```bash
npx hardhat test --network hardhat
```

### Deployment

Deploy to local network:
```bash
npx hardhat run scripts/deploy.js --network localhost
```

Deploy to testnet:
```bash
npx hardhat run scripts/deploy.js --network goerli
```

Deploy to mainnet (after thorough testing):
```bash
npx hardhat run scripts/deploy.js --network mainnet
```

### Executing Arbitrage

Use the execution script to manually trigger arbitrage:
```bash
npx hardhat run scripts/execute-arbitrage.js --network mainnet
```

This script checks for current opportunities and executes profitable trades.

## Unique Aspects

### Modern AAVE V3 Implementation

This repository showcases AAVE V3, the latest and most efficient version of AAVE's lending protocol. V3 offers lower fees, better capital efficiency, and improved functionality compared to earlier versions.

### ERC-3156 Compliance

AAVE V3's flash loans follow the ERC-3156 standard, providing a consistent interface that works across multiple protocols. This standardization makes the code more portable and easier to understand.

### Clean, Educational Code

The implementation prioritizes clarity and educational value. Code is well-commented, variables have descriptive names, and the architecture follows intuitive patterns. This makes it excellent for learning.

### Production-Ready Testing

The comprehensive test suite using mainnet forking ensures the code works against real deployed contracts. This realistic testing catches issues that simulated environments might miss.

### Minimal Dependencies

The contract has minimal external dependencies, relying primarily on AAVE's base contracts and standard interfaces. This reduces complexity and potential security vulnerabilities from third-party code.

## Learning Value

### AAVE Protocol Integration

Studying this repository teaches how to properly integrate with AAVE, one of DeFi's most important lending protocols. Understanding AAVE flash loans is valuable for many DeFi applications beyond arbitrage.

### Flash Loan Mechanics

The implementation demonstrates the complete flash loan lifecycle from request to callback to repayment. Understanding this pattern is essential for any application using flash loans.

### DEX Integration Patterns

The code shows how to properly interact with Uniswap and Sushiswap, including approvals, swaps, and querying expected outputs. These patterns apply broadly to DEX interactions.

### Smart Contract Testing

The test suite demonstrates best practices for testing Solidity contracts, including using fixtures, mainnet forking, and testing both success and failure cases.

### Gas Optimization

The implementation showcases practical gas optimization techniques that reduce transaction costs without sacrificing code clarity or security.

## Recommendations

### For Beginners

Start by reading through FlashloanArbitrage.sol carefully, understanding each function's purpose. Run the tests to see the contract in action. Don't attempt mainnet deployment until you thoroughly understand the code and have tested extensively.

Focus on understanding the flash loan callback pattern - this is the most critical concept. Study how executeOperation receives funds, performs swaps, and ensures repayment.

Use Hardhat's console.log functionality to add debugging output and understand the contract's state at different execution points.

### For Intermediate Users

Modify the contract to support additional DEXes like Curve or Balancer. This requires understanding different DEX interfaces and adapting the swap logic accordingly.

Implement more sophisticated profit calculations that account for gas prices, slippage, and market impact. Consider adding support for multi-hop routes involving three or more tokens.

Optimize the monitoring logic to reduce latency between opportunity detection and execution. Consider using mempool monitoring to detect opportunities before they're confirmed.

### For Advanced Users

Integrate with Flashbots to submit transactions privately, avoiding front-running. This significantly improves profitability on competitive opportunities.

Implement cross-protocol arbitrage involving lending rates, perpetual funding rates, or other DeFi primitives beyond spot DEX trading.

Consider deploying on layer-2 networks or alternative chains where gas costs are lower and arbitrage opportunities may be less competitive.

### Production Considerations

Never deploy to mainnet without professional security audits. Even well-written flash loan contracts can have subtle vulnerabilities.

Implement comprehensive monitoring and alerting for production deployments. You need immediate notification if the bot stops working or starts losing money.

Start with small position sizes and gradually increase as confidence grows. Monitor actual vs expected profits to validate your calculations.

Maintain operational security for private keys. Consider using multi-sig wallets or hardware security modules for controlling high-value contracts.

Keep AAVE protocol documentation bookmarked and monitor for updates. DeFi protocols evolve and changes can break integrations.

This repository provides an excellent foundation for AAVE-based flash loan arbitrage with modern, clean code that's both educational and production-capable.
