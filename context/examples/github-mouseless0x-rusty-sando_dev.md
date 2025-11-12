**Source:** https://github.com/mouseless0x/rusty-sando
**Date:** August 2023 (Archived)

# Rusty-Sando: Deep Developer Documentation

## Deep Architecture Analysis

### System Overview

Rusty-Sando implements a sophisticated three-layer architecture optimized for MEV extraction:

```
┌─────────────────────────────────────────────────────────┐
│                    Application Layer                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Strategy   │  │ Opportunity  │  │   Bundle     │ │
│  │   Manager    │→ │  Evaluator   │→ │  Constructor │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                 Execution Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  Simulator   │  │   Bundler    │  │  Submitter   │ │
│  │   (REVM)     │  │              │  │ (Flashbots)  │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  Data Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Mempool    │  │  State Cache │  │  Pool Data   │ │
│  │   Monitor    │  │              │  │   Manager    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

1. **Data Collection:**
   ```
   Mempool Monitor → Pending TX Detection → Quick Filter
   ```

2. **Opportunity Analysis:**
   ```
   Quick Filter → Pool Data Lookup → Price Impact Calc → Profit Estimation
   ```

3. **Execution Path:**
   ```
   Opportunity → Simulation → Bundle Construction → Flashbots Submission
   ```

4. **Feedback Loop:**
   ```
   Submission Result → Strategy Adjustment → Parameter Tuning
   ```

## Code Structure and Organization

### Directory Layout

```
rusty-sando/
├── bot/
│   ├── src/
│   │   ├── main.rs              # Entry point, bot initialization
│   │   ├── config.rs            # Configuration management
│   │   ├── collectors/
│   │   │   ├── mod.rs
│   │   │   ├── mempool.rs       # Mempool monitoring
│   │   │   └── block.rs         # New block detection
│   │   ├── strategies/
│   │   │   ├── mod.rs
│   │   │   ├── sandwich.rs      # Sandwich strategy core
│   │   │   └── multi_meat.rs    # Multi-victim bundling
│   │   ├── executors/
│   │   │   ├── mod.rs
│   │   │   └── flashbots.rs     # Flashbots bundle submission
│   │   ├── utils/
│   │   │   ├── mod.rs
│   │   │   ├── math.rs          # Price calculations
│   │   │   ├── simulator.rs     # EVM simulation
│   │   │   └── salmonella.rs    # Token safety checks
│   │   └── types/
│   │       ├── mod.rs
│   │       ├── opportunity.rs   # Opportunity structs
│   │       └── pool.rs          # Pool abstractions
│   ├── Cargo.toml
│   └── .env.example
├── contract/
│   ├── src/
│   │   ├── SandoContract.huff   # Main contract logic
│   │   ├── SwapV2.huff          # Uniswap V2 swaps
│   │   ├── SwapV3.huff          # Uniswap V3 swaps
│   │   └── Utils.huff           # Helper functions
│   ├── test/
│   │   ├── SandoContract.t.sol  # Foundry tests
│   │   └── mocks/
│   └── foundry.toml
└── README.md
```

### Key Modules Breakdown

#### 1. Main.rs - Bootstrap and Orchestration

```rust
use artemis::Engine;
use ethers::prelude::*;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt::init();

    // Load configuration
    let config = Config::from_env()?;

    // Create Ethereum provider
    let provider = Provider::<Ws>::connect(&config.ws_url).await?;
    let provider = Arc::new(provider);

    // Initialize contract instance
    let contract = SandoContract::new(config.contract_address, provider.clone());

    // Build Artemis engine
    let mut engine = Engine::new();

    // Add collectors
    engine.add_collector(Box::new(MempoolCollector::new(provider.clone())));
    engine.add_collector(Box::new(BlockCollector::new(provider.clone())));

    // Add strategies
    engine.add_strategy(Box::new(SandwichStrategy::new(
        provider.clone(),
        contract,
        config.clone(),
    )));

    // Add executors
    engine.add_executor(Box::new(FlashbotsExecutor::new(
        provider.clone(),
        config.flashbots_relay_url,
        config.private_key,
    )));

    // Start the engine
    info!("Starting Rusty-Sando bot...");
    engine.run().await?;

    Ok(())
}
```

#### 2. Mempool Collector

```rust
use artemis::Collector;
use ethers::prelude::*;

pub struct MempoolCollector {
    provider: Arc<Provider<Ws>>,
    stream: Option<SubscriptionStream<'static, Ws, Transaction>>,
}

impl MempoolCollector {
    pub fn new(provider: Arc<Provider<Ws>>) -> Self {
        Self {
            provider,
            stream: None,
        }
    }

    async fn should_process(&self, tx: &Transaction) -> bool {
        // Quick filters
        if tx.value > U256::zero() && tx.value < parse_ether(0.01).unwrap() {
            return false; // Too small to sandwich
        }

        // Check if it's a swap transaction
        if let Some(input) = &tx.input {
            let selector = &input[..4];
            // Uniswap V2 swap selectors
            if selector == hex!("38ed1739") ||  // swapExactTokensForTokens
               selector == hex!("7ff36ab5") ||  // swapExactETHForTokens
               selector == hex!("18cbafe5") {   // swapExactTokensForETH
                return true;
            }
        }

        false
    }
}

#[async_trait]
impl Collector for MempoolCollector {
    async fn collect(&mut self) -> Result<Vec<Event>> {
        if self.stream.is_none() {
            // Initialize stream
            let stream = self.provider
                .subscribe_pending_txs()
                .await?;
            self.stream = Some(stream);
        }

        let mut events = Vec::new();

        if let Some(stream) = &mut self.stream {
            while let Some(tx_hash) = stream.next().await {
                // Fetch full transaction
                if let Some(tx) = self.provider.get_transaction(tx_hash).await? {
                    if self.should_process(&tx).await {
                        events.push(Event::PendingTx(tx));
                    }
                }
            }
        }

        Ok(events)
    }
}
```

#### 3. Sandwich Strategy Core

```rust
use artemis::Strategy;
use ethers::prelude::*;

pub struct SandwichStrategy {
    provider: Arc<Provider<Ws>>,
    contract: SandoContract<Provider<Ws>>,
    config: Config,
    pool_manager: PoolManager,
    simulator: Simulator,
}

impl SandwichStrategy {
    pub fn new(
        provider: Arc<Provider<Ws>>,
        contract: SandoContract<Provider<Ws>>,
        config: Config,
    ) -> Self {
        Self {
            provider: provider.clone(),
            contract,
            config,
            pool_manager: PoolManager::new(provider.clone()),
            simulator: Simulator::new(provider),
        }
    }

    async fn calculate_sandwich_opportunity(
        &self,
        victim_tx: &Transaction,
    ) -> Result<Option<SandwichOpportunity>> {
        // Decode victim transaction
        let swap_params = self.decode_swap(victim_tx)?;

        // Get pool data
        let pool = self.pool_manager
            .get_pool(swap_params.token_in, swap_params.token_out)
            .await?;

        // Calculate price impact
        let price_impact = pool.calculate_price_impact(swap_params.amount_in);

        // Skip if impact too small
        if price_impact < self.config.min_price_impact {
            return Ok(None);
        }

        // Calculate optimal frontrun size
        let optimal_frontrun = self.calculate_optimal_frontrun(
            &pool,
            swap_params.amount_in,
        )?;

        // Simulate the sandwich
        let simulation_result = self.simulator
            .simulate_sandwich(
                &pool,
                optimal_frontrun,
                victim_tx,
            )
            .await?;

        // Calculate profit
        let profit = simulation_result.backrun_output
            .saturating_sub(optimal_frontrun)
            .saturating_sub(simulation_result.gas_cost);

        // Check if profitable
        if profit < self.config.min_profit_wei {
            return Ok(None);
        }

        Ok(Some(SandwichOpportunity {
            victim_tx: victim_tx.clone(),
            pool: pool.clone(),
            frontrun_amount: optimal_frontrun,
            expected_profit: profit,
            gas_price: simulation_result.gas_price,
        }))
    }

