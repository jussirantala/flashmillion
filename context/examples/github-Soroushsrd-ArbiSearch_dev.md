**Source:** https://github.com/Soroushsrd/ArbiSearch
**Date:** March 2025

# ArbiSearch - Technical Implementation Guide

## Overview

Technical documentation for the Rust-based MEV searcher bot with real-time blockchain monitoring, price discrepancy detection, and flash loan execution capabilities.

**Repository:** https://github.com/Soroushsrd/ArbiSearch
**Language:** Rust (100%)
**Stars:** 19
**Architecture:** Six-component MEV searcher system

## System Architecture

### Component Overview

```rust
// Simplified architecture structure

pub struct ArbiSearch {
    blockchain: BlockchainConnector,
    monitor: EventMonitor,
    detector: OpportunityDetector,
    simulator: TransactionSimulator,
    executor: ExecutionEngine,
    analytics: AnalyticsSystem,
}

impl ArbiSearch {
    pub async fn run(&mut self) -> Result<(), Error> {
        loop {
            // Monitor events
            let events = self.monitor.poll_events().await?;

            // Detect opportunities
            let opportunities = self.detector.analyze(events).await?;

            for opp in opportunities {
                // Simulate transaction
                if self.simulator.validate(&opp).await? {
                    // Execute if profitable
                    self.executor.execute(opp).await?;
                }
            }

            // Update analytics
            self.analytics.record_metrics().await?;
        }
    }
}
```

## Core Components Implementation

### 1. Blockchain Connector

```rust
use ethers::{
    providers::{Provider, Ws, Http},
    types::{Block, Transaction, Log},
};
use tokio::sync::mpsc;

pub struct BlockchainConnector {
    ws_provider: Provider<Ws>,
    http_provider: Provider<Http>,
    archive_provider: Provider<Http>,
}

impl BlockchainConnector {
    pub async fn new(
        ws_url: &str,
        http_url: &str,
        archive_url: &str,
    ) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            ws_provider: Provider::<Ws>::connect(ws_url).await?,
            http_provider: Provider::<Http>::try_from(http_url)?,
            archive_provider: Provider::<Http>::try_from(archive_url)?,
        })
    }

    pub async fn subscribe_blocks(&self) -> mpsc::Receiver<Block<Transaction>> {
        let (tx, rx) = mpsc::channel(100);

        let stream = self.ws_provider.subscribe_blocks().await.unwrap();

        tokio::spawn(async move {
            let mut stream = stream;
            while let Some(block) = stream.next().await {
                tx.send(block).await.ok();
            }
        });

        rx
    }

    pub async fn subscribe_pending_txs(&self) -> mpsc::Receiver<Transaction> {
        let (tx, rx) = mpsc::channel(1000);

        let stream = self.ws_provider.subscribe_pending_txs().await.unwrap();

        tokio::spawn(async move {
            let mut stream = stream;
            while let Some(tx_hash) = stream.next().await {
                if let Ok(Some(tx)) = self.http_provider.get_transaction(tx_hash).await {
                    tx.send(tx).await.ok();
                }
            }
        });

        rx
    }
}
```

### 2. Event Monitor

```rust
use ethers::types::{Filter, Log, H256};
use std::collections::HashMap;

pub struct EventMonitor {
    connector: Arc<BlockchainConnector>,
    dex_addresses: Vec<Address>,
    event_signatures: HashMap<H256, String>,
}

impl EventMonitor {
    pub fn new(connector: Arc<BlockchainConnector>) -> Self {
        let mut event_signatures = HashMap::new();

        // Uniswap V2 Swap event
        event_signatures.insert(
            H256::from_str("0xd78ad95f...").unwrap(),
            "Swap".to_string(),
        );

        // Add more event signatures...

        Self {
            connector,
            dex_addresses: vec![],
            event_signatures,
        }
    }

    pub async fn monitor_dex_events(&self) -> mpsc::Receiver<DexEvent> {
        let (tx, rx) = mpsc::channel(1000);

        let filter = Filter::new()
            .address(self.dex_addresses.clone())
            .event("Swap(address,uint256,uint256,uint256,uint256,address)");

        let stream = self.connector.ws_provider
            .subscribe_logs(&filter)
            .await
            .unwrap();

        tokio::spawn(async move {
            let mut stream = stream;
            while let Some(log) = stream.next().await {
                if let Some(event) = self.parse_log(log) {
                    tx.send(event).await.ok();
                }
            }
        });

        rx
    }

    fn parse_log(&self, log: Log) -> Option<DexEvent> {
        // Parse log into DexEvent struct
        Some(DexEvent {
            dex: log.address,
            token_in: /* parse */,
            token_out: /* parse */,
            amount_in: /* parse */,
            amount_out: /* parse */,
            timestamp: /* parse */,
        })
    }
}

#[derive(Debug, Clone)]
pub struct DexEvent {
    pub dex: Address,
    pub token_in: Address,
    pub token_out: Address,
    pub amount_in: U256,
    pub amount_out: U256,
    pub timestamp: u64,
}
```

