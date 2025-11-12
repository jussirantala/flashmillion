**Source:** https://github.com/gweidart/evm-flashswap-arb
**Date:** November 2022

# EVM Flash Swap Arbitrage: Mathematical Optimization for Capital-Free MEV

## Repository Statistics

- **Stars:** 156
- **Forks:** ~60+
- **Primary Language:** Solidity (56.8%)
- **Secondary Language:** TypeScript (43.2%)
- **Status:** Archived (November 2022)
- **Platform:** EVM-compatible chains (Ethereum, BSC, Polygon, Arbitrum, etc.)
- **License:** MIT

## Overview

The gweidart EVM Flash Swap Arbitrage bot is a mathematically rigorous implementation of capital-free arbitrage using Uniswap V2's native flash swap functionality. Unlike bots that rely on external flash loan protocols (like Aave), this implementation leverages the built-in flash swap mechanism of Uniswap V2, making it more gas-efficient and elegant.

The distinguishing feature of this bot is its **mathematical optimization engine** that solves quadratic equations to determine the exact optimal trade size for maximum profit, rather than using approximations or trial-and-error approaches.

**Key Innovation:**
```
Traditional Approach: Try different amounts until profit maximized (slow, imprecise)
This Bot: Solve ∂P/∂x = 0 for exact optimal amount (fast, precise, provably optimal)
```

## Purpose and Context

### Flash Swaps vs. Flash Loans

**Flash Loans (Aave, etc.):**
- Borrow from lending protocol
- Pay 0.09% fee
- Requires separate protocol integration
- Higher gas costs (extra external calls)

**Flash Swaps (Uniswap V2):**
- Borrow directly from pool during swap
- Pay standard 0.3% swap fee
- No additional protocol needed
- Lower gas costs (fewer external calls)
- More capital efficient

**Why Flash Swaps Are Better for Arbitrage:**

1. **Atomic Execution:** Borrow, arbitrage, repay in single transaction
2. **No Upfront Capital:** Only gas fees needed
3. **Gas Efficiency:** ~30% less gas than flash loans
4. **Simplicity:** One protocol instead of two
5. **Security:** Enforced by smart contract (cannot lose borrowed funds)

### Mathematical Foundation

The bot solves this optimization problem:

```
Maximize: P(x) = backrun_output(x) - x - gas_costs

Subject to:
- x > 0 (positive trade size)
- x < R₁ (don't drain pool)
- P(x) > 0 (must be profitable)

Where:
P(x) = profit function
x = amount borrowed via flash swap
R₁ = reserves of pool 1
```

The solution uses calculus to find the derivative and solve for x:

```
∂P/∂x = 0
→ x* = optimal trade size

This is a quadratic equation with exact solution!
```

## Architecture Breakdown

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│              TypeScript Bot (Off-Chain)                 │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Pool Price  │→ │  Optimizer   │→ │ Transaction  │ │
│  │  Monitor     │  │              │  │  Builder     │ │
│  │              │  │ Quadratic    │  │              │ │
│  │ - Fetch data │  │ Equation     │  │ - Encode     │ │
│  │ - Compare    │  │ Solver       │  │ - Sign       │ │
│  │ - Filter     │  │              │  │ - Submit     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│           Solidity Smart Contract (On-Chain)            │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Flash Swap  │→ │   Arbitrage  │→ │    Repay     │ │
│  │              │  │              │  │              │ │
│  │ - Borrow     │  │ - Swap pool2 │  │ - Transfer   │ │
│  │   from pool1 │  │ - Calculate  │  │   to pool1   │ │
│  │              │  │   output     │  │ - Keep profit│ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Component Flow

**Discovery Phase:**
```
1. Monitor all Uniswap V2 pools
2. Fetch reserve ratios
3. Compare prices for same token pair across pools
4. Identify arbitrage opportunities
```

**Optimization Phase:**
```
5. Calculate exact optimal trade size using math
6. Estimate gas costs
7. Verify profitability after gas
8. Discard if not profitable
```

