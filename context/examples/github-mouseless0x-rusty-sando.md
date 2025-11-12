**Source:** https://github.com/mouseless0x/rusty-sando
**Date:** August 2023 (Archived)

# Rusty-Sando: Competitive MEV Sandwich Attack Bot

## Repository Statistics

- **Stars:** 857
- **Forks:** ~200+
- **Primary Language:** Rust (76%)
- **Secondary Language:** Solidity (24%)
- **Status:** Archived (August 2023)
- **Framework:** Artemis
- **License:** MIT

## Overview

Rusty-Sando is a high-performance MEV (Maximal Extractable Value) sandwich attack bot built with Rust and the Artemis framework. It represents one of the most sophisticated open-source implementations of sandwich trading strategies on Ethereum, capable of identifying and executing profitable sandwich opportunities across both Uniswap V2 and V3 protocols.

The bot operates by detecting pending transactions in the mempool that will move token prices, then constructing bundles that place trades both before (frontrun) and after (backrun) the victim transaction to profit from the price movement. The name "rusty-sando" is a play on "sandwich" attacks and the Rust programming language.

## Purpose and Context

Sandwich attacks are a controversial but prevalent form of MEV extraction where:

1. A searcher detects a large pending swap transaction
2. Places a buy order before the victim's transaction (frontrun)
3. The victim's transaction executes, moving the price
4. Searcher sells at the higher price (backrun)
5. Profit is the difference minus gas costs

Rusty-Sando was created as an educational and competitive implementation, showcasing advanced techniques in:
- High-performance mempool monitoring
- Smart contract optimization using Huff
- Bundle construction and submission
- EVM simulation and profit calculation
- Multi-victim bundling strategies

## Architecture Breakdown

### High-Level Architecture

```
┌─────────────────────────────────────────────┐
│          Artemis Framework                  │
│  (Event-driven MEV bot framework)          │
└──────────────┬──────────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────────┐   ┌────────▼─────┐
│  Bot Module│   │Contract Module│
│   (Rust)   │   │    (Huff)     │
└───┬────────┘   └────────┬──────┘
    │                     │
    │  ┌──────────────────┘
    │  │
    ▼  ▼
┌────────────────────────────┐
│   Ethereum Network         │
│   (Mempool + Flashbots)    │
└────────────────────────────┘
```

### Core Components

#### 1. Bot Module (Rust)

The bot module handles all off-chain logic:

- **Mempool Monitoring:** Subscribes to pending transactions via WebSocket
- **Opportunity Detection:** Identifies profitable sandwich targets
- **Salmonella Detection:** Filters out malicious token contracts
- **Simulation Engine:** Runs fast concurrent EVM simulations
- **Bundle Construction:** Creates optimized transaction bundles
- **Profit Calculation:** Determines optimal trade sizes
- **Submission:** Sends bundles to Flashbots relayers

#### 2. Contract Module (Huff)

Smart contracts written in Huff (low-level EVM assembly):

- **Swap Execution:** Highly optimized swap logic
- **Multi-hop Support:** Execute complex routing
- **Gas Optimization:** Minimal bytecode for lowest gas costs
- **V2/V3 Compatibility:** Works with both Uniswap versions
- **Dust Management:** Handles token remnants efficiently

#### 3. Artemis Framework Integration

Artemis provides the foundation:

- Event-driven architecture
- Collector-Strategy-Executor pattern
- Built-in monitoring and metrics
- Modular component system

## Key Features Explained

### 1. V2/V3 Uniswap Compatibility

**Uniswap V2:**
- Constant product formula (x * y = k)
- Simpler price calculations
- More predictable gas costs
- Larger liquidity pools generally

**Uniswap V3:**
- Concentrated liquidity
- Multiple fee tiers (0.05%, 0.30%, 1.00%)
- More complex price calculations
- Requires tick math and position tracking

Rusty-Sando handles both by:
- Abstracting pool interfaces
- Using different calculation methods per version
- Optimizing for each protocol's specific characteristics

### 2. Multi-Meat Sandwiches

Traditional sandwich: 1 victim transaction
Multi-meat: Multiple victims in single bundle

**Advantages:**
- Amortize frontrun/backrun gas costs
- Greater profit per bundle
- More efficient capital usage

