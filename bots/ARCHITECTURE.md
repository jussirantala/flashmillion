# MEV Bot Architecture Diagrams

Complete architecture documentation for all four educational MEV bots.

---

## 1. Sandwich Attack Bot

### High-Level Architecture

```mermaid
graph TB
    subgraph "Sandwich Bot System"
        MM[Mempool Monitor<br/>WebSocket Connection]
        PC[Profit Calculator<br/>Uniswap V2 Formula]
        SE[Sandwich Executor<br/>Gas Price Bidding]
        SC[Smart Contract<br/>On-Chain Execution]
    end

    subgraph "External Systems"
        BC[Blockchain<br/>Mempool]
        UV2[Uniswap V2 Router]
        PAIR[Token Pair<br/>Reserves]
    end

    BC -->|Pending TXs| MM
    MM -->|Swap Detected| PC
    PC -->|Get Reserves| PAIR
    PC -->|Opportunity| SE
    SE -->|Execute| SC
    SC -->|Frontrun| UV2
    SC -->|Backrun| UV2

    style MM fill:#e1f5ff
    style PC fill:#fff4e1
    style SE fill:#ffe1f5
    style SC fill:#e1ffe1
```

### Detailed Data Flow

```mermaid
sequenceDiagram
    participant M as Mempool
    participant Mon as Monitor
    participant Calc as Calculator
    participant Exec as Executor
    participant SC as Smart Contract
    participant DEX as Uniswap V2

    M->>Mon: Pending swap TX detected
    Mon->>Mon: Parse swap params<br/>(tokenIn, tokenOut, amount)
    Mon->>Calc: Swap transaction details

    Calc->>DEX: Get pair reserves
    DEX-->>Calc: (reserve0, reserve1)

    Calc->>Calc: Simulate sandwich:<br/>1. Frontrun impact<br/>2. Victim trade<br/>3. Backrun profit

    Calc->>Calc: Calculate:<br/>- Expected profit<br/>- Gas costs<br/>- Net profit

    alt Profitable
        Calc->>Exec: Opportunity details
        Exec->>Exec: Calculate frontrun gas<br/>(120% of victim's)
        Exec->>SC: Execute sandwich
        SC->>DEX: Frontrun swap (buy)
        Note over M: Victim TX executes
        SC->>DEX: Backrun swap (sell)
        SC-->>Exec: Profit
    else Not Profitable
        Calc->>Calc: Discard opportunity
    end
```

### Component Details

```mermaid
graph LR
    subgraph "Mempool Monitor"
        WS[WebSocket Provider]
        PARSE[Transaction Parser]
        FILTER[Uniswap Filter]

        WS --> PARSE
        PARSE --> FILTER
    end

    subgraph "Profit Calculator"
        RESERVES[Get Reserves]
        SIM[Simulate Sandwich]
        FEES[Calculate Fees]

        RESERVES --> SIM
        SIM --> FEES
    end

    subgraph "Sandwich Executor"
        GAS[Gas Price Calculator]
        SIGN[Transaction Signer]
        SEND[Send Transaction]

        GAS --> SIGN
        SIGN --> SEND
    end

    FILTER --> RESERVES
    FEES --> GAS
```

---

## 2. Aave Flashloan Arbitrage Bot

### High-Level Architecture

```mermaid
graph TB
    subgraph "Flashloan Arbitrage Bot"
        PS[Price Scanner<br/>Multi-DEX Queries]
        OD[Opportunity Detector<br/>Price Comparison]
        FE[Flashloan Executor<br/>Aave V3 Integration]
        FC[Flashloan Contract<br/>Arbitrage Logic]
    end

    subgraph "External Systems"
        AAVE[Aave V3 Pool<br/>0.05% Fee]
        UNI[Uniswap V2]
        SUSHI[Sushiswap]
        UNI3[Uniswap V3]
    end

    PS -->|Get Prices| UNI
    PS -->|Get Prices| SUSHI
    PS -->|Get Prices| UNI3
    PS -->|Price Data| OD
    OD -->|Profitable Arb| FE
    FE -->|Initiate Flashloan| AAVE
    AAVE -->|Loan + Callback| FC
    FC -->|Buy Cheap| UNI
    FC -->|Sell High| SUSHI
    FC -->|Repay + Fee| AAVE

    style PS fill:#e1f5ff
    style OD fill:#fff4e1
    style FE fill:#ffe1f5
    style FC fill:#e1ffe1
```