    fn calculate_optimal_frontrun(
        &self,
        pool: &Pool,
        victim_amount: U256,
    ) -> Result<U256> {
        // For Uniswap V2, optimal frontrun using quadratic formula
        // Derived from: max(backrun_out - frontrun_in - gas)
        //
        // Formula: sqrt(reserve_in * reserve_out * victim_in) - reserve_in

        let (reserve_in, reserve_out) = pool.get_reserves();

        let sqrt_arg = reserve_in
            .saturating_mul(reserve_out)
            .saturating_mul(victim_amount);

        let optimal = sqrt(sqrt_arg).saturating_sub(reserve_in);

        // Apply safety margin (90% of optimal)
        let safe_optimal = optimal.saturating_mul(U256::from(90)) / U256::from(100);

        Ok(safe_optimal)
    }
}

#[async_trait]
impl Strategy for SandwichStrategy {
    async fn process_event(&mut self, event: Event) -> Result<Vec<Action>> {
        match event {
            Event::PendingTx(tx) => {
                // Check for salmonella
                if let Some(token) = self.extract_token_from_swap(&tx) {
                    if self.is_salmonella(token).await? {
                        return Ok(vec![]);
                    }
                }

                // Calculate opportunity
                if let Some(opportunity) = self.calculate_sandwich_opportunity(&tx).await? {
                    return Ok(vec![Action::SubmitBundle(opportunity.to_bundle())]);
                }

                Ok(vec![])
            }
            _ => Ok(vec![]),
        }
    }
}
```

## Smart Contract Implementation (Huff)

### Main Contract Structure

```huff
// SandoContract.huff

#include "./SwapV2.huff"
#include "./SwapV3.huff"
#include "./Utils.huff"

// Storage slots
#define constant OWNER_SLOT = FREE_STORAGE_POINTER()
#define constant WETH_SLOT = FREE_STORAGE_POINTER()

// Function selectors
#define constant SWAP_V2_SELECTOR = 0x12345678
#define constant SWAP_V3_SELECTOR = 0x87654321
#define constant WITHDRAW_SELECTOR = 0xabcdefab

// Constructor
#define macro CONSTRUCTOR() = takes(0) returns(0) {
    // Store owner
    caller                    // [msg.sender]
    [OWNER_SLOT]              // [owner_slot, msg.sender]
    sstore                    // []

    // Store WETH address
    0x04 calldataload         // [weth_address]
    [WETH_SLOT]               // [weth_slot, weth_address]
    sstore                    // []
}

// Main entry point
#define macro MAIN() = takes(0) returns(0) {
    // Get function selector
    0x00 calldataload         // [calldata]
    0xE0 shr                  // [selector]

    // Route to appropriate function
    dup1 [SWAP_V2_SELECTOR] eq swap_v2 jumpi
    dup1 [SWAP_V3_SELECTOR] eq swap_v3 jumpi
    dup1 [WITHDRAW_SELECTOR] eq withdraw jumpi

    // No match - revert
    0x00 0x00 revert

    swap_v2:
        SWAP_V2()

    swap_v3:
        SWAP_V3()

    withdraw:
        WITHDRAW()
}

// Withdraw function (only owner)
#define macro WITHDRAW() = takes(0) returns(0) {
    // Check caller is owner
    caller                    // [msg.sender]
    [OWNER_SLOT] sload        // [owner, msg.sender]
    eq                        // [is_owner]
    is_owner jumpi            // []

    // Not owner - revert
    0x00 0x00 revert

    is_owner:
        // Get token address from calldata
        0x04 calldataload     // [token]

        // Get balance
        dup1                  // [token, token]
        address               // [this, token, token]
        BALANCE_OF()          // [balance, token]

        // Transfer to owner
        [OWNER_SLOT] sload    // [owner, balance, token]
        swap1                 // [balance, owner, token]
        TRANSFER()            // [success]

        // Check success
        success jumpi
        0x00 0x00 revert

    success:
        stop
}
```

### Uniswap V2 Swap Implementation

```huff
// SwapV2.huff

// Perform Uniswap V2 swap
// Calldata layout:
//   0x00-0x04: function selector
//   0x04-0x24: token_in address
//   0x24-0x44: token_out address
//   0x44-0x64: amount_in
//   0x64-0x84: amount_out_min
//   0x84-0xa4: pool address

#define macro SWAP_V2() = takes(0) returns(0) {
    // Load parameters from calldata
    0x04 calldataload         // [token_in]
    0x24 calldataload         // [token_out, token_in]
    0x44 calldataload         // [amount_in, token_out, token_in]
    0x64 calldataload         // [amount_out_min, amount_in, token_out, token_in]
    0x84 calldataload         // [pool, amount_out_min, amount_in, token_out, token_in]

    // Transfer token_in to pool
    dup5                      // [token_in, pool, amount_out_min, amount_in, token_out, token_in]
    dup4                      // [amount_in, token_in, pool, amount_out_min, amount_in, token_out, token_in]
    dup3                      // [pool, amount_in, token_in, pool, amount_out_min, amount_in, token_out, token_in]
    TRANSFER()                // [success, pool, amount_out_min, amount_in, token_out, token_in]

    // Check transfer success
    iszero fail jumpi

    // Calculate amount_out using constant product formula
    dup1                      // [pool, pool, amount_out_min, amount_in, token_out, token_in]
    GET_RESERVES()            // [reserve_in, reserve_out, pool, amount_out_min, amount_in, token_out, token_in]

    dup5                      // [amount_in, reserve_in, reserve_out, pool, amount_out_min, amount_in, token_out, token_in]
    CALC_AMOUNT_OUT()         // [amount_out, pool, amount_out_min, amount_in, token_out, token_in]

    // Check slippage
    dup1 dup4 lt              // [amount_out < amount_out_min, amount_out, pool, amount_out_min, amount_in, token_out, token_in]
    fail jumpi

    // Perform swap
    dup2                      // [pool, amount_out, pool, amount_out_min, amount_in, token_out, token_in]
    swap1                     // [amount_out, pool, pool, amount_out_min, amount_in, token_out, token_in]
    address                   // [this, amount_out, pool, pool, amount_out_min, amount_in, token_out, token_in]

    // Call pool.swap()
    DO_SWAP()                 // [success, pool, amount_out_min, amount_in, token_out, token_in]

    iszero fail jumpi
    stop

    fail:
        0x00 0x00 revert
}

// Calculate output amount using constant product formula
// Formula: amount_out = (amount_in * 997 * reserve_out) / (reserve_in * 1000 + amount_in * 997)
#define macro CALC_AMOUNT_OUT() = takes(3) returns(1) {
    // Stack: [amount_in, reserve_in, reserve_out]

    // amount_in_with_fee = amount_in * 997
    dup1                      // [amount_in, amount_in, reserve_in, reserve_out]
    0x03e5                    // [997, amount_in, amount_in, reserve_in, reserve_out]
    mul                       // [amount_in_with_fee, amount_in, reserve_in, reserve_out]

    // numerator = amount_in_with_fee * reserve_out
    dup4                      // [reserve_out, amount_in_with_fee, amount_in, reserve_in, reserve_out]
    mul                       // [numerator, amount_in, reserve_in, reserve_out]

    // denominator = reserve_in * 1000 + amount_in_with_fee
    swap2                     // [reserve_in, amount_in, numerator, reserve_out]
    0x03e8                    // [1000, reserve_in, amount_in, numerator, reserve_out]
    mul                       // [reserve_in_scaled, amount_in, numerator, reserve_out]
    swap1                     // [amount_in, reserve_in_scaled, numerator, reserve_out]
    0x03e5                    // [997, amount_in, reserve_in_scaled, numerator, reserve_out]
    mul                       // [amount_in_with_fee, reserve_in_scaled, numerator, reserve_out]
    add                       // [denominator, numerator, reserve_out]

    // amount_out = numerator / denominator
    swap1                     // [numerator, denominator, reserve_out]
    div                       // [amount_out, reserve_out]

    swap1 pop                 // [amount_out]
}

