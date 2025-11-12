**Source:** https://github.com/insionCEO/Ethereum-MEV-BOT
**Date:** February 2025

# Ethereum MEV BOT: Deep Developer Documentation

## Deep Architecture Analysis

### Graph-Based MEV Detection Architecture

The core innovation of this bot is using graph theory to model the entire DeFi ecosystem:

```
Mathematical Model:
- Nodes (V): Tokens (ETH, USDC, DAI, WBTC, etc.)
- Edges (E): Liquidity pools with exchange rates
- Edge Weight (w): -log(exchange_rate) - fees

Arbitrage Detection:
- Find negative-weight cycles in directed graph
- Negative cycle = profitable arbitrage path
- Use Bellman-Ford algorithm for detection
```

### Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Application Layer                       │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Main Event Loop                                 │  │
│  │  - Mempool monitoring (10k+ TPS)                 │  │
│  │  - Opportunity detection                         │  │
│  │  - Bundle construction                           │  │
│  │  - Multi-builder submission                      │  │
│  └──────────────────────────────────────────────────┘  │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                 Strategy Layer                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │  Arbitrage   │ │  Sandwich    │ │  Backrun     │   │
│  │              │ │              │ │              │   │
│  │ Graph-based  │ │ Victim-based │ │ Event-based  │   │
│  │ Multi-hop    │ │ Optimal size │ │ Liquidations │   │
│  └──────────────┘ └──────────────┘ └──────────────┘   │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│               Infrastructure Layer                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ Pool Manager │ │ Graph Engine │ │   Builder    │   │
│  │              │ │              │ │  Interface   │   │
│  │ V2/V3/DoDo/  │ │ Bellman-Ford │ │ Flashbots+   │   │
│  │ Curve/Bal.   │ │ Dijkstra     │ │ Multi-relay  │   │
│  └──────────────┘ └──────────────┘ └──────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Code Structure and Organization

### Project Layout

```
ethereum-mev-bot/
├── src/
│   ├── main.rs                     # Entry point
│   ├── config.rs                   # Configuration
│   ├── types.rs                    # Common types
│   ├── error.rs                    # Error types
│   │
│   ├── graph/
│   │   ├── mod.rs
│   │   ├── token_graph.rs          # Graph construction
│   │   ├── bellman_ford.rs         # Negative cycle detection
│   │   ├── dijkstra.rs             # Shortest path
│   │   ├── cycle_detector.rs       # Cycle enumeration
│   │   └── profit_calculator.rs    # Profit computation
│   │
│   ├── pools/
│   │   ├── mod.rs
│   │   ├── manager.rs              # Pool state management
│   │   ├── uniswap_v2.rs           # V2 pools
│   │   ├── uniswap_v3.rs           # V3 pools
│   │   ├── curve.rs                # Curve pools
│   │   ├── balancer.rs             # Balancer pools
│   │   ├── dodo.rs                 # DoDo PMM pools
│   │   └── trait.rs                # Common pool interface
│   │
│   ├── strategies/
│   │   ├── mod.rs
│   │   ├── arbitrage.rs            # Graph-based arbitrage
│   │   ├── sandwich.rs             # Sandwich attacks
│   │   ├── backrun.rs              # Backrun strategy
│   │   └── optimizer.rs            # Trade size optimization
│   │
│   ├── mempool/
│   │   ├── mod.rs
│   │   ├── monitor.rs              # Transaction monitoring
│   │   ├── decoder.rs              # Fast TX decoding
│   │   ├── filter.rs               # MEV-relevant filtering
│   │   └── pipeline.rs             # Processing pipeline
│   │
│   ├── execution/
│   │   ├── mod.rs
│   │   ├── bundle.rs               # Bundle construction
│   │   ├── simulator.rs            # EVM simulation
│   │   ├── builder.rs              # Builder interface
│   │   └── multi_submit.rs         # Multi-builder submission
│   │
│   ├── builders/
│   │   ├── mod.rs
│   │   ├── flashbots.rs            # Flashbots integration
│   │   ├── club48.rs               # 48.club integration
│   │   ├── bloxroute.rs            # Bloxroute integration
│   │   ├── blackrazor.rs           # Blackrazor integration
│   │   └── titan.rs                # Titan builder
│   │
│   └── utils/
│       ├── mod.rs
│       ├── math.rs                 # Math utilities
│       ├── gas.rs                  # Gas estimation
│       ├── profiler.rs             # Performance profiling
│       └── metrics.rs              # Monitoring metrics
│
├── benches/
│   ├── graph_benchmarks.rs
│   ├── pool_benchmarks.rs
│   └── pipeline_benchmarks.rs
│
├── tests/
│   ├── integration_tests.rs
│   ├── graph_tests.rs
│   └── strategy_tests.rs
│
├── Cargo.toml
├── config.toml
└── README.md
```