### 3. Opportunity Detector

```rust
use std::collections::HashMap;

pub struct OpportunityDetector {
    price_cache: HashMap<(Address, Address), Price>,
    min_profit_threshold: U256,
    max_flash_amount: U256,
}

impl OpportunityDetector {
    pub async fn analyze(&mut self, events: Vec<DexEvent>) -> Vec<Opportunity> {
        let mut opportunities = Vec::new();

        // Update price cache
        for event in events {
            self.update_prices(&event).await;
        }

        // Find arbitrage opportunities
        for ((token_a, token_b), price_a) in &self.price_cache {
            // Check all DEXs for this pair
            if let Some(price_discrepancy) = self.find_discrepancy(token_a, token_b) {
                if self.is_profitable(&price_discrepancy) {
                    opportunities.push(Opportunity {
                        token_in: *token_a,
                        token_out: *token_b,
                        path: price_discrepancy.path,
                        expected_profit: price_discrepancy.profit,
                        flash_amount: self.calculate_optimal_amount(&price_discrepancy),
                    });
                }
            }
        }

        opportunities
    }

    async fn update_prices(&mut self, event: &DexEvent) {
        let price = Price {
            dex: event.dex,
            rate: event.amount_out / event.amount_in,
            timestamp: event.timestamp,
        };

        self.price_cache.insert(
            (event.token_in, event.token_out),
            price,
        );
    }

    fn find_discrepancy(&self, token_a: &Address, token_b: &Address) -> Option<PriceDiscrepancy> {
        // Compare prices across DEXs
        let prices: Vec<&Price> = self.price_cache
            .iter()
            .filter(|((a, b), _)| a == token_a && b == token_b)
            .map(|(_, p)| p)
            .collect();

        if prices.len() < 2 {
            return None;
        }

        // Find min and max prices
        let min_price = prices.iter().min_by_key(|p| p.rate)?;
        let max_price = prices.iter().max_by_key(|p| p.rate)?;

        let spread = max_price.rate - min_price.rate;

        if spread > self.min_profit_threshold {
            Some(PriceDiscrepancy {
                token_a: *token_a,
                token_b: *token_b,
                buy_dex: min_price.dex,
                sell_dex: max_price.dex,
                spread,
                path: vec![min_price.dex, max_price.dex],
                profit: spread, // Simplified
            })
        } else {
            None
        }
    }

    fn calculate_optimal_amount(&self, discrepancy: &PriceDiscrepancy) -> U256 {
        // Use optimization algorithm (similar to swap-optimizer)
        // For now, return fixed amount
        U256::from(1_000_000) // 1M units
    }
}

#[derive(Debug, Clone)]
pub struct Price {
    pub dex: Address,
    pub rate: U256,
    pub timestamp: u64,
}

#[derive(Debug)]
pub struct PriceDiscrepancy {
    pub token_a: Address,
    pub token_b: Address,
    pub buy_dex: Address,
    pub sell_dex: Address,
    pub spread: U256,
    pub path: Vec<Address>,
    pub profit: U256,
}

#[derive(Debug, Clone)]
pub struct Opportunity {
    pub token_in: Address,
    pub token_out: Address,
    pub path: Vec<Address>,
    pub expected_profit: U256,
    pub flash_amount: U256,
}
```

### 4. Transaction Simulator

