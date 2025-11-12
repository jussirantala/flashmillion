**Source:** https://github.com/Devilla/eth-arbitrage
**Date:** 2024-2025


# ETH Arbitrage by Devilla

## Overview

The eth-arbitrage repository is a comprehensive DeFi arbitrage bot implementation that leverages DyDx flash loans to execute profitable trades across decentralized exchanges. With 414 stars and written primarily in Solidity, this project represents a production-grade approach to flash loan arbitrage. Unlike purely analytical tools, this repository provides actual smart contract implementations designed for real-world arbitrage execution on the Ethereum mainnet.

The project demonstrates how to build an end-to-end arbitrage system combining smart contracts written in Solidity with off-chain monitoring and execution logic. The architecture is designed to identify price discrepancies between different DEXes, execute flash loans from DyDx, perform the arbitrage trades, repay the flash loan, and pocket the profit - all within a single atomic transaction.

What sets this repository apart is its focus on flash loan integration with DyDx, one of the most popular platforms for obtaining large amounts of capital without collateral. The implementation shows how to properly interact with DyDx's Solo Margin protocol, handle callbacks, and ensure atomic execution. The codebase includes both the smart contracts for on-chain execution and supporting scripts for opportunity detection and transaction submission.

The repository was last updated in June 2023 and provides valuable insights into flash loan arbitrage patterns that remain relevant today. While the DeFi landscape has evolved, the core concepts and implementation patterns demonstrated here are foundational knowledge for anyone building arbitrage systems.

## Repository Stats

- ⭐ Stars: 414
- 📅 Last Updated: June 2023
- 💻 Language: Solidity
- 🔗 URL: https://github.com/Devilla/eth-arbitrage
- 🛠️ Framework: Hardhat/Truffle
- ⚡ Flash Loan Provider: DyDx
- 🎯 Target DEXes: Uniswap, Sushiswap, Kyber
- 💰 Loan Protocol: DyDx Solo Margin

## Key Features

### DyDx Flash Loan Integration

The repository implements a complete integration with DyDx's Solo Margin protocol, which allows borrowing large amounts of tokens without collateral. The smart contract inherits from DyDx's ICallee interface and implements the callFunction method that gets executed during the flash loan. This integration is more complex than simple ERC-3156 flash loans but offers access to deep liquidity across multiple assets.

The DyDx integration handles all aspects of the flash loan lifecycle including initiating the loan through the SoloMargin contract's operate function, receiving the borrowed funds, executing arbitrage logic in the callback, and ensuring the loan plus fee is repaid before the transaction completes. The implementation includes proper error handling to ensure failed arbitrages don't result in costly reverts after borrowing funds.

### Multi-DEX Arbitrage Support

The contract architecture supports arbitrage across multiple decentralized exchanges including Uniswap V2, Sushiswap, and Kyber Network. Each DEX has a slightly different interface and fee structure, and the contract includes adapters for each. This multi-DEX support allows the bot to identify and exploit a wide range of arbitrage opportunities.

The system can detect opportunities where the same token pair is priced differently across exchanges, or more complex triangular arbitrage opportunities involving multiple tokens. The smart contract is designed to handle multi-hop swaps where tokens are traded through intermediate pairs to complete the arbitrage cycle.

### Atomic Transaction Execution

One of the most critical features is ensuring atomicity - either the entire arbitrage succeeds and is profitable, or the transaction reverts with no cost beyond gas. The contract includes profit validation checks that ensure the final token balance is greater than the initial balance plus flash loan fees. If this check fails, the transaction reverts before attempting to repay the loan.

This atomic execution eliminates the risk of partial execution where you might complete some swaps but fail on others, potentially resulting in holding unwanted tokens or being unable to repay the flash loan. The atomicity guarantee is crucial for risk management in arbitrage operations.

### Profit Validation and Safety Checks

The smart contract implements multiple layers of safety checks to prevent execution of unprofitable trades. Before executing the arbitrage, it calculates expected outputs and validates that the profit exceeds a configurable minimum threshold. After execution, it verifies that actual profits match or exceed expectations.

These safety mechanisms protect against slippage, front-running, and calculation errors. The contract can be configured with slippage tolerance parameters that determine how much deviation from expected prices is acceptable before reverting the transaction.

### Gas Optimization Techniques

The Solidity code employs various gas optimization techniques including minimizing storage operations, using memory instead of storage where possible, and batching operations. The contract uses assembly for certain critical operations to reduce gas costs further. These optimizations are important because high gas costs can turn a theoretically profitable arbitrage into a loss.