### Flashloan Execution Flow

```mermaid
sequenceDiagram
    participant Bot as Arbitrage Bot
    participant Aave as Aave V3 Pool
    participant FC as Flashloan Contract
    participant DEX1 as Uniswap V2
    participant DEX2 as Sushiswap

    Bot->>Bot: Scan prices<br/>across DEXs
    Bot->>Bot: Detect price<br/>difference > 0.5%

    Bot->>Aave: flashLoan(token, amount)
    Aave->>FC: Transfer borrowed tokens
    Aave->>FC: executeOperation callback

    FC->>FC: Approve DEX1 to spend
    FC->>DEX1: swapExactTokensForTokens<br/>(buy at lower price)
    DEX1-->>FC: Return tokens bought

    FC->>FC: Approve DEX2 to spend
    FC->>DEX2: swapExactTokensForTokens<br/>(sell at higher price)
    DEX2-->>FC: Return more tokens

    FC->>FC: Calculate profit:<br/>received - borrowed - fee
    FC->>FC: Approve Aave to pull debt

    alt Profit > Gas Cost
        Aave->>FC: Pull borrowed amount + 0.05%
        FC-->>Bot: Keep profit
        Bot->>Bot: Success! Log profit
    else Loss
        FC->>Aave: Transaction reverts
        Bot->>Bot: Failed, no cost<br/>except gas
    end
```

### Price Scanning Process

```mermaid
graph TD
    START[Start Price Scan]

    START --> PAIRS[Load Trading Pairs:<br/>WETH/USDC, WETH/DAI,<br/>USDC/DAI, etc.]

    PAIRS --> AMOUNTS[Test Amounts:<br/>1 ETH, 10 ETH, 100 ETH]

    AMOUNTS --> QUERY{Query Each DEX}

    QUERY --> UNI[Uniswap V2<br/>getAmountsOut]
    QUERY --> SUSHI[Sushiswap<br/>getAmountsOut]
    QUERY --> UNI3[Uniswap V3<br/>Quoter]

    UNI --> COMPARE[Compare Prices]
    SUSHI --> COMPARE
    UNI3 --> COMPARE

    COMPARE --> CALC{Price Diff<br/>> 0.5%?}

    CALC -->|Yes| PROFIT[Calculate Net Profit:<br/>- Flashloan fee 0.05%<br/>- Gas costs<br/>- DEX fees]
    CALC -->|No| NEXT[Next Pair/Amount]

    PROFIT --> VIABLE{Profit ><br/>Threshold?}

    VIABLE -->|Yes| EXECUTE[Execute Arbitrage]
    VIABLE -->|No| NEXT

    NEXT --> QUERY

    style EXECUTE fill:#90EE90
    style NEXT fill:#FFB6C1
```

---

## 3. Aave Front-Running Bot (Detection Only)

### High-Level Architecture

```mermaid
graph TB
    subgraph "Front-Running Detection Bot"
        MM[Mempool Monitor<br/>Aave Transactions]
        OA[Opportunity Analyzer<br/>Attack Vectors]
        EO[Educational Output<br/>Explanations]
    end

    subgraph "Aave Protocol"
        POOL[Aave Pool Contract]
        DEP[Deposit Events]
        BOR[Borrow Events]
        LIQ[Liquidation Events]
    end

    POOL -->|Pending TX| MM
    MM -->|Parse Operation| OA

    OA -->|Deposit| EO
    OA -->|Borrow| EO
    OA -->|Liquidation| EO

    EO -->|Log Attack Mechanics| CONSOLE[Console Output]
    EO -->|Log Protection Methods| CONSOLE
    EO -->|Log Ethical Impact| CONSOLE

    style MM fill:#e1f5ff
    style OA fill:#ffcccc
    style EO fill:#ccffcc
```

### Detection & Analysis Flow