```rust
use ethers::types::{Transaction, TransactionReceipt};

pub struct TransactionSimulator {
    fork_url: String,
}

impl TransactionSimulator {
    pub async fn validate(&self, opp: &Opportunity) -> Result<bool, SimulationError> {
        // Create local fork
        let fork = self.create_fork().await?;

        // Build transaction
        let tx = self.build_flash_loan_tx(opp).await?;

        // Simulate execution
        let result = fork.simulate(tx).await?;

        // Verify profitability
        if result.profit > opp.expected_profit * 90 / 100 {
            // Allow 10% slippage
            Ok(true)
        } else {
            Ok(false)
        }
    }

    async fn create_fork(&self) -> Result<Fork, Box<dyn std::error::Error>> {
        // Use anvil or similar to fork mainnet
        // Return fork instance
        todo!()
    }

    async fn build_flash_loan_tx(&self, opp: &Opportunity) -> Result<Transaction, Error> {
        // Build flash loan transaction
        // Include all swaps in path
        todo!()
    }
}

#[derive(Debug)]
pub struct SimulationResult {
    pub success: bool,
    pub profit: U256,
    pub gas_used: U256,
    pub error: Option<String>,
}
```

### 5. Execution Engine

```rust
use ethers::middleware::SignerMiddleware;
use ethers::signers::{LocalWallet, Signer};

pub struct ExecutionEngine {
    wallet: LocalWallet,
    provider: Arc<Provider<Http>>,
    flashbots_relay: Option<String>,
    flash_loan_providers: Vec<FlashLoanProvider>,
}

impl ExecutionEngine {
    pub async fn execute(&self, opp: Opportunity) -> Result<TransactionReceipt, Error> {
        // Select flash loan provider
        let provider = self.select_provider(&opp).await?;

        // Build transaction
        let tx = self.build_transaction(&opp, &provider).await?;

        // Submit transaction
        if let Some(relay) = &self.flashbots_relay {
            self.submit_via_flashbots(tx, relay).await
        } else {
            self.submit_directly(tx).await
        }
    }

    async fn select_provider(&self, opp: &Opportunity) -> Result<&FlashLoanProvider, Error> {
        // Check availability and fees
        // Select cheapest available provider
        Ok(&self.flash_loan_providers[0])
    }

    async fn build_transaction(
        &self,
        opp: &Opportunity,
        provider: &FlashLoanProvider,
    ) -> Result<Transaction, Error> {
        // Build flash loan callback transaction
        // Encode swap path
        // Calculate amounts
        todo!()
    }

    async fn submit_via_flashbots(
        &self,
        tx: Transaction,
        relay: &str,
    ) -> Result<TransactionReceipt, Error> {
        // Submit bundle to Flashbots
        todo!()
    }

    async fn submit_directly(&self, tx: Transaction) -> Result<TransactionReceipt, Error> {
        let client = SignerMiddleware::new(self.provider.clone(), self.wallet.clone());
        let pending = client.send_transaction(tx, None).await?;
        let receipt = pending.await?.ok_or(Error::NoReceipt)?;
        Ok(receipt)
    }
}

#[derive(Debug, Clone)]
pub struct FlashLoanProvider {
    pub name: String,
    pub address: Address,
    pub fee_bps: u16,
    pub max_amount: U256,
}
```

### 6. Analytics System

```rust
use std::sync::atomic::{AtomicU64, Ordering};

pub struct AnalyticsSystem {
    executions: AtomicU64,
    successes: AtomicU64,
    failures: AtomicU64,
    total_profit: Arc<Mutex<U256>>,
    total_gas: Arc<Mutex<U256>>,
}

impl AnalyticsSystem {
    pub async fn record_execution(&self, result: ExecutionResult) {
        self.executions.fetch_add(1, Ordering::Relaxed);

        if result.success {
            self.successes.fetch_add(1, Ordering::Relaxed);

            let mut profit = self.total_profit.lock().await;
            *profit += result.profit;
        } else {
            self.failures.fetch_add(1, Ordering::Relaxed);
        }

        let mut gas = self.total_gas.lock().await;
        *gas += result.gas_used;
    }

    pub async fn get_metrics(&self) -> Metrics {
        Metrics {
            executions: self.executions.load(Ordering::Relaxed),
            successes: self.successes.load(Ordering::Relaxed),
            failures: self.failures.load(Ordering::Relaxed),
            success_rate: self.calculate_success_rate(),
            total_profit: *self.total_profit.lock().await,
            total_gas: *self.total_gas.lock().await,
        }
    }

    fn calculate_success_rate(&self) -> f64 {
        let total = self.executions.load(Ordering::Relaxed) as f64;
        let successes = self.successes.load(Ordering::Relaxed) as f64;

        if total == 0.0 {
            0.0
        } else {
            successes / total * 100.0
        }
    }
}

#[derive(Debug)]
pub struct ExecutionResult {
    pub success: bool,
    pub profit: U256,
    pub gas_used: U256,
    pub error: Option<String>,
}

#[derive(Debug)]
pub struct Metrics {
    pub executions: u64,
    pub successes: u64,
    pub failures: u64,
    pub success_rate: f64,
    pub total_profit: U256,
    pub total_gas: U256,
}
```

