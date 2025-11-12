**Source:** Internal compilation from MEV research and professional bot analysis (rusty-sando, Ethereum-MEV-BOT)
**Date:** November 2024

# Understanding Sandwich Attacks: Complete Guide

## Overview

Sandwich attacks represent one of the most sophisticated and profitable forms of MEV (Maximal Extractable Value) extraction in DeFi. This guide provides comprehensive coverage based on analysis of professional MEV bots including **rusty-sando** (857⭐, archived sandwich bot) and **Ethereum-MEV-BOT** (40⭐, graph-based multi-strategy bot).

**Daily MEV Extraction:** Sandwich attacks extract an estimated $1-5 million daily from Ethereum users alone.

## What is a Sandwich Attack?

A sandwich attack occurs when an attacker places two transactions around a victim's trade:
1. **Frontrun** - Buy before the victim (pushes price up)
2. **Victim Transaction** - Executes at worse price
3. **Backrun** - Sell after the victim (captures profit)

**Visual Representation:**
```
┌─────────────────────────────────────┐
│ Block N                             │
├─────────────────────────────────────┤
│ TX 1: Attacker Buys 100 ETH         │ ← Frontrun
│       Price: $3000 → $3010          │
├─────────────────────────────────────┤
│ TX 2: Victim Buys 50 ETH            │ ← Victim
│       Price: $3010 → $3020          │
├─────────────────────────────────────┤
│ TX 3: Attacker Sells 100 ETH        │ ← Backrun
│       Price: $3020 → $3005          │
│       Profit: $1,500                │
└─────────────────────────────────────┘
```

## The Economics of Sandwich Attacks

### Basic Profit Calculation

```javascript
// Example: USDC → ETH swap
const victimTradeSize = 100000; // $100K USDC
const poolLiquidity = 10000000; // $10M pool

// 1. Price impact from victim trade
const priceImpact = victimTradeSize / poolLiquidity; // 1%

// 2. Optimal frontrun size (mathematical formula)
const optimalFrontrun = Math.sqrt(poolLiquidity * victimTradeSize) - poolLiquidity;
// ≈ $316,228

// 3. Expected profit (simplified)
const frontrunImpact = optimalFrontrun / poolLiquidity; // 3.16%
const totalPriceMove = frontrunImpact + priceImpact; // 4.16%

// 4. Profit = frontrun size × total price movement
const grossProfit = optimalFrontrun * totalPriceMove;
// ≈ $13,157

// 5. Costs
const gasForTwoTxs = 500000 * 2; // 1M gas total
const gasPriceGwei = 50;
const ethPrice = 3000;
const gasCost = (gasForTwoTxs * gasPriceGwei * ethPrice) / 1e9;
// ≈ $150

// 6. Net profit
const netProfit = grossProfit - gasCost;
// ≈ $13,007 from one sandwich!
```

### Why Sandwich Attacks Are So Effective

**1. Guaranteed Profit**
- If victim transaction succeeds, sandwich always profits
- Can simulate exact outcome before submitting
- No price risk - bought and sold in same block

**2. Low Risk**
- Atomic execution (all-or-nothing)
- If simulation shows unprofitable, don't submit
- If victim reverts, sandwich never executes

**3. No Capital Lockup**
- Buy and sell in same block
- Capital available immediately for next opportunity
- Can use flash loans for leverage

**4. Highly Scalable**
- Can sandwich dozens of victims per block
- Automated detection and execution
- Sub-10ms detection enables high volume

**5. Compounding Returns**
- Profits reinvested immediately
- Can grow capital exponentially
- Professional operations: millions in daily revenue

## Victim Selection Criteria

Professional sandwich bots use sophisticated filtering to identify profitable targets.

### Primary Filters

```rust
// Based on rusty-sando implementation
fn is_sandwichable(tx: &Transaction, pool: &Pool) -> bool {
    // Filter 1: Must be a swap transaction
    if !is_swap_transaction(tx) {
        return false;
    }

    // Filter 2: Minimum price impact (0.5%+)
    let price_impact = pool.calculate_price_impact(tx.amount);
    if price_impact < 0.5 {
        return false; // Too small to profit from
    }

    // Filter 3: Sufficient pool liquidity
    let our_frontrun = calculate_optimal_frontrun(pool, tx.amount);
    if pool.liquidity < our_frontrun * 3 {
        return false; // Not enough liquidity to execute
    }

    // Filter 4: Victim's slippage tolerance
    let min_output = tx.decode_min_output();
    let price_after_frontrun = simulate_price_after(pool, our_frontrun);
    if min_output > price_after_frontrun {
        return false; // Victim transaction will revert
    }

    // Filter 5: Profitability after gas
    let profit = calculate_sandwich_profit(our_frontrun, tx.amount);
    let gas_cost = estimate_gas_cost(2); // Frontrun + backrun
    if profit < gas_cost * 2 {
        return false; // Not profitable enough
    }

    // Filter 6: Token safety (salmonella check)
    if is_honeypot_token(pool.token0) || is_honeypot_token(pool.token1) {
        return false; // Dangerous token
    }

    true
}
```

### Advanced Selection Criteria

**1. Token Safety (Salmonella Detection)**

Rusty-sando implements a 3-stage detection pipeline:

```
Stage 1: Quick Checks (<1ms)
├── Blacklist lookup (known scam tokens)
├── Contract age verification (avoid new tokens)
└── Basic bytecode scan (obvious red flags)

Stage 2: Static Analysis (1-5ms)
├── Pausable pattern detection
├── Blacklist pattern detection
├── Owner control detection
└── Fee-on-transfer detection

Stage 3: Simulation (5-20ms)
├── Simulate buy transaction
├── Simulate immediate sell
├── Compare expected vs actual output
└── Test from different addresses
```