**Implementation:**
```
Bundle Structure:
1. Frontrun (buy token)
2. Victim TX 1
3. Victim TX 2
4. Victim TX 3
5. Backrun (sell token)
```

The bot identifies multiple victims trading the same token pair within the same block opportunity.

### 3. Contract Written in Huff

Huff is a low-level language that compiles directly to EVM bytecode.

**Why Huff over Solidity?**
- Smaller bytecode = lower deployment costs
- More gas-efficient execution
- Fine-grained control over storage and memory
- No unnecessary checks or abstractions

**Trade-offs:**
- Harder to write and maintain
- More prone to bugs
- Requires deep EVM knowledge
- Longer development time

For competitive MEV, the gas savings (often 10-30%) justify the complexity.

### 4. Salmonella Detection

"Salmonella" tokens are honeypots designed to trap MEV bots:

- Tokens that can only be sold by certain addresses
- Tokens with hidden transfer fees
- Tokens that blacklist bot contracts
- Tokens with pausable transfers

**Detection Methods:**
1. **Static Analysis:** Check bytecode for suspicious patterns
2. **Simulation:** Test buy and sell in simulation
3. **Blacklists:** Maintain list of known malicious tokens
4. **Heuristics:** Flag unusual ERC20 implementations

Rusty-Sando implements multiple layers to avoid these traps.

### 5. Token Dust Management

After many swaps, contracts accumulate small token amounts ("dust").

**Problems:**
- Increases storage costs
- Locks up capital
- Can interfere with future trades

**Solutions:**
- Periodic dust collection swaps
- Aggregating dust before swapping
- Token-specific dust thresholds
- Automated cleanup routines

### 6. Fast Concurrent EVM Simulations

Speed is critical in MEV. Rusty-Sando uses:

**Parallel Simulation:**
- Simulate multiple opportunities simultaneously
- Use async Rust for concurrency
- Fork state locally for fast execution

**Optimization Techniques:**
- State caching
- Incremental state updates
- Minimal validation (skip unnecessary checks)
- Custom EVM implementation

**Libraries:**
- `revm` (Rust EVM implementation)
- `ethers-rs` for Ethereum interactions
- `tokio` for async runtime

## MEV Strategies Explained

### Sandwich Attack Mechanics

**Step 1: Detection**
```
Monitor mempool → Identify large swap → Calculate price impact
```

**Step 2: Profit Calculation**
```
optimal_frontrun = f(victim_size, pool_reserves, gas_costs)
expected_profit = backrun_output - frontrun_cost - gas_fees
```

**Step 3: Bundle Construction**
```
If expected_profit > minimum_threshold:
    Create bundle [frontrun, victim_tx, backrun]
    Sign transactions
    Submit to Flashbots
```

**Step 4: Execution**
```
Block builder includes bundle → All 3 TXs execute atomically
```

### Optimal Trade Sizing

The bot must calculate optimal frontrun size:

Too small: Minimal profit
Too large: Excessive gas costs and slippage

**Formula (V2):**
```
Given pool reserves (R_in, R_out) and victim amount (V_in):
Optimal frontrun = sqrt(R_in * R_out * V_in) - R_in
```

This maximizes: (backrun_output - frontrun_input - gas)

### Gas Price Strategy

Critical considerations:

1. **Priority Fee:** Must outbid competitors
2. **Bundle Priority:** Flashbots score based on miner tips
3. **Gas Optimization:** Lower gas usage = higher profit margins

**Strategy:**
- Monitor current gas prices
- Calculate minimum viable priority fee
- Adjust based on profit margins
- Use EIP-1559 dynamic fees

## Technologies and Dependencies

### Rust Ecosystem

**Core Libraries:**
- `ethers-rs`: Ethereum interactions, signing, ABI encoding
- `tokio`: Async runtime for concurrent operations
- `revm`: Fast Rust EVM for simulations
- `artemis-core`: MEV framework foundation

**Utility Libraries:**
- `serde`: Serialization/deserialization
- `anyhow`: Error handling
- `tracing`: Logging and diagnostics
- `dotenv`: Configuration management

### Smart Contract Stack

**Huff:**
- Low-level EVM assembly language
- Direct bytecode generation
- Maximum gas efficiency

**Development Tools:**
- `foundry`: Testing and deployment
- `huffc`: Huff compiler
- `cast`: Ethereum CLI tools

### Infrastructure