**Execution Phase:**
```
9. Build transaction calling flash swap
10. Sign transaction
11. Submit to network
12. Monitor for confirmation
```

### Smart Contract Architecture

```solidity
contract FlashSwapArbitrage {
    // Entry point
    function initiateArbitrage(
        address pool1,      // Borrow from here
        address pool2,      // Arbitrage here
        uint amount,        // Optimal amount
        bool direction      // token0→token1 or reverse
    ) external {
        // Initiate flash swap from pool1
        IUniswapV2Pair(pool1).swap(
            amount0Out,
            amount1Out,
            address(this),
            abi.encode(pool2, direction)
        );
        // Callback happens here ↓
    }

    // Uniswap V2 callback
    function uniswapV2Call(
        address sender,
        uint amount0,
        uint amount1,
        bytes calldata data
    ) external {
        // 1. Verify caller is legitimate pool
        require(isValidPool(msg.sender), "Unauthorized");

        // 2. Decode parameters
        (address pool2, bool direction) = abi.decode(data, (address, bool));

        // 3. Execute arbitrage on pool2
        uint amountReceived = executeSwap(pool2, amount0 + amount1, direction);

        // 4. Calculate repayment (borrowed + fee)
        uint amountToRepay = calculateRepayment(amount0 + amount1);

        // 5. Repay pool1
        IERC20(token).transfer(msg.sender, amountToRepay);

        // 6. Profit remains in contract
        uint profit = amountReceived - amountToRepay;

        emit ProfitRealized(profit);
    }
}
```

## Key Features Explained

### 1. Mathematical Optimization (Quadratic Solver)

**The Problem:**
Given two pools with different prices, what amount should we trade to maximize profit?

**The Math:**

For Uniswap V2 constant product pools:

```
Pool 1: x₁ * y₁ = k₁
Pool 2: x₂ * y₂ = k₂

Price in pool 1: p₁ = y₁ / x₁
Price in pool 2: p₂ = y₂ / x₂

Arbitrage exists when p₁ ≠ p₂
```

**Output Formula (with fees):**

```
output = (input * 997 * reserve_out) / (reserve_in * 1000 + input * 997)

Where 997/1000 accounts for 0.3% fee
```

**Profit Function:**

```
P(Δx) = output₂(output₁(Δx)) - Δx - gas

Where:
- Δx = amount borrowed from pool 1
- output₁(Δx) = output from pool 1
- output₂(...) = output from pool 2 (our repayment source)
```

**Finding the Maximum:**

```
Take derivative: dP/dΔx = 0

After calculus (chain rule, product rule):

Δx* = sqrt((R₁ * R₂ * 1000000) / (f₁ * f₂)) - R₁

Where:
R₁ = pool1.reserveIn
R₂ = pool2.reserveOut
f₁ = 997 (pool1 fee factor)
f₂ = 997 (pool2 fee factor)
```

**Implementation:**

```typescript
function calculateOptimalTradeAmount(
    pool1: Pool,
    pool2: Pool,
    tokenIn: string,
    tokenOut: string
): BigNumber {
    // Get reserves
    const [r1In, r1Out] = pool1.getReserves(tokenIn, tokenOut);
    const [r2In, r2Out] = pool2.getReserves(tokenOut, tokenIn);

    // Fee factors (997/1000 = 0.997)
    const f1 = 997;
    const f2 = 997;

    // Calculate: sqrt((r1In * r2Out * 1000000) / (f1 * f2)) - r1In
    const numerator = r1In.mul(r2Out).mul(1000000);
    const denominator = f1 * f2;

    const sqrtArg = numerator.div(denominator);
    const sqrtResult = sqrt(sqrtArg);

    const optimal = sqrtResult.sub(r1In);

    // Safety: cap at 90% of pool 1 reserves
    const maxAmount = r1In.mul(90).div(100);

    return optimal.gt(maxAmount) ? maxAmount : optimal;
}

// Integer square root using binary search
function sqrt(n: BigNumber): BigNumber {
    if (n.isZero()) return n;

    let left = BigNumber.from(1);
    let right = n;

    while (left.lte(right)) {
        const mid = left.add(right).div(2);
        const midSquared = mid.mul(mid);

        if (midSquared.eq(n)) {
            return mid;
        } else if (midSquared.lt(n)) {
            left = mid.add(1);
        } else {
            right = mid.sub(1);
        }
    }

    return right;
}
```