// Helper: Get pool reserves
#define macro GET_RESERVES() = takes(1) returns(2) {
    // Stack: [pool]

    // Call getReserves() - selector 0x0902f1ac
    0x0902f1ac                // [selector, pool]
    0x00 mstore               // [pool]

    0x00                      // [out_offset, pool]
    0x04                      // [in_size, out_offset, pool]
    0x00                      // [in_offset, in_size, out_offset, pool]
    0x00                      // [value, in_offset, in_size, out_offset, pool]
    dup5                      // [pool, value, in_offset, in_size, out_offset, pool]
    gas                       // [gas, pool, value, in_offset, in_size, out_offset, pool]
    staticcall                // [success, pool]

    // Load reserves from returndata
    0x00 mload                // [reserve0, pool]
    0x20 mload                // [reserve1, reserve0, pool]
    swap2 pop                 // [reserve1, reserve0]
}
```

### Uniswap V3 Swap Implementation

```huff
// SwapV3.huff

#define macro SWAP_V3() = takes(0) returns(0) {
    // Load parameters
    0x04 calldataload         // [pool]
    0x24 calldataload         // [zero_for_one, pool]
    0x44 calldataload         // [amount_in, zero_for_one, pool]
    0x64 calldataload         // [sqrt_price_limit, amount_in, zero_for_one, pool]

    // Prepare swap call
    // selector: swap(address,bool,int256,uint160,bytes)
    0x128acb08 0x00 mstore    // Store selector

    // Build calldata
    address 0x04 mstore       // recipient = this
    dup3 0x24 mstore          // zeroForOne
    dup3 0x44 mstore          // amountSpecified
    dup2 0x64 mstore          // sqrtPriceLimitX96
    0x00 0x84 mstore          // data offset
    0x00 0xa4 mstore          // data length

    // Execute swap
    0x00                      // [out_offset]
    0xc4                      // [in_size, out_offset]
    0x00                      // [in_offset, in_size, out_offset]
    0x00                      // [value, in_offset, in_size, out_offset]
    dup8                      // [pool, value, in_offset, in_size, out_offset, ...]
    gas                       // [gas, pool, value, in_offset, in_size, out_offset, ...]
    call                      // [success, ...]

    // Check success
    iszero fail jumpi
    stop

    fail:
        0x00 0x00 revert
}

// Uniswap V3 callback handler
#define macro UNISWAP_V3_SWAP_CALLBACK() = takes(0) returns(0) {
    // Callback is called during swap to transfer tokens
    // amount0Delta and amount1Delta are passed

    0x04 calldataload         // [amount0Delta]
    0x24 calldataload         // [amount1Delta, amount0Delta]

    // Determine which amount is positive (token we need to pay)
    dup1 0x00 sgt             // [amount1Delta > 0, amount1Delta, amount0Delta]
    pay_token1 jumpi

    // Pay token0
    pop                       // [amount0Delta]
    0x44 calldataload         // [token0, amount0Delta]
    swap1                     // [amount0Delta, token0]
    caller                    // [pool, amount0Delta, token0]
    TRANSFER()
    stop

    pay_token1:
        swap1 pop             // [amount1Delta]
        0x64 calldataload     // [token1, amount1Delta]
        swap1                 // [amount1Delta, token1]
        caller                // [pool, amount1Delta, token1]
        TRANSFER()
        stop
}
```

## Rust Implementation Patterns

### Async Pattern for Concurrent Simulations

```rust
use tokio::task::JoinSet;
use std::collections::HashMap;

pub struct ParallelSimulator {
    provider: Arc<Provider<Ws>>,
    max_concurrent: usize,
}

impl ParallelSimulator {
    pub async fn simulate_multiple(
        &self,
        opportunities: Vec<SandwichOpportunity>,
    ) -> Vec<SimulationResult> {
        let mut join_set = JoinSet::new();
        let mut results = Vec::new();

        // Spawn simulations
        for opportunity in opportunities.into_iter() {
            let provider = self.provider.clone();

            join_set.spawn(async move {
                Self::simulate_single(provider, opportunity).await
            });

            // Limit concurrent simulations
            if join_set.len() >= self.max_concurrent {
                if let Some(result) = join_set.join_next().await {
                    if let Ok(Ok(sim_result)) = result {
                        results.push(sim_result);
                    }
                }
            }
        }

        // Collect remaining
        while let Some(result) = join_set.join_next().await {
            if let Ok(Ok(sim_result)) = result {
                results.push(sim_result);
            }
        }

        results
    }

    async fn simulate_single(
        provider: Arc<Provider<Ws>>,
        opportunity: SandwichOpportunity,
    ) -> Result<SimulationResult> {
        // Create local EVM fork
        let mut evm = Evm::new(provider).await?;

        // Simulate frontrun
        let frontrun_result = evm.call(
            opportunity.frontrun_tx.clone(),
            None, // Use latest block
        ).await?;

        // Simulate victim
        let victim_result = evm.call(
            opportunity.victim_tx.clone(),
            None,
        ).await?;

        // Simulate backrun
        let backrun_result = evm.call(
            opportunity.backrun_tx.clone(),
            None,
        ).await?;

        // Calculate profit
        let profit = backrun_result.output
            .saturating_sub(opportunity.frontrun_amount)
            .saturating_sub(calculate_total_gas(&[
                frontrun_result.gas_used,
                backrun_result.gas_used,
            ]));

        Ok(SimulationResult {
            opportunity,
            profit,
            gas_used: frontrun_result.gas_used + backrun_result.gas_used,
            will_succeed: frontrun_result.success &&
                          victim_result.success &&
                          backrun_result.success,
        })
    }
}
```

### State Caching for Performance

```rust
use lru::LruCache;
use std::num::NonZeroUsize;

pub struct PoolDataCache {
    cache: Arc<RwLock<LruCache<Address, PoolData>>>,
    provider: Arc<Provider<Ws>>,
}

impl PoolDataCache {
    pub fn new(provider: Arc<Provider<Ws>>, capacity: usize) -> Self {
        Self {
            cache: Arc::new(RwLock::new(
                LruCache::new(NonZeroUsize::new(capacity).unwrap())
            )),
            provider,
        }
    }

    pub async fn get_pool_data(&self, pool_address: Address) -> Result<PoolData> {
        // Try cache first
        {
            let mut cache = self.cache.write().await;
            if let Some(data) = cache.get(&pool_address) {
                // Check if data is still fresh (< 12 seconds old)
                if data.timestamp + 12 > current_timestamp() {
                    return Ok(data.clone());
                }
            }
        }

        // Cache miss or stale - fetch fresh data
        let pool_data = self.fetch_pool_data(pool_address).await?;

        // Update cache
        {
            let mut cache = self.cache.write().await;
            cache.put(pool_address, pool_data.clone());
        }

        Ok(pool_data)
    }