**Node Requirements:**
- Archive node access (for historical state)
- WebSocket connection (for mempool streaming)
- Low latency (<50ms to validators)

**Flashbots:**
- Relay endpoint for bundle submission
- Searcher reputation system
- Bundle simulation API

## Unique Implementation Aspects

### 1. Artemis Framework Integration

Artemis provides elegant abstractions:

**Collectors:** Gather data (mempool TXs, new blocks, prices)
**Strategies:** Process data and identify opportunities
**Executors:** Submit profitable bundles

This separation of concerns allows:
- Easy testing of individual components
- Swapping implementations (e.g., different executors)
- Reusable modules across MEV strategies

### 2. Huff Smart Contracts

The contracts are written in pure EVM assembly via Huff:

**Benefits:**
- 30-40% gas savings vs Solidity
- Minimal bytecode size
- Perfect control over storage layout
- No compiler optimizations needed (already optimal)

**Example Structure:**
```
#define macro MAIN() = takes(0) returns(0) {
    // Get function selector
    0x00 calldataload 0xE0 shr

    // Route to function
    dup1 0xABCDEF eq swap_v2 jumpi
    dup1 0x123456 eq swap_v3 jumpi

    // Revert if no match
    0x00 0x00 revert

    swap_v2:
        SWAP_V2()
    swap_v3:
        SWAP_V3()
}
```

### 3. Multi-Threaded Simulation

Uses Rust's fearless concurrency:

```rust
// Pseudo-code
async fn simulate_opportunities(txs: Vec<PendingTx>) -> Vec<Opportunity> {
    let futures: Vec<_> = txs.iter()
        .map(|tx| tokio::spawn(simulate_single(tx)))
        .collect();

    join_all(futures).await
        .into_iter()
        .filter_map(|result| result.ok())
        .collect()
}
```

This allows processing hundreds of pending TXs per second.

### 4. Salmonella Detection Pipeline

Multi-stage filtering:

**Stage 1: Quick Checks**
- Is token on blacklist?
- Does it have unusual bytecode?
- Is contract verified?

**Stage 2: Static Analysis**
- Check for pausable functions
- Look for owner-controlled transfer logic
- Detect fee-on-transfer mechanisms

**Stage 3: Simulation**
- Simulate buy and immediate sell
- Verify output matches expected
- Test from different addresses

Only tokens passing all stages are sandwiched.

## Security Considerations

### 1. Private Key Management

**Critical:**
- Never commit private keys to git
- Use environment variables or key management systems
- Consider hardware wallets for hot wallets
- Rotate keys periodically

### 2. Smart Contract Security

**Risks:**
- Reentrancy attacks (though less relevant for sandwich contracts)
- Integer overflow/underflow (use Solidity 0.8+ or manual checks)
- Authorization issues (ensure only bot can call functions)

**Mitigations:**
- Extensive testing with Foundry
- Formal verification of critical functions
- Bug bounties before mainnet deployment

### 3. Bundle Privacy

**Flashbots Protection:**
- Bundles sent to Flashbots are private (not in public mempool)
- Prevents frontrunning of your frontrun
- Reduces failed transaction spam

**Risks:**
- Malicious block builders could steal strategies
- Bundle simulations might be monitored
- Competitor analysis of successful bundles

### 4. Economic Attacks

**Risks:**
- Salmonella tokens draining your funds
- Gas price manipulation
- Uncle bandit attacks (stealing bundles via block reorgs)

**Mitigations:**
- Conservative profit thresholds
- Salmonella detection
- Monitor for unusual activity

### 5. Operational Security

**Best Practices:**
- Run bot on secure, isolated infrastructure
- Monitor for unusual behavior
- Implement kill switches
- Limit maximum trade sizes
- Use separate hot/cold wallets

## Use Cases

### 1. Educational Learning

**For Developers:**
- Understanding MEV mechanics
- Learning Rust for blockchain
- Studying smart contract optimization
- Exploring Artemis framework

**For Researchers:**
- Analyzing MEV extraction patterns
- Studying market microstructure
- Researching fairness in DeFi

### 2. Competitive MEV Extraction

**Production Use:**
- Deploy as active sandwich bot
- Extract value from Uniswap trades
- Participate in MEV economy

**Requirements:**
- Significant capital (minimum $50k-100k)
- Low-latency infrastructure
- Ongoing maintenance and optimization
- Monitoring and alerting systems