```mermaid
sequenceDiagram
    participant M as Mempool
    participant Mon as Monitor
    participant Ana as Analyzer
    participant Out as Educational Output

    M->>Mon: Pending Aave transaction
    Mon->>Mon: Parse transaction:<br/>- supply()<br/>- borrow()<br/>- liquidationCall()

    alt Deposit Operation
        Mon->>Ana: Deposit TX details
        Ana->>Ana: Calculate potential:<br/>- Interest rate manipulation<br/>- Utilization impact<br/>- Expected "profit"
        Ana->>Out: ⚠️ Deposit Front-Run Opportunity
        Out->>Out: Log: How it works
        Out->>Out: Log: Why it's harmful
        Out->>Out: Log: Protection methods
    end

    alt Borrow Operation
        Mon->>Ana: Borrow TX details
        Ana->>Ana: Calculate potential:<br/>- Liquidity drain<br/>- Rate increase<br/>- User impact
        Ana->>Out: ⚠️ Borrow Front-Run Opportunity
        Out->>Out: Educational analysis
    end

    alt Liquidation
        Mon->>Ana: Liquidation TX details
        Ana->>Ana: Calculate:<br/>- 5-10% liquidation bonus<br/>- Gas costs<br/>- Net profit potential
        Ana->>Out: ⚠️ Liquidation Front-Run Opportunity
        Out->>Out: Explain attack + protections
    end

    Note over Out: ❌ NO EXECUTION<br/>Detection only!
```

### Attack Vector Analysis

```mermaid
graph LR
    subgraph "Deposit Front-Running"
        D1[Detect Large Deposit]
        D2[Calculate Rate Impact]
        D3[Assess Profit Potential]
        D4[Educational Output]

        D1 --> D2 --> D3 --> D4
    end

    subgraph "Borrow Front-Running"
        B1[Detect Large Borrow]
        B2[Calculate Liquidity Drain]
        B3[Assess User Harm]
        B4[Protection Methods]

        B1 --> B2 --> B3 --> B4
    end

    subgraph "Liquidation Front-Running"
        L1[Detect Liquidation TX]
        L2[Calculate 5-10% Bonus]
        L3[Gas Price Competition]
        L4[Explain MEV Extraction]

        L1 --> L2 --> L3 --> L4
    end

    style D4 fill:#ffcccc
    style B4 fill:#ffcccc
    style L4 fill:#ffcccc
```

---

## 4. Aave Back-Running Bot

### High-Level Architecture

```mermaid
graph TB
    subgraph "Back-Running Bot"
        EM[Event Monitor<br/>Real-Time Events]
        OD[Opportunity Detector<br/>State Change Analysis]
        SA[Strategy Analyzer<br/>Educational Output]
    end

    subgraph "Aave Protocol Events"
        BORROW[Borrow Event<br/>Utilization ↑]
        REPAY[Repay Event<br/>Utilization ↓]
        LIQ[Liquidation Event<br/>Price Impact]
        SUPPLY[Supply Event<br/>Liquidity ↑]
    end

    subgraph "Opportunity Types"
        ARB[Arbitrage<br/>Price Normalization]
        RATE[Rate Arbitrage<br/>Cross-Protocol]
        CASCADE[Liquidation Cascade<br/>Market Efficiency]
    end

    BORROW -->|Emitted| EM
    REPAY -->|Emitted| EM
    LIQ -->|Emitted| EM
    SUPPLY -->|Emitted| EM

    EM -->|Event Data| OD

    OD -->|After Large Borrow| ARB
    OD -->|After Repay| RATE
    OD -->|After Liquidation| CASCADE

    ARB --> SA
    RATE --> SA
    CASCADE --> SA

    style EM fill:#e1f5ff
    style OD fill:#fff4e1
    style SA fill:#e1ffe1
```

### Event-Driven Execution Flow