    async fn fetch_pool_data(&self, pool_address: Address) -> Result<PoolData> {
        // Batch call using multicall
        let multicall = Multicall::new(self.provider.clone()).await?;

        let pool = IUniswapV2Pool::new(pool_address, self.provider.clone());

        multicall
            .add_call(pool.get_reserves(), false)
            .add_call(pool.token0(), false)
            .add_call(pool.token1(), false);

        let results: (Reserves, Address, Address) = multicall.call().await?;

        Ok(PoolData {
            address: pool_address,
            reserves: results.0,
            token0: results.1,
            token1: results.2,
            timestamp: current_timestamp(),
        })
    }
}
```

### Error Handling Pattern

```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SandoError {
    #[error("Simulation failed: {0}")]
    SimulationFailed(String),

    #[error("Insufficient profit: expected {expected}, got {actual}")]
    InsufficientProfit { expected: U256, actual: U256 },

    #[error("Salmonella token detected: {0}")]
    SalmonellaDetected(Address),

    #[error("Pool not found: {0}")]
    PoolNotFound(Address),

    #[error("Flashbots submission failed: {0}")]
    FlashbotsError(String),

    #[error("Provider error: {0}")]
    ProviderError(#[from] ethers::providers::ProviderError),

    #[error("Contract error: {0}")]
    ContractError(#[from] ethers::contract::ContractError<Provider<Ws>>),
}

pub type Result<T> = std::result::Result<T, SandoError>;

// Usage example
async fn process_opportunity(
    &self,
    opportunity: SandwichOpportunity,
) -> Result<()> {
    // Check for salmonella
    if self.is_salmonella(opportunity.token).await? {
        return Err(SandoError::SalmonellaDetected(opportunity.token));
    }

    // Simulate
    let sim_result = self.simulator
        .simulate(opportunity.clone())
        .await
        .map_err(|e| SandoError::SimulationFailed(e.to_string()))?;

    // Check profit
    if sim_result.profit < self.config.min_profit {
        return Err(SandoError::InsufficientProfit {
            expected: self.config.min_profit,
            actual: sim_result.profit,
        });
    }

    // Submit bundle
    self.executor
        .submit_bundle(opportunity.to_bundle())
        .await
        .map_err(|e| SandoError::FlashbotsError(e.to_string()))?;

    Ok(())
}
```

## Detailed MEV Strategy Algorithms

### Optimal Frontrun Calculation (Mathematical Derivation)

For Uniswap V2 (constant product AMM):

**Goal:** Maximize profit = backrun_output - frontrun_input - gas_cost

**Given:**
- Initial reserves: `R_in`, `R_out`
- Victim trade: `V_in` → `V_out`
- Frontrun: `F_in` → `F_out`
- Backrun: `F_out` → `B_out`

**AMM Formula:**
```
output = (input * 997 * reserve_out) / (reserve_in * 1000 + input * 997)
```

**Step 1:** Calculate state after frontrun
```
F_out = (F_in * 997 * R_out) / (R_in * 1000 + F_in * 997)
R_in' = R_in + F_in
R_out' = R_out - F_out
```

**Step 2:** Calculate state after victim
```
V_out = (V_in * 997 * R_out') / (R_in' * 1000 + V_in * 997)
R_in'' = R_in' + V_in
R_out'' = R_out' - V_out
```

**Step 3:** Calculate backrun output
```
B_out = (F_out * 997 * R_in'') / (R_out'' * 1000 + F_out * 997)
```

**Step 4:** Profit function
```
Profit(F_in) = B_out - F_in - gas_cost
```

**Step 5:** Find maximum via derivative
After calculus (omitted for brevity), optimal frontrun is:

```
F_in* = sqrt(R_in * R_out * V_in) - R_in
```

**Implementation:**

```rust
fn calculate_optimal_frontrun(
    reserve_in: U256,
    reserve_out: U256,
    victim_amount: U256,
) -> U256 {
    // Calculate: sqrt(reserve_in * reserve_out * victim_amount)
    let product = reserve_in
        .checked_mul(reserve_out)
        .and_then(|p| p.checked_mul(victim_amount))
        .expect("Overflow in optimal frontrun calculation");

    let sqrt_product = sqrt_u256(product);

    // Optimal = sqrt_product - reserve_in
    sqrt_product.saturating_sub(reserve_in)
}

// Integer square root using binary search
fn sqrt_u256(n: U256) -> U256 {
    if n == U256::zero() {
        return U256::zero();
    }

    let mut left = U256::one();
    let mut right = n;
    let mut result = U256::zero();

    while left <= right {
        let mid = (left + right) / 2;
        let mid_squared = mid * mid;

        if mid_squared == n {
            return mid;
        } else if mid_squared < n {
            result = mid;
            left = mid + U256::one();
        } else {
            right = mid - U256::one();
        }
    }

    result
}
```

### Multi-Meat Sandwich Algorithm

```rust
pub struct MultiMeatBundler {
    config: Config,
}

impl MultiMeatBundler {
    pub async fn find_multi_meat_opportunities(
        &self,
        pending_txs: Vec<Transaction>,
    ) -> Vec<MultiMeatBundle> {
        // Group transactions by token pair
        let mut grouped: HashMap<(Address, Address), Vec<Transaction>> = HashMap::new();

        for tx in pending_txs {
            if let Some((token_in, token_out)) = self.extract_token_pair(&tx) {
                grouped
                    .entry((token_in, token_out))
                    .or_insert_with(Vec::new)
                    .push(tx);
            }
        }

        // Find bundles with multiple victims
        let mut bundles = Vec::new();

        for ((token_in, token_out), victims) in grouped {
            if victims.len() >= 2 {
                // Calculate aggregate impact
                let total_victim_amount: U256 = victims
                    .iter()
                    .map(|tx| self.extract_amount(tx))
                    .sum();

                // Get pool data
                let pool = self.pool_manager
                    .get_pool(token_in, token_out)
                    .await?;

                // Calculate optimal frontrun for aggregate
                let optimal_frontrun = calculate_optimal_frontrun(
                    pool.reserve_in,
                    pool.reserve_out,
                    total_victim_amount,
                );

                // Build bundle
                let bundle = MultiMeatBundle {
                    token_pair: (token_in, token_out),
                    frontrun_amount: optimal_frontrun,
                    victim_txs: victims,
                    pool,
                };

                bundles.push(bundle);
            }
        }

        bundles
    }

    pub fn construct_bundle(&self, opportunity: &MultiMeatBundle) -> Bundle {
        let mut transactions = Vec::new();

        // 1. Frontrun transaction
        transactions.push(self.create_frontrun_tx(opportunity));

        // 2. All victim transactions
        transactions.extend(opportunity.victim_txs.clone());

        // 3. Backrun transaction
        transactions.push(self.create_backrun_tx(opportunity));

        Bundle {
            transactions,
            block_number: opportunity.block_number,
            min_timestamp: None,
            max_timestamp: None,
        }
    }
}
```

### Salmonella Detection Implementation

```rust
pub struct SalmonellaDetector {
    provider: Arc<Provider<Ws>>,
    blacklist: Arc<RwLock<HashSet<Address>>>,
}

impl SalmonellaDetector {
    pub async fn is_safe_token(&self, token: Address) -> Result<bool> {
        // Stage 1: Quick blacklist check
        {
            let blacklist = self.blacklist.read().await;
            if blacklist.contains(&token) {
                return Ok(false);
            }
        }

        // Stage 2: Bytecode analysis
        if !self.check_bytecode(token).await? {
            self.add_to_blacklist(token).await;
            return Ok(false);
        }

        // Stage 3: Simulation test
        if !self.test_buy_sell(token).await? {
            self.add_to_blacklist(token).await;
            return Ok(false);
        }

        Ok(true)
    }

    async fn check_bytecode(&self, token: Address) -> Result<bool> {
        let code = self.provider.get_code(token, None).await?;

        // Check for suspicious patterns
        let code_hex = hex::encode(&code);

        // Pattern 1: Selfdestruct instruction (0xff)
        if code_hex.contains("ff") {
            warn!("Token {} contains selfdestruct", token);
            return Ok(false);
        }

        // Pattern 2: Check for blacklist storage patterns
        // Look for specific opcodes that suggest blacklisting
        if self.contains_blacklist_pattern(&code) {
            warn!("Token {} has blacklist pattern", token);
            return Ok(false);
        }

        // Pattern 3: Pausable pattern
        if self.contains_pausable_pattern(&code) {
            warn!("Token {} is pausable", token);
            return Ok(false);
        }

        Ok(true)
    }

    async fn test_buy_sell(&self, token: Address) -> Result<bool> {
        // Create simulation environment
        let mut evm = Evm::new(self.provider.clone()).await?;

        let test_amount = parse_ether(1)?; // 1 ETH worth

        // Simulate buy
        let buy_result = evm.simulate_swap(
            self.weth_address(),
            token,
            test_amount,
        ).await?;

        if !buy_result.success {
            warn!("Token {} buy simulation failed", token);
            return Ok(false);
        }

        let tokens_received = buy_result.output;

        // Simulate immediate sell
        let sell_result = evm.simulate_swap(
            token,
            self.weth_address(),
            tokens_received,
        ).await?;

        if !sell_result.success {
            warn!("Token {} sell simulation failed", token);
            return Ok(false);
        }

        // Check if we can sell what we bought
        // Allow for 3% slippage due to fees
        let min_expected = test_amount * 97 / 100;

        if sell_result.output < min_expected {
            warn!(
                "Token {} suspicious: bought for {}, sold for {}",
                token, test_amount, sell_result.output
            );
            return Ok(false);
        }

        Ok(true)
    }

    fn contains_blacklist_pattern(&self, bytecode: &[u8]) -> bool {
        // Look for: CALLER, SLOAD, ISZERO pattern
        // This suggests checking msg.sender against storage
        bytecode.windows(3).any(|window| {
            window[0] == 0x33 &&  // CALLER
            window[1] == 0x54 &&  // SLOAD
            window[2] == 0x15     // ISZERO
        })
    }

    fn contains_pausable_pattern(&self, bytecode: &[u8]) -> bool {
        // Look for common pausable patterns
        // Usually involves SLOAD of a boolean flag
        // Followed by conditional revert

        // Simplified check: look for specific storage slot access patterns
        // In practice, this would be more sophisticated
        bytecode.windows(4).any(|window| {
            window[0] == 0x60 &&  // PUSH1
            window[1] == 0x00 &&  // 0x00 (common pause slot)
            window[2] == 0x54 &&  // SLOAD
            window[3] == 0x15     // ISZERO
        })
    }

    async fn add_to_blacklist(&self, token: Address) {
        let mut blacklist = self.blacklist.write().await;
        blacklist.insert(token);
    }
}
```

## Performance Optimizations

### 1. EVM Simulation Optimization

```rust
use revm::{
    primitives::{AccountInfo, Bytecode, TransactTo, U256},
    Database, EVM,
};

pub struct OptimizedSimulator {
    // Shared state cache across simulations
    state_cache: Arc<RwLock<HashMap<Address, AccountInfo>>>,
}

impl OptimizedSimulator {
    pub async fn simulate_with_cache(
        &self,
        tx: Transaction,
        block_number: u64,
    ) -> Result<SimulationResult> {
        // Create EVM instance
        let mut evm = EVM::new();

        // Load cached state
        {
            let cache = self.state_cache.read().await;
            for (address, account) in cache.iter() {
                evm.database.insert_account_info(*address, account.clone());
            }
        }

        // Configure transaction
        evm.env.tx.caller = tx.from;
        evm.env.tx.transact_to = TransactTo::Call(tx.to.unwrap());
        evm.env.tx.data = tx.input;
        evm.env.tx.value = tx.value;
        evm.env.tx.gas_limit = tx.gas.as_u64();
        evm.env.tx.gas_price = tx.gas_price.unwrap();

        // Execute
        let result = evm.transact_commit()?;

        // Update cache with touched accounts
        {
            let mut cache = self.state_cache.write().await;
            for (address, account) in evm.database.accounts() {
                cache.insert(*address, account.info.clone());
            }
        }

        Ok(SimulationResult {
            success: result.is_success(),
            gas_used: result.gas_used(),
            output: result.output().unwrap_or_default(),
        })
    }
}
```

### 2. Mempool Filter Optimization

```rust
pub struct FastMempoolFilter {
    // Bloom filter for quick rejection
    selector_bloom: BloomFilter,
    // Target selectors
    target_selectors: HashSet<[u8; 4]>,
}

impl FastMempoolFilter {
    pub fn new() -> Self {
        let mut filter = Self {
            selector_bloom: BloomFilter::new(10000, 0.01),
            target_selectors: HashSet::new(),
        };

        // Add Uniswap V2 selectors
        filter.add_selector(&hex!("38ed1739")); // swapExactTokensForTokens
        filter.add_selector(&hex!("7ff36ab5")); // swapExactETHForTokens
        filter.add_selector(&hex!("18cbafe5")); // swapExactTokensForETH
        filter.add_selector(&hex!("8803dbee")); // swapTokensForExactTokens

        // Add Uniswap V3 selectors
        filter.add_selector(&hex!("414bf389")); // exactInputSingle
        filter.add_selector(&hex!("b858183f")); // exactInput
        filter.add_selector(&hex!("db3e2198")); // exactOutputSingle

        filter
    }

    fn add_selector(&mut self, selector: &[u8; 4]) {
        self.selector_bloom.insert(selector);
        self.target_selectors.insert(*selector);
    }

    pub fn should_process(&self, tx: &Transaction) -> bool {
        // Quick rejection using bloom filter
        if tx.input.len() < 4 {
            return false;
        }

        let selector: [u8; 4] = tx.input[..4].try_into().unwrap();

        // Bloom filter check (fast)
        if !self.selector_bloom.contains(&selector) {
            return false;
        }

        // Exact match (slower, but only for potential matches)
        self.target_selectors.contains(&selector)
    }
}
```

### 3. Bundle Construction Optimization

```rust
pub struct BundleOptimizer {
    gas_estimator: GasEstimator,
}

impl BundleOptimizer {
    pub async fn optimize_bundle(
        &self,
        opportunity: SandwichOpportunity,
    ) -> Result<OptimizedBundle> {
        // Calculate optimal gas prices
        let (frontrun_gas, backrun_gas) = self.estimate_gas(&opportunity).await?;

        // Calculate priority fees
        // Frontrun needs higher priority to beat competitors
        // Backrun can use lower priority (will be included with victim)
        let base_fee = self.get_next_base_fee().await?;
        let frontrun_priority = self.calculate_competitive_priority().await?;
        let backrun_priority = U256::from(1_000_000_000); // 1 gwei

        // Build transactions
        let frontrun_tx = self.build_frontrun_tx(
            &opportunity,
            base_fee,
            frontrun_priority,
            frontrun_gas,
        )?;

        let backrun_tx = self.build_backrun_tx(
            &opportunity,
            base_fee,
            backrun_priority,
            backrun_gas,
        )?;

        // Calculate expected profit after gas
        let total_gas_cost = (frontrun_gas * (base_fee + frontrun_priority))
            + (backrun_gas * (base_fee + backrun_priority));

        let net_profit = opportunity.gross_profit.saturating_sub(total_gas_cost);

        Ok(OptimizedBundle {
            frontrun_tx,
            victim_tx: opportunity.victim_tx,
            backrun_tx,
            expected_profit: net_profit,
            total_gas_cost,
        })
    }

    async fn calculate_competitive_priority(&self) -> Result<U256> {
        // Monitor recent successful bundles
        let recent_bundles = self.get_recent_successful_bundles().await?;

        // Calculate percentile priority fee (e.g., 75th percentile)
        let mut priorities: Vec<U256> = recent_bundles
            .iter()
            .map(|b| b.priority_fee)
            .collect();

        priorities.sort();
        let percentile_75 = priorities[priorities.len() * 75 / 100];

        // Add 10% buffer
        Ok(percentile_75 * 110 / 100)
    }
}
```

## Configuration and Setup

### Environment Configuration

```env
# Ethereum Node
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
ETH_WS_URL=wss://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY
CHAIN_ID=1

# Flashbots
FLASHBOTS_RELAY_URL=https://relay.flashbots.net
FLASHBOTS_REPUTATION_PRIVATE_KEY=0x...  # Separate key for reputation

# Bot Configuration
PRIVATE_KEY=0x...  # Your bot's private key (NEVER commit this)
SANDO_CONTRACT_ADDRESS=0x...  # Your deployed Sando contract

# Strategy Parameters
MIN_PROFIT_WEI=10000000000000000  # 0.01 ETH
MAX_POSITION_SIZE_ETH=100  # Maximum frontrun size
MIN_VICTIM_SIZE_ETH=0.1  # Minimum victim trade size to sandwich

# Gas Configuration
MAX_GAS_PRICE_GWEI=500  # Maximum gas price willing to pay
MAX_PRIORITY_FEE_GWEI=100  # Maximum priority fee

# Performance
MAX_CONCURRENT_SIMULATIONS=20
STATE_CACHE_SIZE=1000  # Number of accounts to cache

# Safety
ENABLE_SALMONELLA_DETECTION=true
SIMULATION_REQUIRED=true  # Never submit without simulation
MAX_SLIPPAGE_BPS=50  # 0.5% maximum slippage

# Monitoring
ENABLE_METRICS=true
METRICS_PORT=9090
LOG_LEVEL=info
```

### Configuration Module

```rust
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    // Network
    pub eth_rpc_url: String,
    pub eth_ws_url: String,
    pub chain_id: u64,

    // Flashbots
    pub flashbots_relay_url: String,
    pub flashbots_reputation_private_key: String,

    // Bot
    pub private_key: String,
    pub sando_contract_address: Address,

    // Strategy
    pub min_profit_wei: U256,
    pub max_position_size_eth: f64,
    pub min_victim_size_eth: f64,

    // Gas
    pub max_gas_price_gwei: u64,
    pub max_priority_fee_gwei: u64,

    // Performance
    pub max_concurrent_simulations: usize,
    pub state_cache_size: usize,

    // Safety
    pub enable_salmonella_detection: bool,
    pub simulation_required: bool,
    pub max_slippage_bps: u64,

    // Monitoring
    pub enable_metrics: bool,
    pub metrics_port: u16,
    pub log_level: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenv::dotenv().ok();

        Ok(Config {
            eth_rpc_url: env::var("ETH_RPC_URL")?,
            eth_ws_url: env::var("ETH_WS_URL")?,
            chain_id: env::var("CHAIN_ID")?.parse()?,

            flashbots_relay_url: env::var("FLASHBOTS_RELAY_URL")?,
            flashbots_reputation_private_key: env::var("FLASHBOTS_REPUTATION_PRIVATE_KEY")?,

            private_key: env::var("PRIVATE_KEY")?,
            sando_contract_address: env::var("SANDO_CONTRACT_ADDRESS")?.parse()?,

            min_profit_wei: U256::from_dec_str(&env::var("MIN_PROFIT_WEI")?)?,
            max_position_size_eth: env::var("MAX_POSITION_SIZE_ETH")?.parse()?,
            min_victim_size_eth: env::var("MIN_VICTIM_SIZE_ETH")?.parse()?,

            max_gas_price_gwei: env::var("MAX_GAS_PRICE_GWEI")?.parse()?,
            max_priority_fee_gwei: env::var("MAX_PRIORITY_FEE_GWEI")?.parse()?,

            max_concurrent_simulations: env::var("MAX_CONCURRENT_SIMULATIONS")?.parse()?,
            state_cache_size: env::var("STATE_CACHE_SIZE")?.parse()?,

            enable_salmonella_detection: env::var("ENABLE_SALMONELLA_DETECTION")?.parse()?,
            simulation_required: env::var("SIMULATION_REQUIRED")?.parse()?,
            max_slippage_bps: env::var("MAX_SLIPPAGE_BPS")?.parse()?,

            enable_metrics: env::var("ENABLE_METRICS")?.parse()?,
            metrics_port: env::var("METRICS_PORT")?.parse()?,
            log_level: env::var("LOG_LEVEL")?,
        })
    }

    pub fn validate(&self) -> Result<()> {
        // Validate private key format
        if !self.private_key.starts_with("0x") || self.private_key.len() != 66 {
            return Err(anyhow!("Invalid private key format"));
        }

        // Validate reasonable profit threshold
        if self.min_profit_wei < parse_ether(0.001)? {
            warn!("Very low profit threshold may cause excessive gas spending");
        }

        // Validate max position size
        if self.max_position_size_eth > 1000.0 {
            warn!("Very large max position size - ensure sufficient capital");
        }

        Ok(())
    }
}
```

## Deployment Guide

### 1. Contract Deployment

```bash
# Navigate to contract directory
cd contract