### 3. Strategy Development

**Building Blocks:**
- Use as foundation for other MEV strategies
- Adapt code for different protocols
- Extend to other chains (BSC, Polygon, etc.)

### 4. Defense Research

**Protocol Developers:**
- Understand attack vectors
- Design MEV-resistant mechanisms
- Test protocol vulnerabilities

**Wallet Developers:**
- Implement sandwich protection
- Build transaction privacy features

## Getting Started

### Prerequisites

```bash
# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Foundry (for Huff contracts)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Huff compiler
cargo install huff_cli
```

### Configuration

Create `.env` file:

```env
# Ethereum RPC endpoint (archive node)
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# WebSocket endpoint for mempool
ETH_WS_URL=wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Flashbots relay
FLASHBOTS_RELAY=https://relay.flashbots.net

# Bot private key (NEVER commit this)
PRIVATE_KEY=0x...

# Minimum profit threshold (in ETH)
MIN_PROFIT_ETH=0.01

# Gas price limits
MAX_GAS_PRICE_GWEI=300
```

### Building

```bash
# Clone repository
git clone https://github.com/mouseless0x/rusty-sando.git
cd rusty-sando

# Build Huff contracts
cd contract
forge build

# Build Rust bot
cd ../bot
cargo build --release
```

### Testing

```bash
# Test smart contracts
cd contract
forge test -vvv

# Test bot (with mocked data)
cd ../bot
cargo test

# Integration tests
cargo test --features integration
```

### Running

```bash
# Dry run (simulation only, no submissions)
cargo run --release -- --dry-run

# Production mode
cargo run --release
```

### Monitoring

Key metrics to watch:

- **Opportunities Detected:** Potential sandwiches found
- **Simulations Run:** EVM simulations executed
- **Bundles Submitted:** Bundles sent to Flashbots
- **Bundles Landed:** Successful inclusions
- **Total Profit:** Cumulative earnings
- **Gas Spent:** Total gas costs

## Ethical Considerations

### The Controversy of Sandwich Attacks

Sandwich attacks are one of the most controversial forms of MEV:

**Arguments Against:**
1. **User Harm:** Direct value extraction from traders
2. **Worse Execution:** Users get worse prices than expected
3. **Inequality:** Only sophisticated actors can extract MEV
4. **Market Manipulation:** Artificial price movements
5. **Trust Erosion:** Makes DeFi seem predatory

**Arguments For:**
1. **Free Market:** Anyone can run bots, it's permissionless
2. **Efficiency:** Helps price discovery
3. **Slippage Education:** Encourages better user protection
4. **Technical Achievement:** Showcases blockchain capabilities
5. **Inevitable:** If not you, someone else will do it

### Impact on Users

**Real Costs:**
- Average sandwich extracts 0.5-2% of trade value
- Large trades can lose >5%
- Accumulated costs across ecosystem are millions daily

**User Protections:**
- Use aggregators with MEV protection (CoW Swap, 1inch)
- Set tight slippage tolerances
- Split large trades into smaller chunks
- Use private RPCs or Flashbots Protect

### Developer Responsibility

If deploying this bot:

1. **Understand the Impact:** You are taking value from other users
2. **Consider Alternatives:** Other MEV strategies are less harmful (arbitrage, liquidations)
3. **Contribute to Solutions:** Support MEV-minimization research
4. **Be Transparent:** Don't pretend this is victimless

### Regulatory Landscape

**Current Status:**
- No specific regulations on MEV
- Could be considered market manipulation
- May face scrutiny as regulators understand DeFi

**Future Possibilities:**
- Protocol-level MEV minimization
- Regulatory restrictions on certain MEV types
- User protection requirements

### Educational vs. Production Use

**Educational Use:** Running this bot to learn is valuable
**Production Use:** Deploying for profit has ethical implications

Consider:
- Are you comfortable with the value extraction?
- Could your skills be better used building positive-sum solutions?
- What's your contribution to the ecosystem?

## Learning Value

### What You'll Learn

#### 1. MEV Mechanics

- How sandwich attacks work at a technical level
- Bundle construction and submission
- Flashbots protocol
- Gas price optimization

#### 2. Rust Programming

- Async programming with Tokio
- Error handling patterns
- High-performance concurrent code
- Working with blockchain libraries

#### 3. Smart Contract Optimization

