**Source:** https://docs.furucombo.app/using-furucombo/tutorials/flashloan-combo

# Furucombo Flashloan Tutorial

## What is Furucombo?

Furucombo is a no-code DeFi tool that allows users to build complex DeFi strategies through a visual interface, including flash loan arbitrage without writing smart contracts.

## What Are Flash Loans?

Flash loans allow borrowers to access liquidity without collateral, provided the loan is repaid within the same transaction.

## Three Flash Loan Providers

Furucombo supports three main flash loan providers:

### 1. Aave
- **Tokens Supported:** 22 tokens
- **Fee:** 0.09%
- **Best For:** Wide variety of assets

### 2. dYdX
- **Tokens Supported:** 3 tokens (DAI, USDC, ETH)
- **Fee:** Zero (0%)
- **Best For:** Cost-free borrowing of major assets

### 3. Uniswap V2
- **Tokens Supported:** 100+ tokens
- **Fee:** 0.3%
- **Best For:** Long-tail assets and tokens not on Aave/dYdX

## Primary Use Case: Arbitrage

**Key Point:** Flash loans enable profitable arbitrage—buying low on one exchange and selling high on another.

**Important Note:** Furucombo doesn't identify arbitrage opportunities; users must discover them independently and use the platform for execution.

## Step-by-Step Tutorial: Real Arbitrage Example

The tutorial demonstrates a profitable arbitrage between DAI and sUSD across different exchanges.

### The Opportunity

- **Uniswap V1:** 100 DAI → ~122.84 sUSD
- **Kyberswap:** 122.84 sUSD → ~122.83 DAI
- **Net Difference:** 22.83 DAI profit potential

### Building the Combo

**Step 1: Add Uniswap V1 Swap**
```
Action: Swap
From: 100 DAI
To: ~122.84 sUSD
Platform: Uniswap V1
```

**Step 2: Add Kyberswap Swap**
```
Action: Swap
From: 122.84 sUSD
To: ~122.83 DAI
Platform: Kyberswap
```

**Step 3: Add Flashloan Cube**
```
Action: Flash Loan
Amount: 100 DAI
Provider: Aave
Fee: 0.09% (0.09 DAI)
```

**Step 4: Reorder Execution**
```
Move the flash loan cube to the top:
1. Borrow 100 DAI (Aave Flash Loan)
2. Swap 100 DAI → 122.84 sUSD (Uniswap V1)
3. Swap 122.84 sUSD → 122.83 DAI (Kyberswap)
4. Repay 100.09 DAI (100 + 0.09% fee)
5. Keep remaining ~22.74 DAI as profit
```

**Step 5: Connect Wallet and Execute**
- Connect Web3 wallet (MetaMask, etc.)
- Review transaction details
- Confirm and execute
- Wait for transaction confirmation

### Profit Calculation

```
Starting Capital: 0 DAI (flash loan)
Borrowed: 100 DAI
After Swap 1: 122.84 sUSD
After Swap 2: 122.83 DAI
Flash Loan Repayment: 100.09 DAI (100 + 0.09%)
Net Profit: ~22.74 DAI
Cost: Only gas fees in ETH
```

## Key Requirements

### For Users

**1. ETH for Gas**
- Must have ETH in wallet
- Covers transaction execution costs
- Varies by network congestion
- Estimate before executing

**2. Arbitrage Opportunities**
- Must identify opportunities yourself
- Profit must exceed flash loan fee
- Account for gas costs
- Monitor in real-time

**3. Wallet Connection**
- Compatible Web3 wallet
- Sufficient ETH balance
- Proper network selection
- Security best practices

## Advantages of Furucombo

### 1. No Coding Required
- Visual drag-and-drop interface
- No smart contract development
- No Solidity knowledge needed
- Accessible to non-developers

### 2. Instant Deployment
- No contract deployment
- No testing phase
- Immediate execution
- Quick strategy iteration

### 3. Visual Strategy Building
- See the entire flow
- Easy to modify
- Clear profit calculations
- Intuitive interface

### 4. Multiple Protocol Support
- Connect to major DeFi protocols
- Mix and match platforms
- Complex multi-step strategies
- All in one interface

### 5. Risk Reduction
- Simulates before execution
- Shows expected outcomes
- Validates combos
- Clear error messages

## Supported Protocols in Furucombo

The platform integrates with numerous DeFi protocols:

**DEXs:**
- Uniswap (V1, V2, V3)
- SushiSwap
- Curve
- Balancer
- KyberSwap
- 1inch

**Lending:**
- Aave
- Compound
- Cream Finance

**Flash Loans:**
- Aave
- dYdX
- Uniswap V2

**Others:**
- Maker (DAI)
- Various liquidity pools
- Token bridges

## Building More Complex Combos

### Multi-Step Arbitrage
```
1. Flash Loan 1000 DAI
2. Swap DAI → USDC (Uniswap)
3. Swap USDC → USDT (Curve)
4. Swap USDT → DAI (SushiSwap)
5. Repay Flash Loan + Fee
6. Keep Profit
```