# Compile Huff contracts
huffc src/SandoContract.huff -b

# Deploy using Foundry
forge create \
    --rpc-url $ETH_RPC_URL \
    --private-key $PRIVATE_KEY \
    --constructor-args $WETH_ADDRESS \
    SandoContract

# Save the deployed contract address
export SANDO_CONTRACT_ADDRESS=0x...
```

### 2. Contract Verification

```bash
# Flatten the Huff output
huffc src/SandoContract.huff --bin-runtime > SandoContract.bin

# Verify on Etherscan
forge verify-contract \
    --chain-id 1 \
    --compiler-version v0.8.19 \
    $SANDO_CONTRACT_ADDRESS \
    SandoContract
```

### 3. Bot Deployment

```bash
# Build release binary
cd bot
cargo build --release

# Create systemd service
sudo tee /etc/systemd/system/rusty-sando.service > /dev/null <<EOF
[Unit]
Description=Rusty-Sando MEV Bot
After=network.target

[Service]
Type=simple
User=mev
WorkingDirectory=/home/mev/rusty-sando/bot
Environment="PATH=/home/mev/.cargo/bin:/usr/local/bin:/usr/bin:/bin"
EnvironmentFile=/home/mev/rusty-sando/bot/.env
ExecStart=/home/mev/rusty-sando/bot/target/release/rusty-sando
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable rusty-sando
sudo systemctl start rusty-sando