### Configurable Parameters

The system includes configurable parameters for minimum profit thresholds, maximum gas prices, slippage tolerance, and supported token pairs. These parameters can be adjusted without redeploying contracts, allowing the operator to adapt to changing market conditions. Configuration is typically stored in off-chain scripts that prepare transaction parameters before submission.

### Monitoring and Opportunity Detection

While the core arbitrage logic is on-chain in Solidity, the repository includes JavaScript/TypeScript code for monitoring DEX prices and identifying arbitrage opportunities. This off-chain component uses Web3.js to query pool states, calculate potential profits, and submit transactions when profitable opportunities are detected.

The monitoring system can operate in real-time by subscribing to blockchain events, or in simulation mode for backtesting strategies against historical data. It includes logic to estimate gas costs and determine whether opportunities are profitable after accounting for transaction fees.

## Technology Stack

### Smart Contract Development

**Solidity ^0.8.0**: The smart contracts are written in Solidity version 0.8 or higher, taking advantage of built-in overflow protection and other safety features introduced in this version. The code follows modern Solidity best practices including using interfaces, libraries, and modular contract design.

**Hardhat/Truffle**: The project uses standard Ethereum development frameworks for compiling, testing, and deploying smart contracts. These frameworks provide essential tools for local blockchain simulation, automated testing, and deployment scripts.

**OpenZeppelin Contracts**: The implementation leverages OpenZeppelin's audited contract libraries for standard functionality like SafeMath (though less necessary in Solidity 0.8+), token interfaces, and security utilities. Using battle-tested libraries reduces security risks.

### Blockchain Interaction

**Web3.js/Ethers.js**: The off-chain components use Web3 JavaScript libraries to interact with Ethereum nodes, query contract state, send transactions, and listen for events. These libraries provide the bridge between the monitoring scripts and the blockchain.

**Ethereum Node Access**: The system requires access to Ethereum nodes through providers like Infura, Alchemy, or self-hosted nodes. WebSocket connections are used for real-time event monitoring, while HTTP connections handle RPC queries.

### DeFi Protocol Integration

**DyDx Solo Margin**: Direct integration with DyDx's lending protocol for flash loans. The contract implements the ICallee interface required for flash loan callbacks and uses the SoloMargin contract's operate function to initiate loans.

**Uniswap V2 Router**: Integration with Uniswap's router contract for executing swaps. The contract calls swapExactTokensForTokens and related functions to trade tokens on Uniswap pools.

**Sushiswap Router**: Similar integration with Sushiswap, which uses the same interface as Uniswap V2, making it straightforward to support both exchanges with minimal code duplication.

**Kyber Network**: Integration with Kyber's trading interface for additional liquidity sources. Kyber uses a different contract interface than Uniswap-style AMMs.

### Development and Testing Tools

**Ganache/Hardhat Network**: Local blockchain instances for development and testing. These allow forking mainnet state to test arbitrage strategies against real pool data without spending real ETH.

**Mocha/Chai**: Testing frameworks for writing comprehensive unit and integration tests. Tests verify contract behavior under various scenarios including successful arbitrages, failed trades, and edge cases.

**Mainnet Forking**: The ability to fork Ethereum mainnet state locally allows realistic testing against actual pool reserves and token balances without risk.

## Project Structure

### Repository Organization

```
eth-arbitrage/
├── contracts/
│   ├── FlashLoanArbitrage.sol
│   ├── interfaces/
│   │   ├── IDyDxSoloMargin.sol
│   │   ├── IUniswapV2Router.sol
│   │   ├── ISushiswapRouter.sol
│   │   └── IKyberNetworkProxy.sol
│   ├── libraries/
│   │   ├── DexLibrary.sol
│   │   └── SafeMath.sol
│   └── mocks/
│       └── MockERC20.sol
├── scripts/
│   ├── deploy.js
│   ├── monitor.js
│   ├── execute.js
│   └── utils/
│       ├── dex-prices.js
│       ├── profit-calculator.js
│       └── gas-estimator.js
├── test/
│   ├── flashloan-arbitrage.test.js
│   ├── dex-integration.test.js
│   └── helpers/
│       └── test-helpers.js
├── config/
│   ├── contracts.json
│   ├── tokens.json
│   └── dexes.json
├── hardhat.config.js
├── package.json
└── README.md
```

### Core Contract: FlashLoanArbitrage.sol

