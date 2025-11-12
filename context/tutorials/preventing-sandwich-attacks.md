**Source:** Multiple sources (Flashbots, CoW Protocol, MEV research, Industry best practices)
**Date:** 2024-2025

# Preventing Sandwich Attacks: Complete Protection Guide

## Table of Contents
1. [Overview](#overview)
2. [Understanding the Threat](#understanding-the-threat)
3. [Prevention Strategy Matrix](#prevention-strategy-matrix)
4. [Private Mempool Solutions](#private-mempool-solutions)
5. [Batch Auction Protection](#batch-auction-protection)
6. [Slippage Management](#slippage-management)
7. [Smart Contract Protections](#smart-contract-protections)
8. [Transaction Timing Strategies](#transaction-timing-strategies)
9. [Advanced Protection Techniques](#advanced-protection-techniques)
10. [Implementation Examples](#implementation-examples)
11. [Protection Checklist](#protection-checklist)
12. [Best Practices](#best-practices)

---

## Overview

**Sandwich attacks are the most harmful form of MEV**, accounting for 51.56% of all MEV extraction ($289.76M of $561.92M total). This guide provides comprehensive strategies to protect yourself and your users from these predatory attacks.

### Attack Recap

```
Sandwich Attack Pattern:
1. Attacker's front-run: Buy asset (pushes price UP)
2. Your transaction: Execute at inflated price
3. Attacker's back-run: Sell asset (takes profit)

Result: You pay maximum slippage, attacker profits from both sides
```

### Protection Effectiveness Scale

| Method | Effectiveness | Complexity | Cost | Best For |
|--------|--------------|------------|------|----------|
| **Flashbots Protect** | 100% | Low | Free | Everyone |
| **CoW Protocol** | 100% | Low | Free | Swaps |
| **MEV-Blocker** | 95% | Low | Free | General use |
| **Tight Slippage** | 60% | Low | Free | Small trades |
| **Limit Orders** | 100% | Low | Free | Patient traders |
| **Smart Contract** | 80% | High | Gas | Developers |
| **Trade Splitting** | 50% | Medium | High gas | Large trades |

---

## Understanding the Threat

### Who Gets Sandwiched?

**High-Risk Transactions:**
- ✅ Large DEX swaps (>$10k)
- ✅ High slippage tolerance (>1%)
- ✅ Market orders on volatile pairs
- ✅ Transactions through public mempool
- ✅ Popular trading pairs (ETH/USDC, etc.)

**Low-Risk Transactions:**
- ❌ Limit orders
- ❌ Batch auction orders (CoW Protocol)
- ❌ Private mempool transactions (Flashbots)
- ❌ Very tight slippage (<0.5%)
- ❌ Small trades (<$1k)

### Attack Economics

**Minimum Profitable Sandwich (for attacker):**
```javascript
// Attacker's calculation
const minProfit = gasCost * 2; // Need 2x gas to break even
const gasCost = 360000 * gasPrice; // Front-run + back-run

// At 100 gwei: ~$72 gas cost
// Minimum profit needed: ~$144
// This requires victim slippage: ~1.4% on $10k trade

// Conclusion: Trades <$10k with <1% slippage often not worth attacking
```

### Statistics You Need to Know

- **125,829 sandwich attacks** in October 2024
- **72,000+ attacks** in last 30 days on Ethereum
- **35,000+ victims** targeted monthly
- **Average loss:** 1-2% of trade value
- **Worst case:** Up to 98% loss (March 2025 incident)

---

## Prevention Strategy Matrix

### Choose Your Protection Level

#### Level 1: Basic Protection (Everyone)
**Time Investment:** 2 minutes
**Cost:** Free
**Effectiveness:** 60-80%

1. Use Flashbots Protect RPC
2. Set slippage to 0.5-1%
3. Add transaction deadline

**Implementation:**
```javascript
// MetaMask: Switch RPC to Flashbots Protect
// URL: https://rpc.flashbots.net

// In your dApp:
const slippage = 0.005; // 0.5%
const deadline = Date.now() + 180; // 3 minutes
```

#### Level 2: Advanced Protection (Serious Traders)
**Time Investment:** 10 minutes
**Cost:** Free
**Effectiveness:** 95-100%

1. Use CoW Protocol for all swaps
2. MEV-Blocker integration
3. Limit orders when possible

**Implementation:**
```javascript
// Use CoW Swap interface
// https://swap.cow.fi

// Or integrate SDK
import { CowSdk } from '@cowprotocol/cow-sdk';
```

#### Level 3: Maximum Protection (Developers/Protocols)
**Time Investment:** Development time
**Cost:** Smart contract deployment
**Effectiveness:** 100%

1. Custom smart contracts with protections
2. Commit-reveal schemes
3. Flashbots bundles
4. MEV-sharing integration

---

## Private Mempool Solutions

### 1. Flashbots Protect (Recommended)

**Why It Works:** Your transaction never appears in public mempool, making it invisible to sandwich bots.

**Setup for Users:**

```
Step 1: Add Flashbots Protect RPC to wallet
----------------------------------------
Network Name: Flashbots Protect
RPC URL: https://rpc.flashbots.net
Chain ID: 1
Currency: ETH
Block Explorer: https://etherscan.io

Step 2: Switch to this network for trading
Step 3: Trade normally - you're protected!
```

**Advantages:**
- ✅ 100% sandwich protection
- ✅ Free to use
- ✅ No code changes needed
- ✅ Potential MEV rebates
- ✅ Works with any dApp

**Limitations:**
- ⚠️ Slightly slower inclusion (sometimes)
- ⚠️ Only works with Flashbots validators (~90% of blocks)
- ⚠️ Validators can still sandwich (rare)

**For Developers - Integration:**

```javascript
const { ethers } = require('ethers');

// Connect to Flashbots Protect
const provider = new ethers.providers.JsonRpcProvider(
  'https://rpc.flashbots.net'
);

// All transactions through this provider are protected
const wallet = new ethers.Wallet(privateKey, provider);

// Execute swap - no sandwich possible
const tx = await router.swapExactTokensForTokens(
  amountIn,
  amountOutMin,
  path,
  wallet.address,
  deadline
);

console.log('Protected transaction sent:', tx.hash);
```

### 2. MEV-Blocker

**Why It Works:** Similar to Flashbots, but shares MEV profits back with you.

**Setup:**

```
RPC URL: https://rpc.mevblocker.io
Chain ID: 1

Features:
- Private transaction submission
- MEV profit sharing (rebates)
- Fast inclusion
- Compatible with all wallets
```

**Advantages:**
- ✅ 95%+ sandwich protection
- ✅ Earn rebates from back-running
- ✅ Free to use
- ✅ Faster than Flashbots sometimes

**Integration Example:**

```javascript
const provider = new ethers.providers.JsonRpcProvider(
  'https://rpc.mevblocker.io'
);

// Your transactions may earn you MEV rebates
// Check https://mevblocker.io/stats for earnings
```

### 3. Flashbots Bundles (Advanced)

**Why It Works:** Atomic bundle execution guarantees ordering.

**Use Case:** When you need to combine multiple transactions.

```javascript
const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle');

async function sendProtectedBundle() {
  // Setup
  const authSigner = ethers.Wallet.createRandom();
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    authSigner,
    'https://relay.flashbots.net'
  );

  // Create your transaction(s)
  const tx1 = await wallet.signTransaction({
    to: router.address,
    data: swapCalldata,
    gasLimit: 300000,
    maxFeePerGas: ethers.utils.parseUnits('100', 'gwei'),
    maxPriorityFeePerGas: ethers.utils.parseUnits('3', 'gwei'),
    nonce: await provider.getTransactionCount(wallet.address),
    chainId: 1,
    type: 2
  });

  // Submit as bundle (guaranteed no sandwich)
  const targetBlock = await provider.getBlockNumber() + 1;

  const bundleSubmission = await flashbotsProvider.sendRawBundle(
    [tx1],
    targetBlock
  );

  console.log('Bundle hash:', bundleSubmission.bundleHash);

  // Wait for inclusion
  const waitResponse = await bundleSubmission.wait();

  if (waitResponse === 0) {
    console.log('✅ Bundle included - no sandwich!');
  } else {
    console.log('Bundle not included, retrying...');
    // Retry for next block
  }

  return waitResponse;
}
```

---

## Batch Auction Protection

### CoW Protocol (Best for Swaps)

**Why It Works:** Batch auctions eliminate intra-batch MEV. All orders execute at uniform clearing price.

**How It Works:**

```
Traditional DEX:
- Order goes to mempool (visible)
- Bots can sandwich
- You get sandwiched

CoW Protocol:
- Order goes to batch auction (private)
- Wait ~30 seconds for batch
- All orders execute at same uniform price
- No ordering = no sandwich possible
```

**Using CoW Swap (UI):**

```
1. Visit https://swap.cow.fi
2. Connect wallet
3. Enter swap details
4. Submit order
5. Wait for batch execution (~30 seconds)
6. Receive protected execution + potential surplus!

Advantages:
✅ 100% sandwich protection
✅ Often better prices (CoWs)
✅ Surplus refunded to you
✅ Gas efficient
✅ Free to use
```

**Integration for Developers:**

```javascript
import { CowSdk, OrderKind } from '@cowprotocol/cow-sdk';

async function createProtectedOrder() {
  const cowSdk = new CowSdk(1, { signer: wallet });

  // Create order
  const order = await cowSdk.cowApi.sendOrder({
    sellToken: TOKEN_A_ADDRESS,
    buyToken: TOKEN_B_ADDRESS,
    sellAmount: ethers.utils.parseUnits('1000', 6).toString(), // 1000 USDC
    kind: OrderKind.SELL,
    partiallyFillable: false,
    sellTokenBalance: 'erc20',
    buyTokenBalance: 'erc20'
  });

  console.log('Protected order created:', order);
  console.log('No sandwich possible!');

  return order;
}
```

**Advanced: CoW Hooks**

```solidity
// Execute custom logic before/after CoW order
contract CowHook {
    function preHook(
        GPv2Order.Data calldata order,
        bytes calldata hookData
    ) external {
        // Logic before order execution
        // E.g., claim rewards, compound, etc.
    }

    function postHook(
        GPv2Order.Data calldata order,
        bytes calldata hookData
    ) external {
        // Logic after order execution
        // E.g., stake received tokens
    }
}
```

---

## Slippage Management

### Understanding Slippage as Defense

**Slippage is your shield against sandwiches:**

```
High Slippage (3%+): Easy target for bots
  └─> Attacker can push price 2.9%, still execute
  └─> You lose 2.9%, attacker profits

Low Slippage (0.5%): Difficult target
  └─> Attacker can only push price 0.49%
  └─> Limited profit, might not be worth gas
  └─> Your transaction may revert if organic volatility
```

### Optimal Slippage by Pair

**Stablecoins (USDC/DAI/USDT):**
```javascript
const slippage = 0.001; // 0.1%
// Stables shouldn't move much
// Any bigger movement = sandwich or oracle issue
```

**Major Pairs (ETH/USDC, WBTC/ETH):**
```javascript
const slippage = 0.005; // 0.5%
// Liquid pairs with tight spreads
// 0.5% catches normal volatility
// Larger = sandwich target
```

**Mid-Cap Tokens:**
```javascript
const slippage = 0.01; // 1%
// Less liquid, more volatility
// Balance protection vs execution
```

**Long-Tail/Volatile:**
```javascript
const slippage = 0.03; // 3%
// High risk of sandwich
// USE PROTECTION (Flashbots/CoW) instead
```

### Dynamic Slippage Calculation

```javascript
class SmartSlippage {
  calculateOptimalSlippage(params) {
    const {
      amountIn,
      poolLiquidity,
      volatility,
      gasPrice
    } = params;

    // Base slippage from pool depth
    const tradeImpact = amountIn / poolLiquidity;
    let slippage = tradeImpact * 1.5; // 1.5x expected impact

    // Adjust for volatility
    slippage += volatility * 0.01;

    // Cap based on gas economics
    // Attackers won't sandwich if profit < gas cost
    const maxProfitableSlippage = this.calculateMaxSandwich(
      amountIn,
      gasPrice
    );

    // Use minimum of calculated and max profitable
    slippage = Math.min(slippage, maxProfitableSlippage);

    // Enforce absolute limits
    const MIN_SLIPPAGE = 0.001; // 0.1%
    const MAX_SLIPPAGE = 0.03;  // 3%

    return Math.max(MIN_SLIPPAGE, Math.min(slippage, MAX_SLIPPAGE));
  }

  calculateMaxSandwich(amountIn, gasPrice) {
    // Sandwich costs ~360k gas (front + back)
    const gasCost = 360000 * gasPrice;

    // Attackers need 50% margin minimum
    const minProfit = gasCost * 1.5;

    // Calculate slippage that yields this profit
    const slippage = minProfit / amountIn;

    return slippage;
  }
}

// Usage
const calculator = new SmartSlippage();

const optimalSlippage = calculator.calculateOptimalSlippage({
  amountIn: ethers.utils.parseEther('10'), // 10 ETH
  poolLiquidity: ethers.utils.parseEther('1000'), // 1000 ETH
  volatility: 0.02, // 2% recent volatility
  gasPrice: 100e9 // 100 gwei
});

console.log('Optimal slippage:', optimalSlippage * 100, '%');
```

### Slippage UI Best Practices

```javascript
// DON'T: Fixed high slippage
const slippage = 0.05; // 5% - sandwich magnet!

// DO: Dynamic with warnings
function getSlippageWithWarning(amountIn, pair) {
  const suggested = calculateOptimalSlippage(amountIn, pair);

  if (suggested > 0.02) {
    return {
      slippage: suggested,
      warning: '⚠️ High slippage detected. Consider using CoW Protocol or splitting trade.',
      recommend: 'Use protection'
    };
  }

  return {
    slippage: suggested,
    warning: null,
    recommend: null
  };
}

// Show in UI
const result = getSlippageWithWarning(amountIn, pair);
if (result.warning) {
  alert(result.warning);
  // Suggest Flashbots or CoW
}
```

---

## Smart Contract Protections

### 1. Gas Price Limits

**Concept:** Prevent execution when gas indicates MEV activity.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract GasProtectedSwap {
    uint256 public constant MAX_GAS_PRICE = 500 gwei;

    modifier gasCheck() {
        require(
            tx.gasprice <= MAX_GAS_PRICE,
            "Gas price too high - possible MEV attack"
        );
        _;
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external gasCheck {
        // Your swap logic
        // If gas > 500 gwei, likely MEV bot
        // Transaction reverts
    }
}
```

**Limitations:**
- ⚠️ Post-EIP-1559, attackers can use high priority fee instead
- ⚠️ Legitimate users during high gas periods blocked
- ⚠️ Not foolproof protection

### 2. Time-Weighted Average Price (TWAP)

**Concept:** Use average price over time instead of spot price.

```solidity
contract TWAPProtected {
    struct Observation {
        uint32 timestamp;
        uint256 price;
    }

    Observation[] public observations;
    uint32 public constant TWAP_PERIOD = 30 minutes;

    function getTWAP() public view returns (uint256) {
        uint256 sum = 0;
        uint32 count = 0;
        uint32 cutoff = uint32(block.timestamp) - TWAP_PERIOD;

        for (uint i = observations.length - 1; i >= 0; i--) {
            if (observations[i].timestamp < cutoff) break;

            sum += observations[i].price;
            count++;
        }

        require(count > 0, "No observations");
        return sum / count;
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external returns (uint256) {
        // Use TWAP instead of spot price
        uint256 twapPrice = getTWAP();

        // Calculate expected output based on TWAP
        uint256 expectedOut = (amountIn * twapPrice) / 1e18;

        // Add minimal slippage for TWAP (0.3%)
        uint256 minOut = (expectedOut * 997) / 1000;

        // Execute swap with TWAP-based min
        // Sandwich attacks move spot price, not TWAP
        // So attack becomes unprofitable

        return executeSwap(tokenIn, tokenOut, amountIn, minOut);
    }
}
```

### 3. Commit-Reveal Pattern

**Concept:** Hide swap parameters until execution.

```solidity
contract CommitRevealSwap {
    struct Commitment {
        bytes32 commitHash;
        uint256 timestamp;
    }

    mapping(address => Commitment) public commitments;
    uint256 public constant COMMIT_DELAY = 30 seconds;
    uint256 public constant COMMIT_EXPIRY = 5 minutes;

    // Step 1: Commit to swap (hide parameters)
    function commit(bytes32 commitHash) external {
        commitments[msg.sender] = Commitment({
            commitHash: commitHash,
            timestamp: block.timestamp
        });

        emit Committed(msg.sender, commitHash);
    }

    // Step 2: Reveal and execute (after delay)
    function reveal(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        bytes32 salt
    ) external returns (uint256) {
        Commitment memory c = commitments[msg.sender];

        // Verify commitment
        bytes32 hash = keccak256(abi.encode(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amountOutMin,
            salt
        ));

        require(c.commitHash == hash, "Invalid commitment");

        // Enforce timing
        require(
            block.timestamp >= c.timestamp + COMMIT_DELAY,
            "Too soon"
        );
        require(
            block.timestamp <= c.timestamp + COMMIT_EXPIRY,
            "Commitment expired"
        );

        // Clear commitment
        delete commitments[msg.sender];

        // Execute swap
        // Bots couldn't see parameters during commit
        // Can't sandwich what they can't see!

        return executeSwap(tokenIn, tokenOut, amountIn, amountOutMin);
    }

    // Helper: Generate commit hash off-chain
    function generateCommitHash(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        bytes32 salt
    ) public view returns (bytes32) {
        return keccak256(abi.encode(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amountOutMin,
            salt
        ));
    }
}
```

**Usage:**

```javascript
// Off-chain: Generate commitment
const salt = ethers.utils.randomBytes(32);
const commitHash = await contract.generateCommitHash(
  tokenA,
  tokenB,
  amountIn,
  amountOutMin,
  salt
);

// Step 1: Commit (hide parameters)
await contract.commit(commitHash);
console.log('Committed. Waiting 30 seconds...');

// Wait for delay
await new Promise(resolve => setTimeout(resolve, 35000));

// Step 2: Reveal and execute
await contract.reveal(tokenA, tokenB, amountIn, amountOutMin, salt);
console.log('Swap executed with sandwich protection!');
```

### 4. Oracle-Based Minimum Output

**Concept:** Use Chainlink or other oracle for fair price.

```solidity
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract OracleProtectedSwap {
    AggregatorV3Interface public priceFeed;

    constructor(address _priceFeed) {
        priceFeed = AggregatorV3Interface(_priceFeed);
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 userMinOut
    ) external returns (uint256) {
        // Get oracle price
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price");

        // Calculate fair output based on oracle
        uint256 oracleExpectedOut = (amountIn * uint256(price)) / 1e8;

        // Allow small tolerance (0.5%) for legitimate slippage
        uint256 oracleMinOut = (oracleExpectedOut * 995) / 1000;

        // Use stricter of user or oracle minimum
        uint256 minOut = userMinOut > oracleMinOut ? userMinOut : oracleMinOut;

        // Execute swap
        // If spot price deviates >0.5% from oracle = sandwich
        // Transaction reverts

        return executeSwap(tokenIn, tokenOut, amountIn, minOut);
    }
}
```

---

## Transaction Timing Strategies

### 1. Deadline Protection

**Always set short deadlines:**

```javascript
// ❌ BAD: No deadline or far future
const deadline = Math.floor(Date.now() / 1000) + 86400; // 24 hours

// ✅ GOOD: Short deadline
const deadline = Math.floor(Date.now() / 1000) + 180; // 3 minutes

// Why: If sandwiched and stuck in mempool,
// transaction reverts after 3 minutes
// Prevents execution at stale, manipulated price
```

```solidity
function swapWithDeadline(
    uint256 amountIn,
    uint256 amountOutMin,
    address[] calldata path,
    address to,
    uint256 deadline
) external {
    require(block.timestamp <= deadline, "Transaction expired");

    // Execute swap
    // If sandwiched and delayed, deadline ensures revert
}
```

### 2. Randomized Submission Timing

**For repeated trades:**

```javascript
async function submitWithRandomDelay(tx) {
  // Random delay 0-10 seconds
  const delay = Math.random() * 10000;

  await new Promise(resolve => setTimeout(resolve, delay));

  // Submit transaction
  await wallet.sendTransaction(tx);

  // Makes it harder for bots to predict your pattern
}
```

### 3. Avoid Peak Times

**Gas price correlation with MEV:**

```javascript
async function shouldTrade() {
  const gasPrice = await provider.getGasPrice();
  const gasPriceGwei = parseInt(gasPrice.toString()) / 1e9;

  if (gasPriceGwei > 200) {
    return {
      trade: false,
      reason: 'High gas = high MEV activity. Wait or use protection.'
    };
  }

  if (gasPriceGwei > 100) {
    return {
      trade: true,
      reason: 'Moderate gas. Recommend using Flashbots Protect.',
      useProtection: true
    };
  }

  return {
    trade: true,
    reason: 'Normal gas levels.',
    useProtection: false
  };
}
```

---

## Advanced Protection Techniques

### 1. Transaction Bundling

**Create atomic multi-step operations:**

```javascript
// Example: Swap + Stake in one bundle
async function atomicSwapAndStake() {
  // Transaction 1: Swap
  const swapTx = await wallet.signTransaction({
    to: UNISWAP_ROUTER,
    data: swapCalldata,
    nonce: nonce,
    // ... other params
  });

  // Transaction 2: Stake (uses output from swap)
  const stakeTx = await wallet.signTransaction({
    to: STAKING_CONTRACT,
    data: stakeCalldata,
    nonce: nonce + 1,
    // ... other params
  });

  // Submit as Flashbots bundle
  const bundle = [swapTx, stakeTx];

  await flashbotsProvider.sendRawBundle(bundle, targetBlock);

  // Benefits:
  // - Atomic execution (all or nothing)
  // - No sandwich between steps
  // - More complex strategies possible
}
```

### 2. MEV-Share

**Earn from your own MEV:**

```javascript
// Using MEV-Share to capture your own back-running value
import { MevShareClient } from '@flashbots/mev-share-client';

const mevShareClient = new MevShareClient(authSigner, {
  name: 'my-mev-share-client',
  baseUrl: 'https://mev-share.flashbots.net'
});

// Send transaction with hint for searchers
const tx = await wallet.signTransaction(swapTx);

const result = await mevShareClient.sendTransaction(tx, {
  hints: {
    calldata: true,  // Share calldata
    logs: true,      // Share logs
    hash: true       // Share hash
  },
  // Set refund percentage
  refundConfig: {
    minRefundPercent: 90  // Keep 90% of MEV
  }
});

// You earn from searchers who back-run your trade!
console.log('MEV-Share enabled. You will earn rebates!');
```

### 3. Order Flow Auctions

**Let market makers compete for your order:**

```javascript
// Using 1inch Fusion for order flow auction
import { FusionSDK } from '@1inch/fusion-sdk';

const sdk = new FusionSDK({
  url: 'https://fusion.1inch.io',
  network: 1
});

// Create fusion order
const order = await sdk.createOrder({
  srcToken: TOKEN_A,
  dstToken: TOKEN_B,
  srcAmount: amountIn.toString(),
  dstMinAmount: amountOutMin.toString(),
  walletAddress: wallet.address
});

// Market makers compete to fill your order
// Winner pays you the best price
// No sandwich possible (private auction)

await sdk.submitOrder(order);
```

### 4. Intent-Based Systems

**Express intent, let solver handle execution:**

```
Traditional:
You: "Swap 1000 USDC for ETH at price X"
     └─> Sent to mempool (visible)
     └─> Can be sandwiched

Intent-Based:
You: "I want to end up with ~0.5 ETH from 1000 USDC"
     └─> Sent to solver network (private)
     └─> Solver finds best execution
     └─> No MEV possible

Examples: CoW Protocol, UniswapX, 1inch Fusion
```

---

## Implementation Examples

### Complete Protected Swap Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SandwichProtectedSwap
 * @notice Multi-layered sandwich attack protection
 */
contract SandwichProtectedSwap is Ownable {
    IUniswapV2Router02 public immutable router;

    // Protection parameters
    uint256 public maxGasPrice = 500 gwei;
    uint256 public maxSlippage = 50; // 0.5% in basis points
    uint256 public maxDeadline = 5 minutes;
    uint256 public minTradeSize = 0.01 ether;
    uint256 public maxPoolImpact = 200; // 2%

    // Whitelist for trusted users
    mapping(address => bool) public whitelist;

    // Events
    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    event ProtectionTriggered(
        address indexed user,
        string reason
    );

    constructor(address _router) {
        router = IUniswapV2Router02(_router);
    }

    /**
     * @notice Execute protected swap
     */
    function protectedSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 expectedAmountOut
    ) external returns (uint256) {
        // Layer 1: Gas price check
        require(
            tx.gasprice <= maxGasPrice || whitelist[msg.sender],
            "Gas price too high"
        );

        // Layer 2: Trade size check
        require(amountIn >= minTradeSize, "Trade too small");

        // Layer 3: Pool impact check
        address pair = getPair(tokenIn, tokenOut);
        (uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(pair).getReserves();
        uint256 reserveIn = tokenIn < tokenOut ? reserve0 : reserve1;

        uint256 poolImpact = (amountIn * 10000) / reserveIn;
        require(
            poolImpact <= maxPoolImpact || whitelist[msg.sender],
            "Trade impact too large"
        );

        // Layer 4: Strict slippage
        uint256 minAmountOut = (expectedAmountOut * (10000 - maxSlippage)) / 10000;

        // Layer 5: Short deadline
        uint256 deadline = block.timestamp + maxDeadline;

        // Transfer tokens
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(address(router), amountIn);

        // Execute swap
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        uint256[] memory amounts = router.swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            msg.sender,
            deadline
        );

        emit SwapExecuted(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amounts[1]
        );

        return amounts[1];
    }

    /**
     * @notice Advanced swap with TWAP check
     */
    function protectedSwapWithTWAP(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 expectedAmountOut,
        uint256 twapPrice
    ) external returns (uint256) {
        // Get current spot price
        uint256 spotPrice = getCurrentPrice(tokenIn, tokenOut);

        // Compare spot vs TWAP (allow 0.5% deviation)
        uint256 priceDiff = spotPrice > twapPrice
            ? ((spotPrice - twapPrice) * 10000) / twapPrice
            : ((twapPrice - spotPrice) * 10000) / twapPrice;

        require(
            priceDiff <= 50,
            "Price deviation from TWAP too high - possible sandwich"
        );

        // Execute protected swap
        return protectedSwap(tokenIn, tokenOut, amountIn, expectedAmountOut);
    }

    /**
     * @notice Update protection parameters
     */
    function updateProtection(
        uint256 _maxGasPrice,
        uint256 _maxSlippage,
        uint256 _maxPoolImpact
    ) external onlyOwner {
        maxGasPrice = _maxGasPrice;
        maxSlippage = _maxSlippage;
        maxPoolImpact = _maxPoolImpact;
    }

    /**
     * @notice Add to whitelist (for advanced users)
     */
    function addToWhitelist(address user) external onlyOwner {
        whitelist[user] = true;
    }

    // Internal helpers
    function getPair(address tokenA, address tokenB) internal view returns (address) {
        return IUniswapV2Factory(router.factory()).getPair(tokenA, tokenB);
    }

    function getCurrentPrice(address tokenIn, address tokenOut) internal view returns (uint256) {
        address pair = getPair(tokenIn, tokenOut);
        (uint256 reserve0, uint256 reserve1, ) = IUniswapV2Pair(pair).getReserves();

        if (tokenIn < tokenOut) {
            return (reserve1 * 1e18) / reserve0;
        } else {
            return (reserve0 * 1e18) / reserve1;
        }
    }
}
```

### Frontend Integration with Protection

```javascript
import { ethers } from 'ethers';

class ProtectedSwapUI {
  constructor(walletProvider) {
    this.provider = walletProvider;
    this.protectionLevel = 'high'; // low, medium, high
  }

  async executeProtectedSwap(params) {
    const {
      tokenIn,
      tokenOut,
      amountIn,
      userSlippage
    } = params;

    // Step 1: Analyze trade
    const analysis = await this.analyzeTrade(params);

    // Step 2: Choose protection method
    const protection = this.selectProtection(analysis);

    // Step 3: Execute with chosen protection
    switch (protection.method) {
      case 'flashbots':
        return this.executeViaFlashbots(params);

      case 'cow':
        return this.executeViaCow(params);

      case 'contract':
        return this.executeViaContract(params);

      default:
        return this.executeStandard(params);
    }
  }

  async analyzeTrade(params) {
    const { amountIn, tokenIn, tokenOut } = params;

    // Get pool liquidity
    const liquidity = await this.getPoolLiquidity(tokenIn, tokenOut);

    // Calculate impact
    const impact = (amountIn / liquidity) * 100;

    // Get current gas price
    const gasPrice = await this.provider.getGasPrice();
    const gasPriceGwei = parseInt(gasPrice.toString()) / 1e9;

    // Assess risk
    let risk = 'low';
    if (impact > 2 || gasPriceGwei > 200) risk = 'high';
    else if (impact > 1 || gasPriceGwei > 100) risk = 'medium';

    return {
      impact,
      gasPrice: gasPriceGwei,
      risk,
      liquidity
    };
  }

  selectProtection(analysis) {
    // High risk: Use Flashbots or CoW
    if (analysis.risk === 'high') {
      return {
        method: 'flashbots',
        reason: 'High risk of sandwich attack',
        message: '🛡️ Using Flashbots Protect for maximum security'
      };
    }

    // Medium risk: Use CoW or contract
    if (analysis.risk === 'medium') {
      return {
        method: 'cow',
        reason: 'Moderate risk detected',
        message: '🛡️ Using CoW Protocol for protection'
      };
    }

    // Low risk: Standard with tight slippage
    return {
      method: 'standard',
      reason: 'Low risk trade',
      message: '✅ Standard execution with tight slippage'
    };
  }

  async executeViaFlashbots(params) {
    // Switch to Flashbots RPC
    const flashbotsProvider = new ethers.providers.JsonRpcProvider(
      'https://rpc.flashbots.net'
    );

    const wallet = this.provider.getSigner().connectUnchecked();

    // Execute swap via Flashbots
    const tx = await this.buildSwapTransaction(params);

    const result = await wallet.sendTransaction(tx);

    return {
      hash: result.hash,
      protection: 'flashbots',
      message: 'Transaction sent via Flashbots - sandwich protection enabled'
    };
  }

  async executeViaCow(params) {
    const { CowSdk, OrderKind } = await import('@cowprotocol/cow-sdk');

    const cowSdk = new CowSdk(1, {
      signer: this.provider.getSigner()
    });

    // Create CoW order
    const order = await cowSdk.cowApi.sendOrder({
      sellToken: params.tokenIn,
      buyToken: params.tokenOut,
      sellAmount: params.amountIn.toString(),
      kind: OrderKind.SELL,
      partiallyFillable: false
    });

    return {
      orderId: order,
      protection: 'cow',
      message: 'Order submitted to CoW Protocol - sandwich protection enabled'
    };
  }

  async buildSwapTransaction(params) {
    // Build Uniswap swap transaction
    // ... implementation
  }

  async getPoolLiquidity(tokenA, tokenB) {
    // Get pool reserves
    // ... implementation
  }
}

// Usage in React/Vue component
async function handleSwap() {
  const protectedSwap = new ProtectedSwapUI(provider);

  try {
    const result = await protectedSwap.executeProtectedSwap({
      tokenIn: USDC_ADDRESS,
      tokenOut: ETH_ADDRESS,
      amountIn: ethers.utils.parseUnits('1000', 6),
      userSlippage: 0.005 // 0.5%
    });

    console.log(result.message);
    alert(`✅ ${result.message}`);

  } catch (error) {
    console.error('Swap failed:', error);
    alert('❌ Swap failed: ' + error.message);
  }
}
```

---

## Protection Checklist

### For Users (Essential)

- [ ] **Use Flashbots Protect RPC** for all trades >$1,000
- [ ] **Set slippage ≤1%** for major pairs
- [ ] **Set slippage ≤0.5%** for stablecoins
- [ ] **Add 3-minute deadline** to all transactions
- [ ] **Avoid trading during high gas** (>150 gwei)
- [ ] **Consider CoW Protocol** for large swaps
- [ ] **Use limit orders** when not urgent
- [ ] **Monitor transactions** for sandwich patterns
- [ ] **Enable MEV-Blocker** to earn rebates

### For Developers (dApp Integration)

- [ ] **Integrate Flashbots Protect** as default RPC
- [ ] **Implement dynamic slippage** calculation
- [ ] **Add sandwich detection** warnings
- [ ] **Suggest CoW Protocol** for large trades
- [ ] **Display protection status** in UI
- [ ] **Add gas price warnings** (>150 gwei alert)
- [ ] **Implement deadline enforcement**
- [ ] **Add educational tooltips** about MEV
- [ ] **Track sandwich incidents** for users
- [ ] **Offer protection comparison** (Flashbots vs CoW vs Standard)

### For Smart Contract Developers

- [ ] **Implement gas price limits**
- [ ] **Add TWAP price checks**
- [ ] **Consider commit-reveal** for sensitive ops
- [ ] **Use oracle prices** for validation
- [ ] **Add whitelist** for advanced users
- [ ] **Emit protection events**
- [ ] **Test against sandwich simulations**
- [ ] **Document protection mechanisms**
- [ ] **Audit security measures**
- [ ] **Monitor on-chain for attacks**

---

## Best Practices

### General Principles

1. **Defense in Depth**
   - Use multiple protection layers
   - Don't rely on single method
   - Combine technical + behavioral protections

2. **Education First**
   - Understand how sandwiches work
   - Know when you're at risk
   - Stay informed about new protections

3. **Use Free Tools**
   - Flashbots Protect: Free, effective
   - CoW Protocol: Free, often better prices
   - MEV-Blocker: Free, earn rebates

### Trade Size Strategies

```javascript
// Small trades (<$1k): Standard execution acceptable
if (tradeValue < 1000) {
  slippage = 0.01; // 1%
  protection = 'standard';
}

// Medium trades ($1k-$10k): Use protection
else if (tradeValue < 10000) {
  slippage = 0.005; // 0.5%
  protection = 'flashbots';
}

// Large trades (>$10k): Maximum protection
else {
  slippage = 0.003; // 0.3%
  protection = 'cow'; // Or split trade

  if (tradeValue > 100000) {
    alert('Consider splitting into multiple trades');
  }
}
```

### Gas Price Guidelines

```javascript
const gasPrice = await provider.getGasPrice();
const gwei = parseInt(gasPrice) / 1e9;

if (gwei < 50) {
  console.log('✅ Safe to trade - low MEV activity');
}
else if (gwei < 100) {
  console.log('⚠️ Moderate gas - use basic protection');
}
else if (gwei < 200) {
  console.log('⚠️ High gas - use Flashbots Protect');
}
else {
  console.log('❌ Very high gas - high MEV activity. Wait or use CoW Protocol');
}
```

### When to Use Each Protection

| Scenario | Best Protection | Why |
|----------|----------------|-----|
| Quick stablecoin swap <$1k | Tight slippage (0.1%) | Low risk, not worth sandwich |
| ETH/USDC swap $5k | Flashbots Protect | Free, instant, 100% effective |
| Large trade >$50k | CoW Protocol | Batch auction, best price |
| High gas period | CoW Protocol or wait | Avoid gas war with bots |
| Multiple steps | Flashbots bundle | Atomic execution |
| Want MEV rebates | MEV-Blocker | Earn from your MEV |
| Time-sensitive | Flashbots Protect | Fast + protected |
| Not urgent | Limit order | Perfect execution |

---

## Summary

### Key Takeaways

1. **Sandwich attacks are preventable** - 100% protection available for free
2. **Use Flashbots Protect** - Easiest, most effective solution
3. **CoW Protocol for large trades** - Better prices + protection
4. **Tight slippage is your friend** - But use protection for reliability
5. **Education matters** - Understand when you're at risk
6. **Multiple layers work best** - Combine protections
7. **Monitor your transactions** - Learn from patterns

### Most Important Actions

**For Everyone:**
1. Switch to Flashbots Protect RPC (2 minutes, free)
2. Set slippage to 0.5-1% maximum
3. Use CoW Protocol for swaps >$10k

**For Developers:**
1. Integrate Flashbots by default
2. Add sandwich detection warnings
3. Suggest CoW for large trades

**For Protocols:**
1. Implement MEV-sharing
2. Support intent-based execution
3. Add protection layers to contracts

### Resources

- **Flashbots Protect:** https://protect.flashbots.net
- **CoW Protocol:** https://cow.fi
- **MEV-Blocker:** https://mevblocker.io
- **1inch Fusion:** https://1inch.io/fusion
- **MEV Research:** https://writings.flashbots.net

---

**Remember:** Sandwich attacks are the most harmful MEV type, but they're also the most preventable. Use the free tools available (Flashbots, CoW Protocol, MEV-Blocker) and you'll never be sandwiched again!
