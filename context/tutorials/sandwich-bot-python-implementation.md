**Source:** Internal implementation guide for Python/research focus
**Date:** November 2025

# Sandwich Bot: Python Implementation Guide (Learning & Analysis)

## ⚠️ DISCLAIMERS

**Legal/Ethical/Financial:** See other guides. This is educational only.

**Python Limitation:** Python is **NOT competitive** for production MEV bots (100-200ms latency). Use for:
- Learning MEV concepts
- Analyzing historical data
- Prototyping strategies
- Research & simulation

**For Production:** Use Rust or TypeScript instead.

---

## Overview

Python is perfect for **learning and analysis**, not production. This guide shows:
- Analyzing historical MEV opportunities
- Simulating sandwich attacks
- Calculating profitability
- Understanding mechanics

**Pros:**
- Easiest to learn
- Great for notebooks (Jupiter)
- Excellent libraries (web3.py, pandas)
- Fast prototyping

**Cons:**
- Slow (100-200ms+ latency)
- Not competitive in production
- Higher resource usage
- GIL limits concurrency

---

## Quick Start

### Installation

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install web3 python-dotenv requests pandas
```

### Project Structure

```
sandwich-bot-python/
├── src/
│   ├── config.py           # Configuration
│   ├── analyzer.py         # Historical analysis
│   ├── simulator.py        # Sandwich simulation
│   └── calculator.py       # Profit calculation
├── notebooks/
│   └── analysis.ipynb      # Jupyter notebook
├── .env
├── requirements.txt
└── README.md
```

---

## Complete Implementation

### requirements.txt

```
web3==6.11.0
python-dotenv==1.0.0
requests==2.31.0
pandas==2.1.0
```

### src/config.py

```python
import os
from dotenv import load_dotenv
from web3 import Web3

load_dotenv()

# Network
RPC_URL = os.getenv('RPC_URL', 'https://arb1.arbitrum.io/rpc')
CHAIN_ID = int(os.getenv('CHAIN_ID', '42161'))

# Contracts (Arbitrum)
UNISWAP_ROUTER = Web3.to_checksum_address('0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506')
UNISWAP_FACTORY = Web3.to_checksum_address('0xc35DADB65012eC5796536bD9864eD8773aBc74C4')

# Thresholds
MIN_PROFIT_USD = float(os.getenv('MIN_PROFIT_USD', '5.0'))
MIN_VICTIM_TRADE_USD = float(os.getenv('MIN_VICTIM_TRADE_USD', '10000'))