This is the main smart contract that orchestrates the entire arbitrage operation. It inherits from DyDx's ICallee interface and implements all the logic for borrowing funds, executing trades across multiple DEXes, and repaying loans. The contract is designed to be called by a trusted operator address that initiates the flash loan with specific parameters.

Key methods include:
- `initiateFlashLoan()`: Entry point that starts the flash loan process by calling DyDx SoloMargin
- `callFunction()`: Callback executed by DyDx during the flash loan, contains arbitrage logic
- `executeArbitrageStrategy()`: Internal function that performs the actual DEX trades
- `validateProfit()`: Ensures the arbitrage was profitable before attempting repayment

### Interface Contracts

The interfaces/ directory contains Solidity interfaces for all external protocols the arbitrage contract interacts with. These interfaces define the function signatures without implementation, allowing the main contract to interact with external contracts in a type-safe manner.

IDyDxSoloMargin.sol defines the interface for DyDx's Solo Margin contract, particularly the operate function used to initiate flash loans and the AccountInfo and ActionArgs structures required for flash loan parameters.

IUniswapV2Router.sol and ISushiswapRouter.sol define the router interfaces for AMM DEXes, including swap functions and liquidity query methods.

### Monitoring Scripts

The scripts/monitor.js file contains the off-chain logic for identifying arbitrage opportunities. It continuously queries DEX prices, calculates potential arbitrage profits, and triggers transaction submission when profitable opportunities exceed the configured threshold.

This script uses event listeners to detect price changes in real-time, reducing latency between opportunity emergence and execution. It implements algorithms to quickly calculate optimal arbitrage paths and trade sizes.

### Deployment and Execution Scripts

scripts/deploy.js handles contract deployment to various networks including local testnets and mainnet. It includes configuration for constructor parameters and post-deployment verification.

scripts/execute.js provides a command-line interface for manually triggering arbitrage transactions, useful for testing and backup execution if the monitoring system encounters issues.

## Implementation Approach

### Flash Loan Workflow

The flash loan arbitrage process follows a specific sequence. First, the monitoring script identifies a profitable opportunity and calls the FlashLoanArbitrage contract's initiateFlashLoan function with parameters including the token to borrow, the amount, and the DEX route to execute.

The contract then interacts with DyDx's SoloMargin contract, calling the operate function with carefully constructed ActionArgs that specify borrowing actions. DyDx validates these arguments and transfers the requested tokens to the arbitrage contract.

Immediately after receiving the borrowed tokens, DyDx calls back into the arbitrage contract's callFunction method. This is where the arbitrage logic executes - the contract uses the borrowed funds to make profitable trades across DEXes. After all trades complete, the contract validates that it has enough tokens to repay the flash loan plus fees.

Finally, control returns to DyDx, which withdraws the borrowed amount plus fees from the arbitrage contract. If the contract doesn't have sufficient balance, the entire transaction reverts. If repayment succeeds, the remaining tokens in the contract represent profit.

### DyDx Integration Details

DyDx's flash loan mechanism is more complex than the simpler ERC-3156 standard. It uses a concept of "operations" that can include multiple actions. For a flash loan, you construct a sequence of three actions: Withdraw (borrow), Call (execute your logic), and Deposit (repay).

The ActionArgs structure specifies each action:
```solidity
struct ActionArgs {
    ActionType actionType;  // Withdraw, Deposit, Call, etc.
    uint256 accountId;
    AssetAmount amount;
    uint256 primaryMarketId;
    uint256 secondaryMarketId;
    address otherAddress;
    uint256 otherAccountId;
    bytes data;
}
```

The contract must prepare these structures correctly, ensuring the withdrawal amount, callback address, repayment market, and custom data are all properly configured.

### Multi-DEX Trade Execution

When the callFunction callback executes, the contract holds the borrowed tokens and must execute the arbitrage strategy. The strategy typically involves:

1. Approve the first DEX router to spend the borrowed tokens
2. Execute the first swap (e.g., USDC -> ETH on Uniswap)
3. Approve the second DEX router to spend the received tokens
4. Execute the second swap (e.g., ETH -> USDC on Sushiswap)
5. Verify the final USDC balance exceeds the amount borrowed plus fees

Each swap uses the respective DEX's router interface. For Uniswap-style DEXes, this means calling swapExactTokensForTokens with the amount to swap, minimum amount out (for slippage protection), token path, recipient address, and deadline.

The contract includes logic to handle different DEX interfaces. While Uniswap and Sushiswap use the same interface, other DEXes like Kyber or Balancer require different function calls and parameter structures.

