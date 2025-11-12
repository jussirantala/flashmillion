**Source:** https://github.com/smolmusk/arbi
**Date:** August 2025

# Arbi - Arbitrage Flashloan Executor by smolmusk

**Author:** smolmusk
**Stars:** 24
**Language:** Solidity (52.4%), TypeScript (46.1%)
**License:** Not specified
**Last Updated:** August 2025

## Overview

Arbi is a production-grade arbitrage execution system that combines Solidity smart contracts with a TypeScript bot for automated orderbook arbitrage trading on Ethereum. The system leverages flash loans from Morpho and Balancer protocols and integrates with the 0x Swap API for quote discovery and trade execution. Transactions are routed through Flashbots Protect RPC to prevent frontrunning.

## Project Description

According to the repository, this is a "Production-grade arbitrage executor with flash loans (Morpho, Balancer) and a Node.js strategy bot leveraging 0x Swap API." The system is designed for orderbook-based arbitrage opportunities rather than traditional AMM pool arbitrage.

## Repository Structure

```
arbi/
├── contracts/              # Solidity executor contract
│   ├── Executor.sol       # Main arbitrage executor
│   ├── interfaces/        # Protocol interfaces
│   └── libraries/         # Helper libraries
│
├── bot/                   # TypeScript strategy bot
│   ├── src/
│   │   ├── scanner.ts    # Opportunity scanner
│   │   ├── pricer.ts     # Price calculation
│   │   ├── executor.ts   # Transaction submission
│   │   └── config.ts     # Configuration management
│   ├── package.json      # Bot dependencies
│   └── tsconfig.json     # TypeScript configuration
│
├── ops/                   # Production deployment
│   ├── systemd/          # Service configuration
│   └── monitoring/       # Monitoring scripts
│
├── scripts/              # Deployment scripts
├── test/                 # Test suite
└── README.md            # Documentation
```

## Core Features

### 1. Dual Flash Loan Provider Support

**Morpho Flash Loans:**
- Continuous availability through single approval
- Uses `forceApprove` for ongoing access
- Lower gas costs for repeated executions
- No explicit repayment needed per transaction

**Balancer Flash Loans:**
- Explicit repayment after each loan
- Wide token availability
- Standard flash loan interface
- Fallback option if Morpho unavailable

### 2. 0x Protocol Integration

**0x Swap API Features:**
- Access to orderbook liquidity
- Professional market makers
- Quote aggregation across sources
- Better pricing than AMM pools alone
- Limit order support

**Orderbook Arbitrage:**
- Finds discrepancies in 0x orderbooks
- Compares with AMM pool prices
- Executes profitable spreads
- Automated quote requests

### 3. Flashbots Protection

**Private Transaction Routing:**
- Prevents frontrunning attacks
- MEV protection for strategies
- No public mempool exposure
- Guaranteed execution order

**Flashbots Protect RPC:**
- Transactions sent privately
- Builder network inclusion
- No failed transaction costs
- Priority ordering control

### 4. Security-First Design

**OpenZeppelin Patterns:**
- `Ownable2Step`: Staged ownership transfers
- `Pausable`: Emergency circuit breaker
- `ReentrancyGuard`: Protection against recursive calls
- `SafeERC20`: Safe token operations

**Access Controls:**
- Whitelisted bot EOA addresses
- Owner-only administrative functions
- Restricted execute permissions
- Configured allowlists for 0x contracts

### 5. Automated Profit Extraction

**Treasury System:**
- Automatic profit sweeps
- Designated treasury wallet
- No manual withdrawal needed
- Real-time profit tracking

## Technology Stack

### Smart Contracts (52.4%)

**Language:** Solidity
**Framework:** Foundry (forge 1.2+)

**Key Technologies:**
- OpenZeppelin Contracts
- Morpho flash loan interface
- Balancer vault interface
- 0x Exchange integration

### Bot/Strategy (46.1%)

**Language:** TypeScript
**Runtime:** Node.js 20+

**Key Libraries:**
- ethers.js (Ethereum interaction)
- 0x API client
- Web3 utilities
- Configuration management

## Smart Contract Implementation

### Executor Contract Features

**Whitelisting System:**
- 0x ExchangeProxy whitelisted
- 0x AllowanceTarget whitelisted
- Bot EOA addresses configured
- Restricted execution access