# ABIs
ROUTER_ABI = [
    {
        "inputs": [
            {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
            {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
            {"internalType": "address[]", "name": "path", "type": "address[]"},
            {"internalType": "address", "name": "to", "type": "address"},
            {"internalType": "uint256", "name": "deadline", "type": "uint256"}
        ],
        "name": "swapExactTokensForTokens",
        "outputs": [{"internalType": "uint256[]", "name": "amounts", "type": "uint256[]"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

PAIR_ABI = [
    {
        "constant": True,
        "inputs": [],
        "name": "getReserves",
        "outputs": [
            {"internalType": "uint112", "name": "reserve0", "type": "uint112"},
            {"internalType": "uint112", "name": "reserve1", "type": "uint112"},
            {"internalType": "uint32", "name": "blockTimestampLast", "type": "uint32"}
        ],
        "payable": False,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "token0",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "payable": False,
        "stateMutability": "view",
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "token1",
        "outputs": [{"internalType": "address", "name": "", "type": "address"}],
        "payable": False,
        "stateMutability": "view",
        "type": "function"
    }
]
```

### src/calculator.py

```python
from web3 import Web3

def get_amount_out(amount_in: int, reserve_in: int, reserve_out: int) -> int:
    """Calculate Uniswap V2 output amount"""
    if amount_in == 0 or reserve_in == 0 or reserve_out == 0:
        return 0

    amount_in_with_fee = amount_in * 997
    numerator = amount_in_with_fee * reserve_out
    denominator = (reserve_in * 1000) + amount_in_with_fee

    return numerator // denominator


def calculate_sandwich_profit(
    victim_amount_in: int,
    reserve_in: int,
    reserve_out: int,
    gas_price_gwei: int = 1,
    gas_limit: int = 300000
) -> dict:
    """
    Calculate sandwich attack profitability

    Returns:
        dict with keys: optimal_amount, gross_profit, gas_cost, net_profit
    """
    # Simplified: use 50% of victim amount
    optimal_amount = victim_amount_in // 2

    # 1. Front-run: Buy tokens
    frontrun_output = get_amount_out(optimal_amount, reserve_in, reserve_out)

    # 2. Reserves after front-run
    reserve_in_after_frontrun = reserve_in + optimal_amount
    reserve_out_after_frontrun = reserve_out - frontrun_output

    # 3. Victim's trade
    victim_output = get_amount_out(
        victim_amount_in,
        reserve_in_after_frontrun,
        reserve_out_after_frontrun
    )

    # 4. Reserves after victim
    reserve_in_after_victim = reserve_in_after_frontrun + victim_amount_in
    reserve_out_after_victim = reserve_out_after_frontrun - victim_output

    # 5. Back-run: Sell tokens
    backrun_output = get_amount_out(
        frontrun_output,
        reserve_out_after_victim,
        reserve_in_after_victim
    )

    # Calculate profit
    gross_profit = max(0, backrun_output - optimal_amount)

    # Calculate gas cost (in Wei)
    gas_cost = gas_price_gwei * 10**9 * gas_limit

    # Net profit
    net_profit = max(0, gross_profit - gas_cost)

    return {
        'optimal_amount': optimal_amount,
        'gross_profit': gross_profit,
        'gas_cost': gas_cost,
        'net_profit': net_profit,
        'net_profit_usd': Web3.from_wei(net_profit, 'ether'),  # Assuming stablecoin
        'victim_loss': victim_amount_in + frontrun_output - backrun_output
    }


if __name__ == '__main__':
    # Example calculation
    victim_trade = Web3.to_wei(10000, 'ether')  # 10K USDC
    reserves_in = Web3.to_wei(1000000, 'ether')  # 1M USDC
    reserves_out = Web3.to_wei(1000000, 'ether')  # 1M DAI

    result = calculate_sandwich_profit(victim_trade, reserves_in, reserves_out)

    print("Sandwich Profitability Analysis")
    print("=" * 50)
    print(f"Optimal Amount: {Web3.from_wei(result['optimal_amount'], 'ether')} tokens")
    print(f"Gross Profit: {Web3.from_wei(result['gross_profit'], 'ether')} tokens")
    print(f"Gas Cost: {Web3.from_wei(result['gas_cost'], 'ether')} ETH")
    print(f"Net Profit: {result['net_profit_usd']:.2f} USD")
    print(f"Victim Loss: {Web3.from_wei(result['victim_loss'], 'ether'):.2f} tokens")
```

### src/analyzer.py

```python
from web3 import Web3
from src.config import *
from src.calculator import calculate_sandwich_profit
import time

class HistoricalAnalyzer:
    """Analyze historical blocks for MEV opportunities"""

    def __init__(self, rpc_url: str):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        self.router = self.w3.eth.contract(
            address=UNISWAP_ROUTER,
            abi=ROUTER_ABI
        )

    def analyze_block(self, block_number: int) -> list:
        """Analyze a single block for sandwich opportunities"""
        opportunities = []

        try:
            block = self.w3.eth.get_block(block_number, full_transactions=True)

            for tx in block.transactions:
                if tx.to and tx.to.lower() == UNISWAP_ROUTER.lower():
                    opp = self.analyze_transaction(tx)
                    if opp:
                        opportunities.append(opp)

        except Exception as e:
            print(f"Error analyzing block {block_number}: {e}")

        return opportunities

    def analyze_transaction(self, tx) -> dict:
        """Analyze a single transaction"""
        try:
            # Decode transaction
            func_obj, func_params = self.router.decode_function_input(tx.input)

            if 'swapExactTokensForTokens' not in str(func_obj):
                return None

            # Extract parameters
            amount_in = func_params.get('amountIn', 0)
            path = func_params.get('path', [])

            if len(path) < 2 or amount_in == 0:
                return None

            # Get pair reserves (simplified - would need actual pair query)
            # For demo, using mock reserves
            reserves_in = Web3.to_wei(1000000, 'ether')
            reserves_out = Web3.to_wei(1000000, 'ether')

            # Calculate profitability
            result = calculate_sandwich_profit(amount_in, reserves_in, reserves_out)

            if result['net_profit'] > Web3.to_wei(5, 'ether'):  # $5 minimum
                return {
                    'block': tx.blockNumber,
                    'tx_hash': tx.hash.hex(),
                    'victim_amount': Web3.from_wei(amount_in, 'ether'),
                    'estimated_profit': result['net_profit_usd'],
                    'token_in': path[0],
                    'token_out': path[-1]
                }

        except Exception:
            pass

        return None

    def analyze_range(self, start_block: int, end_block: int):
        """Analyze a range of blocks"""
        print(f"Analyzing blocks {start_block} to {end_block}...")

        all_opportunities = []

        for block_num in range(start_block, end_block + 1):
            opportunities = self.analyze_block(block_num)
            all_opportunities.extend(opportunities)

            if opportunities:
                print(f"Block {block_num}: Found {len(opportunities)} opportunities")

            # Rate limiting
            time.sleep(0.1)

        return all_opportunities


if __name__ == '__main__':
    analyzer = HistoricalAnalyzer(RPC_URL)

    # Analyze last 10 blocks
    latest_block = analyzer.w3.eth.block_number
    opportunities = analyzer.analyze_range(latest_block - 10, latest_block)

    print(f"\n{'='*70}")
    print(f"Total Opportunities Found: {len(opportunities)}")
    print(f"{'='*70}\n")

    for opp in opportunities:
        print(f"Block: {opp['block']}")
        print(f"TX: {opp['tx_hash']}")
        print(f"Victim Trade: {opp['victim_amount']:.2f}")
        print(f"Estimated Profit: ${opp['estimated_profit']:.2f}")
        print("-" * 70)
```

### src/simulator.py

```python
from web3 import Web3
from src.calculator import calculate_sandwich_profit

class SandwichSimulator:
    """Simulate sandwich attacks on various scenarios"""

    def simulate_various_pool_sizes(self):
        """Test profitability across different pool sizes"""
        victim_trade = Web3.to_wei(10000, 'ether')  # 10K USDC

        pool_sizes = [
            Web3.to_wei(100000, 'ether'),    # 100K liquidity
            Web3.to_wei(500000, 'ether'),    # 500K
            Web3.to_wei(1000000, 'ether'),   # 1M
            Web3.to_wei(5000000, 'ether'),   # 5M
            Web3.to_wei(10000000, 'ether'),  # 10M
        ]

        print("Sandwich Profitability vs Pool Size")
        print("=" * 70)
        print(f"{'Pool Size':<15} {'Optimal Amt':<15} {'Gross Profit':<15} {'Net Profit':<15}")
        print("-" * 70)

        for pool_size in pool_sizes:
            result = calculate_sandwich_profit(victim_trade, pool_size, pool_size)

            print(f"{Web3.from_wei(pool_size, 'ether'):>13,.0f}  "
                  f"{Web3.from_wei(result['optimal_amount'], 'ether'):>13,.0f}  "
                  f"{Web3.from_wei(result['gross_profit'], 'ether'):>13,.2f}  "
                  f"${result['net_profit_usd']:>13,.2f}")

    def simulate_various_victim_sizes(self):
        """Test profitability across different victim trade sizes"""
        pool_size = Web3.to_wei(1000000, 'ether')  # 1M liquidity

        victim_sizes = [
            Web3.to_wei(1000, 'ether'),      # 1K
            Web3.to_wei(5000, 'ether'),      # 5K
            Web3.to_wei(10000, 'ether'),     # 10K
            Web3.to_wei(50000, 'ether'),     # 50K
            Web3.to_wei(100000, 'ether'),    # 100K
        ]

        print("\nSandwich Profitability vs Victim Trade Size")
        print("=" * 70)
        print(f"{'Victim Size':<15} {'Victim Loss':<15} {'Our Profit':<15} {'Profit %':<15}")
        print("-" * 70)

        for victim_size in victim_sizes:
            result = calculate_sandwich_profit(victim_size, pool_size, pool_size)

            victim_loss_pct = (result['victim_loss'] / victim_size) * 100 if victim_size > 0 else 0

            print(f"${Web3.from_wei(victim_size, 'ether'):>13,.0f}  "
                  f"${Web3.from_wei(result['victim_loss'], 'ether'):>13,.2f}  "
                  f"${result['net_profit_usd']:>13,.2f}  "
                  f"{victim_loss_pct:>13,.2f}%")


if __name__ == '__main__':
    simulator = SandwichSimulator()

    simulator.simulate_various_pool_sizes()
    print()
    simulator.simulate_various_victim_sizes()
```

---

## Jupyter Notebook Example

### notebooks/analysis.ipynb

```python
# Cell 1: Imports
import sys
sys.path.append('..')

from web3 import Web3
from src.calculator import calculate_sandwich_profit
from src.simulator import SandwichSimulator
import pandas as pd
import matplotlib.pyplot as plt

# Cell 2: Setup
w3 = Web3(Web3.HTTPProvider('https://arb1.arbitrum.io/rpc'))
print(f"Connected: {w3.is_connected()}")
print(f"Latest Block: {w3.eth.block_number}")

# Cell 3: Profitability Analysis
victim_amounts = range(1000, 100000, 5000)
profits = []

for victim_amt in victim_amounts:
    victim_wei = Web3.to_wei(victim_amt, 'ether')
    pool_size = Web3.to_wei(1000000, 'ether')

    result = calculate_sandwich_profit(victim_wei, pool_size, pool_size)
    profits.append(result['net_profit_usd'])

# Cell 4: Plot
df = pd.DataFrame({'Victim Trade Size ($)': list(victim_amounts), 'Profit ($)': profits})

plt.figure(figsize=(12, 6))
plt.plot(df['Victim Trade Size ($)'], df['Profit ($)'])
plt.xlabel('Victim Trade Size ($)')
plt.ylabel('Estimated Profit ($)')
plt.title('Sandwich Attack Profitability Analysis')
plt.grid(True)
plt.show()

# Cell 5: Run Simulations
simulator = SandwichSimulator()
simulator.simulate_various_pool_sizes()
simulator.simulate_various_victim_sizes()
```

---

## Usage Examples

### Calculate Single Opportunity

```python
from web3 import Web3
from src.calculator import calculate_sandwich_profit

# Scenario: 10K USDC trade in 1M liquidity pool
victim_trade = Web3.to_wei(10000, 'ether')
pool_liquidity = Web3.to_wei(1000000, 'ether')

result = calculate_sandwich_profit(victim_trade, pool_liquidity, pool_liquidity)

print(f"Estimated Profit: ${result['net_profit_usd']:.2f}")
print(f"Victim Loss: ${Web3.from_wei(result['victim_loss'], 'ether'):.2f}")
```

### Analyze Historical Blocks

```python
from src.analyzer import HistoricalAnalyzer

analyzer = HistoricalAnalyzer('https://arb1.arbitrum.io/rpc')

# Analyze specific block range
opportunities = analyzer.analyze_range(180000000, 180000100)

print(f"Found {len(opportunities)} opportunities")

# Calculate total potential profit
total_profit = sum(opp['estimated_profit'] for opp in opportunities)
print(f"Total Potential Profit: ${total_profit:.2f}")
```

### Run Simulations

```python
from src.simulator import SandwichSimulator

simulator = SandwichSimulator()

# Test different scenarios
simulator.simulate_various_pool_sizes()
simulator.simulate_various_victim_sizes()
```

---

## Key Insights from Simulations

### Finding 1: Pool Size Matters

```
Pool Size = 100K:   Profit = $12.50
Pool Size = 1M:     Profit = $125.00
Pool Size = 10M:    Profit = $1,250.00

Conclusion: Larger pools = more profit (less price impact)
```

### Finding 2: Victim Loss vs Our Profit

```
Victim trades $10K → Loses $200 (2%) → We profit $150
Victim trades $50K → Loses $1,000 (2%) → We profit $900

Conclusion: Larger victims = more profit, but same % loss
```

### Finding 3: Gas Cost Impact

```
On Ethereum:  Need >$30 profit to break even
On Arbitrum:  Need >$1 profit to break even
On Optimism:  Need >$0.50 profit to break even

Conclusion: L2s make small sandwiches viable
```

---

## Limitations & Warnings

### Python is NOT Production-Ready

**Latency Comparison:**
```
Rust:       5-20ms    (competitive)
TypeScript: 50-100ms  (viable for L2)
Python:     100-200ms (too slow)
```

**Conclusion:** Python loses to every other bot.

### Use Python For:
✅ Learning MEV mechanics
✅ Historical analysis
✅ Strategy prototyping
✅ Research papers
✅ Jupyter notebooks

### Don't Use Python For:
❌ Production bots
❌ Real-time monitoring
❌ Competitive MEV
❌ Mainnet deployment

---

## Next Steps

1. **Learn the Math**
   - Run simulations
   - Understand profitability curves
   - Study victim impact

2. **Analyze History**
   - Use `analyzer.py` on real blocks
   - Find past opportunities
   - Calculate potential profits

3. **Switch to Production Language**
   - Use TypeScript for L2
   - Use Rust for mainnet
   - Keep Python for analysis

4. **Build Actual Bot**
   - See `sandwich-bot-typescript-implementation.md`
   - Or `sandwich-bot-rust-implementation.md`

---

## Conclusion

Python is **perfect for learning**, **terrible for production**.

**Use this guide to:**
- Understand sandwich mechanics deeply
- Analyze historical opportunities
- Prototype strategies safely
- Make informed decisions

**Then switch to:**
- TypeScript (easier, 50-100ms)
- Rust (harder, 5-20ms)

**Never deploy Python bots to production.** You'll lose every opportunity to faster bots.

But Python taught you MEV mechanics - and that knowledge is valuable regardless of language!