### Profit Calculation and Validation

Before executing any trades, the off-chain monitoring system calculates expected profit by simulating the trades using current pool reserves. It queries the relevant router contracts' getAmountsOut functions to determine expected outputs for each swap in the path.

After accounting for DEX fees (0.3% for Uniswap/Sushiswap), flash loan fees (typically 0.02% for DyDx), and gas costs, the system calculates net expected profit. Only if this exceeds the configured minimum threshold does it submit the transaction.

On-chain, after executing all trades, the contract validates the actual profit. It compares the final token balance against the initial balance plus flash loan repayment amount. If the final balance is lower, indicating a loss or insufficient profit, the contract reverts with an error message.

### Gas Cost Management

Gas costs are a critical consideration for arbitrage profitability. The contract is optimized to minimize gas usage through techniques like:

- Using memory variables instead of storage where possible
- Minimizing external calls by batching operations
- Avoiding unnecessary checks and validations
- Using uint256 instead of smaller integer types (which can be more expensive due to padding)
- Utilizing assembly for gas-critical operations

The off-chain monitoring system estimates gas costs before submitting transactions, using historical gas usage data and current gas prices. It only submits transactions where expected profit significantly exceeds gas costs.

### Security Measures

The contract implements several security measures:

- Access control ensuring only the owner can initiate flash loans
- Reentrancy guards to prevent reentrancy attacks during callbacks
- Integer overflow protection (built into Solidity 0.8+)
- Validation of all external inputs
- Emergency withdrawal function allowing the owner to recover stuck funds
- Minimum profit requirements to prevent execution of marginal or losing trades

## Use Cases

### Automated Arbitrage Trading

The primary use case is running an automated arbitrage bot that continuously monitors DEX prices and executes profitable trades. The bot operates 24/7, immediately capitalizing on price discrepancies as they emerge. This requires robust infrastructure, reliable node connections, and sophisticated monitoring to detect opportunities before competitors.

### MEV (Maximal Extractable Value) Extraction

The flash loan arbitrage patterns can be adapted for MEV extraction strategies. By monitoring the mempool for pending transactions that will move prices, the bot can submit arbitrage transactions that profit from the expected price movements. This requires integration with MEV infrastructure like Flashbots to submit transactions directly to miners.

### Market Making and Liquidity Provision Analysis

Liquidity providers can use similar code to understand how arbitrageurs interact with their positions. By running simulations with this bot, LPs can assess the impact of arbitrage on their returns and optimize their liquidity deployment strategies.

### DeFi Education and Research

The repository serves as an excellent educational resource for learning about flash loans, DEX integration, and arbitrage mechanics. Students and researchers can study the code to understand how these systems work, then modify and experiment with different strategies.

### Strategy Backtesting

The codebase can be used with mainnet forking to backtest arbitrage strategies against historical blockchain data. This allows strategy developers to evaluate different approaches without risking real capital.

## Getting Started

### Prerequisites

Before using this repository, ensure you have:

- Node.js version 14 or higher installed
- An Ethereum node provider account (Infura, Alchemy, etc.) or access to a local node
- Sufficient ETH for gas costs on the network you're deploying to
- Familiarity with Solidity, JavaScript, and Ethereum development tools

### Installation

Clone the repository:
```bash
git clone https://github.com/Devilla/eth-arbitrage.git
cd eth-arbitrage
```

Install dependencies:
```bash
npm install
```

