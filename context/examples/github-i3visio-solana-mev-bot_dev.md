**Source:** https://github.com/i3visio/solana-mev-bot
**Date:** August 2024

# Solana MEV Bot: Deep Developer Documentation

## Deep Architecture Analysis

### Solana Transaction Processing Model

Unlike Ethereum's sequential block processing, Solana uses a unique parallel execution model:

```
┌─────────────────────────────────────────────────────────┐
│              Solana Runtime (Sealevel)                  │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Thread 1   │  │  Thread 2   │  │  Thread 3   │   │
│  │             │  │             │  │             │   │
│  │  TX 1, 4, 7 │  │  TX 2, 5, 8 │  │  TX 3, 6, 9 │   │
│  │  (parallel) │  │  (parallel) │  │  (parallel) │   │
│  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                         │
│  Transactions with non-overlapping accounts             │
│  execute in parallel                                    │
└─────────────────────────────────────────────────────────┘
```

**Implications for MEV:**
- No mempool to frontrun
- Parallel execution reduces ordering advantages
- Speed of detection + submission matters most
- Statistical arbitrage > transaction ordering MEV

### Bot Architecture Layers

```
┌──────────────────────────────────────────────────────────┐
│                  Application Layer                       │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Main Trading Loop (async)                         │ │
│  │  - Pool monitoring                                 │ │
│  │  - Opportunity detection                           │ │
│  │  - Transaction execution                           │ │
│  └────────────────────────────────────────────────────┘ │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│                  Strategy Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Arbitrage   │  │  Flash Loan  │  │   Multi-Hop  │  │
│  │  Detector    │  │  Calculator  │  │   Optimizer  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│                  Integration Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Raydium    │  │     Orca     │  │   Meteora    │  │
│  │   Adapter    │  │    Adapter   │  │    Adapter   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Kamino     │  │  Transaction │  │     RPC      │  │
│  │  Flash Loan  │  │   Builder    │  │    Client    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└───────────────────────┬──────────────────────────────────┘
                        │
┌───────────────────────▼──────────────────────────────────┐
│                    Network Layer                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │         Solana Network (Mainnet-Beta)              │ │
│  │  - Multiple RPC endpoints                          │ │
│  │  - WebSocket subscriptions                         │ │
│  │  - Transaction submission pool                     │ │
│  └────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

## Code Structure and Organization

### Project Structure

```
solana-mev-bot/
├── src/
│   ├── main.rs                 # Entry point, main loop
│   ├── config.rs               # Configuration management
│   ├── types.rs                # Shared types and structs
│   ├── error.rs                # Error types
│   │
│   ├── pool/
│   │   ├── mod.rs
│   │   ├── manager.rs          # Pool data management
│   │   ├── cache.rs            # Pool state caching
│   │   └── types.rs            # Pool-related types
│   │
│   ├── dex/
│   │   ├── mod.rs
│   │   ├── trait.rs            # Common DEX interface
│   │   ├── raydium.rs          # Raydium integration
│   │   ├── orca.rs             # Orca integration
│   │   ├── meteora.rs          # Meteora integration
│   │   ├── pump.rs             # Pump.fun integration
│   │   └── utils.rs            # DEX utilities
│   │
│   ├── flash_loan/
│   │   ├── mod.rs
│   │   ├── kamino.rs           # Kamino flash loan
│   │   └── calculator.rs       # Optimal size calculation
│   │
│   ├── arbitrage/
│   │   ├── mod.rs
│   │   ├── detector.rs         # Opportunity detection
│   │   ├── optimizer.rs        # Trade size optimization
│   │   └── validator.rs        # Opportunity validation
│   │
│   ├── transaction/
│   │   ├── mod.rs
│   │   ├── builder.rs          # Transaction construction
│   │   ├── signer.rs           # Transaction signing
│   │   ├── submitter.rs        # Submission logic
│   │   └── spam.rs             # Transaction spamming
│   │
│   ├── rpc/
│   │   ├── mod.rs
│   │   ├── client.rs           # RPC client wrapper
│   │   └── multi.rs            # Multi-RPC management
│   │
│   └── utils/
│       ├── mod.rs
│       ├── math.rs             # Math utilities
│       ├── priority_fee.rs     # Fee calculation
│       └── alt.rs              # Address Lookup Tables
│
├── tests/
│   ├── integration_tests.rs
│   ├── dex_tests.rs
│   └── math_tests.rs
│
├── examples/
│   ├── simple_arbitrage.rs
│   └── flash_loan_demo.rs
│
├── Cargo.toml
├── .env.example
└── README.md
```

### Core Module Analysis

#### 1. Main.rs - Entry Point and Event Loop

```rust
use solana_client::{
    rpc_client::RpcClient,
    rpc_config::RpcSendTransactionConfig,
};
use solana_sdk::{
    commitment_config::CommitmentConfig,
    signature::{Keypair, Signer},
};
use std::sync::Arc;
use tokio::time::{interval, Duration};

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize logging
    env_logger::init();
    info!("Starting Solana MEV Bot");

    // Load configuration
    let config = Config::from_env()?;
    config.validate()?;

    // Load wallet keypair
    let keypair = load_keypair(&config.wallet_path)?;
    let pubkey = keypair.pubkey();
    info!("Bot wallet: {}", pubkey);

    // Initialize RPC client
    let rpc_client = Arc::new(RpcClient::new_with_commitment(
        config.rpc_url.clone(),
        CommitmentConfig::confirmed(),
    ));

    // Check balance
    let balance = rpc_client.get_balance(&pubkey)?;
    info!("Wallet balance: {} SOL", balance as f64 / 1e9);

    if balance < 100_000_000 {  // Less than 0.1 SOL
        warn!("Low balance! Minimum 0.1 SOL recommended for fees");
    }

    // Initialize components
    let pool_manager = Arc::new(PoolManager::new(
        rpc_client.clone(),
        config.clone(),
    ).await?);

    let arbitrage_detector = Arc::new(ArbitrageDetector::new(
        pool_manager.clone(),
        config.clone(),
    ));

    let tx_builder = Arc::new(TransactionBuilder::new(
        keypair,
        config.clone(),
    ));

    let tx_submitter = Arc::new(TransactionSubmitter::new(
        rpc_client.clone(),
        config.clone(),
    ));

    // Start main trading loop
    info!("Starting main trading loop");
    run_trading_loop(
        pool_manager,
        arbitrage_detector,
        tx_builder,
        tx_submitter,
        config,
    ).await?;

    Ok(())
}