## Graph Engine Implementation

### Token Graph Construction

```rust
use petgraph::graph::{DiGraph, NodeIndex};
use std::collections::HashMap;

pub struct TokenGraph {
    graph: DiGraph<Token, PoolEdge>,
    token_to_node: HashMap<Address, NodeIndex>,
    node_to_token: HashMap<NodeIndex, Token>,
}

#[derive(Debug, Clone)]
pub struct Token {
    pub address: Address,
    pub symbol: String,
    pub decimals: u8,
}

#[derive(Debug, Clone)]
pub struct PoolEdge {
    pub pool_address: Address,
    pub pool_type: PoolType,
    pub fee_bps: u16,
    pub reserve_in: U256,
    pub reserve_out: U256,
    pub weight: f64,  // -log(exchange_rate)
}

#[derive(Debug, Clone)]
pub enum PoolType {
    UniswapV2,
    UniswapV3,
    Curve,
    Balancer,
    Dodo,
}

impl TokenGraph {
    pub fn new() -> Self {
        Self {
            graph: DiGraph::new(),
            token_to_node: HashMap::new(),
            node_to_token: HashMap::new(),
        }
    }

    pub fn add_token(&mut self, token: Token) -> NodeIndex {
        if let Some(&node) = self.token_to_node.get(&token.address) {
            return node;
        }

        let node = self.graph.add_node(token.clone());
        self.token_to_node.insert(token.address, node);
        self.node_to_token.insert(node, token);

        node
    }

    pub fn add_pool(&mut self, pool: Pool) {
        let token_in_node = self.add_token(pool.token_in.clone());
        let token_out_node = self.add_token(pool.token_out.clone());

        // Calculate edge weight: -log(exchange_rate) - fees
        let exchange_rate = pool.get_exchange_rate();
        let fee_impact = 1.0 - (pool.fee_bps as f64 / 10000.0);
        let effective_rate = exchange_rate * fee_impact;

        let weight = if effective_rate > 0.0 {
            -effective_rate.ln()
        } else {
            f64::INFINITY  // No liquidity
        };

        let edge = PoolEdge {
            pool_address: pool.address,
            pool_type: pool.pool_type,
            fee_bps: pool.fee_bps,
            reserve_in: pool.reserve_in,
            reserve_out: pool.reserve_out,
            weight,
        };

        self.graph.add_edge(token_in_node, token_out_node, edge);
    }

    pub fn update_pool(&mut self, pool_address: Address, new_reserves: (U256, U256)) {
        // Find and update the edge
        for edge in self.graph.edge_indices() {
            if let Some(pool_edge) = self.graph.edge_weight_mut(edge) {
                if pool_edge.pool_address == pool_address {
                    pool_edge.reserve_in = new_reserves.0;
                    pool_edge.reserve_out = new_reserves.1;

                    // Recalculate weight
                    let exchange_rate = (new_reserves.1.as_u128() as f64)
                        / (new_reserves.0.as_u128() as f64);
                    let fee_impact = 1.0 - (pool_edge.fee_bps as f64 / 10000.0);
                    let effective_rate = exchange_rate * fee_impact;

                    pool_edge.weight = if effective_rate > 0.0 {
                        -effective_rate.ln()
                    } else {
                        f64::INFINITY
                    };

                    break;
                }
            }
        }
    }

    pub fn get_node(&self, token: &Address) -> Option<NodeIndex> {
        self.token_to_node.get(token).copied()
    }

    pub fn get_token(&self, node: NodeIndex) -> Option<&Token> {
        self.node_to_token.get(&node)
    }
}
```

### Bellman-Ford for Negative Cycle Detection