**Why This Matters:**
- Honeypot tokens can trap your funds
- Fee-on-transfer tokens reduce profit
- Pausable tokens can freeze your sandwich
- Malicious tokens can steal frontrun capital

**2. Gas Price Analysis**

```javascript
function isGasPriceReasonable(victimTx, currentBaseFee) {
    // Victim's max fee
    const victimMaxFee = victimTx.maxFeePerGas;

    // Our frontrun must outbid victim
    const ourFrontrunFee = victimMaxFee * 1.1; // 10% higher

    // Our backrun can be lower
    const ourBackrunFee = currentBaseFee * 1.2;

    // Total gas cost
    const totalGasCost = (ourFrontrunFee + ourBackrunFee) * 500000;

    // Must leave profit margin
    const expectedProfit = calculateProfit(victimTx);

    return expectedProfit > totalGasCost * 3; // 3x gas cost minimum
}
```

**3. Pool Liquidity Depth**

```javascript
function hasSufficientLiquidity(pool, victimAmount) {
    // Need 3x victim amount in liquidity
    const requiredLiquidity = victimAmount * 3;

    // Check reserves
    const availableLiquidity = Math.min(pool.reserve0, pool.reserve1);

    if (availableLiquidity < requiredLiquidity) {
        return false; // Too illiquid
    }

    // Check if our frontrun won't drain pool
    const optimalFrontrun = calculateOptimalFrontrun(pool, victimAmount);
    const frontrunImpact = optimalFrontrun / availableLiquidity;

    return frontrunImpact < 0.3; // Max 30% of liquidity
}
```

**4. Timing Considerations**

```javascript
function isTimingOptimal(victimTx, currentBlock) {
    // Must be in mempool
    if (!victimTx.inMempool) {
        return false;
    }

    // Enough time to construct bundle
    const timeInMempool = Date.now() - victimTx.firstSeenTimestamp;
    if (timeInMempool < 100) { // ms
        return false; // Too recent, might be bait
    }

    // Not too far in future
    const targetBlock = victimTx.targetBlock || currentBlock + 1;
    if (targetBlock > currentBlock + 3) {
        return false; // Too far ahead, conditions will change
    }

    // Check if other bots are competing
    const competingBundles = countCompetingBundles(victimTx);
    if (competingBundles > 5) {
        return false; // Too much competition
    }

    return true;
}
```

## Bundle Construction Strategies

### Single-Victim Sandwich

**Traditional Approach:**

```
Bundle Structure:
┌────────────────────────────────┐
│ TX 1: Frontrun (Buy)           │  Priority: Very High
│   - Gas: Victim + 10%          │
│   - Amount: Optimal calculated │
├────────────────────────────────┤
│ TX 2: Victim Transaction       │  Priority: Normal
│   - Original user tx           │
│   - Executes at worse price    │
├────────────────────────────────┤
│ TX 3: Backrun (Sell)           │  Priority: Normal
│   - Gas: Base fee + small tip  │
│   - Amount: Same as frontrun   │
└────────────────────────────────┘
```

**Smart Contract Implementation:**

```solidity
// Minimal Huff-optimized sandwich contract (rusty-sando style)
contract SandwichExecutor {
    address private immutable owner;

    constructor() {
        owner = msg.sender;
    }

    // Frontrun: Buy token before victim
    function frontrun(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address pool
    ) external returns (uint256 amountOut) {
        require(msg.sender == owner, "Not owner");

        // Transfer tokens in
        IERC20(tokenIn).transferFrom(owner, address(this), amountIn);

        // Approve pool
        IERC20(tokenIn).approve(pool, amountIn);

        // Execute swap
        (uint256 amount0Out, uint256 amount1Out) = _calculateAmountsOut(
            pool,
            tokenIn,
            amountIn
        );

        IUniswapV2Pair(pool).swap(
            amount0Out,
            amount1Out,
            address(this),
            ""
        );

        amountOut = IERC20(tokenOut).balanceOf(address(this));
        require(amountOut >= minAmountOut, "Insufficient output");

        return amountOut;
    }

    // Backrun: Sell token after victim
    function backrun(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minProfit,
        address pool
    ) external returns (uint256 profit) {
        require(msg.sender == owner, "Not owner");

        // Execute reverse swap
        IERC20(tokenIn).approve(pool, amountIn);

        (uint256 amount0Out, uint256 amount1Out) = _calculateAmountsOut(
            pool,
            tokenIn,
            amountIn
        );

        IUniswapV2Pair(pool).swap(
            amount0Out,
            amount1Out,
            owner, // Send directly back to owner
            ""
        );

        // Calculate profit (amount out - amount in)
        profit = amount0Out > 0 ? amount0Out : amount1Out;
        require(profit >= minProfit, "Insufficient profit");

        return profit;
    }

    function _calculateAmountsOut(
        address pool,
        address tokenIn,
        uint256 amountIn
    ) internal view returns (uint256 amount0Out, uint256 amount1Out) {
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pool).getReserves();

        address token0 = IUniswapV2Pair(pool).token0();

        uint256 amountInWithFee = amountIn * 997;
        if (tokenIn == token0) {
            amount1Out = (amountInWithFee * reserve1) / (reserve0 * 1000 + amountInWithFee);
            amount0Out = 0;
        } else {
            amount0Out = (amountInWithFee * reserve0) / (reserve1 * 1000 + amountInWithFee);
            amount1Out = 0;
        }
    }
}
```

### Multi-Meat Sandwiches (Advanced)

**Innovation from Rusty-Sando:**