**Why This Works:**

- **Exact Solution:** Not an approximation, it's the mathematically proven optimal
- **Fast Computation:** O(log n) for square root, constant time for rest
- **Guaranteed Maximum:** Derivative test proves this is the global maximum
- **Gas Efficient:** Calculate off-chain, no trial-and-error on-chain

### 2. Atomic Execution

**Flash Swap Mechanism:**

```
┌─────────────────────────────────────┐
│  Single Transaction (Atomic)        │
│                                     │
│  1. Flash swap borrow from pool1    │
│     ↓                               │
│  2. Receive tokens (debt created)   │
│     ↓                               │
│  3. Swap on pool2                   │
│     ↓                               │
│  4. Repay pool1 (with fee)          │
│     ↓                               │
│  5. Keep profit                     │
│                                     │
│  If ANY step fails → ALL REVERT     │
└─────────────────────────────────────┘
```

**Smart Contract Implementation:**

```solidity
function executeArbitrage(
    address borrowPool,
    address arbPool,
    uint256 borrowAmount,
    bool direction
) external onlyOwner {
    // Step 1: Initiate flash swap
    (uint256 amount0Out, uint256 amount1Out) = direction
        ? (borrowAmount, uint256(0))
        : (uint256(0), borrowAmount);

    // This triggers uniswapV2Call callback
    IUniswapV2Pair(borrowPool).swap(
        amount0Out,
        amount1Out,
        address(this),
        abi.encode(arbPool, direction)
    );

    // If we reach here, arbitrage succeeded
}

function uniswapV2Call(
    address sender,
    uint256 amount0,
    uint256 amount1,
    bytes calldata data
) external override {
    // Security: verify caller is legitimate pool
    require(msg.sender == borrowPool, "Unauthorized caller");
    require(sender == address(this), "Invalid sender");

    // Decode parameters
    (address arbPool, bool direction) = abi.decode(data, (address, bool));

    uint256 borrowedAmount = direction ? amount0 : amount1;

    // Step 2: Execute arbitrage swap
    address tokenBorrowed = direction ? token0 : token1;
    address tokenReceived = direction ? token1 : token0;

    // Approve arbPool to spend our tokens
    IERC20(tokenBorrowed).approve(arbPool, borrowedAmount);

    // Swap on arbitrage pool
    (uint256 amountOut) = _swapOnPool(
        arbPool,
        tokenBorrowed,
        tokenReceived,
        borrowedAmount
    );

    // Step 3: Calculate repayment (including 0.3% fee)
    uint256 amountToRepay = _calculateRepaymentAmount(borrowedAmount);

    // Step 4: Repay flash swap
    IERC20(tokenReceived).transfer(msg.sender, amountToRepay);

    // Step 5: Profit remains in contract
    uint256 profit = amountOut - amountToRepay;

    require(profit > 0, "No profit");

    emit ArbitrageExecuted(borrowedAmount, profit);
}

function _calculateRepaymentAmount(uint256 amount) internal pure returns (uint256) {
    // Uniswap V2 fee: 0.3%
    // Repayment = amount * 1000 / 997
    // Ceiling division to ensure we repay enough
    return (amount * 1000) / 997 + 1;
}
```

**Atomicity Guarantees:**

1. **All or Nothing:** If any step fails, entire transaction reverts
2. **No Partial Execution:** Cannot borrow without repaying
3. **No Capital Risk:** Borrowed funds never leave contract unsecured
4. **Automatic Revert:** Solidity's require() handles failures

