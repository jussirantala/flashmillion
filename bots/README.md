# MEV Educational Bots Collection

**⚠️ FOR EDUCATIONAL USE ONLY - PRIVATE BLOCKCHAIN ONLY**

This repository contains four production-quality TypeScript bots demonstrating various MEV (Maximal Extractable Value) strategies. All bots are for **educational purposes only** and should only be used on private blockchains or testnets.

---

## 📚 Bots Overview

| Bot | Type | Ethics | Complexity | Educational Value |
|-----|------|--------|------------|-------------------|
| **[Sandwich Bot](#1-sandwich-attack-bot)** | MEV Attack | ❌ Harmful | High | ⭐⭐⭐⭐⭐ |
| **[Flashloan Arbitrage](#2-aave-flashloan-arbitrage-bot)** | DeFi Strategy | ✅ Legitimate | Medium | ⭐⭐⭐⭐ |
| **[Front-Running Bot](#3-aave-front-running-bot)** | MEV Attack | ❌ Harmful | High | ⭐⭐⭐⭐⭐ |
| **[Back-Running Bot](#4-aave-back-running-bot)** | MEV Strategy | ⚠️ Gray Area | Medium | ⭐⭐⭐⭐ |

---

## 1. Sandwich Attack Bot

**Location**: `/sandwich-bot/`

### What It Does
Detects large pending swaps in the mempool and executes a three-transaction sandwich attack:
1. **Frontrun**: Buy token before victim (pushes price up)
2. **Victim**: Their transaction executes at inflated price
3. **Backrun**: Sell token immediately (profit from price increase)

### Key Features
- ✅ Mempool monitoring via WebSocket
- ✅ Profit calculation using Uniswap V2 formula
- ✅ Smart contract integration
- ✅ Gas price bidding (120% of victim's gas)
- ✅ Salmonella detection (basic)

### Educational Topics
- AMM price impact mechanics
- Mempool transaction ordering
- Gas price auctions
- Constant product formula (x * y = k)
- MEV extraction techniques

### Ethics
❌ **Harmful** - Directly exploits regular users, causing 0.5-2% loss per trade

### Quick Start
```bash
cd sandwich-bot
npm install
cp .env.example .env
npm run dev
```

**Read Full Docs**: [sandwich-bot/README.md](sandwich-bot/README.md)

---

## 2. Aave Flashloan Arbitrage Bot

**Location**: `/aave-flashloan-bot/`

### What It Does
Scans for price differences across DEXs and executes flashloan arbitrage:
1. Borrow tokens from Aave (0.05% fee, no collateral)
2. Buy on cheaper DEX (e.g., Uniswap)
3. Sell on expensive DEX (e.g., Sushiswap)
4. Repay flashloan + fee
5. Keep the profit

### Key Features
- ✅ Aave V3 flashloan integration
- ✅ Multi-DEX price scanning (Uniswap V2, Sushiswap)
- ✅ Profitability calculator (fees + gas)
- ✅ On-chain simulation before execution
- ✅ Automatic opportunity detection

### Educational Topics
- Flashloan mechanics
- Cross-DEX arbitrage
- Capital efficiency
- Fee optimization
- DeFi composability

### Ethics
✅ **Legitimate** - Improves market efficiency, doesn't harm users directly

### Quick Start
```bash
cd aave-flashloan-bot
npm install
cp .env.example .env
npm run dev
```

**Read Full Docs**: [aave-flashloan-bot/README.md](aave-flashloan-bot/README.md)

---

## 3. Aave Front-Running Bot

**Location**: `/aave-frontrun-bot/`

### What It Does
Monitors Aave transactions and identifies front-running opportunities:
- **Deposits**: Manipulate interest rates
- **Borrows**: Reduce liquidity availability
- **Liquidations**: Capture liquidation bonus (5-10%)

**NOTE**: This bot **does NOT execute** attacks. It only detects and explains them.

### Key Features
- ✅ Real-time Aave transaction monitoring
- ✅ Opportunity analysis (deposits, borrows, liquidations)
- ✅ Educational explanations for each attack type
- ✅ Protection method recommendations
- ✅ Detection-only (no execution)

### Educational Topics
- MEV attack vectors
- Transaction ordering impact
- Gas price manipulation
- Protocol exploitation
- MEV protection methods

### Ethics
❌ **Harmful & Potentially Illegal** - Front-running harms users and may violate laws

### Quick Start
```bash
cd aave-frontrun-bot
npm install
cp .env.example .env
npm run dev
```

**Read Full Docs**: [aave-frontrun-bot/README.md](aave-frontrun-bot/README.md)

---

## 4. Aave Back-Running Bot

**Location**: `/aave-backrun-bot/`

### What It Does
Monitors Aave events and executes transactions AFTER them to capture opportunities:
- **Arbitrage**: After large trades create price impact
- **Liquidation Cascades**: After liquidations change prices
- **Rate Arbitrage**: After utilization changes interest rates

### Key Features
- ✅ Real-time Aave event monitoring
- ✅ Opportunity detection (borrows, liquidations, repays)
- ✅ Strategy explanations (arbitrage, cascades, rates)
- ✅ Market efficiency analysis
- ✅ Educational output

### Educational Topics
- Back-running vs front-running
- Market efficiency
- Liquidation cascades
- Interest rate dynamics
- Acceptable MEV

### Ethics
⚠️ **Gray Area** - Less harmful than front-running, often improves market efficiency

### Quick Start
```bash
cd aave-backrun-bot
npm install
cp .env.example .env
npm run dev
```

**Read Full Docs**: [aave-backrun-bot/README.md](aave-backrun-bot/README.md)

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- A local blockchain (Hardhat, Ganache, or Anvil)
- Basic understanding of Ethereum and DeFi

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/flashmillion.git
cd flashmillion

# Choose a bot
cd sandwich-bot  # or aave-flashloan-bot, aave-frontrun-bot, aave-backrun-bot

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run in dry-run mode (safe)
npm run dev
```

### Safety Settings

All bots default to **dry-run mode** for safety:

```env
# In .env file
ENABLE_EXECUTION=false  # Never execute real transactions
DRY_RUN=true           # Simulation only
```

**⚠️ IMPORTANT**: Keep these settings for educational use. Only change on private blockchains.

---

## 📊 Comparison Matrix

### Profitability (Theoretical)

| Bot | Avg Profit | Success Rate | Gas Cost | Competition |
|-----|-----------|--------------|----------|-------------|
| **Sandwich** | 0.5-2% | 10-15% | High | Very High |
| **Flashloan Arb** | 0.1-0.5% | 5-10% | Medium | High |
| **Front-run Liquidation** | 5-10% | 20-30% | High | Very High |
| **Back-run** | 0.1-0.3% | 15-20% | Medium | Medium |

### Technical Complexity

| Bot | Mempool | Smart Contract | DEX Integration | Difficulty |
|-----|---------|----------------|-----------------|------------|
| **Sandwich** | ✅ | ✅ | ✅ | Hard |
| **Flashloan Arb** | ❌ | ✅ | ✅ | Medium |
| **Front-run** | ✅ | ❌ | ❌ | Hard |
| **Back-run** | ✅ | ❌ | ✅ | Medium |

### Ethics Rating

| Bot | User Harm | Legality | Community View | Recommended Use |
|-----|-----------|----------|----------------|-----------------|
| **Sandwich** | ❌❌❌ High | ⚠️ Questionable | ❌ Unethical | Education only |
| **Flashloan Arb** | ✅ None | ✅ Legal | ✅ Acceptable | Production OK |
| **Front-run** | ❌❌ High | ❌ Illegal | ❌ Unethical | Education only |
| **Back-run** | ⚠️ Low | ⚠️ Gray | ⚠️ Debated | Research only |

---

## 🎓 Learning Path

### For Complete Beginners

1. **Start**: Read CLAUDE.md for project overview
2. **Understand**: Read context/tutorials/understanding-sandwich-attacks.md
3. **Learn**: Read context/tutorials/preventing-front-running-attacks.md
4. **Try**: Run Flashloan Arbitrage Bot (most legitimate)
5. **Analyze**: Run Sandwich Bot in dry-run mode
6. **Compare**: Run Front-running Bot (detection only)
7. **Advanced**: Run Back-running Bot

### For Developers

1. Study the **Flashloan Arbitrage Bot** code first (cleanest architecture)
2. Understand **Sandwich Bot** mechanics (most educational)
3. Analyze **Front-running Bot** detection (security insights)
4. Explore **Back-running Bot** strategies (market efficiency)

### For Researchers

1. Run all bots in parallel on testnet
2. Analyze detected opportunities
3. Study competition and profitability
4. Research MEV protection methods
5. Build your own MEV-resistant protocols

---

## 🛡️ MEV Protection

### For Users

Protect yourself from MEV attacks:

| Protection | Type | Cost | Effectiveness |
|------------|------|------|---------------|
| **Flashbots Protect** | Private RPC | Free | ⭐⭐⭐⭐⭐ |
| **MEV-Blocker** | Private RPC | Free | ⭐⭐⭐⭐ |
| **CoW Swap** | DEX Aggregator | 0 fee | ⭐⭐⭐⭐⭐ |
| **Low Slippage** | Setting | Free | ⭐⭐⭐ |
| **Limit Orders** | Strategy | Free | ⭐⭐⭐⭐ |

### For Protocols

Build MEV-resistant protocols:
- Batch auctions (CoW Protocol)
- Time-weighted AMMs
- MEV redistribution (MEV-Share)
- Private mempools
- Commit-reveal schemes

---

## 📖 Documentation

### Project Documentation
- **[CLAUDE.md](CLAUDE.md)** - Project overview and guidelines
- **[context/INDEX.md](context/INDEX.md)** - 76 files of MEV documentation

### Bot-Specific READMEs
- **[sandwich-bot/README.md](sandwich-bot/README.md)** - Sandwich attack implementation
- **[aave-flashloan-bot/README.md](aave-flashloan-bot/README.md)** - Flashloan arbitrage
- **[aave-frontrun-bot/README.md](aave-frontrun-bot/README.md)** - Front-running detection
- **[aave-backrun-bot/README.md](aave-backrun-bot/README.md)** - Back-running strategies

### Educational Guides
- **[context/tutorials/understanding-sandwich-attacks.md](context/tutorials/understanding-sandwich-attacks.md)** - 1500+ line comprehensive guide
- **[context/tutorials/preventing-front-running-attacks.md](context/tutorials/preventing-front-running-attacks.md)** - 850+ line protection guide
- **[context/discussions/flashloan-vs-mev-analysis.md](context/discussions/flashloan-vs-mev-analysis.md)** - Strategic analysis

---

## ⚠️ Legal & Ethical Disclaimer

### IMPORTANT WARNINGS

**❌ DO NOT:**
- Use on mainnet with real funds
- Attack real users
- Deploy for profit extraction
- Ignore legal implications
- Harm the DeFi ecosystem

**✅ DO:**
- Use for education only
- Test on private blockchains
- Build MEV protections
- Understand ethical implications
- Contribute to MEV research

### Legal Notice

**This software is provided for educational purposes only.**

- MEV attacks may be **ILLEGAL** in your jurisdiction
- Front-running can constitute **MARKET MANIPULATION**
- Sandwich attacks **HARM REAL USERS**
- You are **FULLY RESPONSIBLE** for your actions
- The authors **DISCLAIM ALL LIABILITY**

By using this code, you acknowledge:
1. You understand the legal risks
2. You will only use for education/research
3. You will not harm real users
4. You accept full responsibility

**Consult legal counsel before any MEV-related activities.**

---

## 🤝 Contributing

We welcome contributions that:
- ✅ Improve educational value
- ✅ Add MEV protection methods
- ✅ Enhance documentation
- ✅ Fix bugs or security issues

We do NOT accept:
- ❌ Optimizations for attacking users
- ❌ Evasion of MEV protections
- ❌ Harmful features

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## 📜 License

MIT License - For Educational Use Only

See [LICENSE](LICENSE) for full text.

---

## 🙏 Acknowledgments

Built with knowledge from:
- Flashbots research team
- Aave protocol documentation
- MEV research community
- DeFi security researchers
- Ethereum developer community

**Special thanks** to everyone working to make DeFi more fair and secure.

---

## 📞 Questions?

- **Documentation**: Check [context/INDEX.md](context/INDEX.md)
- **Guides**: See [context/tutorials/](context/tutorials/)
- **Issues**: Open a GitHub issue
- **Research**: Join Flashbots Discord

---

**Remember**: Use this knowledge to BUILD PROTECTIONS, not to attack users. 🛡️

The future of DeFi depends on ethical developers who understand MEV and work to eliminate it.