async fn run_trading_loop(
    pool_manager: Arc<PoolManager>,
    arbitrage_detector: Arc<ArbitrageDetector>,
    tx_builder: Arc<TransactionBuilder>,
    tx_submitter: Arc<TransactionSubmitter>,
    config: Config,
) -> Result<()> {
    // Pool refresh interval
    let mut refresh_interval = interval(
        Duration::from_secs(config.pool_refresh_interval)
    );

    loop {
        tokio::select! {
            // Periodic pool refresh
            _ = refresh_interval.tick() => {
                if let Err(e) = pool_manager.refresh_all_pools().await {
                    error!("Failed to refresh pools: {}", e);
                    continue;
                }
                info!("Refreshed {} pools", pool_manager.pool_count());
            }

            // Continuous opportunity detection
            _ = tokio::time::sleep(Duration::from_millis(100)) => {
                match arbitrage_detector.find_opportunities().await {
                    Ok(opportunities) => {
                        for opp in opportunities {
                            if opp.expected_profit > config.min_profit {
                                info!("Found opportunity: {} lamports profit", opp.expected_profit);

                                // Build transaction
                                match tx_builder.build_arbitrage_tx(&opp).await {
                                    Ok(tx) => {
                                        // Submit with spamming
                                        match tx_submitter.submit_with_spam(tx, config.spam_count).await {
                                            Ok(sig) => {
                                                info!("Submitted transaction: {}", sig);
                                            }
                                            Err(e) => {
                                                error!("Failed to submit: {}", e);
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        error!("Failed to build transaction: {}", e);
                                    }
                                }
                            }
                        }
                    }
                    Err(e) => {
                        error!("Error detecting opportunities: {}", e);
                    }
                }
            }
        }
    }
}
```

#### 2. Pool Manager - Data Refresh and Caching

```rust
use solana_client::rpc_client::RpcClient;
use solana_sdk::pubkey::Pubkey;
use std::collections::HashMap;
use std::sync::RwLock;

pub struct PoolManager {
    rpc: Arc<RpcClient>,
    config: Config,
    pools: RwLock<HashMap<Pubkey, PoolData>>,
    dex_adapters: HashMap<String, Box<dyn DexAdapter>>,
}

#[derive(Debug, Clone)]
pub struct PoolData {
    pub address: Pubkey,
    pub dex: String,
    pub token_a: Pubkey,
    pub token_b: Pubkey,
    pub reserve_a: u64,
    pub reserve_b: u64,
    pub fee_bps: u16,
    pub last_updated: i64,
}

impl PoolManager {
    pub async fn new(rpc: Arc<RpcClient>, config: Config) -> Result<Self> {
        let mut dex_adapters: HashMap<String, Box<dyn DexAdapter>> = HashMap::new();

        // Initialize DEX adapters based on config
        if config.enable_raydium {
            dex_adapters.insert(
                "raydium".to_string(),
                Box::new(RaydiumAdapter::new(rpc.clone())),
            );
        }

        if config.enable_orca {
            dex_adapters.insert(
                "orca".to_string(),
                Box::new(OrcaAdapter::new(rpc.clone())),
            );
        }

        if config.enable_meteora {
            dex_adapters.insert(
                "meteora".to_string(),
                Box::new(MeteoraAdapter::new(rpc.clone())),
            );
        }

        Ok(Self {
            rpc,
            config,
            pools: RwLock::new(HashMap::new()),
            dex_adapters,
        })
    }

    pub async fn refresh_all_pools(&self) -> Result<()> {
        let start = Instant::now();

        // Fetch pools from all DEXs in parallel
        let mut fetch_futures = vec![];

        for (dex_name, adapter) in &self.dex_adapters {
            let adapter = adapter.clone();
            let dex_name = dex_name.clone();

            fetch_futures.push(tokio::spawn(async move {
                let pools = adapter.fetch_all_pools().await?;
                Ok::<_, Error>((dex_name, pools))
            }));
        }

        // Collect results
        let results = join_all(fetch_futures).await;

        let mut new_pools = HashMap::new();
        let mut total_fetched = 0;

        for result in results {
            match result {
                Ok(Ok((dex_name, pools))) => {
                    info!("Fetched {} pools from {}", pools.len(), dex_name);
                    total_fetched += pools.len();

                    for pool in pools {
                        new_pools.insert(pool.address, pool);
                    }
                }
                Ok(Err(e)) => {
                    error!("Error fetching pools: {}", e);
                }
                Err(e) => {
                    error!("Task join error: {}", e);
                }
            }
        }

        // Update cache
        {
            let mut pools = self.pools.write().unwrap();
            *pools = new_pools;
        }

        let duration = start.elapsed();
        info!(
            "Refreshed {} pools in {:.2}s",
            total_fetched,
            duration.as_secs_f64()
        );

        Ok(())
    }

    pub fn get_pool(&self, address: &Pubkey) -> Option<PoolData> {
        let pools = self.pools.read().unwrap();
        pools.get(address).cloned()
    }

    pub fn find_pools_for_pair(
        &self,
        token_a: &Pubkey,
        token_b: &Pubkey,
    ) -> Vec<PoolData> {
        let pools = self.pools.read().unwrap();

        pools.values()
            .filter(|pool| {
                (pool.token_a == *token_a && pool.token_b == *token_b) ||
                (pool.token_a == *token_b && pool.token_b == *token_a)
            })
            .cloned()
            .collect()
    }

    pub fn pool_count(&self) -> usize {
        let pools = self.pools.read().unwrap();
        pools.len()
    }
}
```

#### 3. DEX Adapter Trait and Implementations

```rust
use async_trait::async_trait;
use solana_sdk::{instruction::Instruction, pubkey::Pubkey};

#[async_trait]
pub trait DexAdapter: Send + Sync {
    /// Fetch all pools from this DEX
    async fn fetch_all_pools(&self) -> Result<Vec<PoolData>>;

    /// Get pool data for specific address
    async fn get_pool(&self, address: &Pubkey) -> Result<PoolData>;

    /// Calculate output amount for given input
    fn calculate_output(
        &self,
        pool: &PoolData,
        token_in: &Pubkey,
        amount_in: u64,
    ) -> Result<u64>;

    /// Build swap instruction
    fn build_swap_instruction(
        &self,
        pool: &PoolData,
        user: &Pubkey,
        token_in: &Pubkey,
        token_out: &Pubkey,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<Instruction>;
}

// Raydium Implementation
pub struct RaydiumAdapter {
    rpc: Arc<RpcClient>,
}

#[async_trait]
impl DexAdapter for RaydiumAdapter {
    async fn fetch_all_pools(&self) -> Result<Vec<PoolData>> {
        // Raydium uses program-derived addresses
        // Fetch all accounts owned by Raydium AMM program

        const RAYDIUM_AMM_PROGRAM: Pubkey = pubkey!("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

        let accounts = self.rpc.get_program_accounts(&RAYDIUM_AMM_PROGRAM)?;

        let mut pools = Vec::new();

        for (pubkey, account) in accounts {
            // Parse Raydium pool state
            if let Ok(pool_state) = parse_raydium_pool_state(&account.data) {
                pools.push(PoolData {
                    address: pubkey,
                    dex: "raydium".to_string(),
                    token_a: pool_state.coin_mint,
                    token_b: pool_state.pc_mint,
                    reserve_a: pool_state.coin_vault_amount,
                    reserve_b: pool_state.pc_vault_amount,
                    fee_bps: 25,  // Raydium standard fee: 0.25%
                    last_updated: now(),
                });
            }
        }

        Ok(pools)
    }

    fn calculate_output(
        &self,
        pool: &PoolData,
        token_in: &Pubkey,
        amount_in: u64,
    ) -> Result<u64> {
        // Raydium uses constant product AMM: x * y = k

        let (reserve_in, reserve_out) = if *token_in == pool.token_a {
            (pool.reserve_a, pool.reserve_b)
        } else {
            (pool.reserve_b, pool.reserve_a)
        };

        // Apply fee
        let fee_multiplier = 10000 - pool.fee_bps;
        let amount_in_with_fee = (amount_in as u128)
            .checked_mul(fee_multiplier as u128)
            .ok_or(Error::Overflow)?;

        // Calculate output: (amount_in_with_fee * reserve_out) / (reserve_in * 10000 + amount_in_with_fee)
        let numerator = amount_in_with_fee
            .checked_mul(reserve_out as u128)
            .ok_or(Error::Overflow)?;

        let denominator = (reserve_in as u128)
            .checked_mul(10000)
            .ok_or(Error::Overflow)?
            .checked_add(amount_in_with_fee)
            .ok_or(Error::Overflow)?;

        let amount_out = numerator
            .checked_div(denominator)
            .ok_or(Error::DivisionByZero)? as u64;

        Ok(amount_out)
    }

    fn build_swap_instruction(
        &self,
        pool: &PoolData,
        user: &Pubkey,
        token_in: &Pubkey,
        token_out: &Pubkey,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<Instruction> {
        // Raydium swap instruction structure
        // This is simplified; actual implementation needs full account setup

        const RAYDIUM_AMM_PROGRAM: Pubkey = pubkey!("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8");

        // Get user token accounts
        let user_token_in = get_associated_token_address(user, token_in);
        let user_token_out = get_associated_token_address(user, token_out);

        // Raydium swap instruction data
        let instruction_data = RaydiumSwapInstruction {
            instruction: 9,  // Swap instruction discriminator
            amount_in,
            minimum_amount_out,
        };

        Ok(Instruction {
            program_id: RAYDIUM_AMM_PROGRAM,
            accounts: vec![
                // Token program
                AccountMeta::new_readonly(spl_token::id(), false),
                // AMM
                AccountMeta::new(pool.address, false),
                // AMM authority
                AccountMeta::new_readonly(get_amm_authority(&pool.address), false),
                // User accounts
                AccountMeta::new(user_token_in, false),
                AccountMeta::new(user_token_out, false),
                // Pool vaults
                AccountMeta::new(pool.coin_vault, false),
                AccountMeta::new(pool.pc_vault, false),
                // More accounts...
            ],
            data: instruction_data.try_to_vec()?,
        })
    }
}

// Orca Implementation
pub struct OrcaAdapter {
    rpc: Arc<RpcClient>,
}

#[async_trait]
impl DexAdapter for OrcaAdapter {
    async fn fetch_all_pools(&self) -> Result<Vec<PoolData>> {
        // Orca has both legacy pools and Whirlpools

        const ORCA_WHIRLPOOL_PROGRAM: Pubkey = pubkey!("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");

        let accounts = self.rpc.get_program_accounts(&ORCA_WHIRLPOOL_PROGRAM)?;

        let mut pools = Vec::new();

        for (pubkey, account) in accounts {
            if let Ok(whirlpool) = parse_whirlpool_state(&account.data) {
                // Orca Whirlpools use concentrated liquidity
                // Simplify to treat as standard AMM for this example

                pools.push(PoolData {
                    address: pubkey,
                    dex: "orca".to_string(),
                    token_a: whirlpool.token_mint_a,
                    token_b: whirlpool.token_mint_b,
                    reserve_a: whirlpool.liquidity_a,
                    reserve_b: whirlpool.liquidity_b,
                    fee_bps: whirlpool.fee_rate,
                    last_updated: now(),
                });
            }
        }

        Ok(pools)
    }

    fn calculate_output(
        &self,
        pool: &PoolData,
        token_in: &Pubkey,
        amount_in: u64,
    ) -> Result<u64> {
        // Similar to Raydium but with Orca's fee structure
        // Orca has variable fees (0.01%, 0.3%, 1%)

        let (reserve_in, reserve_out) = if *token_in == pool.token_a {
            (pool.reserve_a, pool.reserve_b)
        } else {
            (pool.reserve_b, pool.reserve_a)
        };

        let fee_multiplier = 10000 - pool.fee_bps;
        let amount_in_with_fee = (amount_in as u128)
            .checked_mul(fee_multiplier as u128)
            .ok_or(Error::Overflow)?;

        let numerator = amount_in_with_fee
            .checked_mul(reserve_out as u128)
            .ok_or(Error::Overflow)?;

        let denominator = (reserve_in as u128)
            .checked_mul(10000)
            .ok_or(Error::Overflow)?
            .checked_add(amount_in_with_fee)
            .ok_or(Error::Overflow)?;

        Ok((numerator / denominator) as u64)
    }

    fn build_swap_instruction(
        &self,
        pool: &PoolData,
        user: &Pubkey,
        token_in: &Pubkey,
        token_out: &Pubkey,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<Instruction> {
        // Orca Whirlpool swap instruction
        // Simplified implementation

        const WHIRLPOOL_PROGRAM: Pubkey = pubkey!("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc");

        let user_token_in = get_associated_token_address(user, token_in);
        let user_token_out = get_associated_token_address(user, token_out);

        let instruction_data = WhirlpoolSwapInstruction {
            amount: amount_in,
            other_amount_threshold: minimum_amount_out,
            sqrt_price_limit: u128::MAX,
            amount_specified_is_input: true,
            a_to_b: *token_in == pool.token_a,
        };

        Ok(Instruction {
            program_id: WHIRLPOOL_PROGRAM,
            accounts: vec![
                AccountMeta::new_readonly(spl_token::id(), false),
                AccountMeta::new_readonly(*user, true),
                AccountMeta::new(pool.address, false),
                AccountMeta::new(user_token_in, false),
                AccountMeta::new(user_token_out, false),
                // Vault accounts, oracle, etc.
            ],
            data: instruction_data.try_to_vec()?,
        })
    }
}
```

## Flash Loan Implementation

### Kamino Flash Loan Integration

```rust
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
};

pub struct KaminoFlashLoan {
    rpc: Arc<RpcClient>,
    program_id: Pubkey,
}

impl KaminoFlashLoan {
    pub const PROGRAM_ID: Pubkey = pubkey!("KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD");
    pub const FEE_BPS: u16 = 9;  // 0.09%

    pub fn new(rpc: Arc<RpcClient>) -> Self {
        Self {
            rpc,
            program_id: Self::PROGRAM_ID,
        }
    }

    /// Build flash loan borrow instruction
    pub fn build_borrow_instruction(
        &self,
        borrower: &Pubkey,
        token_mint: &Pubkey,
        amount: u64,
    ) -> Result<Instruction> {
        // Get Kamino reserve for this token
        let reserve = self.get_reserve_for_token(token_mint)?;

        let borrower_token_account = get_associated_token_address(
            borrower,
            token_mint,
        );

        let instruction_data = KaminoInstruction::FlashBorrowReserveLiquidity {
            liquidity_amount: amount,
        };

        Ok(Instruction {
            program_id: self.program_id,
            accounts: vec![
                AccountMeta::new(reserve.address, false),
                AccountMeta::new(reserve.liquidity_supply, false),
                AccountMeta::new(borrower_token_account, false),
                AccountMeta::new_readonly(spl_token::id(), false),
                // Additional accounts...
            ],
            data: instruction_data.try_to_vec()?,
        })
    }

    /// Build flash loan repay instruction
    pub fn build_repay_instruction(
        &self,
        borrower: &Pubkey,
        token_mint: &Pubkey,
        amount: u64,
    ) -> Result<Instruction> {
        let reserve = self.get_reserve_for_token(token_mint)?;

        let borrower_token_account = get_associated_token_address(
            borrower,
            token_mint,
        );

        // Calculate total repayment (principal + fee)
        let fee = (amount as u128)
            .checked_mul(Self::FEE_BPS as u128)
            .ok_or(Error::Overflow)?
            .checked_div(10000)
            .ok_or(Error::DivisionByZero)? as u64;

        let total_repayment = amount
            .checked_add(fee)
            .ok_or(Error::Overflow)?;

        let instruction_data = KaminoInstruction::FlashRepayReserveLiquidity {
            liquidity_amount: total_repayment,
        };

        Ok(Instruction {
            program_id: self.program_id,
            accounts: vec![
                AccountMeta::new(reserve.address, false),
                AccountMeta::new(reserve.liquidity_supply, false),
                AccountMeta::new(borrower_token_account, false),
                AccountMeta::new_readonly(spl_token::id(), false),
                // Additional accounts...
            ],
            data: instruction_data.try_to_vec()?,
        })
    }

    /// Calculate optimal flash loan size for arbitrage
    pub fn calculate_optimal_loan_size(
        &self,
        pool_a: &PoolData,
        pool_b: &PoolData,
        token_in: &Pubkey,
    ) -> Result<u64> {
        // Mathematical optimization for maximum profit
        // Derived from: profit = sell_output - buy_input - flash_loan_fee - gas

        let (r_a_in, r_a_out) = if *token_in == pool_a.token_a {
            (pool_a.reserve_a, pool_a.reserve_b)
        } else {
            (pool_a.reserve_b, pool_a.reserve_a)
        };

        let (r_b_in, r_b_out) = (r_a_out, r_a_in);  // Reverse for pool B

        let fee_a = pool_a.fee_bps;
        let fee_b = pool_b.fee_bps;
        let flash_fee = Self::FEE_BPS;

        // Simplified optimal calculation
        // Actual formula is complex quadratic equation
        // For production, use numerical optimization

        let total_fee_factor = (10000 - fee_a) as u128
            * (10000 - fee_b) as u128
            * (10000 - flash_fee) as u128
            / 1_000_000_000;

        // Approximate optimal as sqrt of product of reserves
        let optimal = ((r_a_in as u128 * r_a_out as u128)
            .integer_sqrt() as u64)
            .checked_mul(total_fee_factor as u64)
            .ok_or(Error::Overflow)?
            / 10000;

        // Cap at 90% of smaller pool's liquidity
        let max_size = std::cmp::min(
            r_a_in * 90 / 100,
            r_b_out * 90 / 100,
        );

        Ok(std::cmp::min(optimal, max_size))
    }
}
```

### Arbitrage Detector

```rust
pub struct ArbitrageDetector {
    pool_manager: Arc<PoolManager>,
    config: Config,
    flash_loan: KaminoFlashLoan,
}

#[derive(Debug, Clone)]
pub struct ArbitrageOpportunity {
    pub token_in: Pubkey,
    pub token_out: Pubkey,
    pub buy_pool: PoolData,
    pub sell_pool: PoolData,
    pub flash_loan_amount: u64,
    pub expected_profit: u64,
    pub price_diff_bps: u64,
}

impl ArbitrageDetector {
    pub fn new(
        pool_manager: Arc<PoolManager>,
        config: Config,
    ) -> Self {
        Self {
            pool_manager,
            config: config.clone(),
            flash_loan: KaminoFlashLoan::new(config.rpc.clone()),
        }
    }

    pub async fn find_opportunities(&self) -> Result<Vec<ArbitrageOpportunity>> {
        let mut opportunities = Vec::new();

        // Get all unique token pairs
        let token_pairs = self.pool_manager.get_all_token_pairs();

        for (token_a, token_b) in token_pairs {
            // Find all pools for this pair
            let pools = self.pool_manager.find_pools_for_pair(&token_a, &token_b);

            if pools.len() < 2 {
                continue;  // Need at least 2 pools for arbitrage
            }

            // Compare all pool pairs
            for i in 0..pools.len() {
                for j in (i + 1)..pools.len() {
                    let pool_a = &pools[i];
                    let pool_b = &pools[j];

                    // Check both directions
                    if let Some(opp) = self.check_arbitrage(
                        pool_a,
                        pool_b,
                        &token_a,
                        &token_b,
                    ).await? {
                        opportunities.push(opp);
                    }

                    if let Some(opp) = self.check_arbitrage(
                        pool_b,
                        pool_a,
                        &token_a,
                        &token_b,
                    ).await? {
                        opportunities.push(opp);
                    }
                }
            }
        }

        // Sort by expected profit
        opportunities.sort_by(|a, b| {
            b.expected_profit.cmp(&a.expected_profit)
        });

        Ok(opportunities)
    }

    async fn check_arbitrage(
        &self,
        buy_pool: &PoolData,
        sell_pool: &PoolData,
        token_a: &Pubkey,
        token_b: &Pubkey,
    ) -> Result<Option<ArbitrageOpportunity>> {
        // Calculate optimal flash loan size
        let flash_loan_amount = self.flash_loan.calculate_optimal_loan_size(
            buy_pool,
            sell_pool,
            token_a,
        )?;

        // Get DEX adapters
        let buy_adapter = self.pool_manager.get_dex_adapter(&buy_pool.dex)?;
        let sell_adapter = self.pool_manager.get_dex_adapter(&sell_pool.dex)?;

        // Calculate buy output
        let buy_output = buy_adapter.calculate_output(
            buy_pool,
            token_a,
            flash_loan_amount,
        )?;

        // Calculate sell output
        let sell_output = sell_adapter.calculate_output(
            sell_pool,
            token_b,
            buy_output,
        )?;

        // Calculate flash loan fee
        let flash_loan_fee = (flash_loan_amount as u128
            * KaminoFlashLoan::FEE_BPS as u128
            / 10000) as u64;

        // Calculate total cost
        let total_cost = flash_loan_amount + flash_loan_fee;

        // Calculate profit
        if sell_output <= total_cost {
            return Ok(None);  // Not profitable
        }

        let gross_profit = sell_output - total_cost;

        // Estimate gas cost
        let gas_cost = self.estimate_gas_cost();

        if gross_profit <= gas_cost {
            return Ok(None);  // Not profitable after gas
        }

        let net_profit = gross_profit - gas_cost;

        // Check minimum profit threshold
        if net_profit < self.config.min_profit {
            return Ok(None);
        }

        // Calculate price difference
        let price_buy = (buy_output as u128 * 10000 / flash_loan_amount as u128) as u64;
        let price_sell = (sell_output as u128 * 10000 / buy_output as u128) as u64;
        let price_diff_bps = if price_sell > price_buy {
            ((price_sell - price_buy) as u128 * 10000 / price_buy as u128) as u64
        } else {
            0
        };

        Ok(Some(ArbitrageOpportunity {
            token_in: *token_a,
            token_out: *token_b,
            buy_pool: buy_pool.clone(),
            sell_pool: sell_pool.clone(),
            flash_loan_amount,
            expected_profit: net_profit,
            price_diff_bps,
        }))
    }

    fn estimate_gas_cost(&self) -> u64 {
        // Estimate based on compute units and priority fee
        let compute_units = 300_000;  // Typical for flash loan + 2 swaps
        let priority_fee = 10_000;  // microlamports per compute unit

        compute_units * priority_fee / 1_000_000
    }
}
```

## Transaction Builder with Versioned Transactions

```rust
use solana_sdk::{
    address_lookup_table_account::AddressLookupTableAccount,
    message::{v0, VersionedMessage},
    transaction::VersionedTransaction,
};

pub struct TransactionBuilder {
    keypair: Keypair,
    config: Config,
    flash_loan: KaminoFlashLoan,
    alt_manager: AddressLookupTableManager,
}

impl TransactionBuilder {
    pub async fn build_arbitrage_tx(
        &self,
        opportunity: &ArbitrageOpportunity,
    ) -> Result<VersionedTransaction> {
        let mut instructions = Vec::new();

        // 1. Set compute unit limit
        instructions.push(
            ComputeBudgetInstruction::set_compute_unit_limit(
                self.config.max_compute_units,
            )
        );

        // 2. Set compute unit price (priority fee)
        let priority_fee = self.calculate_priority_fee(opportunity).await?;
        instructions.push(
            ComputeBudgetInstruction::set_compute_unit_price(priority_fee)
        );

        // 3. Flash loan borrow
        instructions.push(
            self.flash_loan.build_borrow_instruction(
                &self.keypair.pubkey(),
                &opportunity.token_in,
                opportunity.flash_loan_amount,
            )?
        );

        // 4. Buy swap (DEX A)
        let buy_adapter = get_dex_adapter(&opportunity.buy_pool.dex)?;
        let buy_output = buy_adapter.calculate_output(
            &opportunity.buy_pool,
            &opportunity.token_in,
            opportunity.flash_loan_amount,
        )?;

        let min_buy_output = buy_output
            .checked_mul(10000 - self.config.max_slippage_bps)
            .ok_or(Error::Overflow)?
            / 10000;

        instructions.push(
            buy_adapter.build_swap_instruction(
                &opportunity.buy_pool,
                &self.keypair.pubkey(),
                &opportunity.token_in,
                &opportunity.token_out,
                opportunity.flash_loan_amount,
                min_buy_output,
            )?
        );

        // 5. Sell swap (DEX B)
        let sell_adapter = get_dex_adapter(&opportunity.sell_pool.dex)?;
        let sell_output = sell_adapter.calculate_output(
            &opportunity.sell_pool,
            &opportunity.token_out,
            buy_output,
        )?;

        let min_sell_output = sell_output
            .checked_mul(10000 - self.config.max_slippage_bps)
            .ok_or(Error::Overflow)?
            / 10000;

        instructions.push(
            sell_adapter.build_swap_instruction(
                &opportunity.sell_pool,
                &self.keypair.pubkey(),
                &opportunity.token_out,
                &opportunity.token_in,
                buy_output,
                min_sell_output,
            )?
        );

        // 6. Flash loan repay
        instructions.push(
            self.flash_loan.build_repay_instruction(
                &self.keypair.pubkey(),
                &opportunity.token_in,
                opportunity.flash_loan_amount,
            )?
        );

        // Get recent blockhash
        let recent_blockhash = self.config.rpc
            .get_latest_blockhash()
            .await?;

        // Get Address Lookup Tables
        let alt_accounts = self.alt_manager
            .get_lookup_table_accounts()
            .await?;

        // Build V0 message with ALTs
        let message = v0::Message::try_compile(
            &self.keypair.pubkey(),
            &instructions,
            &alt_accounts,
            recent_blockhash,
        )?;

        // Create versioned transaction
        let transaction = VersionedTransaction::try_new(
            VersionedMessage::V0(message),
            &[&self.keypair],
        )?;

        Ok(transaction)
    }

    async fn calculate_priority_fee(
        &self,
        opportunity: &ArbitrageOpportunity,
    ) -> Result<u64> {
        // Get recent prioritization fees
        let recent_fees = self.config.rpc
            .get_recent_prioritization_fees(&[])
            .await?;

        if recent_fees.is_empty() {
            return Ok(10_000);  // Default: 10k microlamports/CU
        }

        // Calculate median fee
        let mut fees: Vec<u64> = recent_fees
            .iter()
            .map(|f| f.prioritization_fee)
            .collect();
        fees.sort();
        let median = fees[fees.len() / 2];

        // Use median + 20% or max based on profit
        let competitive_fee = median * 120 / 100;

        // Cap at 50% of expected profit
        let max_fee = opportunity.expected_profit / 2
            / self.config.max_compute_units as u64;

        Ok(std::cmp::min(competitive_fee, max_fee))
    }
}
```

## Transaction Spamming Implementation

```rust
pub struct TransactionSubmitter {
    rpc_clients: Vec<Arc<RpcClient>>,
    config: Config,
}

impl TransactionSubmitter {
    pub fn new(rpc: Arc<RpcClient>, config: Config) -> Self {
        // Create multiple RPC clients for different endpoints
        let mut rpc_clients = vec![rpc];

        // Add additional RPC endpoints
        for url in &config.additional_rpc_urls {
            rpc_clients.push(Arc::new(
                RpcClient::new_with_commitment(
                    url.clone(),
                    CommitmentConfig::confirmed(),
                )
            ));
        }

        Self {
            rpc_clients,
            config,
        }
    }

    pub async fn submit_with_spam(
        &self,
        tx: VersionedTransaction,
        spam_count: usize,
    ) -> Result<Signature> {
        let signature = tx.signatures[0];

        // Submit to all RPC clients in parallel
        let mut submit_futures = vec![];

        for client in &self.rpc_clients {
            for i in 0..spam_count {
                let client = client.clone();
                let tx = tx.clone();
                let delay = i as u64 * self.config.spam_interval_ms;

                submit_futures.push(tokio::spawn(async move {
                    tokio::time::sleep(Duration::from_millis(delay)).await;

                    client.send_transaction_with_config(
                        &tx,
                        RpcSendTransactionConfig {
                            skip_preflight: true,  // Skip simulation
                            preflight_commitment: Some(CommitmentLevel::Confirmed),
                            encoding: Some(UiTransactionEncoding::Base64),
                            max_retries: Some(0),  // Don't retry, we're spamming
                            min_context_slot: None,
                        },
                    ).await
                }));
            }
        }

        // Wait for all submissions
        let results = join_all(submit_futures).await;

        // Count successes
        let success_count = results.iter()
            .filter(|r| r.is_ok() && r.as_ref().unwrap().is_ok())
            .count();

        info!("Submitted transaction {} times, {} successful",
              results.len(), success_count);

        // Wait for confirmation
        self.wait_for_confirmation(signature, Duration::from_secs(30)).await?;

        Ok(signature)
    }

    async fn wait_for_confirmation(
        &self,
        signature: Signature,
        timeout: Duration,
    ) -> Result<()> {
        let start = Instant::now();

        while start.elapsed() < timeout {
            // Check signature status
            match self.rpc_clients[0].get_signature_status(&signature).await? {
                Some(Ok(_)) => {
                    info!("Transaction {} confirmed!", signature);
                    return Ok(());
                }
                Some(Err(e)) => {
                    error!("Transaction {} failed: {}", signature, e);
                    return Err(Error::TransactionFailed(e.to_string()));
                }
                None => {
                    // Not confirmed yet, keep waiting
                    tokio::time::sleep(Duration::from_millis(500)).await;
                }
            }
        }

        Err(Error::TransactionTimeout)
    }
}
```

## Solana-Specific Optimizations

### 1. Address Lookup Table (ALT) Management

```rust
pub struct AddressLookupTableManager {
    rpc: Arc<RpcClient>,
    payer: Keypair,
    alt_address: Option<Pubkey>,
}

impl AddressLookupTableManager {
    pub async fn create_lookup_table(
        &mut self,
        addresses: Vec<Pubkey>,
    ) -> Result<Pubkey> {
        let recent_slot = self.rpc.get_slot().await?;

        // Create lookup table
        let (create_ix, alt_address) = create_lookup_table(
            &self.payer.pubkey(),
            &self.payer.pubkey(),
            recent_slot,
        );

        // Send create transaction
        let create_tx = Transaction::new_signed_with_payer(
            &[create_ix],
            Some(&self.payer.pubkey()),
            &[&self.payer],
            self.rpc.get_latest_blockhash().await?,
        );

        self.rpc.send_and_confirm_transaction(&create_tx).await?;

        // Wait for table to be created
        tokio::time::sleep(Duration::from_secs(1)).await;

        // Extend with addresses (in batches of 30)
        for chunk in addresses.chunks(30) {
            let extend_ix = extend_lookup_table(
                alt_address,
                &self.payer.pubkey(),
                Some(&self.payer.pubkey()),
                chunk.to_vec(),
            );

            let extend_tx = Transaction::new_signed_with_payer(
                &[extend_ix],
                Some(&self.payer.pubkey()),
                &[&self.payer],
                self.rpc.get_latest_blockhash().await?,
            );

            self.rpc.send_and_confirm_transaction(&extend_tx).await?;
        }

        self.alt_address = Some(alt_address);

        info!("Created ALT {} with {} addresses", alt_address, addresses.len());

        Ok(alt_address)
    }

    pub async fn get_lookup_table_accounts(
        &self,
    ) -> Result<Vec<AddressLookupTableAccount>> {
        if let Some(alt_address) = self.alt_address {
            let alt_account = self.rpc
                .get_account(&alt_address)
                .await?;

            let lookup_table = AddressLookupTable::deserialize(&alt_account.data)?;

            Ok(vec![AddressLookupTableAccount {
                key: alt_address,
                addresses: lookup_table.addresses.to_vec(),
            }])
        } else {
            Ok(vec![])
        }
    }
}
```

### 2. Compute Unit Optimization

```rust
pub struct ComputeUnitOptimizer {
    rpc: Arc<RpcClient>,
}

impl ComputeUnitOptimizer {
    pub async fn estimate_compute_units(
        &self,
        transaction: &VersionedTransaction,
    ) -> Result<u32> {
        // Simulate transaction to get actual compute units used
        let simulation = self.rpc
            .simulate_transaction(transaction)
            .await?;

        if let Some(units_consumed) = simulation.value.units_consumed {
            // Add 10% buffer
            Ok((units_consumed as f64 * 1.1) as u32)
        } else {
            // Default estimate
            Ok(200_000)
        }
    }

    pub fn optimize_instructions(
        &self,
        instructions: &mut Vec<Instruction>,
    ) {
        // Remove unnecessary instructions
        instructions.retain(|ix| {
            // Keep all non-noop instructions
            !self.is_noop(ix)
        });

        // Combine similar instructions where possible
        self.combine_token_transfers(instructions);
    }

    fn is_noop(&self, instruction: &Instruction) -> bool {
        // Check if instruction has no effect
        instruction.data.is_empty() && instruction.accounts.is_empty()
    }

    fn combine_token_transfers(&self, instructions: &mut Vec<Instruction>) {
        // Combine multiple transfers to same destination
        // Implementation depends on specific use case
    }
}
```

### 3. Priority Fee Calculator

```rust
pub struct PriorityFeeCalculator {
    rpc: Arc<RpcClient>,
    fee_history: VecDeque<PriorityFeeData>,
}

#[derive(Debug, Clone)]
struct PriorityFeeData {
    slot: u64,
    fee: u64,
    timestamp: i64,
}

impl PriorityFeeCalculator {
    pub async fn get_recommended_fee(
        &mut self,
        percentile: u8,
    ) -> Result<u64> {
        // Fetch recent fees
        self.update_fee_history().await?;

        if self.fee_history.is_empty() {
            return Ok(10_000);  // Default
        }

        // Calculate percentile
        let mut fees: Vec<u64> = self.fee_history
            .iter()
            .map(|d| d.fee)
            .collect();

        fees.sort();

        let index = (fees.len() as f64 * percentile as f64 / 100.0) as usize;
        let index = index.min(fees.len() - 1);

        Ok(fees[index])
    }

    async fn update_fee_history(&mut self) -> Result<()> {
        let recent_fees = self.rpc
            .get_recent_prioritization_fees(&[])
            .await?;

        for fee_info in recent_fees {
            self.fee_history.push_back(PriorityFeeData {
                slot: fee_info.slot,
                fee: fee_info.prioritization_fee,
                timestamp: now(),
            });
        }

        // Keep only last 100 entries
        while self.fee_history.len() > 100 {
            self.fee_history.pop_front();
        }

        Ok(())
    }

    pub fn calculate_optimal_fee(
        &self,
        expected_profit: u64,
        compute_units: u32,
    ) -> u64 {
        // Maximum fee is 50% of expected profit
        let max_total_fee = expected_profit / 2;

        // Convert to microlamports per compute unit
        let max_fee_per_cu = max_total_fee
            .checked_mul(1_000_000)
            .unwrap_or(u64::MAX)
            / compute_units as u64;

        // Cap at reasonable maximum (100k microlamports/CU = 0.0001 SOL/CU)
        std::cmp::min(max_fee_per_cu, 100_000)
    }
}
```

## Testing Strategy

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_output_constant_product() {
        let pool = PoolData {
            reserve_a: 1_000_000_000,  // 1000 tokens
            reserve_b: 500_000_000,    // 500 tokens
            fee_bps: 30,               // 0.3%
            ..Default::default()
        };

        let amount_in = 100_000_000;  // 100 tokens

        let adapter = RaydiumAdapter::new(Arc::new(mock_rpc()));
        let amount_out = adapter.calculate_output(
            &pool,
            &pool.token_a,
            amount_in,
        ).unwrap();

        // Verify constant product formula
        // (R_in + amount_in) * (R_out - amount_out) = R_in * R_out
        let k_before = pool.reserve_a as u128 * pool.reserve_b as u128;
        let k_after = (pool.reserve_a + amount_in) as u128
            * (pool.reserve_b - amount_out) as u128;

        // Account for fees
        assert!((k_after as i128 - k_before as i128).abs() < 1_000_000);
    }

    #[test]
    fn test_flash_loan_fee_calculation() {
        let amount = 1_000_000_000;  // 1000 tokens
        let fee = (amount as u128 * 9 / 10000) as u64;

        assert_eq!(fee, 900_000);  // 0.09% = 0.9 tokens
    }

    #[test]
    fn test_optimal_loan_size() {
        let flash_loan = KaminoFlashLoan::new(Arc::new(mock_rpc()));

        let pool_a = PoolData {
            reserve_a: 10_000_000_000,
            reserve_b: 5_000_000_000,
            fee_bps: 25,
            ..Default::default()
        };

        let pool_b = PoolData {
            reserve_a: 5_000_000_000,
            reserve_b: 10_000_000_000,
            fee_bps: 30,
            ..Default::default()
        };

        let optimal = flash_loan.calculate_optimal_loan_size(
            &pool_a,
            &pool_b,
            &pool_a.token_a,
        ).unwrap();

        // Optimal should be reasonable fraction of liquidity
        assert!(optimal > 0);
        assert!(optimal < pool_a.reserve_a * 90 / 100);
    }
}
```

### Integration Tests

```rust
#[cfg(test)]
mod integration_tests {
    use super::*;
    use solana_program_test::*;
    use solana_sdk::signature::Keypair;

    #[tokio::test]
    async fn test_full_arbitrage_flow() {
        // Setup test environment
        let program_test = ProgramTest::new(
            "flash_loan_arbitrage",
            kamino::id(),
            processor!(process_instruction),
        );

        let (mut banks_client, payer, recent_blockhash) = program_test.start().await;

        // Setup pools and tokens
        let (token_a, token_b) = setup_test_tokens(&mut banks_client, &payer).await;
        let pool_a = setup_raydium_pool(&mut banks_client, &payer, &token_a, &token_b).await;
        let pool_b = setup_orca_pool(&mut banks_client, &payer, &token_a, &token_b).await;

        // Create price discrepancy
        create_price_difference(&mut banks_client, &pool_a, &pool_b, 200).await;  // 2% diff

        // Build and execute arbitrage transaction
        let tx_builder = TransactionBuilder::new(payer.clone(), config);
        let opportunity = ArbitrageOpportunity {
            token_in: token_a,
            token_out: token_b,
            buy_pool: pool_a,
            sell_pool: pool_b,
            flash_loan_amount: 1_000_000_000,
            expected_profit: 20_000_000,
            price_diff_bps: 200,
        };

        let tx = tx_builder.build_arbitrage_tx(&opportunity).await.unwrap();

        // Submit transaction
        banks_client.process_transaction(tx).await.unwrap();

        // Verify profit was realized
        let final_balance = get_token_balance(&banks_client, &payer.pubkey(), &token_a).await;
        assert!(final_balance > 0);
    }
}
```

## Performance Benchmarks

```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn benchmark_output_calculation(c: &mut Criterion) {
    let adapter = RaydiumAdapter::new(Arc::new(mock_rpc()));
    let pool = create_test_pool();

    c.bench_function("calculate_output", |b| {
        b.iter(|| {
            adapter.calculate_output(
                black_box(&pool),
                black_box(&pool.token_a),
                black_box(1_000_000),
            )
        })
    });
}

fn benchmark_opportunity_detection(c: &mut Criterion) {
    let detector = setup_detector();

    c.bench_function("find_opportunities", |b| {
        b.iter(|| {
            detector.find_opportunities()
        })
    });
}

criterion_group!(benches, benchmark_output_calculation, benchmark_opportunity_detection);
criterion_main!(benches);
```

## Common Issues and Solutions

### Issue 1: Transactions Not Confirming

**Cause:** Insufficient priority fees or network congestion

**Solution:**
```rust
// Implement adaptive priority fees
async fn get_adaptive_priority_fee(&self, attempt: u32) -> u64 {
    let base_fee = self.get_recommended_fee(75).await.unwrap_or(10_000);

    // Exponential backoff on retries
    base_fee * 2u64.pow(attempt)
}
```

### Issue 2: Arbitrage Opportunities Disappearing

**Cause:** High competition, slow detection

**Solution:**
```rust
// Optimize pool refresh rate
async fn continuous_pool_monitor(&self) {
    let mut interval = interval(Duration::from_millis(100));  // 100ms

    loop {
        interval.tick().await;
        self.refresh_hot_pools().await;  // Only refresh active pairs
    }
}
```

### Issue 3: Transaction Size Exceeds Limit

**Cause:** Too many accounts, complex routing

**Solution:**
```rust
// Use Address Lookup Tables
let alt = create_lookup_table_with_common_accounts().await?;

// OR simplify routing
fn prefer_direct_routes(&self, opportunities: Vec<ArbitrageOpportunity>) {
    opportunities.into_iter()
        .filter(|opp| opp.buy_pool.dex == "raydium" && opp.sell_pool.dex == "orca")
        .collect()
}
```

## Enhancement Opportunities

### 1. Machine Learning Price Prediction

```rust
pub struct MLPricePredictor {
    model: TorchModule,
}

impl MLPricePredictor {
    pub async fn predict_future_price(
        &self,
        pool: &PoolData,
        horizon_ms: u64,
    ) -> Result<f64> {
        let features = extract_features(pool);
        let prediction = self.model.forward(features);
        Ok(prediction)
    }
}
```

### 2. Multi-Hop Arbitrage

```rust
pub fn find_multi_hop_opportunities(
    &self,
    max_hops: usize,
) -> Vec<MultiHopOpportunity> {
    // Use graph algorithms to find profitable cycles
    let graph = build_dex_graph();
    find_negative_cycles(graph, max_hops)
}
```

### 3. JIT Liquidity Provision

```rust
pub async fn provide_just_in_time_liquidity(
    &self,
    opportunity: &ArbitrageOpportunity,
) -> Result<()> {
    // Add liquidity just before trade, remove after
    // Can improve execution price
}
```

This comprehensive developer documentation provides deep technical insights into building and operating a Solana MEV arbitrage bot with flash loans.