Bundle multiple victims in one sandwich to amortize gas costs and increase profits.

```
Bundle Structure:
┌────────────────────────────────┐
│ TX 1: Frontrun (Buy 500 ETH)   │  ← One large frontrun
├────────────────────────────────┤
│ TX 2: Victim A (50 ETH swap)   │  ← Victim 1
│ TX 3: Victim B (75 ETH swap)   │  ← Victim 2
│ TX 4: Victim C (30 ETH swap)   │  ← Victim 3
│ TX 5: Victim D (45 ETH swap)   │  ← Victim 4
├────────────────────────────────┤
│ TX 6: Backrun (Sell 500 ETH)   │  ← One large backrun
└────────────────────────────────┘

Advantages:
- Gas cost: 2 txs instead of 8 txs (75% savings)
- Compound price impact: Each victim adds to price move
- Higher total profit: 4x victims = ~3-4x profit
- More capital efficient: One position for multiple victims
```

**Implementation:**

```rust
// Detect multi-meat opportunities
fn find_multi_meat_sandwich(mempool: &[Transaction]) -> Option<MultiMeatBundle> {
    // Group transactions by pool
    let mut pool_groups: HashMap<Address, Vec<Transaction>> = HashMap::new();

    for tx in mempool {
        if is_swap_transaction(tx) {
            let pool = extract_pool_address(tx);
            pool_groups.entry(pool).or_default().push(tx.clone());
        }
    }

    // Find pools with multiple victims
    for (pool_address, victims) in pool_groups {
        if victims.len() >= 2 {
            // Calculate optimal frontrun for all victims combined
            let total_victim_volume: U256 = victims
                .iter()
                .map(|tx| tx.amount)
                .sum();

            let pool = get_pool_data(pool_address);
            let optimal_frontrun = calculate_optimal_frontrun(
                pool.reserve_in,
                pool.reserve_out,
                total_victim_volume,
            );

            // Calculate combined profit
            let profit = simulate_multi_meat(
                pool,
                optimal_frontrun,
                &victims,
            );

            let gas_cost = estimate_gas_cost(2); // Only 2 txs

            if profit > gas_cost * 3 {
                return Some(MultiMeatBundle {
                    pool: pool_address,
                    frontrun_amount: optimal_frontrun,
                    victims,
                    expected_profit: profit,
                });
            }
        }
    }

    None
}
```

**Example Calculation:**

```javascript
// Multi-meat profit calculation
const victims = [
    { amount: parseEther("50"), slippage: 0.5 },
    { amount: parseEther("75"), slippage: 1.0 },
    { amount: parseEther("30"), slippage: 0.3 },
    { amount: parseEther("45"), slippage: 0.8 },
];

// Total victim volume
const totalVolume = victims.reduce((sum, v) => sum.add(v.amount), BigNumber.from(0));
// = 200 ETH

// Optimal frontrun (formula: sqrt(R * V) - R)
const poolReserves = parseEther("10000"); // 10K ETH liquidity
const optimalFrontrun = sqrt(poolReserves.mul(totalVolume)).sub(poolReserves);
// ≈ 414 ETH

// Simulate execution
// 1. Frontrun moves price by ~4%
// 2. Each victim adds 0.5-1% more
// 3. Total price movement: ~8%
// 4. Backrun sells at 8% higher price

const profit = optimalFrontrun.mul(8).div(100);
// ≈ 33 ETH profit

const gasCost = 2 * 500000 * 50 / 1e9 * 3000;
// ≈ 0.15 ETH

const netProfit = profit.sub(gasCost);
// ≈ 32.85 ETH ≈ $98,550 from one sandwich!
```

## How Professional Bots Execute Sandwiches

### Rusty-Sando Architecture

**Technology Stack:**
- **Language:** Rust (performance-critical)
- **Smart Contracts:** Huff (assembly-level optimization)
- **EVM Simulation:** revm (fastest Rust EVM)
- **Framework:** Artemis (MEV bot framework)

**Key Components:**

```
rusty-sando/
├── bot/                    # Rust detection engine
│   ├── mempool.rs         # Mempool monitoring
│   ├── detector.rs        # Opportunity detection
│   ├── simulator.rs       # EVM simulation
│   ├── salmonella.rs      # Token safety checks
│   └── executor.rs        # Bundle submission
├── contracts/             # Huff smart contracts
│   ├── SandwichBot.huff   # Minimal sandwich executor
│   └── TokenDust.huff     # Dust management
└── config/
    └── pools.json         # Monitored liquidity pools
```

**Detection Flow (Sub-20ms Total):**

```rust
async fn analyze_pending_transaction(tx: &Transaction) -> Option<Opportunity> {
    // Step 1: Quick filter (< 1ms)
    if !is_swap_transaction(tx) {
        return None;
    }

    // Step 2: Extract swap parameters (< 1ms)
    let swap = decode_swap(tx)?;

    // Step 3: Salmonella check (1-20ms, cached for known tokens)
    if is_salmonella_token(swap.token).await {
        return None;
    }

    // Step 4: Get pool data (cached, < 1ms)
    let pool = get_pool(swap.pool_address).await?;

    // Step 5: Calculate optimal frontrun (< 1ms)
    let frontrun = calculate_optimal_frontrun(
        pool.reserve_in,
        pool.reserve_out,
        swap.amount_in,
    );

    // Step 6: Simulate sandwich (5-10ms)
    let (frontrun_out, backrun_out) = simulate_sandwich(
        &pool,
        frontrun,
        swap.amount_in,
    ).await?;

    // Step 7: Calculate profit after gas (< 1ms)
    let profit = backrun_out.saturating_sub(frontrun);
    let gas_cost = estimate_gas_cost();
    let net_profit = profit.saturating_sub(gas_cost);

    // Step 8: Profitability check
    if net_profit > MIN_PROFIT {
        return Some(Opportunity {
            victim_tx: tx.clone(),
            frontrun_amount: frontrun,
            expected_profit: net_profit,
        });
    }

    None
}
```