### 3. Capital-Free Trading

**Zero Capital Requirement:**

```
Traditional Arbitrage:
- Need capital: $100,000+
- Borrow: $0
- Risk: High (capital exposed)

Flash Swap Arbitrage:
- Need capital: $0 (only gas)
- Borrow: $100,000+ (flash swap)
- Risk: None (atomic execution)
```

**Why This Matters:**

1. **Accessibility:** Anyone can run the bot (just need gas fees)
2. **Scalability:** Trade size limited only by liquidity, not capital
3. **Risk-Free:** Cannot lose capital (don't have any at risk)
4. **Efficiency:** 100% capital utilization (use exactly what's needed)

**Gas Costs Only:**

```
Typical Transaction:
- Gas: ~180,000 units
- Gas price: 50 gwei
- Cost: 0.009 ETH (~$20 at $2,200/ETH)

With profit threshold of 0.02 ETH:
- Gross profit: 0.02 ETH
- Gas cost: 0.009 ETH
- Net profit: 0.011 ETH (~$24)

ROI: Infinite (no capital invested)
```

### 4. Multi-Chain EVM Support

**Supported Chains:**

- **Ethereum:** Uniswap V2, Sushiswap
- **BSC:** PancakeSwap, BiSwap
- **Polygon:** QuickSwap, SushiSwap
- **Arbitrum:** Uniswap V2, Sushiswap
- **Optimism:** Uniswap V2
- **Avalanche:** Trader Joe, Pangolin

**Why Multi-Chain:**

1. **More Opportunities:** Each chain has unique inefficiencies
2. **Less Competition:** Fewer bots on smaller chains
3. **Higher Profits:** Lower gas costs on L2s/sidechains
4. **Diversification:** Don't rely on single chain

**Configuration:**

```typescript
const chainConfigs = {
    ethereum: {
        rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
        factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f', // Uniswap V2
        routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        wethAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    },
    bsc: {
        rpcUrl: 'https://bsc-dataseed.binance.org/',
        factoryAddress: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73', // PancakeSwap
        routerAddress: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        wethAddress: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
    },
    polygon: {
        rpcUrl: 'https://polygon-rpc.com',
        factoryAddress: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32', // QuickSwap
        routerAddress: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
        wethAddress: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
    },
};
```

### 5. Dynamic Pair Discovery

**Problem:** Manually configuring trading pairs doesn't scale.

**Solution:** Automatically discover all pairs on configured DEXs.

**Implementation:**

```typescript
async function discoverPairs(factory: Contract): Promise<Pair[]> {
    // Get total number of pairs from factory
    const pairCount = await factory.allPairsLength();

    const pairs: Pair[] = [];

    // Fetch all pairs (in batches for efficiency)
    const batchSize = 100;

    for (let i = 0; i < pairCount; i += batchSize) {
        const batch = [];

        for (let j = i; j < Math.min(i + batchSize, pairCount); j++) {
            batch.push(factory.allPairs(j));
        }

        const pairAddresses = await Promise.all(batch);

        // Fetch pair details
        const pairDetails = await Promise.all(
            pairAddresses.map(async (address) => {
                const pair = new Contract(address, PAIR_ABI, provider);

                const [token0, token1, reserves] = await Promise.all([
                    pair.token0(),
                    pair.token1(),
                    pair.getReserves(),
                ]);

                return {
                    address,
                    token0,
                    token1,
                    reserve0: reserves[0],
                    reserve1: reserves[1],
                };
            })
        );

        pairs.push(...pairDetails);
    }

    return pairs;
}

// Filter for tradable pairs
function filterTradablePairs(pairs: Pair[]): Pair[] {
    return pairs.filter((pair) => {
        // Minimum liquidity threshold
        const minLiquidity = parseEther('10'); // $10k equivalent

        const hasLiquidity =
            pair.reserve0.gt(minLiquidity) &&
            pair.reserve1.gt(minLiquidity);

        // Skip pairs with suspicious tokens
        const validTokens =
            !isBlacklisted(pair.token0) &&
            !isBlacklisted(pair.token1);

        return hasLiquidity && validTokens;
    });
}
```

### 6. Auto-Execution

**Continuous Monitoring:**

```typescript
async function startBot() {
    console.log('Starting arbitrage bot...');

    // Discover pairs
    const pairs = await discoverPairs(factory);
    console.log(`Discovered ${pairs.len()} pairs`);

    // Main loop
    while (true) {
        try {
            // Find opportunities
            const opportunities = await findArbitrageOpportunities(pairs);

            for (const opp of opportunities) {
                // Verify profitability
                if (opp.profit.gt(minProfit)) {
                    console.log(`Found opportunity: ${formatEther(opp.profit)} ETH profit`);

                    // Execute
                    await executeArbitrage(opp);
                }
            }

            // Wait before next scan
            await sleep(config.scanInterval);
        } catch (error) {
            console.error('Error in main loop:', error);
            await sleep(5000); // Wait 5s on error
        }
    }
}

async function findArbitrageOpportunities(
    pairs: Pair[]
): Promise<Opportunity[]> {
    const opportunities: Opportunity[] = [];

    // Compare all pairs for same token combinations
    for (let i = 0; i < pairs.length; i++) {
        for (let j = i + 1; j < pairs.length; j++) {
            const pair1 = pairs[i];
            const pair2 = pairs[j];

            // Check if pairs trade same tokens
            if (haveSameTokens(pair1, pair2)) {
                // Calculate optimal arbitrage
                const opp = calculateArbitrage(pair1, pair2);

                if (opp && opp.profit.gt(0)) {
                    opportunities.push(opp);
                }
            }
        }
    }

    // Sort by profit (highest first)
    return opportunities.sort((a, b) =>
        b.profit.gt(a.profit) ? 1 : -1
    );
}
```

## Technologies and Dependencies

### Solidity Stack

**Core:**
- Solidity 0.8.x (latest stable)
- OpenZeppelin Contracts (ERC20, Ownable)
- Uniswap V2 interfaces (IUniswapV2Pair, IUniswapV2Router)

**Development:**
- Hardhat (development framework)
- Ethers.js (contract interaction)
- Waffle (testing)
- TypeChain (TypeScript bindings)

### TypeScript Stack

**Core:**
- TypeScript 4.x
- Ethers.js v5 (blockchain interaction)
- dotenv (configuration)

**Math:**
- BigNumber.js (arbitrary precision)
- Math.js (mathematical functions)

**Utilities:**
- Axios (HTTP requests)
- Winston (logging)

### Infrastructure

**Node Requirements:**
- Ethereum full node OR
- RPC provider (Alchemy, Infura, QuickNode)

**Hardware:**
- Minimal (can run on laptop)
- Cloud VPS recommended for 24/7 operation
- Low latency internet connection

## Getting Started

### Prerequisites

```bash
# Install Node.js 16+
nvm install 16
nvm use 16

# Install Yarn
npm install -g yarn
```

### Installation

```bash
# Clone repository
git clone https://github.com/gweidart/evm-flashswap-arb.git
cd evm-flashswap-arb

# Install dependencies
yarn install

# Compile contracts
yarn hardhat compile
```

### Configuration

Create `.env` file:

```env
# Network
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
BSC_RPC_URL=https://bsc-dataseed.binance.org/
POLYGON_RPC_URL=https://polygon-rpc.com/

# Wallet
PRIVATE_KEY=0x...  # Your private key (NEVER commit)

# Contract
FLASHSWAP_CONTRACT_ADDRESS=0x...  # Deployed contract address

# Strategy
MIN_PROFIT_ETH=0.01  # Minimum profit threshold
SCAN_INTERVAL_MS=10000  # Scan every 10 seconds
MAX_GAS_PRICE_GWEI=100  # Maximum gas price

# DEXs (comma-separated factory addresses)
UNISWAP_FACTORY=0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f
SUSHISWAP_FACTORY=0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac
```

### Deployment

```bash
# Deploy contract to Ethereum mainnet
yarn hardhat run scripts/deploy.ts --network mainnet

# Verify on Etherscan
yarn hardhat verify --network mainnet DEPLOYED_ADDRESS

# Fund contract with gas (if using contract-based execution)
# Or keep funds in wallet (if using EOA execution)
```

### Running

```bash
# Test mode (dry run, no execution)
yarn start --dry-run

# Production mode
yarn start

# With verbose logging
yarn start --verbose

# Specific chain
yarn start --chain ethereum
yarn start --chain bsc
yarn start --chain polygon
```

## Recommendations

### For Beginners

**Start Here:**
1. Understand Uniswap V2 mechanics
2. Learn flash swaps concept
3. Study the mathematical optimization
4. Run in test mode first

**Testnet First:**
```bash
# Deploy to Goerli testnet
yarn hardhat run scripts/deploy.ts --network goerli

# Test with testnet tokens
yarn start --network goerli --dry-run
```

### For Production

**Optimize:**
- Use paid RPC (Alchemy/QuickNode) for reliability
- Deploy to multiple chains
- Monitor for stuck transactions
- Implement health checks

**Risk Management:**
```typescript
// Example safety checks
const safetyChecks = {
    maxTradeSize: parseEther('100'), // Max 100 ETH per trade
    maxGasPrice: parseGwei('200'), // Max 200 gwei
    minProfitRatio: 1.5, // Profit must be 1.5x gas cost
    blacklistedTokens: [...], // Known scam tokens
};
```

### For Researchers

**Interesting Questions:**
- How often do arbitrage opportunities arise?
- What's the typical profit margin?
- How quickly do opportunities disappear?
- What's the impact of gas prices?

**Data Collection:**
```typescript
interface OpportunityLog {
    timestamp: number;
    pair1: string;
    pair2: string;
    optimalAmount: BigNumber;
    expectedProfit: BigNumber;
    actualProfit?: BigNumber;
    executed: boolean;
    gasUsed?: number;
}
```

## Conclusion

The gweidart EVM Flash Swap Arbitrage bot demonstrates the power of mathematical optimization in MEV extraction. By solving the exact optimal trade size using calculus and leveraging Uniswap V2's built-in flash swap mechanism, it achieves:

**Advantages:**
- **Capital Efficiency:** No upfront capital needed
- **Mathematical Rigor:** Provably optimal trade sizes
- **Gas Efficiency:** Lower costs than flash loan alternatives
- **Multi-Chain:** Works on all EVM chains
- **Simplicity:** Clean, understandable codebase

**Limitations:**
- **Uniswap V2 Only:** Doesn't support V3 or other AMMs
- **High Competition:** Arbitrage bots are common
- **Gas Sensitivity:** Profits can be eaten by gas costs
- **Market Dependent:** Opportunities vary by market conditions

**Learning Value:**
- Excellent introduction to flash swaps
- Clear example of mathematical optimization
- Well-structured codebase for learning
- Real-world MEV application

This bot serves as both a profitable tool (in the right market conditions) and an educational resource for understanding the intersection of mathematics, smart contracts, and MEV extraction.

## Additional Resources

- **Uniswap V2 Whitepaper:** https://uniswap.org/whitepaper.pdf
- **Flash Swaps Documentation:** https://docs.uniswap.org/contracts/v2/guides/smart-contract-integration/using-flash-swaps
- **Mathematical Optimization:** "Calculus" by James Stewart
- **Smart Contract Security:** https://consensys.github.io/smart-contract-best-practices/

## Repository Status

Archived as of November 2022. Code remains functional and educational. For production use, consider updating dependencies and adding features like:
- Uniswap V3 support
- Multi-DEX routing
- MEV-Boost integration
- Advanced gas optimization