```rust
use petgraph::graph::{DiGraph, NodeIndex};
use std::collections::VecDeque;

pub struct BellmanFordDetector {
    graph: DiGraph<Token, PoolEdge>,
}

#[derive(Debug, Clone)]
pub struct ArbitrageCycle {
    pub path: Vec<NodeIndex>,
    pub pools: Vec<Address>,
    pub total_weight: f64,
    pub expected_profit: U256,
}

impl BellmanFordDetector {
    pub fn new(graph: DiGraph<Token, PoolEdge>) -> Self {
        Self { graph }
    }

    pub fn find_negative_cycles(&self, max_hops: usize) -> Vec<ArbitrageCycle> {
        let mut cycles = Vec::new();

        // Try starting from each token
        for start_node in self.graph.node_indices() {
            if let Some(cycle) = self.detect_cycle_from_node(start_node, max_hops) {
                cycles.push(cycle);
            }
        }

        cycles
    }

    fn detect_cycle_from_node(
        &self,
        start: NodeIndex,
        max_hops: usize,
    ) -> Option<ArbitrageCycle> {
        let n = self.graph.node_count();

        // Distance array
        let mut dist = vec![f64::INFINITY; n];
        let mut predecessor = vec![None; n];

        dist[start.index()] = 0.0;

        // Relax edges up to max_hops times
        for i in 0..max_hops {
            let mut updated = false;

            for edge in self.graph.edge_references() {
                let u = edge.source();
                let v = edge.target();
                let weight = edge.weight().weight;

                if dist[u.index()] + weight < dist[v.index()] {
                    dist[v.index()] = dist[u.index()] + weight;
                    predecessor[v.index()] = Some((u, edge.id()));
                    updated = true;
                }
            }

            if !updated {
                break;  // Converged early
            }
        }

        // Check for negative cycle back to start
        if dist[start.index()] < 0.0 {
            // Reconstruct cycle
            let mut path = Vec::new();
            let mut pools = Vec::new();
            let mut current = start;

            loop {
                path.push(current);

                if let Some((prev, edge_id)) = predecessor[current.index()] {
                    let edge = self.graph.edge_weight(edge_id).unwrap();
                    pools.push(edge.pool_address);
                    current = prev;

                    if current == start && path.len() > 1 {
                        break;  // Completed cycle
                    }
                } else {
                    break;
                }

                if path.len() > max_hops {
                    break;  // Prevent infinite loop
                }
            }

            if current == start && path.len() > 1 {
                // Calculate expected profit
                let profit = self.calculate_cycle_profit(&path, &pools);

                return Some(ArbitrageCycle {
                    path,
                    pools,
                    total_weight: dist[start.index()],
                    expected_profit: profit,
                });
            }
        }

        None
    }

    fn calculate_cycle_profit(
        &self,
        path: &[NodeIndex],
        pools: &[Address],
    ) -> U256 {
        // Start with 1 ETH equivalent
        let mut amount = parse_ether(1).unwrap();

        for i in 0..pools.len() {
            let pool_address = pools[i];

            // Get pool edge
            let from = path[i];
            let to = path[(i + 1) % path.len()];

            for edge in self.graph.edges_connecting(from, to) {
                if edge.weight().pool_address == pool_address {
                    // Calculate output
                    let reserve_in = edge.weight().reserve_in;
                    let reserve_out = edge.weight().reserve_out;
                    let fee_bps = edge.weight().fee_bps;

                    amount = calculate_output_amount(
                        amount,
                        reserve_in,
                        reserve_out,
                        fee_bps,
                    );

                    break;
                }
            }
        }

        // Profit = final_amount - initial_amount
        amount.saturating_sub(parse_ether(1).unwrap())
    }
}

fn calculate_output_amount(
    amount_in: U256,
    reserve_in: U256,
    reserve_out: U256,
    fee_bps: u16,
) -> U256 {
    // Constant product formula with fees
    let amount_in_with_fee = amount_in
        .saturating_mul(U256::from(10000 - fee_bps));

    let numerator = amount_in_with_fee
        .saturating_mul(reserve_out);

    let denominator = reserve_in
        .saturating_mul(U256::from(10000))
        .saturating_add(amount_in_with_fee);

    numerator / denominator
}
```

### Dijkstra for Shortest Path