**Optimal Frontrun Formula:**

```rust
// Mathematical derivation: maximize profit given AMM constant product
fn calculate_optimal_frontrun(
    reserve_in: U256,
    reserve_out: U256,
    victim_amount: U256,
) -> U256 {
    // Formula: sqrt(R_in * R_out * V_in) - R_in
    let product = reserve_in
        .saturating_mul(reserve_out)
        .saturating_mul(victim_amount);

    let sqrt_result = sqrt_u256(product);
    let optimal = sqrt_result.saturating_sub(reserve_in);

    // Apply 90% safety margin (account for fees, slippage)
    optimal.saturating_mul(U256::from(90)) / U256::from(100)
}

// Integer square root (no floating point needed)
fn sqrt_u256(n: U256) -> U256 {
    if n == U256::zero() {
        return U256::zero();
    }

    // Newton's method
    let mut x = n;
    let mut y = (x + U256::one()) >> 1;

    while y < x {
        x = y;
        y = (x + n / x) >> 1;
    }

    x
}
```

**Huff Contract Advantages:**

```huff
// Huff vs Solidity gas savings
// Solidity SandwichExecutor: ~200,000 gas
// Huff SandwichExecutor: ~120,000 gas
// Savings: 40% reduction

// Huff allows direct EVM opcode control
#define macro SWAP() = takes(0) returns(0) {
    // Direct opcode manipulation
    // No Solidity safety overhead
    // Minimal bytecode size
}

// Result: 30-40% gas savings per transaction
// On high-volume sandwiches: $10K+ daily savings
```

### Ethereum-MEV-BOT Graph-Based Approach

**Architecture Innovation:**

Instead of linearly scanning transactions, model DeFi as a directed graph for optimal path finding.

**Graph Representation:**

```
Nodes: Tokens (ETH, USDC, DAI, WBTC, etc.)
Edges: Liquidity pools with exchange rates as weights
Weight: -log(exchange_rate) - fees

Example Graph:
         [ETH]
         / | \
    0.001/ 0.002 \0.0015
       /    |      \
   [USDC] [DAI] [WBTC]
      \    |    /
    0.0005\ | /0.001
         [USDT]
```

**Sandwich Detection Algorithm:**

```rust
struct MEVGraph {
    nodes: Vec<Token>,
    edges: Vec<Pool>,
    adjacency: HashMap<Token, Vec<Pool>>,
}

impl MEVGraph {
    // Detect sandwich opportunities using graph theory
    fn find_sandwich_paths(&self, victim_tx: &Transaction) -> Vec<SandwichPath> {
        let victim_path = victim_tx.decode_path(); // e.g., [USDC, ETH]

        // 1. Traditional sandwich (same path)
        let direct_sandwich = SandwichPath {
            frontrun: victim_path.clone(),
            backrun: victim_path.reverse(),
            profit: self.simulate_direct(victim_tx),
        };

        // 2. Multi-hop sandwiches (more profitable, less competition)
        let multi_hop_sandwiches = self.find_alternative_paths(
            victim_path[0],
            victim_path[victim_path.len() - 1],
            3, // Max 3 hops
        );

        // 3. Compare and return best
        let mut all_paths = vec![direct_sandwich];
        all_paths.extend(multi_hop_sandwiches);

        all_paths.sort_by_key(|p| p.profit);
        all_paths.reverse();

        all_paths
    }

    // Find alternative paths using Bellman-Ford
    fn find_alternative_paths(
        &self,
        start: Token,
        end: Token,
        max_hops: usize,
    ) -> Vec<SandwichPath> {
        // Use negative weights to find "most profitable" paths
        let paths = self.bellman_ford(start, end, max_hops);

        paths
            .into_iter()
            .filter(|p| p.hops() <= max_hops)
            .collect()
    }
}
```

**Multi-Hop Sandwich Example:**

```
Victim Transaction:
  USDC → ETH (Uniswap V2)

Traditional Sandwich:
  Frontrun: USDC → ETH (Uniswap V2)
  Backrun:  ETH → USDC (Uniswap V2)
  Competition: HIGH (many bots)
  Profit: $500

Graph-Based Sandwich:
  Frontrun: USDC → WBTC → ETH (Uniswap V3 → SushiSwap)
  Backrun:  ETH → WBTC → USDC (SushiSwap → Uniswap V3)
  Competition: LOW (complex path)
  Profit: $750 (50% more!)

Reason: Less competition on multi-hop paths
```

**Sub-10ms Detection Techniques:**

```rust
// 1. Zero-Copy Deserialization
use zerocopy::FromBytes;

#[derive(FromBytes)]
#[repr(C)]
struct Transaction {
    to: [u8; 20],
    value: u128,
    data: [u8; 1024],
    // ... other fields
}

// Parse without allocating: <0.1ms per transaction

// 2. Lock-Free Data Structures
use lockfree::queue::Queue;

static PENDING_TXS: Queue<Transaction> = Queue::new();

// No mutex contention: 10,000+ TPS

// 3. NUMA-Aware Memory
use numa::Memory;

let pool_data = Memory::allocate_on_node(0); // CPU node 0

// Minimize memory latency: 2-3x faster access

// 4. SIMD-Optimized Calculations
use packed_simd::u256x4;

fn batch_calculate_profits(amounts: &[U256; 4]) -> [U256; 4] {
    let simd_amounts = u256x4::from_slice_unaligned(amounts);
    let results = simd_amounts * PRICE_FACTOR;
    results.into()
}

// Process 4 calculations simultaneously: 4x throughput
```

