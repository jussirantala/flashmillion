**Source:** Multiple sources (a16z Crypto, Bitquery, Web Search 2024-2025)
**Date:** 2024-2025

# MEV Sandwich Attacks: Comprehensive Technical Guide

## Table of Contents
1. [Overview](#overview)
2. [How Sandwich Attacks Work](#how-sandwich-attacks-work)
3. [Technical Mechanisms](#technical-mechanisms)
4. [Attack Anatomy](#attack-anatomy)
5. [Real-World Examples](#real-world-examples)
6. [Economic Impact](#economic-impact)
7. [Attack Profitability](#attack-profitability)
8. [Detection Methods](#detection-methods)
9. [Protection Strategies](#protection-strategies)
10. [Code Examples](#code-examples)
11. [Key Takeaways](#key-takeaways)

---

## Overview

**Definition:** A sandwich attack is the most profitable and harmful form of MEV exploitation, where an attacker places two transactions around a victim's trade—one before (front-run) and one after (back-run)—to manipulate the price and extract maximum value.

### Key Characteristics

- **Execution Pattern:** Attacker Tx1 → Victim Tx → Attacker Tx2
- **Components:** Front-run (buy) + Back-run (sell)
- **Impact:** Victim pays inflated price, attacker profits from both sides
- **Classification:** Most predatory MEV attack type
- **Profitability:** Highest profit potential for attackers

### Attack Structure

```
Sandwich Attack = Front-Running + Back-Running

Step 1 (Front-Run):
  └─> Attacker buys asset BEFORE victim
  └─> Pushes price UP
  └─> Uses high gas price for priority

Step 2 (Victim):
  └─> Victim's transaction executes
  └─> Pays INFLATED price
  └─> Receives fewer tokens than expected

Step 3 (Back-Run):
  └─> Attacker sells asset AFTER victim
  └─> Captures profit from price pump
  └─> Price returns closer to original

Result:
  └─> Attacker profits from both transactions
  └─> Victim suffers maximum slippage
  └─> Most harmful MEV attack
```

**Critical Quote (a16z):** "A sandwich attacker buys tokens before Alice's purchase (increasing price), then sells after her transaction at the inflated price. The result: Alice pays more, and the attacker profits from the price manipulation."

---

## How Sandwich Attacks Work

### Complete Attack Flow

```
1. Mempool Observation
   └─> Attacker monitors pending transactions
   └─> Identifies profitable target (large swap)
   └─> Calculates potential profit

2. Front-Run Transaction
   └─> Attacker submits BUY transaction
   └─> HIGHER gas price than victim (e.g., 200 gwei vs 50 gwei)
   └─> Buys same asset victim wants
   └─> Pushes price up artificially

3. Victim Transaction Executes
   └─> Victim's BUY executes at inflated price
   └─> Receives fewer tokens due to higher price
   └─> Suffers maximum slippage
   └─> Pays gas for degraded execution

4. Back-Run Transaction
   └─> Attacker submits SELL transaction
   └─> LOWER gas price (executes after victim)
   └─> Sells at the inflated price
   └─> Captures profit from price manipulation

5. Final State
   └─> Attacker: Profit from buy low, sell high
   └─> Victim: Loss from buying high
   └─> Market: Price returns to approximate original level
```

### Real-World Scenario

**Example: USDC to ETH Swap on Uniswap**

```
Market State:
- Uniswap ETH/USDC: 1 ETH = 2,000 USDC
- Victim wants to buy 100 ETH
- Expected cost: ~201,000 USDC (includes normal 0.5% slippage)

Victim Transaction (Mempool):
- Buy 100 ETH for USDC
- Gas: 50 gwei
- Max slippage tolerance: 2% (204,000 USDC max)

Attacker Observes:
- Large buy will impact price
- Can sandwich for profit
- Victim's slippage tolerance: 2%

ATTACK EXECUTION:

Block N Transaction Order:

Tx 1 (Attacker Front-Run, 500 gwei):
  └─> Buy 50 ETH for USDC
  └─> Cost: ~100,500 USDC
  └─> Price after: 1 ETH = 2,010 USDC ⬆

Tx 2 (Victim, 50 gwei):
  └─> Buy 100 ETH for USDC
  └─> Cost: ~203,500 USDC (inflated!)
  └─> Price after: 1 ETH = 2,035 USDC ⬆⬆

Tx 3 (Attacker Back-Run, 30 gwei):
  └─> Sell 50 ETH for USDC
  └─> Revenue: ~101,750 USDC
  └─> Price after: 1 ETH = ~2,010 USDC ⬇

RESULTS:

Attacker:
  ✅ Bought: 50 ETH for 100,500 USDC
  ✅ Sold: 50 ETH for 101,750 USDC
  ✅ Gross profit: 1,250 USDC
  ✅ Gas cost: ~$150
  ✅ Net profit: ~$1,100

Victim:
  ❌ Expected: 100 ETH for ~201,000 USDC
  ❌ Actually paid: 203,500 USDC
  ❌ Extra cost: 2,500 USDC (1.25% additional slippage)
  ❌ Within slippage tolerance so transaction succeeded
  ❌ Loss: $2,500

Market:
  - Temporary price spike
  - Returns to ~2,010 USDC (slight increase from volume)
  - Net effect: Value transferred from victim to attacker
```

---

## Technical Mechanisms

### Gas Price Orchestration

Sandwich attacks require precise gas price management:

```solidity
// Transaction ordering via gas prices (Pre-EIP-1559)
attackerFrontRunGasPrice = victimGasPrice * 10;  // Much higher
victimGasPrice = userSubmittedPrice;
attackerBackRunGasPrice = victimGasPrice * 0.5;  // Lower

// Result:
// Block inclusion order: Front-run → Victim → Back-run
```

**Post-EIP-1559 (Current Ethereum):**

```javascript
// Front-run transaction
{
  maxFeePerGas: '500 gwei',
  maxPriorityFeePerGas: '50 gwei',  // High tip for validator
  nonce: N
}

// Victim transaction
{
  maxFeePerGas: '100 gwei',
  maxPriorityFeePerGas: '2 gwei',
  nonce: M
}

// Back-run transaction
{
  maxFeePerGas: '100 gwei',
  maxPriorityFeePerGas: '1 gwei',  // Low tip
  nonce: N + 1  // Same account as front-run
}
```

### Price Impact Calculation

Attackers calculate optimal sandwich amounts:

```javascript
class SandwichCalculator {
  // Calculate optimal front-run amount
  calculateOptimalFrontRun(victimAmount, reserves, targetSlippage) {
    // Goal: Push price to victim's max slippage tolerance
    const [reserveIn, reserveOut] = reserves;

    // Victim's max price (from slippage tolerance)
    const victimMaxPrice = this.getCurrentPrice(reserves) * (1 + targetSlippage);

    // Amount needed to push price to victim's limit
    const frontRunAmount = this.solveForAmount(
      reserveIn,
      reserveOut,
      victimMaxPrice
    );

    return frontRunAmount;
  }

  // Uniswap V2 price after swap
  priceAfterSwap(reserveIn, reserveOut, amountIn) {
    const newReserveIn = reserveIn + amountIn;
    const amountOut = (reserveOut * amountIn * 997) / (reserveIn * 1000 + amountIn * 997);
    const newReserveOut = reserveOut - amountOut;

    return newReserveOut / newReserveIn;
  }

  // Calculate sandwich profit
  calculateProfit(frontRunAmount, victimAmount, reserves, gasCost) {
    // Simulate front-run
    let [rIn, rOut] = reserves;
    const buyPrice1 = this.priceAfterSwap(rIn, rOut, frontRunAmount);
    rIn += frontRunAmount;
    rOut -= (rOut * frontRunAmount * 997) / (rIn * 1000);

    // Simulate victim transaction
    const buyPrice2 = this.priceAfterSwap(rIn, rOut, victimAmount);
    rIn += victimAmount;
    rOut -= (rOut * victimAmount * 997) / (rIn * 1000);

    // Simulate back-run (sell frontRunAmount)
    const sellRevenue = (rOut * frontRunAmount * 997) / (rIn * 1000 + frontRunAmount * 997);

    // Calculate profit
    const grossProfit = sellRevenue - frontRunAmount;
    const netProfit = grossProfit - gasCost;

    return {
      grossProfit,
      gasCost,
      netProfit,
      profitPercent: (netProfit / frontRunAmount) * 100
    };
  }
}
```

### MEV Bot Logic

**Sandwich Attack Decision Tree:**

```javascript
async function evaluateSandwichOpportunity(victimTx) {
  // 1. Parse victim transaction
  const { tokenIn, tokenOut, amountIn, slippageTolerance } = parseSwap(victimTx);

  // 2. Get pool reserves
  const reserves = await getReserves(tokenIn, tokenOut);

  // 3. Calculate optimal front-run amount
  const frontRunAmount = calculateOptimalFrontRun(
    amountIn,
    reserves,
    slippageTolerance
  );

  // 4. Simulate sandwich
  const simulation = simulateSandwich(
    frontRunAmount,
    amountIn,
    reserves,
    victimTx.gasPrice
  );

  // 5. Check profitability
  const estimatedGas = 400000; // Front-run + back-run
  const gasCost = estimatedGas * victimTx.gasPrice * 1.5; // 1.5x for priority

  const profitable = simulation.profit > gasCost * 1.2; // 20% minimum ROI

  // 6. Execute if profitable
  if (profitable) {
    return {
      execute: true,
      frontRunAmount,
      frontRunGas: victimTx.gasPrice * 10,
      backRunGas: victimTx.gasPrice * 0.8,
      expectedProfit: simulation.profit - gasCost
    };
  }

  return { execute: false };
}
```

---

## Attack Anatomy

### Components Breakdown

#### 1. Target Identification

**Ideal Sandwich Targets:**

```
Criteria:
✅ Large transaction value (>$50k)
✅ High slippage tolerance (>1%)
✅ Market orders (not limit orders)
✅ Popular trading pairs (high liquidity)
✅ Moderate gas price (not already priority)
✅ No MEV protection (public mempool)

Bot Scanning Logic:
for each pending_tx in mempool:
  if is_dex_swap(pending_tx):
    if tx_value > MINIMUM_TARGET:
      if slippage_tolerance > MINIMUM_SLIPPAGE:
        if estimated_profit > MIN_PROFIT:
          queue_sandwich_attack(pending_tx)
```

#### 2. Front-Run Construction

```solidity
// Front-run transaction specification
struct FrontRun {
    address dex;              // Same DEX as victim
    address[] path;           // Same token path as victim
    uint256 amountIn;         // Calculated optimal amount
    uint256 amountOutMin;     // Conservative minimum (1% slippage)
    uint256 gasPrice;         // 5-20x victim's gas price
    uint256 gasLimit;         // ~180k for simple swap
}

// Example front-run tx
{
    to: UNISWAP_V2_ROUTER,
    data: encodeFunctionData(
        'swapExactTokensForTokens',
        [
            frontRunAmount,        // amountIn
            minAmountOut,          // amountOutMin (with buffer)
            [tokenA, tokenB],      // path
            botAddress,            // to
            deadline               // deadline
        ]
    ),
    gasLimit: 180000,
    maxFeePerGas: victimGas * 10,
    maxPriorityFeePerGas: victimPriority * 10
}
```

#### 3. Victim Transaction

```javascript
// Victim's transaction (unaware of sandwich)
{
  to: UNISWAP_V2_ROUTER,
  data: swapExactTokensForTokens(
    100 ETH,                    // amountIn
    98 ETH worth of USDC,       // amountOutMin (2% slippage)
    [ETH, USDC],
    victimAddress,
    deadline
  ),
  gasLimit: 200000,
  maxFeePerGas: 50 gwei,
  maxPriorityFeePerGas: 2 gwei
}

// Victim unknowingly set 2% slippage
// Attacker will push price to ~1.9% to maximize profit
// Transaction succeeds (within slippage) but victim loses value
```

#### 4. Back-Run Construction

```solidity
// Back-run transaction (profit taking)
struct BackRun {
    address dex;              // Same DEX
    address[] path;           // REVERSE path
    uint256 amountIn;         // Exact amount from front-run
    uint256 amountOutMin;     // Must profit after fees
    uint256 gasPrice;         // Lower than victim
    uint256 gasLimit;         // ~180k
}

// Example back-run tx
{
    to: UNISWAP_V2_ROUTER,
    data: encodeFunctionData(
        'swapExactTokensForTokens',
        [
            frontRunAmount,        // Sell exactly what was bought
            frontRunAmount * 1.01, // Must profit >1%
            [tokenB, tokenA],      // REVERSE path
            botAddress,
            deadline
        ]
    ),
    gasLimit: 180000,
    maxFeePerGas: victimGas,
    maxPriorityFeePerGas: victimPriority * 0.5  // Lower priority
}
```

### Bundle Submission

**Modern Approach (Flashbots):**

```javascript
// Instead of three separate txs with gas auction
// Use Flashbots bundle to guarantee ordering

const bundle = [
  signedFrontRunTx,
  victimTxFromMempool,
  signedBackRunTx
];

const bundleSubmission = await flashbotsProvider.sendBundle(
  bundle,
  targetBlockNumber
);

// Benefits:
// - Guaranteed ordering (no risk of failed sandwich)
// - No gas war (only pay if bundle included)
// - No failed transaction costs
// - Can target specific validators
```

---

## Real-World Examples

### Example 1: Large Stablecoin Swap (March 2025)

**One of the most brutal documented attacks:**

```
Victim Transaction:
- Swap: 220,764 USDC → USDT
- Pool: Uniswap V3 USDC/USDT
- Expected: ~220,000 USDT (minimal slippage expected for stablecoins)
- Slippage tolerance: Unknown, but likely 1-2% for stablecoin

MEV Bot Attack:

Tx 1 (Front-Run):
  └─> Buy massive amount of USDT with USDC
  └─> Completely drain USDT liquidity in tight range
  └─> Push USDT price sky-high

Tx 2 (Victim):
  └─> Swap executes at horrific price
  └─> Receives only $5,271 worth of USDT
  └─> 98% VALUE LOSS

Tx 3 (Back-Run):
  └─> Sell USDT back to pool
  └─> Capture victim's entire swap value

Attack Result:
- Victim loss: $215,493 (98% of intended swap)
- Bot profit: $215,500+
- Attack duration: 8 seconds
- Victim received: 2.4% of expected value

Analysis:
- Extreme example of sandwich attack
- Exploited concentrated liquidity (V3)
- Victim's slippage tolerance too high
- No MEV protection used
```

### Example 2: Typical ETH Swap Sandwich

**More common occurrence:**

```
Market: Uniswap V2 ETH/USDC
Victim: Buy 50 ETH with USDC

Initial State:
- Price: 1 ETH = 2,000 USDC
- Pool reserves: 10,000 ETH / 20,000,000 USDC
- Victim's slippage: 1.5%

Block N Transactions:

Tx 1 (Attacker Front-Run, 300 gwei):
  └─> Buy 25 ETH
  └─> Cost: ~50,125 USDC
  └─> New price: 1 ETH = 2,010 USDC

Tx 2 (Victim, 50 gwei):
  └─> Buy 50 ETH
  └─> Cost: ~101,500 USDC (expected ~100,500)
  └─> New price: 1 ETH = 2,040 USDC

Tx 3 (Attacker Back-Run, 40 gwei):
  └─> Sell 25 ETH
  └─> Revenue: ~51,000 USDC
  └─> New price: 1 ETH = 2,020 USDC

Attacker Profit:
- Revenue: 51,000 USDC
- Cost: 50,125 USDC
- Gas: ~$120
- Net profit: ~$755

Victim Loss:
- Expected cost: ~100,500 USDC
- Actual cost: 101,500 USDC
- Additional loss: 1,000 USDC (~1%)
- Still within 1.5% slippage tolerance
```

### Example 3: NFT Mint Sandwich

**Uncommon but exists:**

```
NFT Drop:
- Mint price: 0.08 ETH
- Victim minting: 10 NFTs
- Total: 0.8 ETH

Attacker Strategy:
  Tx 1: Mint 100 NFTs (front-run)
  Tx 2: Victim mints 10 NFTs
  Tx 3: List attacker's NFTs slightly above mint price

Result:
- Attacker controls supply
- Can influence floor price
- Victim pays full price, gets NFTs
- Attacker dumps on market later

Note: Less direct than DEX sandwiches, more market manipulation
```

---

## Economic Impact

### Industry Statistics (2024-2025)

**Sandwich Attack Prevalence:**

- **October 2024:** 125,829 sandwich attacks in one month
- **Total gas fees:** $7.89 million spent on MEV that month
- **Daily average:** ~4,000 sandwich attacks per day
- **Success rate:** >90% when properly executed
- **Victim count:** Tens of thousands of users affected monthly

**Total MEV Extraction:**

- **Since June 2020:** $1+ billion total MEV extracted
- **Sandwich attacks:** 51.56% of MEV volume ($289.76M of $561.92M)
- **Last 30 days (Ethereum):** 72,000+ sandwich attacks
- **Victims:** 35,000+ unique addresses targeted
- **Total value used:** $8+ million to extract $1.4+ million profit

**Solana MEV (16 months):**

- **Sandwich bot profits:** $370-$500 million
- **Platform:** Significantly worse than Ethereum
- **Protection:** Limited until recent updates

### Cost Breakdown

**For Victims (Per Attack):**

```
Small Trade ($1,000):
- Normal slippage: $5-10 (0.5-1%)
- Sandwich slippage: $10-30 (1-3%)
- Additional loss: $5-20
- Percentage loss: 0.5-2%

Medium Trade ($50,000):
- Normal slippage: $250-500 (0.5-1%)
- Sandwich slippage: $500-1,500 (1-3%)
- Additional loss: $250-1,000
- Percentage loss: 0.5-2%

Large Trade ($500,000):
- Normal slippage: $2,500-5,000 (0.5-1%)
- Sandwich slippage: $5,000-15,000 (1-3%)
- Additional loss: $2,500-10,000
- Percentage loss: 0.5-2%

Extreme Case (March 2025):
- Trade size: $220,764
- Sandwich loss: $215,493 (98%!)
- Percentage loss: 98%
```

**For Attackers (Per Attack):**

```
Typical Profitable Sandwich:
- Front-run cost: $50,000-200,000
- Back-run revenue: $50,500-202,000
- Gross profit: $500-2,000
- Gas costs: $100-500
- Net profit: $400-1,500
- ROI: 0.8-1.5%

High-Value Sandwich:
- Front-run cost: $500,000-2,000,000
- Back-run revenue: $510,000-2,020,000
- Gross profit: $10,000-20,000
- Gas costs: $500-2,000
- Net profit: $9,500-18,000
- ROI: 1.9-2%

Failed Attempts (60-70% of attempts):
- Gas cost: $100-500 per failed attempt
- Zero revenue
- Pure loss
```

### Market Impact

**Aggregate Effects:**

1. **Hidden Tax on DeFi:** 0.5-2% additional cost for users
2. **Reduced Trust:** Users avoid large trades on DEX
3. **Migration to Protection:** Growth of MEV-protected services
4. **Gas Price Inflation:** MEV bots bid up gas during volatile periods
5. **Centralization Pressure:** Validators/builders extracting MEV
6. **Innovation:** Development of MEV mitigation solutions

---

## Attack Profitability

### Profitability Formula

```javascript
function calculateSandwichProfit(params) {
  const {
    victimAmountIn,
    victimSlippage,
    poolReserves,
    gasPrice,
    baseFee
  } = params;

  // 1. Calculate optimal front-run amount
  const frontRunAmount = optimizeAmount(
    victimAmountIn,
    victimSlippage,
    poolReserves
  );

  // 2. Simulate three transactions
  let [reserveIn, reserveOut] = poolReserves;

  // Front-run: Buy
  const frontRunCost = simulateSwap(frontRunAmount, reserveIn, reserveOut);
  reserveIn += frontRunAmount;
  reserveOut -= frontRunCost;

  // Victim: Buy (pushed to max slippage)
  const victimOut = simulateSwap(victimAmountIn, reserveIn, reserveOut);
  reserveIn += victimAmountIn;
  reserveOut -= victimOut;

  // Back-run: Sell
  const backRunRevenue = simulateSwap(frontRunAmount, reserveOut, reserveIn);

  // 3. Calculate profit
  const grossProfit = backRunRevenue - frontRunAmount;

  // 4. Calculate gas costs
  const frontRunGas = 180000;
  const backRunGas = 180000;
  const totalGas = frontRunGas + backRunGas;

  // Front-run pays high priority, back-run pays low
  const frontRunGasCost = frontRunGas * (baseFee + gasPrice * 10);
  const backRunGasCost = backRunGas * (baseFee + gasPrice * 0.5);
  const totalGasCost = frontRunGasCost + backRunGasCost;

  const netProfit = grossProfit - totalGasCost;

  return {
    frontRunAmount,
    grossProfit,
    gasCost: totalGasCost,
    netProfit,
    profitable: netProfit > 0,
    roi: (netProfit / frontRunAmount) * 100,
    victimLoss: victimAmountIn * victimSlippage * 0.9 // ~90% of slippage is sandwich
  };
}
```

### Break-Even Analysis

```javascript
// Minimum conditions for profitable sandwich
function minimumProfitableConditions(gasPrice) {
  const MIN_GAS = 360000; // Front + back run
  const GAS_COST = MIN_GAS * gasPrice;

  // Need at least 0.5% profit margin after gas
  const MIN_PROFIT_MARGIN = 0.005;

  // Minimum trade size
  const MIN_TRADE_VALUE = GAS_COST / MIN_PROFIT_MARGIN;

  // Minimum slippage tolerance
  const MIN_SLIPPAGE = 0.01; // 1%

  return {
    minTradeSize: MIN_TRADE_VALUE,
    minSlippage: MIN_SLIPPAGE,
    breakEvenTrade: MIN_TRADE_VALUE / MIN_SLIPPAGE,
    gasCost: GAS_COST
  };
}

// Example at 100 gwei gas:
// Min trade size: ~$10,000
// Min slippage: 1%
// Break-even: $1,000,000 trade at 0.01% slippage
//          OR $10,000 trade at 1% slippage
```

---

## Detection Methods

### On-Chain Detection

**Pattern Recognition:**

```python
def detect_sandwich_attack(block):
    """Detect sandwich attacks in a block"""
    transactions = block.transactions
    sandwiches = []

    for i in range(len(transactions) - 2):
        tx1 = transactions[i]     # Potential front-run
        tx2 = transactions[i + 1] # Potential victim
        tx3 = transactions[i + 2] # Potential back-run

        # Check sandwich pattern
        if is_sandwich(tx1, tx2, tx3):
            profit = calculate_profit(tx1, tx3)
            victim_loss = calculate_victim_loss(tx2)

            sandwiches.append({
                'block': block.number,
                'frontrun': tx1.hash,
                'victim': tx2.hash,
                'backrun': tx3.hash,
                'attacker': tx1.from_address,
                'victim_address': tx2.from_address,
                'profit': profit,
                'victim_loss': victim_loss
            })

    return sandwiches

def is_sandwich(tx1, tx2, tx3):
    """Check if three transactions form a sandwich"""
    return (
        # Same attacker for tx1 and tx3
        tx1.from_address == tx3.from_address and

        # Different victim
        tx2.from_address != tx1.from_address and

        # All interact with same DEX
        tx1.to == tx2.to == tx3.to and

        # Gas price ordering (front-run high, back-run low)
        tx1.gas_price > tx2.gas_price and
        tx3.gas_price <= tx2.gas_price and

        # Tx1 and tx3 are opposite trades
        is_opposite_swap(tx1, tx3) and

        # Tx2 is same direction as tx1
        is_same_direction(tx1, tx2)
    )
```

### Real-Time Mempool Detection

```javascript
class SandwichDetector {
  constructor(web3) {
    this.web3 = web3;
    this.pendingSwaps = new Map();
    this.potentialSandwiches = [];
  }

  async monitorMempool() {
    const subscription = this.web3.eth.subscribe('pendingTransactions');

    subscription.on('data', async (txHash) => {
      const tx = await this.web3.eth.getTransaction(txHash);

      if (this.isDexSwap(tx)) {
        // Check if this could be front-run for existing pending tx
        for (const [victimHash, victimTx] of this.pendingSwaps) {
          if (this.isPotentialFrontRun(tx, victimTx)) {
            console.warn('⚠️ Potential sandwich attack detected!');
            console.log('Victim TX:', victimHash);
            console.log('Front-run TX:', txHash);
            console.log('Victim gas:', victimTx.gasPrice);
            console.log('Attacker gas:', tx.gasPrice);

            this.potentialSandwiches.push({
              victim: victimHash,
              frontRun: txHash,
              timestamp: Date.now()
            });
          }
        }

        // Store this tx as potential victim
        this.pendingSwaps.set(txHash, tx);

        // Clean up old entries
        setTimeout(() => this.pendingSwaps.delete(txHash), 30000);
      }
    });
  }

  isPotentialFrontRun(attackerTx, victimTx) {
    return (
      // Same DEX
      attackerTx.to === victimTx.to &&

      // Much higher gas price
      attackerTx.gasPrice > victimTx.gasPrice * 2 &&

      // Same token pair
      this.extractTokenPair(attackerTx) === this.extractTokenPair(victimTx) &&

      // Same direction (both buying or both selling)
      this.getSwapDirection(attackerTx) === this.getSwapDirection(victimTx)
    );
  }
}

// Usage
const detector = new SandwichDetector(web3);
detector.monitorMempool();
```

### Check if You Were Sandwiched

**Post-Transaction Analysis:**

```javascript
async function wasISandwiched(myTxHash) {
  const web3 = new Web3(RPC_URL);

  // Get your transaction
  const myTx = await web3.eth.getTransaction(myTxHash);
  const myReceipt = await web3.eth.getTransactionReceipt(myTxHash);

  // Get block
  const block = await web3.eth.getBlock(myReceipt.blockNumber, true);

  // Find your tx position
  const myIndex = block.transactions.findIndex(tx => tx.hash === myTxHash);

  // Check transaction before (potential front-run)
  const txBefore = block.transactions[myIndex - 1];

  // Check transaction after (potential back-run)
  const txAfter = block.transactions[myIndex + 1];

  // Analyze pattern
  const isSandwich = (
    txBefore &&
    txAfter &&
    txBefore.from === txAfter.from &&  // Same attacker
    txBefore.to === myTx.to &&          // Same DEX
    txAfter.to === myTx.to &&
    txBefore.gasPrice > myTx.gasPrice && // Higher gas (front-run)
    txAfter.gasPrice <= myTx.gasPrice    // Lower gas (back-run)
  );

  if (isSandwich) {
    console.log('🥪 You were sandwiched!');
    console.log('Front-run TX:', txBefore.hash);
    console.log('Your TX:', myTxHash);
    console.log('Back-run TX:', txAfter.hash);
    console.log('Attacker:', txBefore.from);

    // Calculate your loss
    const expectedOutput = await estimateExpectedOutput(myTx);
    const actualOutput = await getActualOutput(myReceipt);
    const loss = expectedOutput - actualOutput;

    console.log('Estimated loss:', web3.utils.fromWei(loss, 'ether'), 'tokens');
  } else {
    console.log('✅ No sandwich attack detected');
  }

  return isSandwich;
}
```

---

## Protection Strategies

### 1. Use Private Mempools (Most Effective)

**Flashbots Protect RPC:**

```javascript
// Configure wallet/dApp to use Flashbots Protect
const provider = new ethers.providers.JsonRpcProvider(
  'https://rpc.flashbots.net'
);

// Your transactions bypass public mempool
// Sent directly to Flashbots validators
// MEV bots cannot see your transaction
// Sandwich attacks impossible

// Benefits:
// ✅ Complete sandwich protection
// ✅ No transaction changes needed
// ✅ Free to use
// ✅ May receive MEV rebates

// Limitations:
// ⚠️ Only works with Flashbots-connected validators
// ⚠️ Might have slower inclusion times
```

**Other Private Mempool Services:**

- **MEV-Blocker:** https://mevblocker.io
- **Eden Network:** https://www.edennetwork.io
- **BloXroute:** https://bloxroute.com

### 2. Set Strict Slippage Tolerance

**Minimize Sandwich Profitability:**

```javascript
// ❌ BAD: High slippage = profitable sandwich target
const slippageTolerance = 0.05; // 5%

// ✅ GOOD: Low slippage = less profitable for attackers
const slippageTolerance = 0.005; // 0.5%

// Calculate amountOutMin
const expectedOutput = await router.getAmountsOut(amountIn, path);
const amountOutMin = expectedOutput * (1 - slippageTolerance);

// Trade-off:
// Lower slippage = More protection, but higher revert rate
// Higher slippage = Less protection, but more reliable execution

// Recommended:
// - Stablecoins: 0.1-0.5%
// - Major pairs: 0.5-1%
// - Mid-caps: 1-2%
// - Long-tail: 2-3% (but use protection!)
```

**Smart Slippage Management:**

```solidity
contract ProtectedSwap {
    // Dynamic slippage based on pool liquidity
    function calculateSafeSlippage(
        uint256 amountIn,
        uint256 poolLiquidity
    ) public pure returns (uint256) {
        // Trade size as % of pool
        uint256 tradeImpact = (amountIn * 10000) / poolLiquidity;

        // Base slippage + impact-based buffer
        uint256 slippage;

        if (tradeImpact < 50) {
            // <0.5% of pool: 0.5% slippage
            slippage = 50;
        } else if (tradeImpact < 100) {
            // 0.5-1% of pool: 1% slippage
            slippage = 100;
        } else if (tradeImpact < 500) {
            // 1-5% of pool: 2% slippage
            slippage = 200;
        } else {
            // >5% of pool: Consider splitting trade
            revert("Trade too large, split recommended");
        }

        return slippage;
    }
}
```

### 3. Use CoW Protocol

**Batch Auctions Eliminate Sandwiches:**

```
CoW Protocol Mechanism:
1. Submit order to batch auction
2. Wait for batch window (e.g., 30 seconds)
3. Orders matched with CoWs (Coincidence of Wants) first
4. Remaining filled at uniform clearing price
5. Surplus returned to users

Sandwich Protection:
- No intra-batch ordering
- Uniform price prevents sandwich profit
- CoWs provide better prices
- MEV protection built-in

dApp Integration:
import { CowSdk } from '@cowprotocol/cow-sdk';

const cowSdk = new CowSdk(chainId, provider);

const order = await cowSdk.cowApi.sendOrder({
  sellToken: TOKEN_A,
  buyToken: TOKEN_B,
  sellAmount: amount,
  kind: OrderKind.SELL,
  partiallyFillable: false
});

// Order protected from MEV automatically
```

### 4. Split Large Trades

**Reduce Per-Trade Impact:**

```javascript
// Instead of one large trade
async function largeTrade(amount) {
  await swap(amount); // Huge price impact, sandwich target
}

// Split into smaller trades
async function splitTrade(totalAmount, numSplits) {
  const amountPerTrade = totalAmount / numSplits;

  for (let i = 0; i < numSplits; i++) {
    await swap(amountPerTrade);
    await sleep(60000); // Wait 1 minute between trades
  }

  // Benefits:
  // - Smaller price impact per trade
  // - Less profitable for sandwiches
  // - More likely attacker ignores

  // Drawbacks:
  // - Higher total gas cost
  // - Longer execution time
  // - Still could be sandwiched on each
}
```

### 5. Use Limit Orders

**Eliminate Slippage Entirely:**

```javascript
// 0x Protocol limit order
import { LimitOrder } from '@0x/protocol-utils';

const limitOrder = new LimitOrder({
  makerToken: TOKEN_A,
  takerToken: TOKEN_B,
  makerAmount: sellAmount,
  takerAmount: exactBuyAmount,  // Exact price
  maker: wallet.address,
  expiry: Math.floor(Date.now() / 1000) + 3600 // 1 hour
});

// Sign and submit
const signature = await limitOrder.getSignatureWithProviderAsync(provider);
await submitOrder(limitOrder, signature);

// Benefits:
// ✅ No slippage
// ✅ Exact price or better
// ✅ No sandwich possible

// Drawbacks:
// ⚠️ May not fill immediately
// ⚠️ Could never fill if price doesn't reach
```

### 6. Gas Price Strategy

**Don't Make Yourself a Target:**

```javascript
// ❌ BAD: Using "fast" or "instant" gas
const gasPrice = await getInstantGasPrice(); // 200 gwei
// Signals: "I need this NOW" = priority target

// ✅ BETTER: Use normal gas price
const gasPrice = await getStandardGasPrice(); // 50 gwei
// Less urgent signal

// ✅ BEST: Use private mempool
// No gas price signal at all

// Rule of thumb:
// If your trade can wait 30-60 seconds:
//   → Use normal gas + private mempool
// If urgent:
//   → Use Flashbots bundle to hide urgency
```

### 7. Deadline Protection

**Prevent Delayed Execution:**

```solidity
// Add short deadline to prevent stale execution
function swapWithDeadline(
    uint256 amountIn,
    uint256 amountOutMin,
    address[] calldata path
) external {
    uint256 deadline = block.timestamp + 180; // 3 minutes

    router.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        msg.sender,
        deadline  // Transaction reverts if not mined within 3 minutes
    );

    // Prevents:
    // - Execution at stale prices
    // - Delayed sandwich attacks
    // - Long mempool wait exploitation
}
```

### 8. Aggregators with Protection

**Use MEV-Protected Aggregators:**

```
Services with built-in MEV protection:
- CoW Swap (cowswap.exchange)
- 1inch with MEV protection
- Matcha (0x)
- Paraswap with MEV protection

These services:
✅ Route through private channels
✅ Use batch auctions or RFQ
✅ Provide MEV rebates
✅ Aggregate liquidity efficiently
```

---

## Code Examples

### Example 1: Sandwich Attack Simulator

```javascript
class SandwichSimulator {
  constructor(poolReserves, fee = 0.003) {
    this.reserves = poolReserves;
    this.fee = fee;
  }

  // Uniswap V2 swap simulation
  getAmountOut(amountIn, reserveIn, reserveOut) {
    const amountInWithFee = amountIn * (1 - this.fee);
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn + amountInWithFee;
    return numerator / denominator;
  }

  // Simulate complete sandwich attack
  simulateSandwich(victimAmountIn, frontRunAmount) {
    let [reserveIn, reserveOut] = this.reserves;

    // Step 1: Front-run (attacker buys)
    const frontRunOut = this.getAmountOut(frontRunAmount, reserveIn, reserveOut);
    reserveIn += frontRunAmount;
    reserveOut -= frontRunOut;

    console.log('After front-run:');
    console.log('  Reserves:', reserveIn, reserveOut);
    console.log('  Price:', reserveOut / reserveIn);

    // Step 2: Victim transaction
    const victimOut = this.getAmountOut(victimAmountIn, reserveIn, reserveOut);
    reserveIn += victimAmountIn;
    reserveOut -= victimOut;

    console.log('After victim:');
    console.log('  Reserves:', reserveIn, reserveOut);
    console.log('  Price:', reserveOut / reserveIn);
    console.log('  Victim received:', victimOut);

    // Step 3: Back-run (attacker sells)
    const backRunOut = this.getAmountOut(frontRunOut, reserveOut, reserveIn);
    reserveOut += frontRunOut;
    reserveIn -= backRunOut;

    console.log('After back-run:');
    console.log('  Reserves:', reserveIn, reserveOut);
    console.log('  Price:', reserveOut / reserveIn);

    // Calculate profit
    const attackerProfit = backRunOut - frontRunAmount;
    const profitPercent = (attackerProfit / frontRunAmount) * 100;

    // Calculate victim loss
    const expectedVictimOut = this.getAmountOut(
      victimAmountIn,
      this.reserves[0],
      this.reserves[1]
    );
    const victimLoss = expectedVictimOut - victimOut;
    const victimLossPercent = (victimLoss / expectedVictimOut) * 100;

    return {
      attackerProfit,
      profitPercent,
      victimOut,
      expectedVictimOut,
      victimLoss,
      victimLossPercent
    };
  }

  // Find optimal front-run amount
  findOptimalFrontRun(victimAmountIn, maxIterations = 100) {
    let bestProfit = 0;
    let bestAmount = 0;

    // Try different front-run amounts
    for (let i = 1; i <= maxIterations; i++) {
      const frontRunAmount = (victimAmountIn * i) / 100;

      const result = this.simulateSandwich(victimAmountIn, frontRunAmount);

      if (result.attackerProfit > bestProfit) {
        bestProfit = result.attackerProfit;
        bestAmount = frontRunAmount;
      }
    }

    return {
      optimalAmount: bestAmount,
      expectedProfit: bestProfit
    };
  }
}

// Usage
const simulator = new SandwichSimulator([1000000, 2000000000]); // 1M ETH, 2B USDC

const result = simulator.simulateSandwich(
  100,   // Victim buying 100 ETH
  50     // Attacker front-runs with 50 ETH
);

console.log('Sandwich Simulation Results:');
console.log('Attacker profit:', result.attackerProfit);
console.log('Profit %:', result.profitPercent);
console.log('Victim loss:', result.victimLoss);
console.log('Victim loss %:', result.victimLossPercent);
```

### Example 2: Protection Smart Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SandwichProtectedSwap
 * @notice Implements multiple layers of sandwich attack protection
 */
contract SandwichProtectedSwap {
    IUniswapV2Router02 public immutable router;

    // Protection parameters
    uint256 public constant MAX_SLIPPAGE = 50;      // 0.5% max slippage
    uint256 public constant MAX_GAS_PRICE = 500 gwei;
    uint256 public constant MAX_DEADLINE = 3 minutes;
    uint256 public constant MIN_TRADE_SIZE = 0.1 ether;
    uint256 public constant MAX_POOL_IMPACT = 200;  // 2% max of pool

    event ProtectedSwap(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(address _router) {
        router = IUniswapV2Router02(_router);
    }

    /**
     * @notice Execute a sandwich-protected swap
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input tokens
     * @param expectedAmountOut Expected output (from off-chain calculation)
     */
    function protectedSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 expectedAmountOut
    ) external returns (uint256 amountOut) {
        // Protection 1: Gas price limit
        require(tx.gasprice <= MAX_GAS_PRICE, "Gas price too high - potential sandwich");

        // Protection 2: Minimum trade size (reduce viability)
        require(amountIn >= MIN_TRADE_SIZE, "Trade too small");

        // Protection 3: Calculate strict slippage
        uint256 minAmountOut = (expectedAmountOut * (10000 - MAX_SLIPPAGE)) / 10000;

        // Protection 4: Short deadline
        uint256 deadline = block.timestamp + MAX_DEADLINE;

        // Protection 5: Check pool impact
        address pair = getPair(tokenIn, tokenOut);
        (uint256 reserve0, uint256 reserve1,) = IUniswapV2Pair(pair).getReserves();
        uint256 reserveIn = tokenIn < tokenOut ? reserve0 : reserve1;

        uint256 poolImpact = (amountIn * 10000) / reserveIn;
        require(poolImpact <= MAX_POOL_IMPACT, "Trade too large for pool");

        // Execute swap
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(address(router), amountIn);

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint[] memory amounts = router.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            msg.sender,
            deadline
        );

        amountOut = amounts[1];

        emit ProtectedSwap(msg.sender, tokenIn, tokenOut, amountIn, amountOut);

        return amountOut;
    }

    function getPair(address tokenA, address tokenB) internal view returns (address) {
        address factory = router.factory();
        return IUniswapV2Factory(factory).getPair(tokenA, tokenB);
    }
}
```

### Example 3: Flashbots Protection Bundle

```javascript
const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle');
const { ethers } = require('ethers');

async function protectedSwap(swapParams) {
  // Setup
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  // Flashbots auth
  const authSigner = ethers.Wallet.createRandom();
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    authSigner,
    'https://relay.flashbots.net'
  );

  // Build swap transaction
  const swapTx = {
    to: UNISWAP_ROUTER,
    data: router.interface.encodeFunctionData('swapExactTokensForTokens', [
      swapParams.amountIn,
      swapParams.amountOutMin,
      swapParams.path,
      wallet.address,
      deadline
    ]),
    gasLimit: 300000,
    maxFeePerGas: ethers.utils.parseUnits('100', 'gwei'),
    maxPriorityFeePerGas: ethers.utils.parseUnits('3', 'gwei'),
    nonce: await provider.getTransactionCount(wallet.address),
    chainId: 1,
    type: 2
  };

  // Sign transaction
  const signedTx = await wallet.signTransaction(swapTx);

  // Submit as single-transaction bundle
  const targetBlock = await provider.getBlockNumber() + 1;

  const bundleSubmission = await flashbotsProvider.sendRawBundle(
    [signedTx],
    targetBlock
  );

  console.log('Protected swap bundle submitted');
  console.log('Bundle hash:', bundleSubmission.bundleHash);

  // Wait for inclusion
  const waitResponse = await bundleSubmission.wait();

  if (waitResponse === 0) {
    console.log('✅ Swap executed without sandwich!');
    return { success: true, block: targetBlock };
  } else {
    console.log('Bundle not included, trying next block...');
    // Retry for next block if needed
  }
}
```

---

## Key Takeaways

### For Users

1. **Sandwich attacks are the most harmful MEV** - 51.56% of MEV volume
2. **Use private mempools** - Flashbots Protect, MEV-Blocker (free & effective)
3. **Set strict slippage** - 0.5-1% for major pairs, accept some reverts
4. **Split large trades** - Reduce per-trade profitability
5. **Use CoW Protocol** - Batch auctions eliminate sandwiches
6. **Avoid high gas** - Don't signal urgency
7. **Check if you were sandwiched** - Learn from patterns

### For Developers

1. **Integrate MEV protection** - Flashbots, MEV-Blocker, CoW Protocol
2. **Default to low slippage** - Protect users by default
3. **Educate users** - Explain sandwich risks
4. **Implement protection** - Smart contract defenses
5. **Monitor attacks** - Track sandwich activity on your protocol
6. **Support private transactions** - Enable Flashbots integration
7. **Consider batch auctions** - CoW Protocol model

### For MEV Searchers

1. **Sandwich attacks are predatory** - Harm retail users
2. **Legal/ethical concerns** - Regulatory attention increasing
3. **Infrastructure expensive** - $10K+ monthly costs
4. **Competition intense** - Success rate <40% for attempts
5. **Consider alternatives** - Back-running, arbitrage less harmful
6. **Use Flashbots** - Reduce failed transaction costs
7. **Understand impact** - You're extracting value from regular users

### Economic Reality

- **$289.76M extracted** via sandwiches (51.56% of MEV)
- **125,829 attacks** in October 2024 alone
- **72,000+ attacks** in last 30 days on Ethereum
- **35,000+ victims** targeted monthly
- **Protection widely available** - Use it!

### Future Outlook

**Trends:**
- Increasing regulatory scrutiny of MEV
- Growth of MEV-protected services (CoW, MEV-Blocker)
- L2 adoption with private mempools
- PBS (Proposer-Builder Separation) changes dynamics
- Encrypted mempools on some L2s
- User education reducing sandwich success

**Recommendations:**
- **ALWAYS use MEV protection for trades >$1,000**
- Default to Flashbots Protect or CoW Protocol
- Set slippage as low as possible
- Monitor your transactions for sandwich patterns
- Support MEV-resistant DeFi protocols
- Advocate for better MEV protection standards

---

## Additional Resources

### Protection Tools
- **Flashbots Protect:** https://protect.flashbots.net (Private RPC)
- **MEV-Blocker:** https://mevblocker.io (Rebates + protection)
- **CoW Protocol:** https://cow.fi (Batch auctions)
- **0x:** https://0x.org (Limit orders)

### Analytics
- **MEV-Explore:** https://explore.flashbots.net (Track MEV)
- **EigenPhi:** https://eigenphi.io (MEV analytics)
- **Zeromev:** https://zeromev.org (Real-time MEV)

### Research
- **Flashbots Research:** https://writings.flashbots.net
- **a16z Crypto:** https://a16zcrypto.com/mev
- **Ethereum Foundation:** https://ethereum.org/en/developers/docs/mev

### Communities
- **Flashbots Discord:** https://discord.gg/flashbots
- **CoW Protocol Discord:** https://discord.gg/cowprotocol
- **MEV Ship:** https://mevship.com

---

**Remember:** Sandwich attacks are preventable. Use private mempools (Flashbots Protect, MEV-Blocker) or batch auctions (CoW Protocol) to completely eliminate the risk. Don't be a victim!