```rust
use petgraph::algo::dijkstra;
use petgraph::graph::{DiGraph, NodeIndex};
use std::collections::HashMap;

pub struct DijkstraRouter {
    graph: DiGraph<Token, PoolEdge>,
}

impl DijkstraRouter {
    pub fn new(graph: DiGraph<Token, PoolEdge>) -> Self {
        Self { graph }
    }

    pub fn find_best_route(
        &self,
        from: NodeIndex,
        to: NodeIndex,
    ) -> Option<Route> {
        // Run Dijkstra's algorithm
        let distances: HashMap<NodeIndex, f64> = dijkstra(
            &self.graph,
            from,
            Some(to),
            |edge| edge.weight().weight,
        );

        if let Some(&distance) = distances.get(&to) {
            if distance.is_finite() {
                // Reconstruct path
                let path = self.reconstruct_path(from, to, &distances);

                return Some(Route {
                    path,
                    total_distance: distance,
                });
            }
        }

        None
    }

    fn reconstruct_path(
        &self,
        from: NodeIndex,
        to: NodeIndex,
        distances: &HashMap<NodeIndex, f64>,
    ) -> Vec<NodeIndex> {
        // Backtrack from destination to source
        let mut path = vec![to];
        let mut current = to;

        while current != from {
            // Find the predecessor with minimum distance
            let mut best_pred = None;
            let mut best_dist = f64::INFINITY;

            for edge in self.graph.edges_directed(current, petgraph::Direction::Incoming) {
                let pred = edge.source();
                if let Some(&pred_dist) = distances.get(&pred) {
                    let total_dist = pred_dist + edge.weight().weight;
                    if (total_dist - distances[&current]).abs() < 1e-9 && pred_dist < best_dist {
                        best_pred = Some(pred);
                        best_dist = pred_dist;
                    }
                }
            }

            if let Some(pred) = best_pred {
                path.push(pred);
                current = pred;
            } else {
                break;
            }
        }

        path.reverse();
        path
    }
}

#[derive(Debug)]
pub struct Route {
    pub path: Vec<NodeIndex>,
    pub total_distance: f64,
}
```

## Pool Manager Implementation

### Unified Pool Interface