```mermaid
sequenceDiagram
    participant Aave as Aave Pool
    participant Mon as Event Monitor
    participant Det as Detector
    participant Out as Output

    Note over Aave: User borrows 100 ETH
    Aave->>Mon: Borrow event emitted

    Mon->>Det: Event: Borrow<br/>asset: ETH<br/>amount: 100<br/>user: 0x123...

    Det->>Det: Analyze impact:<br/>- Utilization increased<br/>- Interest rates adjusted up<br/>- Price impact on DEXs

    alt Arbitrage Opportunity
        Det->>Det: Calculate:<br/>- Price difference created<br/>- Expected profit<br/>- Gas costs

        Det->>Out: 💰 Back-run Strategy: ARBITRAGE
        Out->>Out: Explain: Price imbalance<br/>from large borrow
        Out->>Out: Steps to execute:<br/>1. Detect rate change<br/>2. Arbitrage delta<br/>3. Profit from correction
    end

    Note over Aave: User liquidated
    Aave->>Mon: LiquidationCall event

    Mon->>Det: Liquidation details
    Det->>Det: Analyze cascade risk:<br/>- Collateral dumped<br/>- Price impact<br/>- Additional liquidations?

    alt Cascade Opportunity
        Det->>Out: ⚡ Back-run Strategy: CASCADE
        Out->>Out: Explain market efficiency<br/>role of back-running
    end

    Note over Out: ✅ EDUCATIONAL ONLY<br/>Shows opportunities,<br/>doesn't execute
```

### Strategy Decision Tree

```mermaid
graph TD
    EVENT[Aave Event Detected]

    EVENT --> TYPE{Event Type?}

    TYPE -->|Borrow| BORROW_ANALYZE[Analyze Borrow]
    TYPE -->|Repay| REPAY_ANALYZE[Analyze Repay]
    TYPE -->|Liquidation| LIQ_ANALYZE[Analyze Liquidation]
    TYPE -->|Supply| SUPPLY_ANALYZE[Analyze Supply]

    BORROW_ANALYZE --> UTIL_UP{Utilization<br/>Increased?}
    UTIL_UP -->|Yes| RATE_UP[Interest Rates ↑]
    RATE_UP --> RATE_ARB[Rate Arbitrage<br/>Opportunity]

    REPAY_ANALYZE --> UTIL_DOWN{Utilization<br/>Decreased?}
    UTIL_DOWN -->|Yes| RATE_DOWN[Interest Rates ↓]
    RATE_DOWN --> BORROW_CHEAP[Borrow at Lower Rate<br/>Opportunity]

    LIQ_ANALYZE --> PRICE_IMPACT{Significant<br/>Price Impact?}
    PRICE_IMPACT -->|Yes| ARB_OPP[Arbitrage<br/>Opportunity]
    PRICE_IMPACT -->|Yes| CASCADE_CHECK[Check Cascade Risk]

    SUPPLY_ANALYZE --> LIQ_UP{Liquidity<br/>Increased?}
    LIQ_UP -->|Yes| SPREAD[Spread<br/>Tightening]

    RATE_ARB --> OUTPUT[Educational Output]
    BORROW_CHEAP --> OUTPUT
    ARB_OPP --> OUTPUT
    CASCADE_CHECK --> OUTPUT
    SPREAD --> OUTPUT

    style OUTPUT fill:#90EE90
    style RATE_ARB fill:#FFE4B5
    style ARB_OPP fill:#FFE4B5
    style CASCADE_CHECK fill:#FFB6C1
```

---

## System Comparison

### Architecture Comparison Matrix

```mermaid
graph TB
    subgraph "Sandwich Bot"
        S1[Mempool Monitoring]
        S2[Profit Calculation]
        S3[Transaction Execution]
        S4[Smart Contract]

        S1 --> S2 --> S3 --> S4
    end

    subgraph "Flashloan Arbitrage Bot"
        F1[Price Scanning]
        F2[Opportunity Detection]
        F3[Flashloan Execution]
        F4[DEX Swaps]

        F1 --> F2 --> F3 --> F4
    end

    subgraph "Front-Running Bot"
        FR1[Mempool Monitoring]
        FR2[Attack Analysis]
        FR3[Educational Output]

        FR1 --> FR2 --> FR3
    end

    subgraph "Back-Running Bot"
        BR1[Event Monitoring]
        BR2[State Analysis]
        BR3[Strategy Output]

        BR1 --> BR2 --> BR3
    end

    style S4 fill:#ffcccc
    style F4 fill:#90EE90
    style FR3 fill:#FFE4B5
    style BR3 fill:#E1F5FF
```

