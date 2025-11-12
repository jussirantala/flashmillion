# Quick Setup Guide for Testing

## Step 1: Set Up Local Blockchain

### Option A: Using Hardhat (Recommended)

```bash
# Install Hardhat globally
npm install -g hardhat

# Start local blockchain with Uniswap V2 fork
npx hardhat node --fork https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
```

This will:
- Start a local blockchain on `http://127.0.0.1:8545`
- Fork Ethereum mainnet (includes Uniswap V2)
- Provide test accounts with ETH

### Option B: Using Anvil (Foundry)

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Start local chain with fork
anvil --fork-url https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
```

### Option C: Private Chain (No Fork)

If you want a completely private chain, you'll need to:
1. Deploy Uniswap V2 contracts yourself
2. Create token pairs
3. Add liquidity

## Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
RPC_URL=http://127.0.0.1:8545
WS_URL=ws://127.0.0.1:8545

# Use one of Hardhat's test accounts
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Mainnet addresses (if forking)
UNISWAP_V2_ROUTER=0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
UNISWAP_V2_FACTORY=0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f
WETH_ADDRESS=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2

MIN_PROFIT_USD=10
ENABLE_EXECUTION=false
```

## Step 3: Install Dependencies

```bash
npm install
```

## Step 4: Test the Bot (Dry Run)

```bash
npm run dev
```

You should see:
```
[INFO] Starting Sandwich Bot (Educational Version)...
==========================================================
           SANDWICH ATTACK BOT - EDUCATIONAL VERSION
==========================================================
⚠️  FOR EDUCATIONAL USE ONLY - PRIVATE BLOCKCHAIN ONLY
...
[SUCCESS] Bot is now running and monitoring mempool...
```

## Step 5: Generate Test Swaps

In another terminal, create a script to generate test swaps:

```javascript
// test-swap.js
const { ethers } = require('ethers');

async function swap() {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  const routerABI = [
    'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)'
  ];

  const router = new ethers.Contract(
    '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    routerABI,
    wallet
  );

  const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
  const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';

  const tx = await router.swapExactETHForTokens(
    0,
    [WETH, DAI],
    wallet.address,
    Date.now() + 1000 * 60 * 10,
    { value: ethers.parseEther('1.0') }
  );

  console.log(`Swap transaction: ${tx.hash}`);
}

swap();
```

Run it:
```bash
node test-swap.js
```

Your sandwich bot should detect it!

## Step 6: Deploy Sandwich Contract (Optional)

```bash
# Compile
npx hardhat compile

# Deploy
npx hardhat run scripts/deploy.ts --network localhost

# Add contract address to .env
SANDWICH_CONTRACT_ADDRESS=0x...
```

## Step 7: Enable Execution (Optional)

```env
ENABLE_EXECUTION=true
```

Restart the bot:
```bash
npm start
```

## Troubleshooting

### "Cannot connect to WebSocket"
- Make sure your local blockchain supports WebSocket
- Try using `ws://127.0.0.1:8545`
- For Hardhat, WebSocket is enabled by default

### "No swaps detected"
- Make sure you're generating test swaps
- Check that UNISWAP_V2_ROUTER address is correct
- Verify the local chain is running

### "Insufficient funds"
- Fund your wallet with test ETH
- Fund the sandwich contract with tokens

### "Transaction reverted"
- Check token approvals
- Verify liquidity exists in the pair
- Ensure minimum profit threshold is met

## What to Watch For

When a swap is detected, you'll see:

```
[INFO] Detected swap: 0x1234567890...
==========================================================
🎯 SANDWICH OPPORTUNITY DETECTED
==========================================================
Victim TX: 0x1234567890abcdef...
Token Pair: WETH -> DAI
Victim Amount: 1000000000000000000
Frontrun Amount: 100000000000000000
Estimated Profit: 50000000000000000 (5.00%)
Gas Cost: 30000000000000000
==========================================================
```

## Next Steps

1. ✅ Run in dry-run mode first
2. ✅ Generate test swaps and verify detection
3. ✅ Check profit calculations make sense
4. ✅ Deploy sandwich contract
5. ✅ Test execution with small amounts
6. ✅ Analyze results and learn!

## Learning Exercises

1. **Modify profit calculation**: Try different frontrun amounts (5%, 20%, etc.)
2. **Add multi-hop support**: Handle DAI -> USDC -> WETH swaps
3. **Implement salmonella detection**: Check for honeypot tokens
4. **Add gas optimization**: Dynamic gas price bidding
5. **Monitor success rate**: Track profitable vs unprofitable attempts

## Safety Reminders

- ⚠️ Only use on private blockchain or testnet
- ⚠️ Never use real funds
- ⚠️ Never deploy to mainnet
- ⚠️ Never sandwich real users
- ⚠️ This is for education only

Happy learning! 🎓