```rust
use async_trait::async_trait;

#[async_trait]
pub trait PoolInterface: Send + Sync {
    /// Get current reserves
    fn get_reserves(&self) -> (U256, U256);

    /// Calculate output for given input
    fn calculate_output(&self, amount_in: U256, token_in: Address) -> Result<U256>;

    /// Get effective exchange rate
    fn get_exchange_rate(&self) -> f64;

    /// Estimate gas cost for swap
    fn estimate_gas(&self) -> u64;

    /// Build swap instruction
    fn build_swap_instruction(
        &self,
        amount_in: U256,
        min_amount_out: U256,
        recipient: Address,
    ) -> Result<TransactionRequest>;

    /// Update state from on-chain data
    async fn update_state(&mut self, provider: &Provider<Ws>) -> Result<()>;
}

// Uniswap V2 Implementation
pub struct UniswapV2Pool {
    pub address: Address,
    pub token0: Address,
    pub token1: Address,
    pub reserve0: U256,
    pub reserve1: U256,
    pub fee_bps: u16,  // Usually 30 (0.3%)
}

#[async_trait]
impl PoolInterface for UniswapV2Pool {
    fn get_reserves(&self) -> (U256, U256) {
        (self.reserve0, self.reserve1)
    }

    fn calculate_output(&self, amount_in: U256, token_in: Address) -> Result<U256> {
        let (reserve_in, reserve_out) = if token_in == self.token0 {
            (self.reserve0, self.reserve1)
        } else if token_in == self.token1 {
            (self.reserve1, self.reserve0)
        } else {
            return Err(Error::InvalidToken);
        };

        // V2 constant product formula
        let amount_in_with_fee = amount_in
            .saturating_mul(U256::from(10000 - self.fee_bps));

        let numerator = amount_in_with_fee
            .saturating_mul(reserve_out);

        let denominator = reserve_in
            .saturating_mul(U256::from(10000))
            .saturating_add(amount_in_with_fee);

        Ok(numerator / denominator)
    }

    fn get_exchange_rate(&self) -> f64 {
        (self.reserve1.as_u128() as f64) / (self.reserve0.as_u128() as f64)
    }

    fn estimate_gas(&self) -> u64 {
        // V2 swap typically costs ~110k gas
        110_000
    }

    fn build_swap_instruction(
        &self,
        amount_in: U256,
        min_amount_out: U256,
        recipient: Address,
    ) -> Result<TransactionRequest> {
        // Encode swap function call
        let function = "swapExactTokensForTokens";
        let params = ethers::abi::encode(&[
            Token::Uint(amount_in),
            Token::Uint(min_amount_out),
            Token::Array(vec![Token::Address(self.token0), Token::Address(self.token1)]),
            Token::Address(recipient),
            Token::Uint(U256::from(u64::MAX)),  // deadline
        ]);

        Ok(TransactionRequest {
            to: Some(self.address),
            data: Some(params.into()),
            ..Default::default()
        })
    }

    async fn update_state(&mut self, provider: &Provider<Ws>) -> Result<()> {
        let pool = IUniswapV2Pool::new(self.address, provider.clone());
        let (reserve0, reserve1, _) = pool.get_reserves().call().await?;

        self.reserve0 = reserve0;
        self.reserve1 = reserve1;

        Ok(())
    }
}

// Uniswap V3 Implementation
pub struct UniswapV3Pool {
    pub address: Address,
    pub token0: Address,
    pub token1: Address,
    pub sqrt_price_x96: U256,
    pub liquidity: u128,
    pub tick: i32,
    pub fee_tier: u32,  // 500, 3000, or 10000 (0.05%, 0.3%, 1%)
}

#[async_trait]
impl PoolInterface for UniswapV3Pool {
    fn get_reserves(&self) -> (U256, U256) {
        // V3 doesn't have traditional reserves
        // Calculate virtual reserves from sqrt_price and liquidity
        let price = self.sqrt_price_to_price();

        let reserve0 = U256::from(self.liquidity as u64);
        let reserve1 = (U256::from(self.liquidity as u64) as f64 * price) as u64;

        (reserve0, U256::from(reserve1))
    }

    fn calculate_output(&self, amount_in: U256, token_in: Address) -> Result<U256> {
        // V3 uses concentrated liquidity and tick math
        // Simplified calculation (production would use full tick math)

        let zero_for_one = token_in == self.token0;

        // Calculate price impact
        let sqrt_price_x96 = self.sqrt_price_x96;
        let liquidity = U256::from(self.liquidity);

        let amount_out = if zero_for_one {
            // Calculate amount_out using V3 formula
            self.calculate_v3_output(amount_in, true)
        } else {
            self.calculate_v3_output(amount_in, false)
        };

        Ok(amount_out)
    }

    fn get_exchange_rate(&self) -> f64 {
        self.sqrt_price_to_price()
    }

    fn estimate_gas(&self) -> u64 {
        // V3 swap costs ~140-180k gas depending on ticks crossed
        160_000
    }

    fn build_swap_instruction(
        &self,
        amount_in: U256,
        min_amount_out: U256,
        recipient: Address,
    ) -> Result<TransactionRequest> {
        // V3 swap encoding
        let function = "swap";
        let zero_for_one = true;  // Assume token0 → token1

        let params = ethers::abi::encode(&[
            Token::Address(recipient),
            Token::Bool(zero_for_one),
            Token::Int(I256::from(amount_in)),
            Token::Uint(self.calculate_sqrt_price_limit(zero_for_one)),
            Token::Bytes(vec![]),  // callback data
        ]);

        Ok(TransactionRequest {
            to: Some(self.address),
            data: Some(params.into()),
            ..Default::default()
        })
    }

    async fn update_state(&mut self, provider: &Provider<Ws>) -> Result<()> {
        let pool = IUniswapV3Pool::new(self.address, provider.clone());

        let slot0 = pool.slot_0().call().await?;
        self.sqrt_price_x96 = slot0.sqrt_price_x96;
        self.tick = slot0.tick;

        let liquidity = pool.liquidity().call().await?;
        self.liquidity = liquidity;

        Ok(())
    }
}

impl UniswapV3Pool {
    fn sqrt_price_to_price(&self) -> f64 {
        let sqrt_price = self.sqrt_price_x96.as_u128() as f64;
        let price = (sqrt_price / (2f64.powi(96))).powi(2);
        price
    }

    fn calculate_v3_output(&self, amount_in: U256, zero_for_one: bool) -> U256 {
        // Simplified V3 calculation
        // Production implementation would use exact tick math

        let fee_amount = amount_in * self.fee_tier / 1_000_000;
        let amount_in_less_fee = amount_in - fee_amount;

        // Use current price as approximation
        let price = self.sqrt_price_to_price();

        let amount_out = if zero_for_one {
            (amount_in_less_fee.as_u128() as f64 * price) as u128
        } else {
            (amount_in_less_fee.as_u128() as f64 / price) as u128
        };

        U256::from(amount_out)
    }

    fn calculate_sqrt_price_limit(&self, zero_for_one: bool) -> U256 {
        // Calculate price limit for swap
        // In practice, use MIN_SQRT_RATIO or MAX_SQRT_RATIO

        if zero_for_one {
            U256::from(4295128739)  // MIN_SQRT_RATIO + 1
        } else {
            U256::from_dec_str("1461446703485210103287273052203988822378723970342").unwrap()
            // MAX_SQRT_RATIO - 1
        }
    }
}
```

## Sandwich Attack Implementation