**Builder Integration Strategy:**

```rust
// Submit to multiple builders for higher inclusion rate
async fn submit_sandwich_bundle(bundle: Bundle) -> Result<BundleReceipt> {
    let builders = vec![
        Builder::Flashbots,    // Highest reputation, largest market share
        Builder::Club48,       // Low latency, good for sandwiches
        Builder::Bloxroute,    // High throughput, ethical & non-ethical
        Builder::Blackrazor,   // Sandwich specialist
        Builder::Titan,        // Multi-chain support
        Builder::Beaverbuild,  // Competitive pricing
        Builder::Rsync,        // Low-latency MEV
    ];

    // Customize bundle for each builder
    let futures = builders.iter().map(|builder| {
        let customized = customize_for_builder(bundle.clone(), builder);

        // Different builders have different fee structures
        match builder {
            Builder::Flashbots => {
                // Flashbots: pay via coinbase transfer
                customized.add_coinbase_payment(calculate_optimal_tip());
            }
            Builder::Club48 => {
                // 48.club: optimize for speed
                customized.set_priority(Priority::Urgent);
            }
            Builder::Bloxroute => {
                // BloXroute: bid in ETH
                customized.set_max_bid(calculate_max_bid());
            }
            _ => {}
        }

        submit_to_builder(builder, customized)
    });

    // Submit to all builders in parallel
    let results = join_all(futures).await;

    // Return first successful inclusion
    for result in results {
        if result.is_ok() {
            return result;
        }
    }

    Err("No builder included bundle")
}
```

## Defending Against Sandwich Attacks

### Strategy 1: MEV-Protected Infrastructure

**Flashbots Protect RPC:**

```javascript
// Send transactions through Flashbots Protect
const provider = new ethers.providers.JsonRpcProvider(
    'https://rpc.flashbots.net'
);

// Your transaction bypasses public mempool
const tx = await wallet.connect(provider).sendTransaction({
    to: ROUTER_ADDRESS,
    data: swapCalldata,
    maxFeePerGas: ethers.utils.parseUnits('50', 'gwei'),
    maxPriorityFeePerGas: ethers.utils.parseUnits('2', 'gwei'),
});

// Result: No frontrun possible (may still be backrun)
```

**Benefits:**
- ✅ Transaction never in public mempool
- ✅ Sandwich bots can't see it
- ✅ May still be backrun, but no frontrun
- ✅ Free to use
- ⚠️ Backrun still possible

**MEV-Share (Get Paid for Being Sandwiched):**

```javascript
const { MevShareProvider } = require('@flashbots/mev-share-client');

const mevShareProvider = new MevShareProvider(
    provider,
    authSigner,
    'https://mev-share.flashbots.net'
);

await mevShareProvider.sendTransaction({
    ...transaction,
    hints: {
        calldata: false,       // Hide your exact trade
        contractAddress: true,  // Show you're swapping
        functionSelector: true, // Show swap function
    },
    maxBlockNumber: currentBlock + 5,
    // Searchers compete to backrun
    // You get paid share of MEV!
});
```

**How MEV-Share Works:**
1. You submit transaction with hints (partial info)
2. Searchers see hints and bid to backrun
3. Highest bidder's backrun gets included
4. You receive % of searcher's profit
5. Result: Turn MEV loss into MEV revenue!

**CoW Swap (Batch Auctions):**

```javascript
// Use CoW Swap API
const { OrderBookApi, OrderSigningUtils } = require('@cowprotocol/cow-sdk');

const orderBookApi = new OrderBookApi({ chainId: 1 });

// Create order (not transaction!)
const order = {
    sellToken: USDC_ADDRESS,
    buyToken: ETH_ADDRESS,
    sellAmount: ethers.utils.parseUnits("10000", 6),
    buyAmount: ethers.utils.parseEther("3.3"),
    validTo: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    appData: "0x0", // Optional metadata
    feeAmount: "0",
    kind: "sell",
    partiallyFillable: false,
};

// Sign order
const signature = await OrderSigningUtils.signOrder(order, wallet);

// Submit to CoW Swap
await orderBookApi.sendOrder({
    ...order,
    signature,
});

// Result:
// - Order enters batch auction
// - Solvers compete for best execution
// - MEV protection built-in
// - You get MEV rebates
```

### Strategy 2: Optimal Slippage Settings

**The Slippage Dilemma:**

```
Too Tight (0.1%):
✅ Strong protection from sandwiches
❌ High revert rate (legitimate price moves)
❌ Poor user experience
❌ Failed transactions cost gas

Too Loose (5%+):
✅ Low revert rate
❌ Maximum sandwich vulnerability
❌ Terrible execution price
❌ Can lose 2-5% to MEV

Optimal (0.5-1%):
✅ Balance protection and execution
✅ Based on pool liquidity
✅ Account for expected price impact
✅ Add safety buffer for MEV
```

**Dynamic Slippage Calculator:**