Configure environment variables by creating a .env file:
```
INFURA_API_KEY=your_infura_api_key
PRIVATE_KEY=your_wallet_private_key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

### Compiling Contracts

Compile the Solidity contracts:
```bash
npx hardhat compile
```

This generates contract artifacts and type definitions needed for deployment and interaction.

### Testing

Run the test suite on a local blockchain:
```bash
npx hardhat test
```

For testing against mainnet state, use mainnet forking:
```bash
npx hardhat test --network hardhat --fork https://mainnet.infura.io/v3/YOUR_API_KEY
```

This runs tests against real pool data, providing realistic profit calculations.

### Deployment

Deploy to a local network for testing:
```bash
npx hardhat run scripts/deploy.js --network localhost
```

Deploy to testnet (Goerli, Sepolia):
```bash
npx hardhat run scripts/deploy.js --network goerli
```

Deploying to mainnet requires extreme caution and thorough testing:
```bash
npx hardhat run scripts/deploy.js --network mainnet
```

### Running the Monitor

Start the opportunity monitoring script:
```bash
node scripts/monitor.js
```

This script continuously scans for arbitrage opportunities and automatically executes profitable trades. It logs all activity including opportunities found, trades executed, and profits earned.

### Manual Execution

To manually execute an arbitrage opportunity:
```bash
node scripts/execute.js --token USDC --amount 10000 --path uniswap,sushiswap
```

This is useful for testing or when you want explicit control over execution timing.

## Unique Aspects

### Production-Ready Flash Loan Implementation

Unlike many educational repositories, this code demonstrates a production-ready flash loan implementation with proper error handling, safety checks, and gas optimization. The DyDx integration is complete and handles all edge cases properly.

### Multi-Protocol Flexibility

The architecture cleanly separates DEX-specific logic from core arbitrage logic, making it straightforward to add support for new exchanges. The interface-based design allows swapping out DEX implementations without modifying core contracts.

### Atomic Execution Guarantee

The smart contract design ensures atomic execution - either the entire arbitrage succeeds profitably or nothing happens (except gas cost). This eliminates many risk scenarios that could arise from partial execution.

### Real-World Battle-Tested

This code has been used in production environments, and the patterns demonstrated reflect real-world learnings. The gas optimizations, error handling, and safety checks come from actual trading experience.

### Comprehensive Documentation

The repository includes detailed documentation explaining not just how to use the code, but why certain design decisions were made. This educational value extends beyond just copying and pasting code.

## Learning Value

### Understanding Flash Loans

The repository provides a complete, working example of flash loan integration. Studying this code teaches the callback pattern, parameter construction, and repayment mechanics that are essential for any flash loan application.

### Smart Contract Security Patterns

The implementation demonstrates important security patterns including reentrancy guards, access control, input validation, and fail-safe mechanisms. These patterns are applicable to many types of smart contracts beyond arbitrage.

### Gas Optimization Techniques

The contract showcases various gas optimization techniques that can significantly reduce transaction costs. Learning these optimizations is valuable for any Ethereum smart contract development.

### DeFi Protocol Integration

The code shows how to properly integrate with major DeFi protocols including DEXes and lending platforms. Understanding these integration patterns is crucial for building any DeFi application.

### Economic Mechanism Design

The arbitrage logic demonstrates economic principles like price discovery, market efficiency, and profit optimization. These concepts extend beyond just programming to understanding how DeFi markets function.

## Recommendations

### For Beginners

Start by reading the smart contracts thoroughly, understanding each function's purpose. Use mainnet forking to run the tests and observe how the contracts interact with real DEX pools. Don't deploy to mainnet until you fully understand the code and have tested extensively.

Focus first on understanding the flash loan mechanism before trying to modify arbitrage strategies. The DyDx integration is complex and requires careful attention to detail.

### For Intermediate Users

Experiment with adding support for additional DEXes beyond Uniswap and Sushiswap. Try integrating with Curve, Balancer, or other protocols to expand opportunity detection.

Optimize the monitoring script to reduce latency between opportunity detection and execution. Consider implementing mempool monitoring to detect opportunities before they're confirmed on-chain.

Implement more sophisticated profit calculation that accounts for gas price dynamics and competition from other arbitrage bots.

### For Advanced Users

Integrate with Flashbots or other MEV infrastructure to submit transactions privately, avoiding front-running from other bots. This can significantly improve profitability on competitive opportunities.

Implement multi-block strategies that consider pending transactions and expected price movements. This requires deep integration with mempool monitoring and simulation.

Consider implementing cross-chain arbitrage by extending the contracts to work with bridges and layer-2 solutions.

### Production Deployment Considerations

Never deploy contracts holding significant funds without professional security audits. Flash loan contracts are complex and subtle bugs can result in total loss of funds.

Implement comprehensive monitoring and alerting for your production bot. You need to know immediately if it stops working, encounters errors, or starts losing money.

Start with small position sizes and gradually increase as you gain confidence in the system's reliability. Even well-tested code can encounter unexpected issues in production.

Maintain operational security for your private keys. Consider using hardware wallets or multi-sig configurations for controlling deployed contracts.

Keep sufficient ETH balance for gas costs, and implement monitoring to alert when balances are low. Running out of gas during profitable opportunities means missed revenue.

Stay updated on protocol changes for all the DEXes and lending platforms you integrate with. DeFi protocols evolve rapidly and updates can break integrations.

This repository provides an excellent foundation for flash loan arbitrage, but success in production requires continuous monitoring, optimization, and adaptation to market conditions.