```rust
pub struct SandwichStrategy {
    pool_manager: Arc<PoolManager>,
    config: Config,
}

#[derive(Debug, Clone)]
pub struct SandwichOpportunity {
    pub victim_tx: Transaction,
    pub pool: Address,
    pub token_in: Address,
    pub token_out: Address,
    pub victim_amount: U256,
    pub optimal_frontrun: U256,
    pub expected_profit: U256,
    pub gas_cost: U256,
}

impl SandwichStrategy {
    pub async fn analyze_transaction(
        &self,
        tx: &Transaction,
    ) -> Result<Option<SandwichOpportunity>> {
        // Decode swap transaction
        let swap_params = self.decode_swap(tx)?;

        // Get pool
        let pool = self.pool_manager
            .get_pool(&swap_params.pool_address)
            .ok_or(Error::PoolNotFound)?;

        // Calculate price impact
        let price_impact = pool.calculate_price_impact(swap_params.amount_in);

        // Skip if impact too small (not profitable to sandwich)
        if price_impact < self.config.min_sandwich_impact {
            return Ok(None);
        }

        // Calculate optimal frontrun size
        let optimal_frontrun = self.calculate_optimal_frontrun(
            &pool,
            swap_params.amount_in,
        )?;

        // Simulate sandwich
        let (frontrun_output, backrun_output) = self.simulate_sandwich(
            &pool,
            optimal_frontrun,
            swap_params.amount_in,
        )?;

        // Calculate profit
        let gross_profit = backrun_output.saturating_sub(optimal_frontrun);

        // Estimate gas cost
        let gas_cost = self.estimate_gas_cost()?;

        let net_profit = gross_profit.saturating_sub(gas_cost);

        // Check profitability
        if net_profit < self.config.min_profit {
            return Ok(None);
        }

        Ok(Some(SandwichOpportunity {
            victim_tx: tx.clone(),
            pool: swap_params.pool_address,
            token_in: swap_params.token_in,
            token_out: swap_params.token_out,
            victim_amount: swap_params.amount_in,
            optimal_frontrun,
            expected_profit: net_profit,
            gas_cost,
        }))
    }

    fn calculate_optimal_frontrun(
        &self,
        pool: &dyn PoolInterface,
        victim_amount: U256,
    ) -> Result<U256> {
        // Mathematical optimization for maximum profit
        // For Uniswap V2: optimal = sqrt(R_in * R_out * V_in) - R_in

        let (reserve_in, reserve_out) = pool.get_reserves();

        let product = reserve_in
            .saturating_mul(reserve_out)
            .saturating_mul(victim_amount);

        let sqrt = sqrt_u256(product);

        let optimal = sqrt.saturating_sub(reserve_in);

        // Apply safety factor (90% of optimal)
        let safe_optimal = optimal
            .saturating_mul(U256::from(90))
            / U256::from(100);

        Ok(safe_optimal)
    }

    fn simulate_sandwich(
        &self,
        pool: &dyn PoolInterface,
        frontrun_amount: U256,
        victim_amount: U256,
    ) -> Result<(U256, U256)> {
        // Simulate frontrun
        let frontrun_output = pool.calculate_output(
            frontrun_amount,
            pool.token_in(),
        )?;

        // Update pool state after frontrun
        let (new_reserve_in, new_reserve_out) = (
            pool.reserve_in() + frontrun_amount,
            pool.reserve_out() - frontrun_output,
        );

        // Simulate victim transaction
        let victim_output = calculate_output_with_reserves(
            victim_amount,
            new_reserve_in,
            new_reserve_out,
            pool.fee_bps(),
        )?;

        // Update pool state after victim
        let (final_reserve_in, final_reserve_out) = (
            new_reserve_in + victim_amount,
            new_reserve_out - victim_output,
        );

        // Simulate backrun
        let backrun_output = calculate_output_with_reserves(
            frontrun_output,
            final_reserve_out,
            final_reserve_in,
            pool.fee_bps(),
        )?;

        Ok((frontrun_output, backrun_output))
    }

    fn estimate_gas_cost(&self) -> Result<U256> {
        // Frontrun: ~120k gas
        // Backrun: ~120k gas
        // Total: ~240k gas

        let gas_units = U256::from(240_000);
        let gas_price = self.get_competitive_gas_price()?;

        Ok(gas_units * gas_price)
    }

    fn get_competitive_gas_price(&self) -> Result<U256> {
        // Get current base fee + priority fee
        // Need to outbid victim's gas price

        let base_fee = self.get_next_base_fee()?;
        let victim_priority = self.victim_tx.max_priority_fee_per_gas.unwrap_or_default();

        // Our priority = victim's priority * 1.2 + 1 gwei
        let our_priority = victim_priority
            .saturating_mul(U256::from(120))
            / U256::from(100)
            .saturating_add(parse_gwei(1)?);

        Ok(base_fee + our_priority)
    }

    pub async fn build_sandwich_bundle(
        &self,
        opportunity: &SandwichOpportunity,
    ) -> Result<Bundle> {
        let pool = self.pool_manager
            .get_pool(&opportunity.pool)
            .ok_or(Error::PoolNotFound)?;

        // Build frontrun transaction
        let frontrun_tx = pool.build_swap_instruction(
            opportunity.optimal_frontrun,
            calculate_min_output(opportunity.optimal_frontrun, 50),  // 0.5% slippage
            self.config.bot_address,
        )?;

        // Build backrun transaction
        let backrun_amount = pool.calculate_output(
            opportunity.optimal_frontrun,
            opportunity.token_in,
        )?;

        let backrun_tx = pool.build_swap_instruction(
            backrun_amount,
            opportunity.expected_profit,  // Minimum profit target
            self.config.bot_address,
        )?;

        // Create bundle
        let bundle = Bundle {
            transactions: vec![
                frontrun_tx,
                opportunity.victim_tx.clone(),
                backrun_tx,
            ],
            block_number: self.get_current_block() + 1,
            min_timestamp: None,
            max_timestamp: None,
        };

        Ok(bundle)
    }
}
```