**Access Control:**
```solidity
// Ownable2Step for safe ownership transfer
contract Executor is Ownable2Step, Pausable, ReentrancyGuard {
    // Only whitelisted bots can execute
    mapping(address => bool) public authorizedBots;

    modifier onlyBot() {
        require(authorizedBots[msg.sender], "Not authorized");
        _;
    }
}
```

**Flash Loan Integration:**
- Morpho: One-time `forceApprove` for continuous use
- Balancer: Per-transaction repayment
- Automatic protocol selection
- Fallback mechanisms

**Safety Features:**
- Pausable for emergencies
- Reentrancy protection on all external calls
- Safe ERC20 operations
- Input validation

## Bot Architecture

### Multi-Step Evaluation Process

**1. Token Pair Scanning:**
- Monitors configured token pairs
- Continuous price checking
- Real-time opportunity detection
- Configurable pair list

**2. Price Discrepancy Identification:**
- Compares 0x orderbook prices
- Compares AMM pool prices
- Calculates potential profit
- Factors in fees and costs

**3. Position Sizing:**
- Configurable minimum profit threshold
- Example: $100M minimum in documentation
- Maximum flash amount limits
- Example: $100B maximum
- Gas cost buffer calculations

**4. Quote Requests:**
- Queries 0x orderbook API
- Gets best available prices
- Validates quote freshness
- Confirms liquidity availability

**5. Transaction Submission:**
- Submits via Flashbots Protect RPC
- Private mempool routing
- Builder network distribution
- Confirmation monitoring

### Configuration Parameters

**Profitability Settings:**
- `MIN_PROFIT_USD`: Minimum profit threshold (e.g., $100M)
- `MAX_FLASH_AMOUNT`: Maximum flash loan (e.g., $100B)
- `GAS_BUFFER`: Extra gas cost allowance
- `SLIPPAGE_TOLERANCE`: Price slippage limits

**Token Configuration:**
- USDC address
- WETH address
- Additional trading pairs
- Token decimals

**API Credentials:**
- 0x API key
- RPC endpoint URLs
- Flashbots signer key
- Executor contract address

## Deployment Process

### Smart Contract Deployment

**Prerequisites:**
- Foundry installed (forge 1.2+)
- Environment variables configured
- Treasury address prepared
- Bot EOA address ready

**Deployment Script:**
```bash
# Set environment variables
export PRIVATE_KEY=<deployer_private_key>
export TREASURY_ADDRESS=<treasury_wallet>
export BOT_EOA=<bot_wallet_address>

# Deploy executor contract
forge script scripts/Deploy.s.sol --broadcast --rpc-url <RPC_URL>
```

**Post-Deployment:**
- Verify contract on Etherscan
- Configure whitelist addresses
- Approve 0x contracts
- Test with small amounts

### Bot Setup

**Installation:**
```bash
cd bot/
npm install
npm run build
```

**Configuration (.env):**
```bash
# RPC Endpoints
RPC_URL=<ethereum_rpc>
FLASHBOTS_RPC=<flashbots_protect_rpc>

# Contract Addresses
EXECUTOR_ADDRESS=<deployed_executor>
ZERO_X_PROXY=<0x_exchange_proxy>

# 0x API
ZERO_X_API_KEY=<api_key>
ZERO_X_API_URL=https://api.0x.org

# Token Addresses
USDC_ADDRESS=0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
WETH_ADDRESS=0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2

# Strategy Parameters
MIN_PROFIT_USD=100000000
MAX_FLASH_AMOUNT=100000000000
GAS_BUFFER=20

# Private Key
BOT_PRIVATE_KEY=<bot_wallet_private_key>
```

**Running the Bot:**
```bash
npm run start
```

## Orderbook Arbitrage Strategy

### How It Works

**Traditional AMM Arbitrage:**
- Exploits price differences between Uniswap/Sushiswap
- Competes with many other bots
- High gas costs
- Front-running risks