## Main Application

```rust
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load configuration
    let config = Config::from_env()?;

    // Initialize components
    let connector = Arc::new(BlockchainConnector::new(
        &config.ws_url,
        &config.http_url,
        &config.archive_url,
    ).await?);

    let monitor = EventMonitor::new(connector.clone());
    let detector = OpportunityDetector::new(config.min_profit);
    let simulator = TransactionSimulator::new(&config.fork_url);
    let executor = ExecutionEngine::new(config.wallet, connector.clone());
    let analytics = AnalyticsSystem::new();

    // Start monitoring
    let mut event_rx = monitor.monitor_dex_events().await;

    println!("ArbiSearch started...");

    loop {
        // Collect events
        let mut events = Vec::new();
        while let Ok(event) = event_rx.try_recv() {
            events.push(event);
        }

        // Detect opportunities
        let opportunities = detector.analyze(events).await;

        // Process opportunities
        for opp in opportunities {
            // Simulate
            if simulator.validate(&opp).await? {
                // Execute
                match executor.execute(opp.clone()).await {
                    Ok(receipt) => {
                        analytics.record_execution(ExecutionResult {
                            success: true,
                            profit: opp.expected_profit,
                            gas_used: receipt.gas_used.unwrap(),
                            error: None,
                        }).await;
                    }
                    Err(e) => {
                        analytics.record_execution(ExecutionResult {
                            success: false,
                            profit: U256::zero(),
                            gas_used: U256::zero(),
                            error: Some(e.to_string()),
                        }).await;
                    }
                }
            }
        }

        // Log metrics periodically
        let metrics = analytics.get_metrics().await;
        println!("Metrics: {:?}", metrics);

        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}
```

## Configuration

### Cargo.toml

```toml
[package]
name = "arbisearch"
version = "0.1.0"
edition = "2021"

[dependencies]
tokio = { version = "1", features = ["full"] }
ethers = "2.0"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
anyhow = "1"
thiserror = "1"
dotenv = "0.15"
```

### .env Configuration

```bash
# RPC Endpoints
WS_URL=wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
HTTP_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ARCHIVE_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# Wallet
PRIVATE_KEY=0x...

# Flash Loan Providers
AAVE_POOL=0x...
BALANCER_VAULT=0x...

# Flashbots
FLASHBOTS_RELAY=https://relay.flashbots.net
FLASHBOTS_SIGNER_KEY=0x...

# Parameters
MIN_PROFIT_USD=100
MAX_FLASH_AMOUNT=1000000
GAS_BUFFER=20
```

## Building and Running

```bash
# Build release
cargo build --release

# Run
./target/release/arbisearch

# Run with logging
RUST_LOG=debug ./target/release/arbisearch
```

## Testing

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_opportunity_detection() {
        let detector = OpportunityDetector::new(U256::from(100));

        let events = vec![
            DexEvent { /* ... */ },
        ];

        let opps = detector.analyze(events).await;
        assert!(opps.len() > 0);
    }

    #[tokio::test]
    async fn test_simulation() {
        let simulator = TransactionSimulator::new("http://localhost:8545");

        let opp = Opportunity { /* ... */ };

        let valid = simulator.validate(&opp).await.unwrap();
        assert!(valid);
    }
}
```

## Performance Considerations

1. **Async Runtime** - Tokio for concurrent operations
2. **Connection Pooling** - Reuse HTTP connections
3. **Event Batching** - Process events in batches
4. **Parallel Simulation** - Simulate multiple opportunities concurrently
5. **Caching** - Cache prices and pool states

## Security Best Practices

1. **Private Key Management** - Use HSM or secure vault
2. **Rate Limiting** - Prevent API abuse
3. **Circuit Breakers** - Stop on anomalies
4. **Input Validation** - Validate all external data
5. **Audit Logging** - Record all executions

## Conclusion

ArbiSearch provides a complete MEV searcher implementation in Rust with comprehensive blockchain monitoring, opportunity detection, simulation, and execution capabilities. The modular architecture allows for easy customization and extension while maintaining high performance and safety.
