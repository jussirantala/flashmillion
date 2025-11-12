# Sandwich Attack Bot - Educational Implementation

**⚠️ FOR EDUCATIONAL USE ONLY - PRIVATE BLOCKCHAIN ONLY**

This is a complete TypeScript implementation of a sandwich attack MEV bot for educational purposes. It demonstrates how sandwich attacks work and should ONLY be used on private blockchains or testnets.

## What is a Sandwich Attack?

A sandwich attack is a type of MEV (Maximal Extractable Value) attack where a bot:

1. **Detects** a large pending swap transaction in the mempool
2. **Frontruns** the victim by buying the same token (pushing price up)
3. **Victim's transaction executes** at the inflated price
4. **Backruns** by selling the token immediately (profiting from price increase)

```
Block N:
├─ Frontrun tx (bot buy)  → Price goes UP
├─ Victim tx (their swap) → Executes at high price
└─ Backrun tx (bot sell)  → Bot profits from price difference
```

## Architecture

```
┌──────────────────┐
│ Mempool Monitor  │ ← Listens for pending swaps via WebSocket
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Profit Calculator│ ← Simulates sandwich using Uniswap formula
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Sandwich Executor│ ← Executes frontrun + backrun transactions
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Smart Contract   │ ← On-chain sandwich execution
└──────────────────┘
```

## Components

### 1. Mempool Monitor (`src/mempoolMonitor.ts`)
- Connects to WebSocket RPC endpoint
- Listens for pending transactions
- Detects Uniswap V2 swap transactions
- Parses swap parameters (tokens, amounts, etc.)

### 2. Profit Calculator (`src/profitCalculator.ts`)
- Fetches Uniswap V2 pair reserves
- Simulates the three-step sandwich:
  - Frontrun impact on price
  - Victim transaction execution
  - Backrun profit calculation
- Uses constant product formula: `x * y = k`
- Accounts for 0.3% Uniswap fee
- Estimates gas costs
- Determines net profitability