## Multi-Builder Integration

```rust
pub struct MultiBuilderSubmitter {
    flashbots: FlashbotsClient,
    club48: Club48Client,
    bloxroute: BloxrouteClient,
    blackrazor: BlackrazorClient,
    titan: TitanClient,
    config: Config,
}

impl MultiBuilderSubmitter {
    pub async fn submit_bundle(
        &self,
        bundle: Bundle,
    ) -> Result<SubmissionResult> {
        // Submit to all builders in parallel
        let futures = vec![
            self.submit_to_flashbots(bundle.clone()),
            self.submit_to_48club(bundle.clone()),
            self.submit_to_bloxroute(bundle.clone()),
            self.submit_to_blackrazor(bundle.clone()),
            self.submit_to_titan(bundle.clone()),
        ];

        // Wait for all submissions
        let results = join_all(futures).await;

        // Track which builders accepted
        let mut accepted_by = Vec::new();
        for (i, result) in results.iter().enumerate() {
            if result.is_ok() {
                accepted_by.push(self.builder_name(i));
            }
        }

        info!("Bundle accepted by: {:?}", accepted_by);

        // Monitor for inclusion
        let inclusion = self.monitor_bundle_inclusion(
            &bundle,
            Duration::from_secs(15),
        ).await?;

        Ok(SubmissionResult {
            bundle_hash: bundle.hash(),
            accepted_by,
            included_in_block: inclusion,
        })
    }

    async fn submit_to_flashbots(&self, mut bundle: Bundle) -> Result<()> {
        // Flashbots-specific customization
        bundle.priority_fee = bundle.priority_fee * 120 / 100;  // 20% higher

        let signed_bundle = self.flashbots.sign_bundle(&bundle)?;

        self.flashbots
            .send_bundle(signed_bundle)
            .await?;

        Ok(())
    }

    async fn submit_to_48club(&self, mut bundle: Bundle) -> Result<()> {
        // 48.club prefers maximum priority
        bundle.priority_fee = self.calculate_max_profitable_fee(&bundle);

        self.club48
            .send_bundle(&bundle)
            .await?;

        Ok(())
    }

    async fn submit_to_bloxroute(&self, bundle: Bundle) -> Result<()> {
        // Bloxroute uses BDN
        self.bloxroute
            .send_bundle_via_bdn(&bundle)
            .await?;

        Ok(())
    }

    async fn submit_to_blackrazor(&self, mut bundle: Bundle) -> Result<()> {
        // Blackrazor allows bundle merging
        bundle.allow_merging = true;

        self.blackrazor
            .send_bundle(&bundle)
            .await?;

        Ok(())
    }

    async fn submit_to_titan(&self, bundle: Bundle) -> Result<()> {
        // Titan supports multi-chain
        self.titan
            .send_bundle(&bundle, Chain::Ethereum)
            .await?;

        Ok(())
    }

    async fn monitor_bundle_inclusion(
        &self,
        bundle: &Bundle,
        timeout: Duration,
    ) -> Result<Option<u64>> {
        let start = Instant::now();
        let target_block = bundle.block_number;

        while start.elapsed() < timeout {
            let current_block = self.get_current_block().await?;

            if current_block >= target_block {
                // Check if bundle was included
                let block = self.get_block(target_block).await?;

                if self.is_bundle_in_block(bundle, &block) {
                    info!("Bundle included in block {}", target_block);
                    return Ok(Some(target_block));
                } else {
                    warn!("Bundle not included in target block");
                    return Ok(None);
                }
            }

            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        warn!("Bundle inclusion timeout");
        Ok(None)
    }

    fn calculate_max_profitable_fee(&self, bundle: &Bundle) -> U256 {
        // Maximum fee = 50% of expected profit
        let profit = bundle.expected_profit();
        let gas_units = bundle.total_gas();

        (profit / 2) / gas_units
    }
}
```