- Huff language and EVM assembly
- Gas optimization techniques
- Storage layout optimization
- Bytecode minimization

#### 4. System Design

- Event-driven architecture
- Collector-Strategy-Executor pattern
- Real-time data processing
- High-availability systems

#### 5. DeFi Protocols

- Uniswap V2/V3 internals
- AMM mathematics
- Price impact calculations
- Liquidity pool mechanics

### Skills Developed

- **Blockchain Development:** Deep understanding of Ethereum
- **Systems Programming:** High-performance Rust code
- **Financial Engineering:** MEV strategy optimization
- **DevOps:** Running production trading infrastructure
- **Security:** Protecting keys and funds

### Career Applications

Knowledge gained applies to:

- MEV research positions
- DeFi protocol development
- Trading firm engineering
- Blockchain security auditing
- Academic research

## Recommendations

### For Learners

**Do:**
- Study the code thoroughly
- Run simulations on testnets
- Understand each component before moving to next
- Read Artemis framework documentation
- Experiment with modifications

**Don't:**
- Deploy to mainnet without deep understanding
- Use real funds you can't afford to lose
- Expect easy profits (competition is intense)
- Ignore security considerations

### For Researchers

**Opportunities:**
- Analyze sandwich attack patterns
- Study MEV distribution across actors
- Research mitigation techniques
- Compare different MEV extraction methods
- Model economic impacts

### For Protocol Developers

**Insights:**
- See how your protocol is exploited
- Understand user experience degradation
- Design MEV-resistant features
- Consider protocol-level MEV capture (MEV-Share)

### For Competitive Use

**Requirements:**
1. **Capital:** $100k+ recommended
2. **Infrastructure:** Low-latency servers near validators
3. **Expertise:** Deep Rust and EVM knowledge
4. **Time:** Full-time monitoring and optimization
5. **Risk Tolerance:** Possible complete loss of capital

**Reality Check:**
- Competition is extreme
- Profit margins are thin
- Requires constant updates
- Market conditions change rapidly
- May become obsolete (PBS, MEV-Share, etc.)

### For Ethical Deployment

If you choose to run this:

1. **Set Reasonable Limits:** Don't sandwich small trades
2. **Consider User Impact:** Maybe focus on other MEV types
3. **Contribute Back:** Share improvements, support research
4. **Be Honest:** Don't hide what you're doing
5. **Stay Informed:** Follow MEV research and ethics discussions

## Conclusion

Rusty-Sando represents a technically impressive implementation of sandwich attack bots, showcasing advanced techniques in Rust programming, smart contract optimization, and MEV extraction. It serves as an excellent educational resource for understanding MEV mechanics and building high-performance blockchain applications.

However, it also exemplifies the controversial nature of MEV extraction, particularly sandwich attacks that directly harm users. While the code is open-source and technically fascinating, deploying it for profit raises significant ethical questions about value extraction vs. value creation in the DeFi ecosystem.

For learners and researchers, this repository offers invaluable insights into:
- Modern MEV infrastructure
- High-performance Rust development
- Smart contract optimization techniques
- DeFi protocol internals
- Event-driven system architecture

For those considering production deployment, carefully weigh the technical challenges, capital requirements, competitive landscape, and most importantly, the ethical implications of extracting value from other users' transactions.

The future of MEV is evolving toward more equitable solutions like MEV-Share, protocol-level MEV capture, and user-protecting mechanisms. Understanding projects like Rusty-Sando is crucial for building these better alternatives.

## Additional Resources

- **Artemis Framework:** https://github.com/paradigmxyz/artemis
- **Huff Language:** https://huff.sh/
- **Flashbots Documentation:** https://docs.flashbots.net/
- **MEV Research:** https://ethereum.org/en/developers/docs/mev/
- **Uniswap V2 Whitepaper:** https://uniswap.org/whitepaper.pdf
- **Uniswap V3 Whitepaper:** https://uniswap.org/whitepaper-v3.pdf

## Repository Status

As of August 2023, this repository is archived and no longer actively maintained. While the code remains educational, it may not work out-of-the-box with current Ethereum infrastructure. Consider it a reference implementation rather than production-ready software.

For current MEV development, explore:
- Updated Artemis strategies
- MEV-Share integration
- Alternative MEV types (arbitrage, liquidations)
- MEV protection services