```javascript
async function calculateOptimalSlippage(
    tokenIn,
    tokenOut,
    amountIn,
    poolAddress
) {
    // Get pool reserves
    const pool = new ethers.Contract(poolAddress, POOL_ABI, provider);
    const reserves = await pool.getReserves();

    // Determine which reserve is which token
    const token0 = await pool.token0();
    const isToken0 = tokenIn.toLowerCase() === token0.toLowerCase();

    const reserveIn = isToken0 ? reserves.reserve0 : reserves.reserve1;
    const reserveOut = isToken0 ? reserves.reserve1 : reserves.reserve0;

    // Calculate price impact using constant product formula
    // priceImpact = 1 - (reserveOut / (reserveOut - amountOut))
    // where amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)

    const amountInWithFee = amountIn.mul(997);
    const numerator = amountInWithFee.mul(reserveOut);
    const denominator = reserveIn.mul(1000).add(amountInWithFee);
    const amountOut = numerator.div(denominator);

    const priceImpact = BigNumber.from(10000)
        .sub(reserveOut.mul(10000).div(reserveOut.sub(amountOut)));

    // Slippage = price impact + safety buffer + MEV buffer
    const baseSlippage = priceImpact; // In basis points
    const safetyBuffer = 10; // 0.1%
    const mevBuffer = priceImpact.div(2); // 50% of price impact

    const optimalSlippage = baseSlippage.add(safetyBuffer).add(mevBuffer);

    // Cap at reasonable maximum (1%)
    const maxSlippage = 100; // 1%
    const finalSlippage = optimalSlippage.gt(maxSlippage)
        ? maxSlippage
        : optimalSlippage.toNumber();

    return finalSlippage; // Returns basis points
}

// Usage
const slippageBps = await calculateOptimalSlippage(
    USDC_ADDRESS,
    ETH_ADDRESS,
    ethers.utils.parseUnits("10000", 6), // 10K USDC
    USDC_ETH_POOL
);

const expectedOutput = await getExpectedOutput(...);
const minOutput = expectedOutput.mul(10000 - slippageBps).div(10000);

await router.swapExactTokensForTokens(
    amountIn,
    minOutput, // Optimal slippage protection
    path,
    recipient,
    deadline
);
```

### Strategy 3: Trade Splitting

**Split Large Trades:**

```javascript
class TradeSplitter {
    async executeSplitTrade(
        tokenIn,
        tokenOut,
        totalAmount,
        options = {}
    ) {
        // Determine optimal number of splits
        const splits = this.calculateOptimalSplits(
            totalAmount,
            options.poolLiquidity
        );

        console.log(`Splitting ${ethers.utils.formatEther(totalAmount)} into ${splits.length} trades`);

        const results = [];

        for (let i = 0; i < splits.length; i++) {
            const splitAmount = splits[i];

            // Calculate slippage for this split size
            const slippage = await calculateOptimalSlippage(
                tokenIn,
                tokenOut,
                splitAmount,
                options.poolAddress
            );

            // Random delay between trades (avoid pattern detection)
            if (i > 0) {
                const delayMs = Math.random() * 5000 + 2000; // 2-7 seconds
                await sleep(delayMs);
            }

            // Execute trade
            try {
                const tx = await this.executeSwap(
                    tokenIn,
                    tokenOut,
                    splitAmount,
                    slippage
                );

                const receipt = await tx.wait();
                results.push({
                    success: true,
                    amount: splitAmount,
                    txHash: receipt.transactionHash
                });

                console.log(`Split ${i + 1}/${splits.length} completed`);
            } catch (error) {
                results.push({
                    success: false,
                    amount: splitAmount,
                    error: error.message
                });

                console.error(`Split ${i + 1}/${splits.length} failed:`, error);
            }
        }

        return results;
    }

    calculateOptimalSplits(totalAmount, poolLiquidity) {
        // Split to keep each trade < 1% of pool liquidity
        const maxTradeSize = poolLiquidity.div(100); // 1%

        const numSplits = totalAmount.div(maxTradeSize).add(1);

        // Distribute amount across splits
        const splits = [];
        const baseAmount = totalAmount.div(numSplits);
        const remainder = totalAmount.mod(numSplits);

        for (let i = 0; i < numSplits; i++) {
            let amount = baseAmount;
            if (i === numSplits - 1) {
                amount = amount.add(remainder); // Add remainder to last split
            }
            splits.push(amount);
        }

        return splits;
    }
}
```

**Benefits:**
- ✅ Each trade has lower price impact
- ✅ Less profitable for sandwich bots
- ✅ Harder to frontrun multiple transactions
- ✅ Better overall execution

**Drawbacks:**
- ❌ More gas fees (N transactions)
- ❌ Takes longer to execute
- ❌ More total slippage than single trade
- ❌ May miss optimal pricing window

### Strategy 4: Smart Contract Protection

**TWAP-Based Protection:**

```solidity
contract SandwichProtectedRouter {
    // Time-Weighted Average Price oracle
    mapping(address => TWAPOracle) public oracles;

    struct TWAPOracle {
        uint256 priceCumulativeLast;
        uint32 blockTimestampLast;
        uint256 priceAverage;
    }

    // Update TWAP before swap
    function updateTWAP(address pool) public {
        IUniswapV2Pair pair = IUniswapV2Pair(pool);

        uint256 priceCumulative = pair.price0CumulativeLast();
        uint32 blockTimestamp = uint32(block.timestamp);

        TWAPOracle storage oracle = oracles[pool];

        if (oracle.blockTimestampLast == 0) {
            // First time - initialize
            oracle.priceCumulativeLast = priceCumulative;
            oracle.blockTimestampLast = blockTimestamp;
            return;
        }

        // Calculate TWAP
        uint32 timeElapsed = blockTimestamp - oracle.blockTimestampLast;

        if (timeElapsed > 0) {
            oracle.priceAverage = (priceCumulative - oracle.priceCumulativeLast) / timeElapsed;
            oracle.priceCumulativeLast = priceCumulative;
            oracle.blockTimestampLast = blockTimestamp;
        }
    }

    // Swap with sandwich protection
    function swapWithProtection(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        address pool
    ) external returns (uint256 amountOut) {
        // Update TWAP
        updateTWAP(pool);

        // Get current spot price
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pool).getReserves();
        uint256 spotPrice = (reserve1 * 1e18) / reserve0;

        // Get TWAP price
        uint256 twapPrice = oracles[pool].priceAverage;

        // Check deviation
        uint256 deviation = spotPrice > twapPrice
            ? ((spotPrice - twapPrice) * 10000) / twapPrice
            : ((twapPrice - spotPrice) * 10000) / twapPrice;

        // Revert if price deviated too much (likely frontrun)
        require(deviation < 50, "Price deviation too high"); // 0.5% max

        // Execute swap
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(pool, amountIn);

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts = IUniswapV2Router(ROUTER).swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            msg.sender,
            block.timestamp
        );

        return amounts[1];
    }
}
```