### Component Reusability

```mermaid
graph LR
    subgraph "Shared Components"
        CONFIG[Config Manager]
        LOGGER[Logger]
        PROVIDER[Ethers Provider]
        WALLET[Wallet Manager]
    end

    subgraph "Bot-Specific"
        MEMPOOL[Mempool Monitor]
        EVENTS[Event Monitor]
        SCANNER[Price Scanner]
        EXECUTOR[Executors]
    end

    CONFIG --> MEMPOOL
    CONFIG --> EVENTS
    CONFIG --> SCANNER

    LOGGER --> MEMPOOL
    LOGGER --> EVENTS
    LOGGER --> SCANNER

    PROVIDER --> MEMPOOL
    PROVIDER --> EVENTS
    PROVIDER --> SCANNER
    PROVIDER --> EXECUTOR

    WALLET --> EXECUTOR

    style CONFIG fill:#E1F5FF
    style LOGGER fill:#FFE4B5
    style PROVIDER fill:#90EE90
    style WALLET fill:#FFB6C1
```

---

## Performance Characteristics

### Latency Comparison

| Bot | Detection | Calculation | Execution | Total | Target Network |
|-----|-----------|-------------|-----------|-------|----------------|
| **Sandwich** | 50-100ms | 10-50ms | 50-200ms | 110-350ms | L2 (100ms acceptable) |
| **Flashloan Arb** | N/A (scan) | 50-200ms | 200-500ms | 250-700ms | Any (not latency sensitive) |
| **Front-Run** | 50-100ms | 10-20ms | N/A (no exec) | 60-120ms | Detection only |
| **Back-Run** | <10ms (events) | 20-50ms | 100-300ms | 120-350ms | L1/L2 (post-event) |

### Resource Requirements

```mermaid
graph TB
    subgraph "Resource Usage"
        direction TB

        CPU[CPU Usage]
        MEM[Memory Usage]
        NET[Network I/O]
        STORAGE[Storage]
    end

    subgraph "Sandwich Bot"
        S_CPU[Medium<br/>~20% CPU]
        S_MEM[~200MB RAM]
        S_NET[High<br/>WebSocket stream]
        S_STORAGE[Low<br/>~10MB]
    end

    subgraph "Flashloan Bot"
        F_CPU[Low<br/>~10% CPU]
        F_MEM[~150MB RAM]
        F_NET[Medium<br/>Periodic queries]
        F_STORAGE[Low<br/>~5MB]
    end

    subgraph "Front-Run Bot"
        FR_CPU[Medium<br/>~15% CPU]
        FR_MEM[~100MB RAM]
        FR_NET[High<br/>WebSocket stream]
        FR_STORAGE[Minimal]
    end

    subgraph "Back-Run Bot"
        BR_CPU[Low<br/>~5% CPU]
        BR_MEM[~100MB RAM]
        BR_NET[Medium<br/>Event listening]
        BR_STORAGE[Minimal]
    end

    CPU -.-> S_CPU
    CPU -.-> F_CPU
    CPU -.-> FR_CPU
    CPU -.-> BR_CPU

    MEM -.-> S_MEM
    MEM -.-> F_MEM
    MEM -.-> FR_MEM
    MEM -.-> BR_MEM

    NET -.-> S_NET
    NET -.-> F_NET
    NET -.-> FR_NET
    NET -.-> BR_NET

    STORAGE -.-> S_STORAGE
    STORAGE -.-> F_STORAGE
    STORAGE -.-> FR_STORAGE
    STORAGE -.-> BR_STORAGE
```

---

## Deployment Architecture

### Development Setup

```mermaid
graph TB
    subgraph "Local Development"
        DEV[Developer Machine]
        HARDHAT[Hardhat Node<br/>Localhost:8545]
        BOTS[Bot Instances<br/>Dry-Run Mode]
    end

    DEV -->|Deploy Contracts| HARDHAT
    DEV -->|Run Bots| BOTS
    BOTS -->|Connect to| HARDHAT

    style DEV fill:#E1F5FF
    style HARDHAT fill:#90EE90
    style BOTS fill:#FFE4B5
```

