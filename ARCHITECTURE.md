# Flash Loan Arbitrage & MEV Bot Architecture Diagrams

This document provides visual architecture diagrams for the various flash loan and MEV bot implementations documented in this repository.

---

## Table of Contents

1. [Overall System Architecture](#overall-system-architecture)
2. [Sandwich Bot Architecture (All Implementations)](#sandwich-bot-architecture)
3. [TypeScript Implementation Flow](#typescript-implementation-flow)
4. [Rust Implementation Flow](#rust-implementation-flow)
5. [Smart Contract Execution Flow](#smart-contract-execution-flow)
6. [MEV Protection Strategies](#mev-protection-strategies)

---

## Overall System Architecture

```mermaid
graph TB
    subgraph "Documentation Repository"
        A[Core Protocols<br/>7 files] --> Z[INDEX.md<br/>Master Catalog]
        B[Tutorial Guides<br/>21 files] --> Z
        C[MEV Implementation<br/>5 files] --> Z
        D[GitHub Examples<br/>41 files] --> Z
        E[Community Discussions<br/>2 files] --> Z
    end

    subgraph "Implementation Guides"
        C --> F[Roadmap Guide<br/>$1K-5K Budget]
        C --> G[Solidity + TypeScript<br/>Beginner-Friendly]
        C --> H[TypeScript Only<br/>Fastest Start]
        C --> I[Rust High-Performance<br/>Production-Grade]
        C --> J[Python Analysis<br/>Learning Only]
    end

    subgraph "Use Cases"
        F --> K[Phase 1: Learning]
        F --> L[Phase 2: Testnet]
        F --> M[Phase 3: L2 Deployment]
        F --> N[Phase 4: Mainnet Optional]
    end

    style C fill:#ff9,stroke:#f90,stroke-width:4px
    style Z fill:#9f9,stroke:#090,stroke-width:4px
```

---

## Sandwich Bot Architecture

### High-Level Component Diagram

```mermaid
graph LR
    subgraph "Monitoring Layer"
        A[WebSocket RPC] --> B[Mempool Monitor]
        B --> C{Filter Transactions}
    end

    subgraph "Analysis Layer"
        C --> D[Parse Swap Transaction]
        D --> E[Whitelist Check]
        E --> F[Salmonella Detector]
        F --> G[Profit Calculator]
    end

    subgraph "Execution Layer"
        G --> H{Profitable?}
        H -->|Yes| I[Build Sandwich TX]
        H -->|No| J[Skip]
        I --> K[Submit to Blockchain]
    end

    subgraph "Smart Contract"
        K --> L[Flash Swap Borrow]
        L --> M[Front-run Buy]
        M --> N[Victim TX Executes]
        N --> O[Back-run Sell]
        O --> P[Repay Flash Swap + Fee]
        P --> Q{Profitable?}
        Q -->|Yes| R[Keep Profit]
        Q -->|No| S[Revert Transaction]
    end

    style F fill:#f99,stroke:#f00,stroke-width:2px
    style G fill:#9f9,stroke:#090,stroke-width:2px
    style R fill:#9ff,stroke:#09f,stroke-width:2px
```

### Data Flow Diagram

```mermaid
sequenceDiagram
    participant Mempool
    participant Monitor
    participant Analyzer
    participant Salmonella
    participant Profit
    participant Executor
    participant Contract
    participant DEX

    Mempool->>Monitor: Pending TX
    Monitor->>Analyzer: Parse Transaction
    Analyzer->>Analyzer: Extract: tokenIn, tokenOut, amount
    Analyzer->>Salmonella: Check if honeypot
    Salmonella-->>Analyzer: Safe/Unsafe
    alt Token is safe
        Analyzer->>Profit: Calculate profitability
        Profit->>Profit: Simulate sandwich
        Profit-->>Analyzer: Estimated profit
        alt Profitable
            Analyzer->>Executor: Execute sandwich
            Executor->>Contract: Call executeSandwich()
            Contract->>DEX: Flash swap (borrow)
            Contract->>DEX: Front-run (buy)
            Note over DEX: Victim TX executes
            Contract->>DEX: Back-run (sell)
            Contract->>DEX: Repay flash swap
            Contract-->>Executor: Success/Fail
            Executor-->>Monitor: Result
        end
    end
```

---

## TypeScript Implementation Flow

### Component Architecture

```mermaid
graph TD
    subgraph "TypeScript Bot (Node.js)"
        A[index.ts<br/>Main Entry] --> B[MempoolMonitor]
        A --> C[OpportunityDetector]
        A --> D[SalmonellaDetector]
        A --> E[SandwichExecutor]

        B --> F[ethers.providers.WebSocketProvider]
        F --> G[Subscribe to 'pending' events]

        C --> H[ProfitCalculator]
        C --> I[Transaction Parser]

        D --> J[Token Analyzer]
        D --> K[Simulation Engine]

        E --> L[Transaction Builder]
        E --> M[Gas Estimator]
    end

    subgraph "External Services"
        G --> N[Alchemy/QuickNode RPC]
        L --> O[SandwichExecutor Contract]
        O --> P[Uniswap V2 Pairs]
    end

    subgraph "Configuration"
        Q[config.ts] --> A
        Q --> R[.env File]
    end

    style A fill:#9f9,stroke:#090,stroke-width:3px
    style O fill:#f99,stroke:#f00,stroke-width:2px
```

### Execution Timeline

```mermaid
gantt
    title TypeScript Bot Execution Timeline
    dateFormat X
    axisFormat %L ms

    section Detection
    WebSocket Event           :0, 5
    Fetch TX Details          :5, 15
    Parse Transaction         :15, 20

    section Analysis
    Whitelist Check           :20, 21
    Salmonella Detection      :21, 26
    Profit Calculation        :26, 35

    section Execution
    Build TX                  :35, 40
    Submit to Network         :40, 50
    Wait for Confirmation     :50, 100

    section Total Latency
    End-to-End               :crit, 0, 100
```

**Expected Latency: 50-100ms** (Competitive for L2)

---

## Rust Implementation Flow

### High-Performance Architecture

```mermaid
graph TD
    subgraph "Tokio Async Runtime"
        A[main.rs] --> B[Async Tasks Spawner]

        B --> C[Mempool Monitor Task]
        B --> D[Opportunity Processor Task]
        B --> E[Executor Task]
    end

    subgraph "Concurrent Processing"
        C --> F[WebSocket Stream]
        F --> G{New TX}
        G -->|Parallel| H1[Worker 1]
        G -->|Parallel| H2[Worker 2]
        G -->|Parallel| H3[Worker N]

        H1 & H2 & H3 --> I[Opportunity Channel]
    end

    subgraph "Analysis Pipeline"
        I --> J[Graph-Based Detection]
        J --> K[Bellman-Ford Algorithm]
        K --> L[DashMap Cache<br/>Concurrent Hashmap]
        L --> M[Profit Calculation]
    end

    subgraph "Execution"
        M --> N[Bundle Builder]
        N --> O[Multi-Builder Submission]
        O --> P1[Flashbots]
        O --> P2[Titan Builder]
        O --> P3[Beaver Build]
    end

    style B fill:#f90,stroke:#f60,stroke-width:3px
    style J fill:#9f9,stroke:#090,stroke-width:2px
    style O fill:#f99,stroke:#f00,stroke-width:2px
```

### Parallel Processing Flow

```mermaid
graph LR
    subgraph "Single-Threaded (TypeScript)"
        A1[TX 1] --> A2[Process]
        A2 --> A3[TX 2]
        A3 --> A4[Process]
        A4 --> A5[TX 3]
        A5 --> A6[Process]
    end

    subgraph "Multi-Threaded (Rust + Tokio)"
        B1[TX 1] --> B2[Process]
        B3[TX 2] --> B4[Process]
        B5[TX 3] --> B6[Process]

        B2 & B4 & B6 --> B7[Results Channel]
    end

    style B7 fill:#9f9,stroke:#090,stroke-width:3px
```

**Expected Latency: 10-20ms** (Competitive for Mainnet)

---

## Smart Contract Execution Flow

### Flash Swap Sandwich Pattern

```mermaid
sequenceDiagram
    participant Bot
    participant SandwichExecutor
    participant UniswapPair
    participant Victim
    participant Market

    Bot->>SandwichExecutor: executeSandwich(tokenIn, tokenOut, amount)
    activate SandwichExecutor

    SandwichExecutor->>UniswapPair: swap(amount0Out, amount1Out, callback_data)
    Note over UniswapPair: Flash swap initiated

    UniswapPair->>SandwichExecutor: Send tokens (flash loan)
    UniswapPair->>SandwichExecutor: uniswapV2Call() callback

    rect rgb(255, 200, 200)
        Note over SandwichExecutor: Front-run execution
        SandwichExecutor->>Market: Buy tokenOut with tokenIn
        Market-->>SandwichExecutor: Receive tokenOut
        Note over Market: Price increases ↑
    end

    rect rgb(200, 200, 255)
        Note over Victim,Market: Victim transaction executes
        Victim->>Market: Swap
        Note over Market: Price increases more ↑↑
    end

    rect rgb(200, 255, 200)
        Note over SandwichExecutor: Back-run execution
        SandwichExecutor->>Market: Sell tokenOut for tokenIn
        Market-->>SandwichExecutor: Receive tokenIn (+ profit)
    end

    SandwichExecutor->>UniswapPair: Repay flash swap + 0.3% fee
    deactivate SandwichExecutor

    alt Profitable
        SandwichExecutor-->>Bot: Success (profit retained)
    else Not Profitable
        SandwichExecutor-->>Bot: Revert (no loss except gas)
    end
```

### Gas Optimization Techniques

```mermaid
graph TD
    subgraph "Standard Solidity (~150K gas)"
        A1[Storage Variables]
        A2[Multiple SLOAD Operations]
        A3[Standard Transfers]
        A4[Function Calls]
    end

    subgraph "Optimized Solidity (~120K gas)"
        B1[Memory Variables]
        B2[Immutable Constants]
        B3[Cached Values]
        B4[Inline Operations]
    end

    subgraph "Huff/Yul Assembly (~80K gas)"
        C1[Raw Assembly]
        C2[Direct Stack Manipulation]
        C3[Optimized Loops]
        C4[Minimal ABI Encoding]
    end

    A1 & A2 & A3 & A4 --> D[150K Gas]
    B1 & B2 & B3 & B4 --> E[120K Gas<br/>20% Savings]
    C1 & C2 & C3 & C4 --> F[80K Gas<br/>47% Savings]

    style F fill:#9f9,stroke:#090,stroke-width:3px
    style E fill:#ff9,stroke:#f90,stroke-width:2px
    style D fill:#f99,stroke:#f00,stroke-width:2px
```

---

## MEV Protection Strategies

### User Protection Mechanisms

```mermaid
graph TD
    subgraph "Vulnerable User"
        A[Public Mempool] --> B[Visible to All Bots]
        B --> C[High Slippage 5%+]
        C --> D[Gets Sandwiched]
        D --> E[Loses 0.5-2% of Trade]
    end

    subgraph "Protected User (Flashbots)"
        F[Private Mempool] --> G[Flashbots Protect RPC]
        G --> H[Bundle Submission]
        H --> I[Direct to Builder]
        I --> J[No Front-Running Possible]
    end

    subgraph "Protected User (CoW Swap)"
        K[CoW Swap Order] --> L[Off-Chain Matching]
        L --> M[Batch Settlement]
        M --> N[MEV Protection]
        N --> O[No Sandwich Possible]
    end

    subgraph "Protected User (Low Slippage)"
        P[0.5% Slippage Setting] --> Q[Transaction Reverts if Sandwiched]
        Q --> R[No Value Extracted]
    end

    style J fill:#9f9,stroke:#090,stroke-width:3px
    style O fill:#9f9,stroke:#090,stroke-width:3px
    style R fill:#9f9,stroke:#090,stroke-width:3px
    style E fill:#f99,stroke:#f00,stroke-width:3px
```

### Bot Defense Layers

```mermaid
graph TD
    subgraph "Salmonella Detection System"
        A[Incoming Token] --> B{Check 1: Known Honeypots}
        B -->|Blacklisted| C[REJECT]
        B -->|Unknown| D{Check 2: Simulate Transfer}
        D -->|Reverts| C
        D -->|Success| E{Check 3: Transfer Fee}
        E -->|> 2%| C
        E -->|< 2%| F{Check 4: Blacklist Function}
        F -->|Present| C
        F -->|Absent| G{Check 5: Liquidity Depth}
        G -->|Insufficient| C
        G -->|Sufficient| H[APPROVE]
    end

    style H fill:#9f9,stroke:#090,stroke-width:3px
    style C fill:#f99,stroke:#f00,stroke-width:3px
```

### Decision Tree: To Sandwich or Not

```mermaid
graph TD
    A[Pending Transaction Detected] --> B{Is DEX Router?}
    B -->|No| Z[Skip]
    B -->|Yes| C{Tokens Whitelisted?}
    C -->|No| Z
    C -->|Yes| D{Trade Size > $10K?}
    D -->|No| Z
    D -->|Yes| E{Slippage > 0.5%?}
    E -->|No| Z
    E -->|Yes| F[Salmonella Check]
    F -->|Honeypot| Z
    F -->|Safe| G[Calculate Profit]
    G --> H{Profit > $5 + Gas?}
    H -->|No| Z
    H -->|Yes| I{Gas Price Acceptable?}
    I -->|No| Z
    I -->|Yes| J[Execute Sandwich]

    style J fill:#9f9,stroke:#090,stroke-width:4px
    style Z fill:#ccc,stroke:#999,stroke-width:2px
```

---

## Deployment Architecture

### L2 vs Mainnet Comparison

```mermaid
graph TD
    subgraph "Ethereum Mainnet (Expensive)"
        A1[RPC Node<br/>$500-2K/month] --> A2[Bot Instance]
        A2 --> A3[Gas Cost<br/>$10-50/sandwich]
        A3 --> A4[Minimum Profit<br/>$30+ required]
        A4 --> A5[Break-even<br/>3-5 sandwiches/day]
        A5 --> A6[Capital Needed<br/>$50K+]
    end

    subgraph "Arbitrum L2 (Affordable)"
        B1[RPC Node<br/>$49-99/month] --> B2[Bot Instance]
        B2 --> B3[Gas Cost<br/>$0.10-1/sandwich]
        B3 --> B4[Minimum Profit<br/>$1+ required]
        B4 --> B5[Break-even<br/>10-20 sandwiches/month]
        B5 --> B6[Capital Needed<br/>$1K-5K]
    end

    style B6 fill:#9f9,stroke:#090,stroke-width:3px
    style A6 fill:#f99,stroke:#f00,stroke-width:2px
```

### Infrastructure Setup

```mermaid
graph LR
    subgraph "Development Environment"
        A[Local Machine] --> B[Code Editor]
        B --> C[Hardhat/Foundry]
        C --> D[Testnet Deployment]
    end

    subgraph "Production (L2)"
        E[VPS Server<br/>$10-50/month] --> F[PM2 Process Manager]
        F --> G[Bot Process]
        G --> H[Alchemy RPC<br/>$49/month]
        H --> I[Arbitrum Network]

        G --> J[Monitoring]
        J --> K[Discord Alerts]
        J --> L[Log Files]
    end

    subgraph "Capital Management"
        M[Hot Wallet<br/>$1K-5K] --> G
        N[Cold Storage<br/>Profits] --> O[Withdraw Daily]
    end

    D --> E
    style I fill:#9f9,stroke:#090,stroke-width:3px
```

---

## Performance Metrics Dashboard

### Key Performance Indicators

```mermaid
graph TD
    subgraph "Detection Metrics"
        A1[Latency: <50ms] --> A[🎯 Target]
        A2[Latency: 50-100ms] --> B[✅ Acceptable L2]
        A3[Latency: >100ms] --> C[❌ Too Slow]
    end

    subgraph "Success Metrics"
        B1[Success Rate: >20%] --> D[🎯 Excellent]
        B2[Success Rate: 10-20%] --> E[✅ Good]
        B3[Success Rate: <10%] --> F[⚠️ Needs Optimization]
    end

    subgraph "Profitability Metrics"
        C1[Net Profit: >$500/month] --> G[🎯 Profitable]
        C2[Net Profit: $0-500/month] --> H[✅ Break-even]
        C3[Net Profit: <$0/month] --> I[❌ Losing Money]
    end

    style D fill:#9f9,stroke:#090,stroke-width:3px
    style G fill:#9f9,stroke:#090,stroke-width:3px
    style I fill:#f99,stroke:#f00,stroke-width:3px
```

---

## Conclusion

These diagrams illustrate:
- ✅ Complete system architecture for all implementations
- ✅ Data flow from mempool monitoring to execution
- ✅ Performance comparisons between languages
- ✅ MEV protection strategies
- ✅ Deployment architecture for L2 vs mainnet

**Use these diagrams to:**
- Understand overall system design
- Choose the right implementation for your needs
- Visualize the sandwich attack flow
- Plan your infrastructure
- Set realistic performance targets

For implementation details, see the respective guide files in `context/tutorials/`.