### Strategy 5: Limit Orders

**1inch Limit Order Protocol:**

```javascript
const { LimitOrderBuilder } = require('@1inch/limit-order-protocol');

const limitOrderBuilder = new LimitOrderBuilder(
    LIMIT_ORDER_PROTOCOL_ADDRESS,
    chainId,
    provider
);

// Create limit order
const limitOrder = limitOrderBuilder.buildLimitOrder({
    makerAssetAddress: USDC_ADDRESS,
    takerAssetAddress: ETH_ADDRESS,
    makerAddress: wallet.address,
    makerAmount: ethers.utils.parseUnits("10000", 6), // 10K USDC
    takerAmount: ethers.utils.parseEther("3.3"),      // 3.3 ETH exact
    predicate: "0x",  // No predicate (always valid)
    permit: "0x",     // No permit
    interaction: "0x" // No interaction
});

// Sign order
const signature = await limitOrderBuilder.buildOrderSignature(
    wallet,
    limitOrder
);

// Submit to 1inch orderbook
await fetch('https://limit-orders.1inch.io/v3.0/1/limit-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        orderHash: limitOrder.getHashHex(),
        signature,
        data: limitOrder
    })
});

// Order waits in orderbook
// Filled when price reaches target
// No mempool exposure = No sandwich risk!
```

## Real-World Defense Implementation

**Complete Protection Service:**

```javascript
class ComprehensiveSandwichProtection {
    constructor() {
        this.flashbotsProvider = new FlashbotsBundleProvider(...);
        this.mevShareProvider = new MevShareProvider(...);
        this.cowSwapAPI = new CoWSwapAPI();
    }

    async executeProtectedSwap(
        tokenIn,
        tokenOut,
        amountIn,
        options = {}
    ) {
        // Step 1: Choose optimal protection method
        const method = await this.selectProtectionMethod(
            tokenIn,
            tokenOut,
            amountIn
        );

        console.log(`Using protection method: ${method}`);

        switch (method) {
            case 'COW_SWAP':
                return this.executeCowSwap(tokenIn, tokenOut, amountIn);

            case 'MEV_SHARE':
                return this.executeMEVShare(tokenIn, tokenOut, amountIn);

            case 'FLASHBOTS_PROTECT':
                return this.executeFlashbotsProtect(tokenIn, tokenOut, amountIn);

            case 'SPLIT_TRADE':
                return this.executeSplitTrade(tokenIn, tokenOut, amountIn);

            case 'LIMIT_ORDER':
                return this.executeLimitOrder(tokenIn, tokenOut, amountIn);

            default:
                throw new Error('No suitable protection method');
        }
    }

    async selectProtectionMethod(tokenIn, tokenOut, amountIn) {
        // Get pool liquidity
        const pool = await this.getPool(tokenIn, tokenOut);
        const liquidity = pool.reserve0.add(pool.reserve1);

        // Calculate trade size relative to pool
        const tradeRatio = amountIn.mul(10000).div(liquidity);

        // Decision tree
        if (tradeRatio.lt(10)) { // < 0.1% of pool
            return 'FLASHBOTS_PROTECT'; // Small trade, simple protection
        }

        if (tradeRatio.lt(100)) { // < 1% of pool
            return 'MEV_SHARE'; // Medium trade, get MEV rebate
        }

        if (tradeRatio.lt(500)) { // < 5% of pool
            return 'COW_SWAP'; // Large trade, use batch auction
        }

        if (tradeRatio.lt(1000)) { // < 10% of pool
            return 'SPLIT_TRADE'; // Very large, must split
        }

        return 'LIMIT_ORDER'; // Huge trade, use limit order
    }

    async executeCowSwap(tokenIn, tokenOut, amountIn) {
        const quote = await this.cowSwapAPI.getQuote({
            sellToken: tokenIn,
            buyToken: tokenOut,
            amount: amountIn.toString(),
            kind: 'sell'
        });

        const order = await this.cowSwapAPI.createOrder({
            ...quote,
            validTo: Math.floor(Date.now() / 1000) + 3600
        });

        const signature = await this.wallet.signMessage(order.hash);

        return this.cowSwapAPI.submitOrder({
            ...order,
            signature
        });
    }

    async executeMEVShare(tokenIn, tokenOut, amountIn) {
        const tx = await this.buildSwapTransaction(
            tokenIn,
            tokenOut,
            amountIn
        );

        return this.mevShareProvider.sendTransaction({
            ...tx,
            hints: {
                calldata: false,
                contractAddress: true,
                functionSelector: true,
                logs: true
            },
            maxBlockNumber: await this.provider.getBlockNumber() + 5
        });
    }

    async executeFlashbotsProtect(tokenIn, tokenOut, amountIn) {
        const tx = await this.buildSwapTransaction(
            tokenIn,
            tokenOut,
            amountIn
        );

        const flashbotsRPC = new ethers.providers.JsonRpcProvider(
            'https://rpc.flashbots.net'
        );

        return this.wallet.connect(flashbotsRPC).sendTransaction(tx);
    }
}
```