### 3. Sandwich Executor (`src/sandwichExecutor.ts`)
- Manages wallet and transaction signing
- Executes sandwich via smart contract
- Handles gas price bidding (120% of victim's gas)
- Reports execution results

### 4. Smart Contract (`contracts/SandwichContract.sol`)
- Executes atomic sandwich on-chain
- Handles token approvals
- Swaps via Uniswap V2 Router
- Includes profit validation
- Owner-only controls
- Emergency withdrawal functions

## Installation

```bash
# Clone the repository
cd sandwich-bot

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## Configuration

Edit `.env` file:

```env
# Your private blockchain RPC endpoints
RPC_URL=http://127.0.0.1:8545
WS_URL=ws://127.0.0.1:8545

# Private key (NEVER use real funds)
PRIVATE_KEY=0x...

# Uniswap V2 addresses on your network
UNISWAP_V2_ROUTER=0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
UNISWAP_V2_FACTORY=0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f
WETH_ADDRESS=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2

# Bot settings
MIN_PROFIT_USD=10
MAX_GAS_PRICE_GWEI=50
SLIPPAGE_TOLERANCE=0.5
MAX_POSITION_SIZE_ETH=1

# Safety: Keep false for dry-run mode
ENABLE_EXECUTION=false
```

## Deployment

### Step 1: Install Hardhat (for contract compilation)

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
```

### Step 2: Compile the smart contract

```bash
npx hardhat compile
```

### Step 3: Deploy the sandwich contract

```bash
npx hardhat run scripts/deploy.ts --network localhost
```

Save the deployed contract address and add it to `.env`:

```env
SANDWICH_CONTRACT_ADDRESS=0x...
```

### Step 4: Fund the contract

Send some ETH and tokens to the contract address so it can execute swaps.

## Running the Bot

### Dry Run Mode (Recommended First)

```bash
# Keep ENABLE_EXECUTION=false in .env
npm run dev
```

This will:
- Monitor the mempool
- Detect swap transactions
- Calculate profitability
- Log opportunities
- **NOT execute** any transactions

### Execution Mode (Use with Caution)

```bash
# Set ENABLE_EXECUTION=true in .env
npm start
```

This will **actually execute** sandwich attacks when profitable opportunities are detected.

## Understanding the Output

```
==========================================================
🎯 SANDWICH OPPORTUNITY DETECTED
==========================================================
Victim TX: 0x1234...
Token Pair: 0xC02a... -> 0x1f9840...
Victim Amount: 1000000000000000000
Frontrun Amount: 100000000000000000
Estimated Profit: 50000000000000000 (5.00%)
Gas Cost: 30000000000000000
==========================================================
```

**Explanation:**
- **Victim TX**: The transaction we're sandwiching
- **Token Pair**: Which tokens are being swapped
- **Victim Amount**: How much they're swapping
- **Frontrun Amount**: How much we'll use (typically 10% of victim)
- **Estimated Profit**: Expected profit after gas costs
- **Gas Cost**: Estimated gas fees for frontrun + backrun

## How It Works (Technical Details)

### 1. Mempool Detection

```typescript
// Listen for pending transactions
provider.on('pending', async (txHash) => {
  const tx = await provider.getTransaction(txHash);

  // Check if it's a Uniswap swap
  if (tx.to === UNISWAP_V2_ROUTER) {
    parseAndAnalyze(tx);
  }
});
```

### 2. Profit Simulation

```typescript
// Uniswap V2 constant product formula
function getAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn * 997; // 0.3% fee
  const numerator = amountInWithFee * reserveOut;
  const denominator = (reserveIn * 1000) + amountInWithFee;
  return numerator / denominator;
}

// Simulate sandwich
1. frontrunOutput = getAmountOut(frontrunAmount, reserveIn, reserveOut)
2. newReserves = updateReserves(frontrunOutput)
3. victimOutput = getAmountOut(victimAmount, newReserves)
4. finalReserves = updateReserves(victimOutput)
5. backrunOutput = getAmountOut(frontrunOutput, finalReserves)
6. profit = backrunOutput - frontrunAmount - gasCosts
```

### 3. Execution Strategy

```typescript
// Frontrun: Use 120% of victim's gas price
frontrunGasPrice = victimGasPrice * 1.2

// Execute sandwich via smart contract
await sandwichContract.executeSandwich(
  tokenIn,
  tokenOut,
  frontrunAmount,
  minProfit,
  { gasPrice: frontrunGasPrice }
)
```

## Safety Features

1. **Dry Run Mode**: Test without executing transactions
2. **Minimum Profit Threshold**: Only execute if profit > gas costs
3. **Maximum Position Size**: Limit capital at risk
4. **Owner-Only Contract**: Only your wallet can call sandwich functions
5. **Emergency Withdrawal**: Recover funds anytime

## Testing Checklist

- [ ] Set up private blockchain (Hardhat, Ganache, or Anvil)
- [ ] Deploy Uniswap V2 contracts (Router, Factory, Pairs)
- [ ] Create test token pairs with liquidity
- [ ] Deploy sandwich contract
- [ ] Fund sandwich contract with ETH and tokens
- [ ] Configure `.env` correctly
- [ ] Test in dry-run mode first
- [ ] Generate test swap transactions
- [ ] Verify profit calculations
- [ ] Test actual execution (if desired)

## Educational Insights

### Why Sandwich Attacks Work

1. **AMM Design**: Constant product formula means large trades move price
2. **Mempool Visibility**: Pending transactions are public
3. **Gas Price Auction**: Higher gas = earlier execution
4. **Atomic Execution**: All three txs in same block = guaranteed profit

### Why They're Harmful

1. **Extracts value from regular users** (0.5-2% per trade)
2. **Increases slippage** beyond user's settings
3. **Degrades DeFi UX** for everyone
4. **Potentially illegal** in some jurisdictions

### Defenses Against Sandwiches

1. **Private Transactions**: Flashbots Protect, MEV-Blocker
2. **Low Slippage**: Set tight slippage tolerance
3. **Limit Orders**: Use CoW Protocol or 1inch Limit Orders
4. **MEV-Resistant DEXs**: Cowswap, Hashflow
5. **L2 Networks**: Faster blocks reduce MEV window

## Performance Considerations

### Latency Breakdown

- **Mempool Detection**: 50-100ms (WebSocket)
- **Profit Calculation**: 10-50ms (RPC calls)
- **Transaction Submission**: 50-200ms
- **Total**: ~100-350ms

**For production bots:**
- Need <10ms latency
- Requires custom infrastructure
- Direct block builder connections
- Co-location with validators

## Limitations of This Educational Bot

1. **Simplified Profit Calculation**: Real bots use more sophisticated models
2. **No Multi-Hop Support**: Only handles direct pair swaps
3. **No Salmonella Detection**: Doesn't check for honeypot tokens
4. **Basic Gas Bidding**: Real bots use dynamic gas strategies
5. **Single DEX**: Only Uniswap V2 (real bots monitor many DEXs)
6. **No Bundle Support**: Doesn't use Flashbots bundles

## Next Steps for Learning

1. **Study the code**: Understand each module
2. **Run simulations**: Test on private chain
3. **Analyze real MEV**: Look at Etherscan MEV transactions
4. **Read advanced guides**: Check `/context/tutorials/` in this repo
5. **Learn defenses**: Understand how to protect against MEV
6. **Ethical considerations**: Think about the impact of MEV

## Resources

- **Uniswap V2 Docs**: https://docs.uniswap.org/contracts/v2/overview
- **Flashbots Docs**: https://docs.flashbots.net
- **MEV Research**: https://research.paradigm.xyz/MEV
- **This Project's Guides**: `/context/tutorials/understanding-sandwich-attacks.md`

## Legal and Ethical Disclaimer

**⚠️ IMPORTANT:**

- This code is for **educational purposes ONLY**
- Sandwich attacks **harm regular users**
- May be **illegal** in your jurisdiction
- Can constitute **market manipulation**
- Only use on **private blockchains or testnets**
- **NEVER use on mainnet** with real funds
- **NEVER sandwich real users**

By using this code, you acknowledge:
1. You understand the ethical implications
2. You will only use it for education/research
3. You will not harm real users
4. You accept full responsibility for your actions

## License

MIT License - For Educational Use Only

## Questions?

This is part of the Flash Million educational repository. See:
- `/context/tutorials/` for more guides
- `/context/INDEX.md` for all documentation
- `CLAUDE.md` for project overview

---

**Remember**: MEV extraction harms the DeFi ecosystem. Use this knowledge to:
- Understand MEV mechanics
- Build MEV protections
- Design MEV-resistant protocols
- Educate others about MEV risks

**DO NOT** use it to extract value from real users.
