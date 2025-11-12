# Aave Flashloan Arbitrage Bot

**⚠️ FOR EDUCATIONAL USE ONLY - PRIVATE BLOCKCHAIN ONLY**

Educational TypeScript bot demonstrating Aave V3 flashloan arbitrage across DEXs.

## What It Does

1. **Scans prices** across Uniswap V2 and Sushiswap
2. **Detects arbitrage opportunities** (price differences > 0.5%)
3. **Executes flashloan** from Aave V3
4. **Performs arbitrage**:
   - Buy token on cheaper DEX
   - Sell token on expensive DEX
   - Repay flashloan + 0.05% fee
   - Keep profit

## Architecture

```
Price Scanner → Opportunity Detector → Flashloan Executor
      ↓                 ↓                      ↓
  Uniswap V2      Find Best Prices      Aave V3 Pool
  Sushiswap       Calculate Profit      Smart Contract
```

## Quick Start

```bash
# Install
npm install

# Configure
cp .env.example .env
# Edit .env

# Run (dry-run mode)
npm run dev
```

## Features

- ✅ Aave V3 flashloan integration
- ✅ Multi-DEX price scanning
- ✅ Automatic opportunity detection
- ✅ Profitability calculation (fees + gas)
- ✅ Dry-run mode for safe testing
- ✅ On-chain simulation before execution

## How It Works

### 1. Price Scanning
Continuously checks prices on:
- Uniswap V2
- Sushiswap
- (Uniswap V3 support can be added)

### 2. Opportunity Detection
Finds profitable arbitrage when:
- Price difference > 0.5%
- Net profit > minimum threshold
- After flashloan fee (0.05%)
- After estimated gas costs

### 3. Execution
```solidity
1. Borrow tokens from Aave (flashloan)
2. Swap on cheaper DEX
3. Swap back on expensive DEX
4. Repay Aave + 0.05% fee
5. Profit = (sell - buy) - fee - gas
```

## Files

- `src/index.ts` - Main bot logic
- `src/opportunityDetector.ts` - Finds arbitrage opportunities
- `src/priceScanner.ts` - Scans DEX prices
- `src/flashloanExecutor.ts` - Executes flashloan arbitrage
- `contracts/FlashloanArbitrage.sol` - On-chain arbitrage contract

## Configuration

Key settings in `.env`:

```env
MIN_PROFIT_USD=50           # Minimum profit to execute
MAX_LOAN_AMOUNT_USD=100000  # Maximum flashloan size
ENABLE_EXECUTION=false      # Set true to execute
DRY_RUN=true               # Set false for live mode
```

## Safety Features

- 📊 Dry-run mode by default
- ✅ On-chain profitability simulation
- ✅ Minimum profit threshold
- ✅ Gas cost estimation
- ✅ Owner-only contract controls
- ✅ Emergency withdrawal

## Educational Value

Learn about:
- Aave V3 flashloans
- DEX arbitrage mechanics
- Price discovery across DEXs
- Profitability calculations
- Smart contract integration

## ⚠️ Important

- Only use on private blockchain/testnet
- Never use with real funds
- Understand the risks and fees
- This is for learning purposes only

See full documentation in the main README.