## Monitoring and Analytics

**Detect Sandwich Attacks:**

```javascript
class SandwichMonitor {
    async monitorTransaction(txHash) {
        const receipt = await provider.getTransactionReceipt(txHash);
        const block = await provider.getBlock(receipt.blockNumber);

        const ourTxIndex = block.transactions.indexOf(txHash);

        // Analyze surrounding transactions
        const analysis = {
            wasSandwiched: false,
            frontrunTx: null,
            backrunTx: null,
            mevExtracted: BigNumber.from(0)
        };

        // Check for frontrun
        if (ourTxIndex > 0) {
            const prevTx = await provider.getTransaction(
                block.transactions[ourTxIndex - 1]
            );

            if (await this.isFrontrun(prevTx, receipt)) {
                analysis.frontrunTx = prevTx.hash;
                analysis.wasSandwiched = true;
            }
        }

        // Check for backrun
        if (ourTxIndex < block.transactions.length - 1) {
            const nextTx = await provider.getTransaction(
                block.transactions[ourTxIndex + 1]
            );

            if (await this.isBackrun(nextTx, receipt)) {
                analysis.backrunTx = nextTx.hash;
                analysis.wasSandwiched = true;
            }
        }

        // Calculate MEV extracted
        if (analysis.wasSandwiched) {
            analysis.mevExtracted = await this.calculateMEV(
                analysis.frontrunTx,
                txHash,
                analysis.backrunTx
            );

            console.warn('🚨 SANDWICH ATTACK DETECTED!');
            console.warn('Frontrun:', analysis.frontrunTx);
            console.warn('Your TX:', txHash);
            console.warn('Backrun:', analysis.backrunTx);
            console.warn('MEV Extracted:', ethers.utils.formatEther(analysis.mevExtracted), 'ETH');
        }

        return analysis;
    }

    async isFrontrun(tx, ourReceipt) {
        // Decode both transactions
        const theirParams = await this.decodeSwap(tx);
        const ourParams = await this.decodeSwap(ourReceipt);

        if (!theirParams || !ourParams) return false;

        // Check if same pool and same direction
        return (
            theirParams.pool === ourParams.pool &&
            theirParams.tokenIn === ourParams.tokenIn &&
            theirParams.tokenOut === ourParams.tokenOut
        );
    }

    async isBackrun(tx, ourReceipt) {
        const theirParams = await this.decodeSwap(tx);
        const ourParams = await this.decodeSwap(ourReceipt);

        if (!theirParams || !ourParams) return false;

        // Check if same pool but opposite direction
        return (
            theirParams.pool === ourParams.pool &&
            theirParams.tokenIn === ourParams.tokenOut &&
            theirParams.tokenOut === ourParams.tokenIn
        );
    }

    async calculateMEV(frontrunHash, victimHash, backrunHash) {
        // Get frontrun amount in
        const frontrunReceipt = await provider.getTransactionReceipt(frontrunHash);
        const frontrunLogs = this.parseSwapLogs(frontrunReceipt.logs);

        // Get backrun amount out
        const backrunReceipt = await provider.getTransactionReceipt(backrunHash);
        const backrunLogs = this.parseSwapLogs(backrunReceipt.logs);

        // MEV = backrun output - frontrun input - gas costs
        const profit = backrunLogs.amountOut.sub(frontrunLogs.amountIn);

        const gasCost = frontrunReceipt.gasUsed
            .add(backrunReceipt.gasUsed)
            .mul(frontrunReceipt.effectiveGasPrice);

        return profit.sub(gasCost);
    }
}
```

## Key Takeaways

### Understanding the Threat

1. **Scale:** $1-5M extracted daily from Ethereum users
2. **Sophistication:** Professional bots like rusty-sando use:
   - Huff assembly contracts (40% gas savings)
   - Sub-20ms detection (<1% of block time)
   - Mathematical optimization (optimal frontrun formulas)
   - Multi-meat sandwiches (4x profit per bundle)
3. **Competition:** Graph-based bots find multi-hop paths
4. **Inevitability:** Public mempool + price impact = sandwich

### Essential Defenses

**Priority Order:**

1. **Flashbots Protect RPC** - Eliminates frontrun completely
2. **MEV-Share** - Get paid instead of paying
3. **CoW Swap** - Batch auctions with built-in protection
4. **Tight Slippage** - Make sandwiches unprofitable (<0.5%)
5. **Trade Splitting** - Reduce per-trade impact

### Advanced Protection

- Use MEV-protected aggregators (CoW, 1inch)
- Implement TWAP checks in smart contracts
- Monitor transactions for sandwich detection
- Consider limit orders for large trades
- Split trades across multiple blocks

### The Reality

**If your transaction is:**
- ✅ In public mempool
- ✅ Moves price >0.5%
- ✅ Has >1% slippage tolerance

**Then assume it will be sandwiched.**

**Your options:**
1. Use private mempool (Flashbots)
2. Accept MEV-Share revenue
3. Use CoW Swap batch auctions
4. Split into smaller trades
5. Use limit orders

**Remember:** Sandwich bots are extremely sophisticated, fast, and well-capitalized. Your only defense is **not being visible** in the public mempool or **getting paid for being sandwiched** via MEV-Share.

The era of profitable public mempool trading is over. Adapt or lose 0.5-2% of every trade to MEV extraction.