## Performance Optimization

### Lock-Free Transaction Pipeline

```rust
use crossbeam::queue::SegQueue;
use std::sync::Arc;

pub struct LockFreePipeline {
    input_queue: Arc<SegQueue<Transaction>>,
    output_queue: Arc<SegQueue<Opportunity>>,
    worker_count: usize,
}

impl LockFreePipeline {
    pub fn new(worker_count: usize) -> Self {
        Self {
            input_queue: Arc::new(SegQueue::new()),
            output_queue: Arc::new(SegQueue::new()),
            worker_count,
        }
    }

    pub fn start(&self) {
        for i in 0..self.worker_count {
            let input = self.input_queue.clone();
            let output = self.output_queue.clone();

            std::thread::spawn(move || {
                Self::worker_loop(i, input, output);
            });
        }
    }

    fn worker_loop(
        id: usize,
        input: Arc<SegQueue<Transaction>>,
        output: Arc<SegQueue<Opportunity>>,
    ) {
        loop {
            if let Some(tx) = input.pop() {
                if let Some(opportunity) = analyze_transaction(&tx) {
                    output.push(opportunity);
                }
            } else {
                // No work, yield CPU
                std::thread::yield_now();
            }
        }
    }

    pub fn push_transaction(&self, tx: Transaction) {
        self.input_queue.push(tx);
    }

    pub fn pop_opportunity(&self) -> Option<Opportunity> {
        self.output_queue.pop()
    }
}
```

### SIMD-Optimized Math

```rust
use std::arch::x86_64::*;

#[target_feature(enable = "avx2")]
unsafe fn calculate_outputs_simd(
    amounts: &[u64; 4],
    reserves_in: &[u64; 4],
    reserves_out: &[u64; 4],
) -> [u64; 4] {
    // Load data into SIMD registers
    let amounts_vec = _mm256_loadu_si256(amounts.as_ptr() as *const __m256i);
    let reserves_in_vec = _mm256_loadu_si256(reserves_in.as_ptr() as *const __m256i);
    let reserves_out_vec = _mm256_loadu_si256(reserves_out.as_ptr() as *const __m256i);

    // Perform calculations (simplified)
    let numerator = _mm256_mul_epu32(amounts_vec, reserves_out_vec);
    let denominator = _mm256_add_epi64(reserves_in_vec, amounts_vec);
    let result = _mm256_div_epu64(numerator, denominator);

    // Store result
    let mut output = [0u64; 4];
    _mm256_storeu_si256(output.as_mut_ptr() as *mut __m256i, result);

    output
}

pub fn batch_calculate_outputs(
    amounts: &[u64],
    reserves_in: &[u64],
    reserves_out: &[u64],
) -> Vec<u64> {
    assert_eq!(amounts.len(), reserves_in.len());
    assert_eq!(amounts.len(), reserves_out.len());

    let mut results = Vec::with_capacity(amounts.len());

    // Process in chunks of 4 (SIMD width)
    for chunk in amounts.chunks(4) {
        if chunk.len() == 4 {
            let amounts_chunk: [u64; 4] = chunk.try_into().unwrap();
            // Similar for reserves...

            unsafe {
                let chunk_results = calculate_outputs_simd(
                    &amounts_chunk,
                    &reserves_in_chunk,
                    &reserves_out_chunk,
                );

                results.extend_from_slice(&chunk_results);
            }
        } else {
            // Handle remainder
            for i in 0..chunk.len() {
                results.push(calculate_output_scalar(
                    chunk[i],
                    reserves_in[i],
                    reserves_out[i],
                ));
            }
        }
    }

    results
}
```

This comprehensive developer documentation provides deep technical insights into building an ultra-advanced MEV bot with graph-based algorithms, multi-builder integration, and extreme performance optimization.