**Orderbook Arbitrage (Arbi's Approach):**
- Uses 0x professional orderbooks
- Finds spreads between orderbook and AMM
- Flash loan finances both sides
- Private execution via Flashbots

### Example Arbitrage Flow

```
1. Bot Detects Opportunity:
   - WETH on 0x orderbook: $2000
   - WETH on Uniswap pool: $2010
   - Potential profit: $10 per ETH

2. Size Position:
   - Calculate max profitable amount
   - Check flash loan availability
   - Verify gas costs < profit
   - Confirm minimum profit threshold

3. Request Flash Loan:
   - Borrow USDC from Morpho/Balancer
   - Amount: calculated optimal size

4. Execute Arbitrage:
   - Buy WETH from 0x orderbook ($2000)
   - Sell WETH to Uniswap pool ($2010)
   - Net profit: $10 per ETH (minus fees)

5. Repay and Profit:
   - Repay flash loan + fee
   - Send profit to treasury
   - Transaction completes atomically
```

## Key Constraints and Requirements

### Critical Requirement: Private Transactions

**Documentation Emphasis:**
"Use private transactions to avoid frontrunning."

**Why This Matters:**
- Orderbook arbitrage is time-sensitive
- Public mempool exposure = front-running risk
- MEV bots monitor mempool constantly
- Flashbots ensures first-look protection

**Implementation:**
- All bot transactions via Flashbots Protect RPC
- No public RPC for execution
- Private transaction bundles
- Builder network priority

### Whitelisting Requirements

**0x Contracts:**
- ExchangeProxy must be whitelisted
- AllowanceTarget must be whitelisted
- Required for token approvals
- Configured during deployment

**Bot Addresses:**
- Only authorized bot EOAs can execute
- Multi-bot support possible
- Owner can add/remove bots
- Security against unauthorized access

## Production Operations

### Systemd Service Configuration

**Service File (`/ops/systemd/arbi.service`):**
```ini
[Unit]
Description=Arbi Arbitrage Bot
After=network.target

[Service]
Type=simple
User=arbi
WorkingDirectory=/home/arbi/bot
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**Management Commands:**
```bash
# Start service
sudo systemctl start arbi

# Enable on boot
sudo systemctl enable arbi

# Check status
sudo systemctl status arbi

# View logs
journalctl -u arbi -f
```

### Monitoring

**Key Metrics to Track:**
- Execution count
- Success rate
- Total profit
- Gas costs
- Failed transactions
- API response times
- Flash loan availability

**Alerting:**
- Low wallet balance
- Failed executions
- API errors
- Contract paused
- Unusual gas prices

## Unique Characteristics

### 1. Orderbook Focus

Unlike most arbitrage bots that focus on AMM-to-AMM arbitrage, Arbi specifically targets orderbook opportunities through 0x integration. This provides access to professional market maker liquidity.

### 2. Production-Grade Architecture

The repository explicitly describes itself as "production-grade," including:
- Systemd service configuration
- Monitoring infrastructure
- Security best practices
- Operational documentation

### 3. Dual Flash Loan Support

Supporting both Morpho and Balancer provides:
- Redundancy if one protocol unavailable
- Flexibility in token selection
- Optimization opportunities
- Risk mitigation

### 4. TypeScript Bot

Using TypeScript (vs JavaScript) provides:
- Type safety
- Better IDE support
- Fewer runtime errors
- Professional development experience

## Repository Metrics

**Community Engagement:**
- Stars: 24
- Forks: 23
- Commits: 2
- Open Issues: 0

**Language Distribution:**
- Solidity: 52.4%
- TypeScript: 46.1%
- Other: 1.5% (config, docs)

## Security Considerations

### Smart Contract Security

**OpenZeppelin Standards:**
- Audited libraries used throughout
- Industry best practices
- Well-tested patterns
- Regular updates

**Custom Security Measures:**
- Bot whitelist prevents unauthorized access
- Pausable for emergency stops
- Reentrancy guards on all entry points
- Safe token transfer operations

### Operational Security

**Private Key Management:**
- Separate bot and deployer keys
- Treasury wallet isolation
- Environment variable storage
- Never commit to repository

**Transaction Security:**
- Flashbots prevents frontrunning
- Private mempool routing
- No MEV extraction by others
- Guaranteed execution order

## Limitations and Challenges

### Market Competition

**Orderbook Arbitrage Challenges:**
- Professional market makers compete
- High-frequency trading firms active
- Speed critical for profitability
- Need for optimal infrastructure

### Infrastructure Requirements

**Necessary Resources:**
- Fast RPC endpoints (low latency)
- Reliable Flashbots connection
- Monitoring and alerting system
- 24/7 uptime infrastructure

### Configuration Complexity

**Setup Requirements:**
- Foundry framework knowledge
- TypeScript/Node.js experience
- Understanding of 0x protocol
- Flash loan mechanism familiarity

## Use Cases

### 1. Professional Trading

**Ideal For:**
- Trading firms with infrastructure
- Professional arbitrageurs
- Market makers diversifying strategies
- Well-funded individual traders

### 2. Educational/Research

**Learning Opportunities:**
- Orderbook arbitrage mechanics
- Flash loan integration patterns
- 0x protocol usage
- Flashbots implementation

### 3. Strategy Development

**Base for Building:**
- Custom orderbook strategies
- Multi-protocol arbitrage
- MEV strategy development
- Trading bot frameworks

## Comparison with AMM-Only Bots

### Advantages

✅ **Orderbook Access** - Professional market maker liquidity
✅ **Production-Ready** - Systemd, monitoring included
✅ **Dual Flash Loans** - Morpho and Balancer support
✅ **MEV Protected** - Flashbots integration
✅ **Type Safe** - TypeScript implementation

### Disadvantages

❌ **Complex Setup** - Requires multiple services
❌ **API Dependency** - Relies on 0x API
❌ **Infrastructure Costs** - Needs reliable hosting
❌ **Competitive** - Faces professional traders

## Best Practices for Users

### Before Deployment

1. **Understand Components**
   - Study Solidity executor contract
   - Review TypeScript bot logic
   - Understand 0x integration
   - Learn Flashbots usage

2. **Test Thoroughly**
   - Deploy on testnet first
   - Test flash loan mechanisms
   - Verify 0x API integration
   - Confirm Flashbots routing

3. **Prepare Infrastructure**
   - Set up reliable RPC endpoints
   - Configure monitoring
   - Prepare alerting
   - Test service restart mechanisms

### During Operation

1. **Monitor Continuously**
   - Track execution success rate
   - Monitor profitability
   - Watch for API errors
   - Check gas costs

2. **Maintain Security**
   - Rotate keys periodically
   - Monitor contract balance
   - Review transaction logs
   - Update dependencies

3. **Optimize Strategy**
   - Adjust profit thresholds
   - Refine token pairs
   - Optimize gas usage
   - Improve execution speed

## Enhancement Opportunities

### Additional Flash Loan Providers

```solidity
// Add Aave V3 support
interface IAavePool {
    function flashLoan(
        address receiver,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
}
```

### Multi-DEX Routing

```typescript
// Check multiple AMMs for best execution
const amms = ['uniswap', 'sushiswap', 'curve'];
for (const amm of amms) {
    const price = await getPrice(amm, token);
    // Compare with orderbook
}
```

### Advanced Monitoring

```typescript
// Prometheus metrics
const prometheus = require('prom-client');
const profitCounter = new prometheus.Counter({
    name: 'arbi_profit_total',
    help: 'Total profit in USD'
});
```

## Technical Requirements

### Minimum Requirements

**Development:**
- Foundry 1.2+
- Node.js 20+
- TypeScript compiler
- Git

**Deployment:**
- Ethereum RPC endpoint
- Flashbots Protect RPC access
- 0x API key
- Wallet with ETH for gas

### Recommended Setup

**Production Infrastructure:**
- Dedicated server/VPS
- Low-latency RPC (not public)
- Systemd service management
- Monitoring and alerting
- Log aggregation
- Backup systems

## Key Takeaways

1. **Production-Grade** - Designed for real deployment, not just education
2. **Orderbook Focus** - Unique approach using 0x protocol
3. **Dual Flash Loans** - Morpho and Balancer support
4. **MEV Protected** - Flashbots integration essential
5. **Type Safe** - TypeScript for reliability
6. **Security First** - OpenZeppelin patterns throughout
7. **Complex Setup** - Requires technical expertise
8. **Infrastructure Dependent** - Needs reliable services

## Conclusion

Arbi represents a **production-grade orderbook arbitrage system** that differentiates itself from typical AMM arbitrage bots through its 0x protocol integration and emphasis on professional deployment practices.

**Best Suited For:**
- Professional trading operations
- Well-funded arbitrageurs
- Firms with technical infrastructure
- Developers building trading systems

**Less Ideal For:**
- Beginners to DeFi
- Users without infrastructure
- Those seeking simple setup
- Casual experimenters

**Perfect For:**
- Orderbook arbitrage strategies
- Production trading deployment
- Learning professional bot architecture
- Building advanced MEV strategies

The repository's focus on production readiness, security, and orderbook opportunities makes it a valuable resource for serious arbitrage traders and developers building professional-grade trading systems in the DeFi ecosystem.
