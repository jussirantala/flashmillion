**Source:** https://github.com/i3visio/solana-mev-bot
**Date:** August 2024

# Solana MEV Bot: High-Performance Flash-Loan-Integrated Arbitrage

## Repository Statistics

- **Stars:** 1,100
- **Forks:** ~350+
- **Primary Language:** Rust (100%)
- **Status:** Active
- **Platform:** Solana
- **License:** MIT

## Overview

The i3visio Solana MEV bot is a sophisticated arbitrage bot designed specifically for the Solana blockchain, leveraging flash loans from Kamino Finance to execute capital-free arbitrage opportunities across multiple decentralized exchanges (DEXs). Unlike Ethereum MEV bots that rely on transaction ordering and mempool monitoring, this bot exploits Solana's unique architecture and high transaction throughput to capture arbitrage opportunities in real-time.

This implementation represents a significant advancement in Solana MEV infrastructure, combining:
- Flash loan integration for zero-capital trading
- Multi-DEX support across the Solana ecosystem
- Transaction spamming techniques for guaranteed inclusion
- Advanced Solana-specific optimizations
- High-frequency trading capabilities

## Purpose and Context

Solana's architecture differs fundamentally from Ethereum:

**Ethereum MEV:**
- Based on transaction ordering in blocks
- Mempool visibility allows frontrunning
- Block builders control inclusion
- ~12 second block times

**Solana MEV:**
- Based on parallel transaction execution
- No traditional mempool (uses Gulf Stream)
- Leader rotation every ~400ms
- Sub-second finality

This creates unique MEV opportunities:

1. **Arbitrage:** Price discrepancies across DEXs (primary focus)
2. **Liquidations:** Lending protocol liquidations
3. **NFT Sniping:** New listing captures
4. **Token Launch Sniping:** New token pair captures

This bot focuses primarily on **arbitrage with flash loans**, enabling:
- Zero capital requirements (only gas needed)
- Atomic execution (all-or-nothing)
- Risk-free profit extraction
- High-frequency opportunity capture

## Architecture Breakdown

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Main Event Loop                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Async Trading Loop (continuous)                 │  │
│  │  - Pool data refresh every 30s                   │  │
│  │  - Opportunity detection                         │  │
│  │  - Transaction execution                         │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │
    ┌────────────────┼────────────────┐
    │                │                │
┌───▼───────┐  ┌─────▼──────┐  ┌─────▼──────┐
│  Pool     │  │Opportunity │  │Transaction │
│  Monitor  │→ │ Detector   │→ │  Builder   │
└───────────┘  └────────────┘  └─────┬──────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
              ┌─────▼──────┐   ┌──────▼─────┐   ┌──────▼─────┐
              │Flash Loan  │   │ Swap Logic │   │  Spam      │
              │Integration │   │ (Multi-DEX)│   │  Submitter │
              └────────────┘   └────────────┘   └─────┬──────┘
                                                       │
                                                ┌──────▼──────┐
                                                │   Solana    │
                                                │   Network   │
                                                └─────────────┘