### Collateral Swap
```
1. Flash Loan ETH
2. Deposit ETH to Aave
3. Borrow DAI against ETH
4. Swap DAI to repay original debt
5. Withdraw original collateral
6. Repay Flash Loan ETH
```

### Leveraged Farming
```
1. Flash Loan Token A
2. Deposit Token A in lending protocol
3. Borrow Token B
4. Swap Token B → Token A
5. Deposit Token A again
6. Borrow more Token B
7. Use Token B to repay flash loan
```

## Profit Optimization Tips

### 1. Choose Right Flash Loan Provider
- **dYdX:** Zero fee for DAI, USDC, ETH
- **Aave:** 0.09% for wider asset selection
- **Uniswap V2:** 0.3% for rare tokens

**Example:**
```
Borrow 10,000 DAI:
- dYdX: 0 DAI fee
- Aave: 9 DAI fee (0.09%)
- Uniswap V2: 30 DAI fee (0.3%)
```

### 2. Monitor Gas Prices
- Execute during low-congestion periods
- Use gas trackers
- Set reasonable gas limits
- Factor gas into profitability

### 3. Account for Slippage
- Price changes during execution
- Set appropriate slippage tolerance
- Larger trades = more slippage
- Monitor liquidity depth

### 4. Quick Execution
- Arbitrage opportunities disappear quickly
- Have combo ready
- Execute immediately when opportunity appears
- Use Furucombo's simulation feature

## Risk Considerations

### 1. Transaction Failure
If any step in the combo fails:
- Entire transaction reverts
- You only lose gas fees
- No flash loan repayment required (transaction never completes)
- Capital preserved

### 2. Negative Profit
```
Opportunity Changes:
- Price moves against you
- Slippage higher than expected
- Gas costs exceed profit
→ Transaction should be rejected before execution
```

### 3. Smart Contract Risk
- Furucombo contracts audited
- Still carries smart contract risk
- Use reputable protocols
- Start with small amounts

### 4. Market Competition
- Many bots scanning for same opportunities
- Fast execution critical
- Opportunities may disappear
- Profit margins thin

## Real-World Considerations

### Profitability Reality

**Small Opportunities:**
```
Profit: 20 DAI
Gas Cost: 0.01 ETH (~$20-$40)
Flash Loan Fee: 0.09 DAI
Net: May be unprofitable after gas
```

**Larger Opportunities:**
```
Profit: 500 DAI
Gas Cost: 0.01 ETH (~$20-$40)
Flash Loan Fee: 0.90 DAI
Net: More likely profitable
```

### Competition

- Bots execute in milliseconds
- Manual execution slower
- Opportunities disappear quickly
- Need to be fast or find unique angles

### Gas Price Impact

```
Low Gas (20 gwei): $5 transaction
High Gas (200 gwei): $50 transaction

Minimum profitable arbitrage increases with gas
```

## Tutorial Key Takeaways

1. **Zero Capital Required:** Flash loans enable arbitrage with no starting capital
2. **No Coding Needed:** Furucombo's visual interface accessible to all
3. **Multiple Protocols:** Connect many DeFi platforms in one transaction
4. **Atomic Execution:** All-or-nothing transaction ensures safety
5. **Gas Cost Only:** Only cost is ETH for gas (if unprofitable, don't execute)
6. **Must Find Opportunities:** Platform doesn't identify arbitrage for you
7. **Quick Execution:** Speed critical in competitive market
8. **Fee Awareness:** Choose provider wisely (dYdX = 0%, Aave = 0.09%, Uni = 0.3%)

## Comparison: Furucombo vs Smart Contract Bots

| Aspect | Furucombo | Custom Smart Contract |
|--------|-----------|----------------------|
| Coding Required | No | Yes (Solidity) |
| Speed | Manual execution | Automated/instant |
| Flexibility | Limited to UI | Complete control |
| Setup Time | Minutes | Days/weeks |
| Testing Required | Simulation only | Extensive testing |
| Gas Efficiency | Good | Optimizable |
| Customization | Limited | Unlimited |
| Maintenance | None | Ongoing |
| Best For | Manual strategies | Automated bots |

## Getting Started with Furucombo

### Prerequisites
1. Web3 wallet (MetaMask)
2. ETH for gas fees
3. Understanding of DeFi protocols
4. Ability to identify arbitrage opportunities

### First Steps
1. Visit Furucombo website
2. Connect wallet
3. Explore example combos
4. Build simple test combo
5. Simulate before executing
6. Start with small amounts
7. Learn from each transaction

## Conclusion

Furucombo provides an accessible entry point for flash loan arbitrage:

**Advantages:**
- No-code solution
- Quick experimentation
- Visual strategy building
- Low barrier to entry

**Limitations:**
- Manual execution (slower than bots)
- Limited to supported protocols
- Competitive market
- Gas costs eat into profit

**Best Use Case:**
- Learning flash loan mechanics
- Testing arbitrage strategies
- Occasional manual arbitrage
- Educational purposes

For serious, automated arbitrage, consider developing custom smart contracts with bot automation (as described in other context files), but Furucombo offers an excellent starting point for understanding flash loan arbitrage mechanics without the technical complexity.