# Check status
sudo systemctl status rusty-sando
```

### 4. Monitoring Setup

```bash
# Install Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.40.0/prometheus-2.40.0.linux-amd64.tar.gz
tar xvfz prometheus-*.tar.gz
cd prometheus-*

# Configure Prometheus
cat > prometheus.yml <<EOF
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'rusty-sando'
    static_configs:
      - targets: ['localhost:9090']
EOF

# Start Prometheus
./prometheus --config.file=prometheus.yml

# Install Grafana for visualization
sudo apt-get install -y grafana
sudo systemctl start grafana-server
```

## Testing Strategy

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_optimal_frontrun_calculation() {
        let reserve_in = parse_ether(100).unwrap();
        let reserve_out = parse_ether(50).unwrap();
        let victim_amount = parse_ether(10).unwrap();

        let optimal = calculate_optimal_frontrun(
            reserve_in,
            reserve_out,
            victim_amount,
        );

        // Verify optimal is reasonable
        assert!(optimal > U256::zero());
        assert!(optimal < victim_amount);
    }

    #[test]
    fn test_price_impact_calculation() {
        let pool = Pool {
            reserve_in: parse_ether(100).unwrap(),
            reserve_out: parse_ether(100).unwrap(),
            ..Default::default()
        };

        let amount_in = parse_ether(1).unwrap();
        let impact = pool.calculate_price_impact(amount_in);

        // 1 ETH in 100 ETH pool should have ~1% impact
        assert!(impact > 90 && impact < 110); // 0.9-1.1%
    }

    #[test]
    fn test_salmonella_detection() {
        // Test bytecode patterns
        let detector = SalmonellaDetector::new();

        // Malicious bytecode with selfdestruct
        let bad_bytecode = hex!("60ff");
        assert!(!detector.is_safe_bytecode(&bad_bytecode));

        // Normal ERC20 bytecode
        let good_bytecode = hex!("6080604052");
        assert!(detector.is_safe_bytecode(&good_bytecode));
    }
}
```