```

### Core Components

#### 1. Pool Data Manager

Continuously monitors liquidity pools across multiple DEXs:

**Supported DEXs:**
- **Raydium:** Largest Solana DEX (AMM + CLMM)
- **Orca:** Second-largest, concentrated liquidity focus
- **Meteora:** Dynamic liquidity pools
- **Pump.fun:** Meme coin DEX
- **SolFi:** Solana Finance DEX
- **Vertigo:** Newer AMM protocol

**Responsibilities:**
- Fetch and cache pool states
- Monitor reserve ratios
- Track fee structures
- Identify tradable pairs

#### 2. Opportunity Detector

Analyzes pool states to find arbitrage:

**Detection Algorithm:**
1. Compare prices across all DEXs for same token pair
2. Calculate potential profit accounting for fees
3. Determine optimal trade size
4. Validate opportunity is still profitable after slippage

**Criteria:**
- Minimum profit threshold (configurable)
- Sufficient liquidity in all pools
- No suspicious token patterns
- Fee structure validation

#### 3. Flash Loan Integrator

Interfaces with Kamino Finance flash loans:

**Kamino Flash Loans:**
- Borrow any amount available in reserves
- 0.09% fee (9 basis points)
- Single transaction repayment
- No collateral required

**Process:**
1. Request flash loan for optimal amount
2. Execute arbitrage swaps
3. Repay loan + fee
4. Keep profit

#### 4. Transaction Builder

Constructs optimized Solana transactions:

**Features:**
- **Versioned Transactions:** V0 format with Address Lookup Tables
- **Compute Unit Optimization:** Precise compute budget calculation
- **Priority Fees:** Dynamic fee calculation for inclusion
- **Atomic Execution:** All instructions succeed or fail together

**Structure:**
```
Transaction {
    Instructions: [
        1. Set Compute Unit Limit
        2. Set Compute Unit Price (priority fee)
        3. Flash Loan Borrow
        4. Swap on DEX 1 (buy)
        5. Swap on DEX 2 (sell)
        6. Flash Loan Repay
    ]
}
```

#### 5. Transaction Spammer

Increases inclusion probability through redundancy:

**Strategy:**
- Submit same transaction to multiple RPC endpoints
- Send multiple identical transactions per block
- Use different priority fees across submissions
- Monitor for confirmation

**Why This Works:**
- Solana leaders process transactions in parallel
- Multiple submissions increase probability
- No penalty for duplicate transactions (only one executes)
- Critical for competitive MEV capture

## Key Features Explained

### 1. Kamino Finance Flash Loan Integration

**What are Flash Loans?**
Uncollateralized loans that must be repaid within the same transaction.

**Kamino Advantages:**
- Deepest liquidity on Solana
- Low 0.09% fee
- Wide range of supported tokens
- Reliable execution

**Integration Details:**
```rust
// Pseudo-code structure
fn execute_flash_loan_arbitrage() {
    // 1. Calculate optimal borrow amount
    let borrow_amount = calculate_optimal_size(pool_a, pool_b);

    // 2. Build flash loan instruction
    let flash_loan_ix = kamino::flash_loan_begin(
        token_mint,
        borrow_amount,
        flash_loan_fee,
    );

    // 3. Build arbitrage instructions
    let swap_a_ix = dex_a::swap(token_a, token_b, borrow_amount);
    let swap_b_ix = dex_b::swap(token_b, token_a, received_amount);

    // 4. Build repayment instruction
    let repay_ix = kamino::flash_loan_repay(
        borrow_amount + flash_loan_fee,
    );

    // 5. Combine into single transaction
    let transaction = Transaction::new([
        flash_loan_ix,
        swap_a_ix,
        swap_b_ix,
        repay_ix,
    ]);

    // 6. Submit
    send_transaction(transaction);
}
```

**Capital Requirements:**
- **Zero** for arbitrage trades (flash loan covers)
- Only need SOL for transaction fees (~0.000005 SOL per TX)
- Profitable from trade 1

### 2. Multi-DEX Support

**Why Multiple DEXs Matter:**

Arbitrage opportunities arise from price discrepancies. More DEXs = more opportunities.

**Per-DEX Integration:**

**Raydium:**
- AMM (Constant Product) pools
- CLMM (Concentrated Liquidity) pools
- Largest liquidity on Solana
- 0.25% standard fee

**Orca:**
- Whirlpools (concentrated liquidity)
- Legacy pools
- Strong stablecoin liquidity
- Variable fees (0.01% - 1%)

**Meteora:**
- Dynamic liquidity pools
- Multi-token pools
- Lower fees on some pairs
- Newer but growing

**Pump.fun:**
- Meme coin focused
- Bonding curve model
- High volatility = more arb opportunities
- Different pricing mechanism

**Implementation Pattern:**
```rust
trait DexSwap {
    fn build_swap_instruction(
        &self,
        pool_address: Pubkey,
        token_in: Pubkey,
        token_out: Pubkey,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Instruction;

    fn calculate_output(
        &self,
        pool: &PoolState,
        amount_in: u64,
    ) -> u64;
}

// Each DEX implements this trait
impl DexSwap for RaydiumDex { ... }
impl DexSwap for OrcaDex { ... }
impl DexSwap for MeteoraDex { ... }
```

### 3. Transaction Spamming for Inclusion

**The Problem:**
Solana processes ~65,000 TPS, but demand often exceeds capacity. Transactions can be dropped.

**The Solution:**
Spam identical transactions with variations to maximize inclusion probability.

**Techniques:**

**A. Multi-RPC Submission:**
```rust
async fn spam_to_multiple_rpcs(tx: Transaction) {
    let rpc_endpoints = vec![
        "https://api.mainnet-beta.solana.com",
        "https://solana-api.projectserum.com",
        "https://rpc.ankr.com/solana",
        "https://ssc-dao.genesysgo.net",
    ];

    let futures: Vec<_> = rpc_endpoints.iter()
        .map(|endpoint| {
            let client = RpcClient::new(endpoint);
            client.send_transaction(&tx)
        })
        .collect();

    join_all(futures).await;
}
```

**B. Priority Fee Variation:**
```rust
async fn spam_with_fee_variation(tx: Transaction) {
    let base_fee = 5000; // microlamports
    let variations = vec![
        base_fee,
        base_fee * 2,
        base_fee * 5,
        base_fee * 10,
    ];

    for fee in variations {
        let mut modified_tx = tx.clone();
        modified_tx.set_compute_unit_price(fee);
        send_transaction(modified_tx).await;
    }
}
```

**C. Rapid Submission:**
```rust
async fn rapid_spam(tx: Transaction, count: usize) {
    for _ in 0..count {
        tokio::spawn(send_transaction(tx.clone()));
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}
```

**Why It Works:**
- Different RPC nodes route to different leaders
- Higher priority fees win in congestion
- Multiple submissions survive network issues
- First confirmed wins, others fail (no double-execution)

### 4. Address Lookup Tables (ALTs)

**Problem:**
Solana transactions have a size limit (1232 bytes). Complex arbitrage with many accounts can exceed this.

**Solution:**
Address Lookup Tables store account addresses off-chain, referenced by index.

**Benefits:**
- Reduce transaction size by ~80%
- Include more instructions per transaction
- Enable complex multi-hop arbitrage
- Lower transaction fees

**Usage:**
```rust
// Create ALT
let alt_address = create_lookup_table(
    &payer,
    &authority,
    &recent_slot,
).await?;

// Add addresses
extend_lookup_table(
    alt_address,
    vec![
        raydium_pool,
        orca_pool,
        token_a_mint,
        token_b_mint,
        // ... many more accounts
    ],
).await?;

// Use in transaction
let transaction = VersionedTransaction::new(
    Message::V0(MessageV0 {
        address_lookup_tables: vec![alt_address],
        // ... rest of transaction
    }),
);
```

### 5. Atomic Execution

**Guarantee:**
All instructions in a transaction execute or none do.

**For Arbitrage:**
- Borrow flash loan
- Execute swaps
- Repay loan

If any step fails, entire transaction reverts. No risk of:
- Borrowing without repaying
- Executing partial arbitrage
- Losing capital to failed swaps

**Implementation:**
```rust
fn build_atomic_arbitrage_tx(
    flash_loan_amount: u64,
    path: Vec<DexSwap>,
) -> Transaction {
    let mut instructions = vec![];

    // 1. Compute budget (must be first)
    instructions.push(
        ComputeBudgetInstruction::set_compute_unit_limit(300_000)
    );
    instructions.push(
        ComputeBudgetInstruction::set_compute_unit_price(10_000)
    );

    // 2. Flash loan borrow
    instructions.push(
        kamino_flash_loan_begin(flash_loan_amount)
    );

    // 3. All swaps
    for swap in path {
        instructions.push(swap.build_instruction());
    }

    // 4. Flash loan repay
    instructions.push(
        kamino_flash_loan_repay(flash_loan_amount + fee)
    );

    Transaction::new_with_payer(&instructions, Some(&payer))
}
```

### 6. Compute Unit Optimization

**Solana Compute Units:**
Each transaction has a compute budget (max: 1.4M units)

**Why Optimize:**
- Transactions failing compute limits lose profit
- Lower compute = lower priority fees needed
- Faster execution

**Optimization Strategies:**

**A. Precise Budgeting:**
```rust
// Don't use default (200k), calculate exact needs
let compute_units = estimate_compute_units(&instructions);
let optimized = compute_units * 110 / 100; // 10% buffer

set_compute_unit_limit(optimized);
```

**B. Instruction Efficiency:**
```rust
// Bad: Multiple account validations
for account in accounts {
    validate(account);
}

// Good: Batch validation
validate_all(accounts);
```

**C. Minimize Cross-Program Invocations:**
```rust
// Each CPI costs ~1000 compute units
// Prefer single-DEX when profitable vs multi-hop
```

## Technologies and Dependencies

### Rust Ecosystem

**Solana SDK:**
- `solana-sdk`: Core Solana types and functions
- `solana-client`: RPC client for network interaction
- `solana-program`: On-chain program development
- `solana-transaction-status`: Transaction status tracking

**Async Runtime:**
- `tokio`: Async runtime (essential for high-performance)
- `futures`: Future combinators

**Serialization:**
- `borsh`: Solana's preferred serialization format
- `serde`: General serialization
- `serde_json`: JSON handling for RPC responses

**Utility Libraries:**
- `anyhow`: Error handling
- `thiserror`: Custom error types
- `log`/`env_logger`: Logging
- `dotenv`: Environment configuration

### Solana-Specific Libraries

**DEX Integrations:**
- `raydium-amm`: Raydium SDK
- `orca-whirlpool`: Orca SDK
- Custom implementations for other DEXs

**Math Libraries:**
- `spl-math`: Solana Program Library math
- `num-traits`: Numeric traits
- `rust_decimal`: Precise decimal arithmetic

### Infrastructure

**RPC Providers:**
- Solana Labs RPC (free, rate-limited)
- Quicknode (paid, reliable)
- GenesysGo (paid, high-performance)
- Triton (paid, MEV-focused)

**Requirements:**
- Low latency to validators (<50ms ideal)
- High throughput (10,000+ requests/min)
- WebSocket support for subscriptions
- Historical data access

## Unique Implementation Aspects

### 1. Solana-Specific MEV Landscape

**No Traditional Mempool:**
Solana uses Gulf Stream, which forwards transactions directly to upcoming leaders.

**Implications:**
- Can't monitor pending transactions
- Can't frontrun specific transactions
- Focus on statistical arbitrage opportunities
- Speed of detection matters more than transaction ordering

### 2. Leader Schedule Awareness

**Leader Rotation:**
Solana rotates block producers every ~400ms.

**Optimization:**
```rust
async fn get_current_leader() -> Pubkey {
    let epoch_info = client.get_epoch_info().await?;
    let leader_schedule = client.get_leader_schedule(None).await?;

    // Calculate current slot's leader
    let slot_index = epoch_info.slot_index;
    leader_schedule.get_slot_leader(slot_index)
}

async fn send_to_current_leader(tx: Transaction) {
    let leader = get_current_leader().await?;
    let leader_rpc = get_leader_rpc_endpoint(leader);

    // Send directly to leader's RPC
    RpcClient::new(leader_rpc)
        .send_transaction(&tx)
        .await?;
}
```

### 3. Token Account Management

**Solana Token Accounts:**
Unlike Ethereum (balance stored in contract), Solana uses Associated Token Accounts (ATAs).

**Implications:**
```rust
// Must create token accounts before first trade
async fn ensure_token_accounts(
    owner: &Pubkey,
    token_mints: &[Pubkey],
) -> Result<()> {
    for mint in token_mints {
        let ata = get_associated_token_address(owner, mint);

        // Check if exists
        if !account_exists(&ata).await? {
            // Create ATA
            let ix = create_associated_token_account(
                &payer,
                owner,
                mint,
            );
            send_and_confirm_transaction(ix).await?;
        }
    }
    Ok(())
}
```

### 4. Rent Exemption Handling

**Solana Rent:**
Accounts must maintain minimum balance (rent exemption) or pay ongoing rent.

**For Arbitrage Bot:**
```rust
// Calculate rent-exempt minimum
let rent = client.get_minimum_balance_for_rent_exemption(
    TokenAccount::LEN
).await?;

// Ensure all token accounts are rent-exempt
// Usually ~0.00203928 SOL per account
```

### 5. Priority Fee Economics

**Dynamic Fee Calculation:**
```rust
async fn calculate_optimal_priority_fee(
    profit: u64,
    compute_units: u32,
) -> u64 {
    // Get recent priority fees
    let recent_fees = client
        .get_recent_prioritization_fees()
        .await?;

    // Use median of recent fees as base
    let base_fee = median(recent_fees);

    // Calculate max fee (50% of profit)
    let max_fee = profit / 2;

    // Compute microlamports per compute unit
    let fee_per_unit = max_fee / compute_units as u64;

    // Return competitive fee (10% above median, capped at max)
    min(base_fee * 110 / 100, fee_per_unit)
}
```

## Use Cases

### 1. Profitable Arbitrage Trading

**Primary Use Case:**
- Detect price discrepancies across Solana DEXs
- Execute risk-free arbitrage with flash loans
- Generate consistent profit with zero capital

**Requirements:**
- Running infrastructure (VPS or dedicated server)
- SOL for transaction fees (~1 SOL to start)
- Reliable RPC endpoint

**Expected Returns:**
- Highly variable based on market conditions
- Active markets: 0.1-1 SOL/day possible
- Volatile periods: 5-20 SOL/day seen
- Consistency depends on optimization

### 2. Educational Learning

**For Students:**
- Understanding Solana architecture
- Learning Rust async programming
- DeFi protocol integration
- MEV concepts on non-EVM chains

**Learning Outcomes:**
- Solana transaction structure
- Flash loan mechanics
- AMM mathematics
- High-performance Rust

### 3. MEV Research

**Research Applications:**
- Analyzing Solana MEV landscape
- Comparing EVM vs Solana MEV
- Studying arbitrage efficiency
- Flash loan economics

**Data Collection:**
- Opportunity frequency
- Profit distribution
- Competition analysis
- DEX efficiency comparison

### 4. DeFi Protocol Development

**Insights for Builders:**
- Understanding how bots exploit protocols
- Designing MEV-resistant features
- Optimizing for arbitrage prevention
- Improving price oracles

## Getting Started

### Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Verify installation
solana --version
rustc --version
```

### Initial Setup

```bash
# Create Solana wallet
solana-keygen new --outfile ~/solana-mev-bot-keypair.json

# Set to mainnet
solana config set --url https://api.mainnet-beta.solana.com

# Fund wallet (need SOL for fees)
# Send at least 1 SOL to your wallet address
solana balance
```

### Configuration

Create `.env` file:

```env
# Solana RPC endpoint
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WS_URL=wss://api.mainnet-beta.solana.com

# Wallet
WALLET_PATH=~/solana-mev-bot-keypair.json

# Strategy parameters
MIN_PROFIT_LAMPORTS=10000000  # 0.01 SOL
MAX_SLIPPAGE_BPS=100  # 1%
FLASH_LOAN_FEE_BPS=9  # 0.09% Kamino fee

# Performance
POOL_REFRESH_INTERVAL_SECS=30
MAX_COMPUTE_UNITS=300000
PRIORITY_FEE_PERCENTILE=75

# Transaction spam
SPAM_COUNT=5
SPAM_INTERVAL_MS=100

# DEX selection (true/false)
ENABLE_RAYDIUM=true
ENABLE_ORCA=true
ENABLE_METEORA=true
ENABLE_PUMP=false  # Higher risk
```

### Building

```bash
# Clone repository
git clone https://github.com/i3visio/solana-mev-bot.git
cd solana-mev-bot

# Build release
cargo build --release

# Run tests
cargo test
```

### Running

```bash
# Dry run (simulation only)
cargo run --release -- --dry-run

# Production mode
cargo run --release

# With custom config
cargo run --release -- --config custom.env

# With verbose logging
RUST_LOG=debug cargo run --release
```

### Monitoring

```bash
# Check wallet balance
solana balance

# Monitor transactions
solana transaction-history $(solana address)

# Check logs
tail -f logs/mev-bot.log
```

## Recommendations

### For Beginners

**Start Small:**
1. Run in dry-run mode first
2. Understand each component
3. Monitor without executing
4. Start with single DEX pair

**Learn First:**
- Read Solana documentation
- Understand AMM mechanics
- Study flash loan concepts
- Practice on devnet

**Risk Management:**
- Start with minimal SOL
- Set conservative profit thresholds
- Monitor closely initially
- Don't invest more than you can afford to lose

### For Production Deployment

**Infrastructure:**
- Use dedicated server (not local machine)
- Low-latency connection to Solana validators
- Paid RPC endpoint (Quicknode/GenesysGo)
- Redundant RPC connections

**Optimization:**
- Profile and optimize hot paths
- Minimize latency everywhere
- Use ALTs for complex transactions
- Implement smart priority fee bidding

**Monitoring:**
- Set up alerting for errors
- Track profit/loss in real-time
- Monitor success rate
- Watch for suspicious activity

**Security:**
- Secure private key storage
- Use separate hot/cold wallets
- Limit max transaction size
- Implement circuit breakers

### For Researchers

**Data Collection:**
```rust
// Log all opportunities
struct OpportunityLog {
    timestamp: i64,
    token_pair: (Pubkey, Pubkey),
    dex_a: String,
    dex_b: String,
    price_diff_bps: u64,
    potential_profit: u64,
    executed: bool,
    actual_profit: Option<u64>,
}

// Analyze patterns
fn analyze_opportunities(logs: Vec<OpportunityLog>) {
    // Frequency analysis
    // Profit distribution
    // DEX efficiency comparison
    // Time-of-day patterns
}
```

### For Protocol Developers

**Use This To:**
- Test your DEX for arbitrage vulnerabilities
- Understand how MEV bots interact with your protocol
- Design better price oracles
- Implement MEV-resistant features

**Defense Strategies:**
- Shorter oracle update intervals
- MEV-resistant AMM designs
- Transaction batching
- Privacy features

## Conclusion

The i3visio Solana MEV bot represents a sophisticated approach to arbitrage on Solana, leveraging the chain's unique architecture and high throughput. Unlike Ethereum MEV which focuses on transaction ordering, Solana MEV is about speed, efficiency, and statistical arbitrage opportunities.

**Key Takeaways:**

1. **Flash Loans Enable Zero-Capital Trading:** No upfront investment needed beyond gas fees
2. **Multi-DEX Coverage Is Critical:** More DEXs = more opportunities
3. **Solana-Specific Optimizations Matter:** Transaction spamming, compute units, ALTs
4. **Speed Is Everything:** Milliseconds matter in detecting and executing opportunities
5. **Sustainable MEV:** Arbitrage is positive-sum (improves market efficiency)

**Future of Solana MEV:**

- Jito Labs MEV infrastructure maturing
- More sophisticated strategies emerging
- Increased competition reducing margins
- Protocol-level MEV capture (similar to Ethereum's MEV-Share)

This bot serves as both a profitable tool and an excellent educational resource for understanding Solana's MEV landscape, flash loans, and high-performance DeFi trading systems.

## Additional Resources

- **Solana Documentation:** https://docs.solana.com/
- **Kamino Finance:** https://kamino.finance/
- **Raydium Docs:** https://docs.raydium.io/
- **Orca Docs:** https://docs.orca.so/
- **Jito Labs (Solana MEV):** https://jito.network/
- **Solana Cookbook:** https://solanacookbook.com/

## Repository Status

As of August 2024, this repository is actively maintained and working on Solana mainnet. The Solana ecosystem is rapidly evolving, so stay updated with:
- Solana core updates
- DEX protocol changes
- New arbitrage opportunities
- MEV infrastructure improvements