### Testnet Deployment

```mermaid
graph TB
    subgraph "Testnet Environment"
        SEPOLIA[Sepolia Testnet]
        ARBITRUM[Arbitrum Sepolia]

        BOT_SERVER[VPS / Cloud Server]
        MONITOR[Monitoring Dashboard]
    end

    subgraph "External Services"
        ALCHEMY[Alchemy RPC]
        INFURA[Infura RPC]
    end

    BOT_SERVER -->|WebSocket| ALCHEMY
    BOT_SERVER -->|Backup| INFURA
    ALCHEMY -->|Testnet Data| SEPOLIA
    ALCHEMY -->|Testnet Data| ARBITRUM

    BOT_SERVER -->|Metrics| MONITOR

    style BOT_SERVER fill:#FFE4B5
    style MONITOR fill:#90EE90
```

### Production Architecture (Educational Reference)

```mermaid
graph TB
    subgraph "Infrastructure Layer"
        COLOCATE[Co-located Server<br/>Low Latency]
        BACKUP[Backup Server<br/>Failover]
    end

    subgraph "Data Layer"
        CUSTOM_NODE[Custom Ethereum Node<br/>Archive + Mempool]
        DB[(Database<br/>Opportunities Log)]
        CACHE[(Redis Cache<br/>Price Data)]
    end

    subgraph "Application Layer"
        BOT1[Bot Instance 1<br/>Primary]
        BOT2[Bot Instance 2<br/>Backup]
        MONITOR[Monitoring Service]
    end

    subgraph "External"
        VALIDATORS[Ethereum Validators]
        FLASHBOTS[Flashbots Relay]
    end

    COLOCATE --> BOT1
    BACKUP --> BOT2

    BOT1 --> CUSTOM_NODE
    BOT2 --> CUSTOM_NODE

    BOT1 --> CACHE
    BOT1 --> DB

    BOT1 -->|Private TX| FLASHBOTS
    FLASHBOTS -->|Bundle| VALIDATORS

    MONITOR --> BOT1
    MONITOR --> BOT2

    style COLOCATE fill:#FFB6C1
    style CUSTOM_NODE fill:#90EE90
    style FLASHBOTS fill:#E1F5FF
```

---

## Security Architecture

### Access Control

```mermaid
graph TB
    subgraph "Security Layers"
        ENV[Environment Variables<br/>Private Keys]
        WALLET[Wallet Manager<br/>Signing Only]
        CONTRACT[Smart Contracts<br/>Owner-Only Functions]
    end

    subgraph "Safety Mechanisms"
        DRY_RUN[Dry-Run Mode<br/>Default Enabled]
        MIN_PROFIT[Minimum Profit<br/>Threshold]
        MAX_GAS[Maximum Gas Price<br/>Limit]
        MAX_POSITION[Maximum Position<br/>Size Limit]
    end

    ENV --> WALLET
    WALLET --> CONTRACT

    DRY_RUN -.->|Override| WALLET
    MIN_PROFIT -.->|Validate| WALLET
    MAX_GAS -.->|Limit| WALLET
    MAX_POSITION -.->|Protect| CONTRACT

    style DRY_RUN fill:#90EE90
    style MIN_PROFIT fill:#90EE90
    style MAX_GAS fill:#FFB6C1
    style MAX_POSITION fill:#FFB6C1
```

---

## Educational Value

Each bot teaches different concepts:

| Bot | Primary Learning | Secondary Learning | Advanced Topics |
|-----|-----------------|-------------------|-----------------|
| **Sandwich** | MEV extraction | Gas price auctions | Mempool analysis |
| **Flashloan** | DeFi composability | Aave V3 integration | Cross-DEX arbitrage |
| **Front-Run** | Attack vectors | Detection methods | Ethical considerations |
| **Back-Run** | Event-driven strategies | Market efficiency | Cascade effects |

---

**Note**: All architectures shown are for **EDUCATIONAL PURPOSES ONLY**. Do not use for production deployment or to harm real users.

For implementation details, see individual bot README files and [BOTS.md](BOTS.md).