### Integration Tests

```rust
#[cfg(test)]
mod integration_tests {
    use super::*;

    #[tokio::test]
    async fn test_end_to_end_sandwich() {
        // Setup test environment
        let anvil = Anvil::new().fork(ETH_RPC_URL).spawn();
        let provider = Provider::<Http>::try_from(anvil.endpoint()).unwrap();

        // Deploy contracts
        let weth = deploy_weth(&provider).await.unwrap();
        let factory = deploy_uniswap_factory(&provider).await.unwrap();
        let sando = deploy_sando_contract(&provider, weth.address()).await.unwrap();

        // Create test pool
        let (token_a, token_b) = deploy_test_tokens(&provider).await.unwrap();
        let pool = create_pair(&factory, token_a.address(), token_b.address()).await.unwrap();
        add_liquidity(&pool, parse_ether(100).unwrap()).await.unwrap();

        // Create victim transaction
        let victim_tx = create_swap_tx(
            token_a.address(),
            token_b.address(),
            parse_ether(10).unwrap(),
        );

        // Run sandwich strategy
        let strategy = SandwichStrategy::new(provider.into(), sando, Config::default());
        let opportunity = strategy
            .calculate_sandwich_opportunity(&victim_tx)
            .await
            .unwrap()
            .unwrap();

        // Verify opportunity is profitable
        assert!(opportunity.expected_profit > parse_ether(0.01).unwrap());

        // Execute sandwich
        let bundle = opportunity.to_bundle();
        let result = execute_bundle(&provider, bundle).await.unwrap();

        // Verify success
        assert!(result.success);
        assert!(result.profit > U256::zero());
    }
}
```

### Contract Tests (Foundry)

```solidity
// test/SandoContract.t.sol
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../src/SandoContract.sol";

contract SandoContractTest is Test {
    SandoContract sando;
    address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;

    function setUp() public {
        sando = new SandoContract(WETH);
    }

    function testSwapV2() public {
        // Setup: Fund contract with WETH
        deal(WETH, address(sando), 10 ether);

        // Get Uniswap V2 WETH/USDC pool
        address pool = 0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc;

        // Execute swap
        uint256 amountIn = 1 ether;
        sando.swapV2(
            WETH,
            USDC,
            amountIn,
            0, // min amount out
            pool
        );

        // Verify we received USDC
        uint256 usdcBalance = IERC20(USDC).balanceOf(address(sando));
        assertGt(usdcBalance, 0);
    }

    function testMultiHopSwap() public {
        // Test multi-hop routing
        deal(WETH, address(sando), 10 ether);

        address[] memory path = new address[](3);
        path[0] = WETH;
        path[1] = USDC;
        path[2] = DAI;

        sando.multiHopSwap(path, 1 ether, 0);

        uint256 daiBalance = IERC20(DAI).balanceOf(address(sando));
        assertGt(daiBalance, 0);
    }

    function testOnlyOwnerCanWithdraw() public {
        deal(WETH, address(sando), 10 ether);

        // Try to withdraw as non-owner
        vm.prank(address(0x1234));
        vm.expectRevert("Not owner");
        sando.withdraw(WETH);

        // Withdraw as owner should succeed
        sando.withdraw(WETH);
        assertEq(IERC20(WETH).balanceOf(address(this)), 10 ether);
    }
}
```

## Gas Optimization

### Gas-Efficient Techniques

1. **Use Huff Instead of Solidity:** 20-40% gas savings
2. **Minimize Storage Operations:** Use memory/calldata when possible
3. **Batch Operations:** Combine multiple calls
4. **Optimal Data Types:** Use uint256 (EVM native) when possible
5. **Short-Circuit Logic:** Place cheap checks first

### Gas Benchmarks

Typical gas costs for rusty-sando operations:

| Operation | Gas Cost | Notes |
|-----------|----------|-------|
| V2 Swap | ~95,000 | Optimized Huff implementation |
| V3 Swap | ~140,000 | More complex than V2 |
| Multi-hop V2 | ~150,000 | Two swaps |
| Withdraw | ~45,000 | Simple transfer |
| Full Sandwich | ~250,000 | Frontrun + backrun |

Compare to Solidity equivalents (typically 30% higher).

## Security Analysis

### Attack Vectors

1. **Private Key Compromise:**
   - Risk: Total loss of funds
   - Mitigation: Hardware wallet, secure key management, regular rotation

2. **Salmonella Tokens:**
   - Risk: Locked funds in honeypot contracts
   - Mitigation: Multi-stage detection, simulation required

3. **Flashbots Relay Manipulation:**
   - Risk: Bundle stealing, frontrunning
   - Mitigation: Use reputable relays, monitor for unusual behavior

4. **Gas Price Manipulation:**
   - Risk: Overpaying for inclusion
   - Mitigation: Max gas price limits, competitive analysis

5. **Smart Contract Vulnerabilities:**
   - Risk: Funds drained via exploit
   - Mitigation: Extensive testing, formal verification, audit

### Security Best Practices

```rust
// 1. Always simulate before submitting
if config.simulation_required {
    let sim_result = simulator.simulate(opportunity).await?;
    if !sim_result.success {
        return Err(SandoError::SimulationFailed);
    }
}

// 2. Validate all external inputs
fn validate_opportunity(opp: &SandwichOpportunity) -> Result<()> {
    require!(opp.frontrun_amount > U256::zero(), "Invalid frontrun amount");
    require!(opp.expected_profit > MIN_PROFIT, "Insufficient profit");
    require!(opp.pool.reserve_in > U256::zero(), "Invalid pool reserves");
    Ok(())
}

// 3. Implement circuit breakers
struct CircuitBreaker {
    max_loss_per_hour: U256,
    current_loss: U256,
    last_reset: Instant,
}

impl CircuitBreaker {
    fn check_before_trade(&mut self, amount: U256) -> Result<()> {
        if self.current_loss + amount > self.max_loss_per_hour {
            return Err(SandoError::CircuitBreakerTripped);
        }
        Ok(())
    }
}

// 4. Rate limiting
struct RateLimiter {
    max_bundles_per_block: usize,
    bundles_this_block: usize,
}

impl RateLimiter {
    fn allow_submission(&mut self) -> bool {
        if self.bundles_this_block >= self.max_bundles_per_block {
            return false;
        }
        self.bundles_this_block += 1;
        true
    }
}
```

## Common Issues and Solutions

### Issue 1: Bundles Not Landing

**Symptoms:** Bundles submitted but never included

**Causes:**
- Priority fee too low
- Bundle simulation fails on-chain
- Timing issues (victim TX already mined)

**Solutions:**
```rust
// Increase priority fee dynamically
let recent_landed = get_recent_landed_bundles().await?;
let avg_priority = calculate_average_priority(&recent_landed);
let competitive_priority = avg_priority * 120 / 100; // 20% higher

// Add bundle validity period
bundle.min_timestamp = Some(current_timestamp());
bundle.max_timestamp = Some(current_timestamp() + 12); // Only valid for 1 block

// Monitor and retry
if !bundle_landed_in_block(bundle_hash, target_block).await? {
    retry_with_higher_priority(bundle).await?;
}
```

### Issue 2: Negative Profit After Execution

**Symptoms:** Simulation shows profit, but actual execution loses money

**Causes:**
- State changes between simulation and execution
- Underestimated gas costs
- Front-running by other bots

**Solutions:**
```rust
// Add safety margin to profit calculation
let required_profit = config.min_profit * 150 / 100; // 50% margin

// Validate state hasn't changed
let current_reserves = pool.get_reserves().await?;
if current_reserves != simulation_reserves {
    return Err(SandoError::StateChanged);
}

// Use more accurate gas estimation
let gas_with_buffer = estimated_gas * 120 / 100; // 20% buffer
```

### Issue 3: Salmonella Token Bypass

**Symptoms:** Bot loses funds to honeypot tokens despite detection

**Causes:**
- Sophisticated honeypot that passes initial checks
- Time-based or block-based honeypot activation
- Different behavior for different addresses

**Solutions:**
```rust
// More comprehensive testing
async fn extended_salmonella_check(token: Address) -> Result<bool> {
    // Test 1: Standard buy-sell
    if !test_buy_sell(token).await? {
        return Ok(false);
    }

    // Test 2: Test from different address
    if !test_from_different_address(token).await? {
        return Ok(false);
    }

    // Test 3: Test with time delay
    if !test_with_delay(token).await? {
        return Ok(false);
    }

    // Test 4: Check token contract age
    let creation_block = get_contract_creation_block(token).await?;
    let current_block = provider.get_block_number().await?;
    if current_block - creation_block < 100 {
        // Very new token, extra suspicious
        warn!("Token {} is very new", token);
        return Ok(false);
    }

    Ok(true)
}
```

## Enhancement Opportunities

### 1. Multi-Chain Support

```rust
pub enum Chain {
    Ethereum,
    BSC,
    Polygon,
    Arbitrum,
    Optimism,
}

pub struct MultiChainSandoBot {
    bots: HashMap<Chain, SandwichStrategy>,
}

impl MultiChainSandoBot {
    pub async fn run(&mut self) {
        let mut handles = vec![];

        for (chain, bot) in self.bots.iter_mut() {
            let handle = tokio::spawn(async move {
                bot.run().await
            });
            handles.push(handle);
        }

        join_all(handles).await;
    }
}
```

### 2. Machine Learning for Opportunity Scoring

```rust
pub struct MLOpportunityScorer {
    model: TorchModel,
}

impl MLOpportunityScorer {
    pub async fn score_opportunity(
        &self,
        opportunity: &SandwichOpportunity,
    ) -> f32 {
        // Extract features
        let features = vec![
            opportunity.pool.liquidity_usd,
            opportunity.victim_size.as_u128() as f32,
            opportunity.expected_profit.as_u128() as f32,
            opportunity.gas_cost.as_u128() as f32,
            opportunity.pool.volume_24h,
            opportunity.token_age_days,
        ];

        // Run inference
        let score = self.model.predict(features);
        score
    }
}
```

### 3. Advanced Bundle Strategies

```rust
pub enum BundleStrategy {
    Simple,           // Single frontrun + backrun
    MultiMeat,        // Multiple victims
    Layered,          // Multiple frontrunS with different gas prices
    CrossPool,        // Sandwich across multiple pools
}

pub struct AdvancedBundler {
    strategy: BundleStrategy,
}

impl AdvancedBundler {
    pub async fn build_optimal_bundle(
        &self,
        opportunities: Vec<SandwichOpportunity>,
    ) -> Bundle {
        match self.strategy {
            BundleStrategy::Simple => self.build_simple(opportunities[0]),
            BundleStrategy::MultiMeat => self.build_multi_meat(opportunities),
            BundleStrategy::Layered => self.build_layered(opportunities[0]),
            BundleStrategy::CrossPool => self.build_cross_pool(opportunities),
        }
    }
}
```

### 4. MEV-Share Integration

```rust
pub struct MEVShareIntegration {
    client: MEVShareClient,
}

impl MEVShareIntegration {
    pub async fn submit_with_kickback(
        &self,
        bundle: Bundle,
        kickback_percent: u8,
    ) -> Result<BundleHash> {
        // Submit bundle with user kickback
        let bundle_params = BundleParams {
            bundle,
            kickback_percent,
            privacy: Privacy::FullyPrivate,
        };

        self.client.submit_bundle(bundle_params).await
    }
}
```

## Complete Code Examples

### Full Bot Implementation Example

```rust
// main.rs - Complete bot implementation
use anyhow::Result;
use artemis::{Engine, Collector, Strategy, Executor};
use ethers::prelude::*;
use std::sync::Arc;
use tracing::{info, warn, error};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter("rusty_sando=info")
        .init();

    info!("Starting Rusty-Sando MEV Bot");

    // Load configuration
    let config = Config::from_env()?;
    config.validate()?;

    // Setup Ethereum provider
    let provider = Arc::new(
        Provider::<Ws>::connect(&config.eth_ws_url)
            .await?
            .interval(std::time::Duration::from_millis(100))
    );

    // Setup wallet
    let wallet = config.private_key
        .parse::<LocalWallet>()?
        .with_chain_id(config.chain_id);
    let signer = Arc::new(SignerMiddleware::new(provider.clone(), wallet));

    // Initialize contract
    let contract = SandoContract::new(
        config.sando_contract_address,
        signer.clone(),
    );

    // Create Artemis engine
    let mut engine = Engine::new();

    // Add collectors
    let mempool_collector = Box::new(
        MempoolCollector::new(provider.clone())
    );
    let block_collector = Box::new(
        BlockCollector::new(provider.clone())
    );

    engine.add_collector(mempool_collector);
    engine.add_collector(block_collector);

    // Add strategy
    let strategy = Box::new(
        SandwichStrategy::new(
            provider.clone(),
            contract,
            config.clone(),
        )
    );

    engine.add_strategy(strategy);

    // Add executor
    let executor = Box::new(
        FlashbotsExecutor::new(
            signer.clone(),
            config.flashbots_relay_url.clone(),
        )
    );

    engine.add_executor(executor);

    // Setup metrics
    if config.enable_metrics {
        setup_metrics_server(config.metrics_port)?;
    }

    // Run bot
    info!("Bot initialized, starting main loop");
    engine.run().await?;

    Ok(())
}

fn setup_metrics_server(port: u16) -> Result<()> {
    use prometheus::{Encoder, TextEncoder};
    use warp::Filter;

    tokio::spawn(async move {
        let metrics_route = warp::path("metrics").map(|| {
            let encoder = TextEncoder::new();
            let metric_families = prometheus::gather();
            let mut buffer = vec![];
            encoder.encode(&metric_families, &mut buffer).unwrap();
            String::from_utf8(buffer).unwrap()
        });

        warp::serve(metrics_route)
            .run(([0, 0, 0, 0], port))
            .await;
    });

    Ok(())
}
```

This comprehensive developer documentation provides everything needed to understand, deploy, and optimize Rusty-Sando for MEV extraction on Ethereum.

