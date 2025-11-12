**Source:** https://github.com/ccyanxyz/uniswap-arbitrage-analysis
**Date:** 2024-2025


# Uniswap Arbitrage Analysis - Technical Deep Dive

## Architecture Analysis

### System Architecture Overview

The uniswap-arbitrage-analysis system follows a layered architecture design that separates concerns into distinct modules. At the foundation is the blockchain interaction layer, which handles all communication with Ethereum nodes through Web3.py. Above this sits the protocol-specific layer containing Uniswap V2 and V3 interfaces that abstract away the complexity of interacting with different AMM versions.

The core business logic layer contains the arbitrage detection, calculation, and optimization components. This layer is protocol-agnostic and works with normalized data structures, allowing it to analyze opportunities across different DEX protocols uniformly. The analysis and visualization layer sits at the top, consuming data from the core logic and presenting it in various formats including charts, reports, and interactive notebooks.

The architecture employs a modular design where each component has well-defined interfaces and can be tested independently. This makes the codebase maintainable and allows for easy extension to support additional protocols or analysis methods. The system uses dependency injection patterns to allow different implementations of the same interface, facilitating testing and customization.

### Data Flow Architecture

Data flows through the system in a pipeline pattern. Raw blockchain data enters through the Web3 connection layer, where it's fetched from nodes using RPC calls. This raw data includes contract state (pool reserves, token balances) and historical events (swaps, liquidity changes).

The protocol interfaces transform raw blockchain data into normalized data structures. For example, both Uniswap V2 and V3 pools are represented using a common Pool class that exposes methods like get_price() and calculate_output(), hiding protocol-specific implementation details.

The arbitrage detector consumes normalized pool data and produces opportunity objects. These objects contain all information needed to evaluate and potentially execute an arbitrage trade, including the token path, estimated profit, required capital, and execution parameters.

The analyzer components consume opportunity data and produce insights, reports, and visualizations. This separation allows the same opportunity data to be analyzed from multiple perspectives without repeating the detection logic.

### Concurrency Model

The system uses Python's asyncio for concurrent operations where appropriate. Blockchain queries that don't depend on each other can be executed in parallel, significantly improving performance when analyzing many pools simultaneously.

For CPU-intensive operations like pathfinding in large graphs, the system can optionally use multiprocessing to take advantage of multiple CPU cores. This is particularly valuable when analyzing historical data across many blocks.

The system implements careful state management to avoid race conditions when multiple concurrent tasks update shared data structures. It uses locks and atomic operations where necessary to ensure consistency.

### Caching Strategy

A multi-level caching strategy improves performance and reduces blockchain query load. At the lowest level, Web3 responses for immutable data (like contract bytecode or historical block data) are cached indefinitely.

Pool state data has time-based expiration since it changes with each new block. The cache can be configured to treat pool data as valid for a certain number of seconds or blocks, balancing freshness against query efficiency.

Computed results like optimal trade sizes for specific scenarios are cached with invalidation keys based on input parameters. This allows reuse of expensive calculations when parameters haven't changed.

### Error Handling and Resilience

The system implements comprehensive error handling throughout the stack. Network errors from Web3 providers trigger automatic retries with exponential backoff. The retry logic is configurable and includes circuit breakers to avoid overwhelming failing endpoints.

Contract interaction errors are caught and handled gracefully. If a pool state query fails, the system can fall back to cached data or skip that pool temporarily rather than crashing the entire analysis.

The system includes health checks for critical components like the Web3 connection. If health checks fail, the system can automatically attempt to reconnect or switch to backup providers.

## Code Structure

### Core Modules Deep Dive

**arbitrage/detector.py Implementation**

The detector module contains several classes implementing different detection strategies. The base Detector class defines the interface all detectors must implement:

```python
class Detector:
    def __init__(self, pool_manager, config):
        self.pool_manager = pool_manager
        self.config = config
        self.graph = None

    def build_graph(self):
        """Build trading graph from pool data"""
        pass

    def find_opportunities(self):
        """Find and return arbitrage opportunities"""
        pass

    def validate_opportunity(self, opportunity):
        """Validate that an opportunity is executable"""
        pass
```

TwoPoolDetector is the simplest implementation, checking pairs of pools that share common tokens. It iterates through pool combinations and calculates whether trading through both pools results in profit:

```python
class TwoPoolDetector(Detector):
    def find_opportunities(self):
        opportunities = []
        pools = self.pool_manager.get_all_pools()

        for pool_a, pool_b in self._find_pool_pairs(pools):
            if self._shares_token_pair(pool_a, pool_b):
                opp = self._calculate_arbitrage(pool_a, pool_b)
                if opp and opp.profit > self.config.min_profit:
                    opportunities.append(opp)

        return opportunities
```

MultiHopDetector uses graph algorithms to find profitable cycles. It builds a directed graph where nodes are tokens and edges are trading pairs, then applies a modified Bellman-Ford algorithm:

```python
class MultiHopDetector(Detector):
    def build_graph(self):
        self.graph = nx.DiGraph()

        for pool in self.pool_manager.get_all_pools():
            token_a, token_b = pool.tokens
            rate_a_to_b = pool.get_exchange_rate(token_a, token_b)
            rate_b_to_a = pool.get_exchange_rate(token_b, token_a)

            # Use negative log for Bellman-Ford
            self.graph.add_edge(
                token_a,
                token_b,
                weight=-math.log(rate_a_to_b),
                pool=pool
            )
            self.graph.add_edge(
                token_b,
                token_a,
                weight=-math.log(rate_b_to_a),
                pool=pool
            )

    def find_opportunities(self):
        self.build_graph()
        negative_cycles = self._find_negative_cycles()

        opportunities = []
        for cycle in negative_cycles:
            opp = self._evaluate_cycle(cycle)
            if opp and self.validate_opportunity(opp):
                opportunities.append(opp)

        return opportunities
```

**arbitrage/calculator.py Implementation**

The calculator module handles all mathematical computations for arbitrage profitability. It implements precise versions of AMM formulas accounting for fees and slippage:

```python
class ArbitrageCalculator:
    @staticmethod
    def calculate_uniswap_v2_output(
        input_amount,
        input_reserve,
        output_reserve,
        fee=0.003
    ):
        """Calculate output amount for Uniswap V2 swap"""
        input_with_fee = input_amount * (1 - fee)
        numerator = input_with_fee * output_reserve
        denominator = input_reserve + input_with_fee
        return numerator / denominator

    @staticmethod
    def calculate_two_hop_profit(
        input_amount,
        pool_a_reserves,
        pool_b_reserves,
        intermediate_token
    ):
        """Calculate profit for two-pool arbitrage"""
        # First swap
        intermediate_amount = ArbitrageCalculator.calculate_uniswap_v2_output(
            input_amount,
            pool_a_reserves[0],
            pool_a_reserves[1]
        )

        # Second swap
        output_amount = ArbitrageCalculator.calculate_uniswap_v2_output(
            intermediate_amount,
            pool_b_reserves[0],
            pool_b_reserves[1]
        )

        return output_amount - input_amount

    @staticmethod
    def calculate_optimal_input(pool_a, pool_b, token_path):
        """Find optimal input amount that maximizes profit"""
        def profit_function(input_amount):
            return ArbitrageCalculator.calculate_two_hop_profit(
                input_amount,
                pool_a.get_reserves(),
                pool_b.get_reserves(),
                token_path[1]
            )

        # Use scipy to find maximum
        from scipy.optimize import minimize_scalar
        result = minimize_scalar(
            lambda x: -profit_function(x),
            bounds=(1e10, 1e22),
            method='bounded'
        )

        return result.x if result.success else None
```

For Uniswap V3, the calculator implements tick math and concentrated liquidity calculations:

```python
class UniswapV3Calculator:
    @staticmethod
    def get_sqrt_price_at_tick(tick):
        """Convert tick to sqrt price"""
        return math.pow(1.0001, tick / 2)

    @staticmethod
    def calculate_output_with_liquidity(
        input_amount,
        liquidity,
        sqrt_price_current,
        sqrt_price_target,
        fee_tier
    ):
        """Calculate output considering concentrated liquidity"""
        input_with_fee = input_amount * (1 - fee_tier)

        # Calculate price impact
        sqrt_price_next = (
            liquidity * sqrt_price_current
        ) / (
            liquidity + input_with_fee * sqrt_price_current
        )

        # Calculate output amount
        output_amount = liquidity * (
            sqrt_price_current - sqrt_price_next
        ) / (sqrt_price_current * sqrt_price_next)

        return output_amount, sqrt_price_next
```

**arbitrage/optimizer.py Implementation**

The optimizer module determines the optimal trade size for identified opportunities. It uses numerical optimization to find the input amount that maximizes profit after accounting for all costs:

```python
class ArbitrageOptimizer:
    def __init__(self, gas_price_gwei, config):
        self.gas_price_gwei = gas_price_gwei
        self.config = config

    def optimize_trade_size(self, opportunity):
        """Find optimal trade size for maximum profit"""

        def net_profit(input_amount):
            # Calculate gross profit from arbitrage
            gross_profit = self._calculate_gross_profit(
                input_amount,
                opportunity
            )

            # Subtract gas costs
            gas_cost_eth = self._estimate_gas_cost(opportunity)
            gas_cost_tokens = self._eth_to_tokens(
                gas_cost_eth,
                opportunity.input_token
            )

            return gross_profit - gas_cost_tokens

        # Find maximum using scipy
        from scipy.optimize import minimize_scalar
        result = minimize_scalar(
            lambda x: -net_profit(x),
            bounds=(self.config.min_trade_size, self.config.max_trade_size),
            method='bounded'
        )

        if result.success and net_profit(result.x) > 0:
            return {
                'optimal_input': result.x,
                'expected_profit': net_profit(result.x),
                'gas_cost': self._estimate_gas_cost(opportunity)
            }

        return None

    def _estimate_gas_cost(self, opportunity):
        """Estimate gas cost based on opportunity complexity"""
        base_gas = 150000  # Base cost for simple swap

        # Add gas for each hop
        gas_per_hop = 100000
        total_hops = len(opportunity.path) - 1

        total_gas = base_gas + (gas_per_hop * total_hops)

        # Convert to ETH
        gas_cost_wei = total_gas * self.gas_price_gwei * 1e9
        gas_cost_eth = gas_cost_wei / 1e18

        return gas_cost_eth
```

### Uniswap Protocol Interfaces

**uniswap/v2_interface.py Implementation**

The V2 interface provides methods for interacting with Uniswap V2 pools:

```python
class UniswapV2Interface:
    def __init__(self, web3, factory_address, router_address):
        self.web3 = web3
        self.factory = self._load_factory_contract(factory_address)
        self.router = self._load_router_contract(router_address)
        self.pair_cache = {}

    def get_pair_address(self, token_a, token_b):
        """Get pair contract address for token pair"""
        cache_key = f"{token_a}:{token_b}"

        if cache_key not in self.pair_cache:
            pair_address = self.factory.functions.getPair(
                token_a,
                token_b
            ).call()
            self.pair_cache[cache_key] = pair_address

        return self.pair_cache[cache_key]

    def get_reserves(self, pair_address):
        """Get current reserves for a pair"""
        pair_contract = self._load_pair_contract(pair_address)
        reserves = pair_contract.functions.getReserves().call()

        return {
            'reserve0': reserves[0],
            'reserve1': reserves[1],
            'block_timestamp_last': reserves[2]
        }

    def calculate_amount_out(self, amount_in, reserve_in, reserve_out):
        """Calculate output amount using Uniswap V2 formula"""
        amount_in_with_fee = amount_in * 997
        numerator = amount_in_with_fee * reserve_out
        denominator = (reserve_in * 1000) + amount_in_with_fee
        return numerator / denominator

    def get_amounts_out(self, amount_in, path):
        """Get output amounts for multi-hop path"""
        amounts = [amount_in]

        for i in range(len(path) - 1):
            pair_address = self.get_pair_address(path[i], path[i+1])
            reserves = self.get_reserves(pair_address)

            amount_out = self.calculate_amount_out(
                amounts[-1],
                reserves['reserve0'],
                reserves['reserve1']
            )
            amounts.append(amount_out)

        return amounts
```

**uniswap/v3_interface.py Implementation**

The V3 interface handles the additional complexity of concentrated liquidity:

```python
class UniswapV3Interface:
    def __init__(self, web3, factory_address, quoter_address):
        self.web3 = web3
        self.factory = self._load_factory_contract(factory_address)
        self.quoter = self._load_quoter_contract(quoter_address)

    def get_pool_address(self, token_a, token_b, fee):
        """Get pool address for token pair and fee tier"""
        return self.factory.functions.getPool(
            token_a,
            token_b,
            fee
        ).call()

    def get_pool_state(self, pool_address):
        """Get current state of V3 pool"""
        pool_contract = self._load_pool_contract(pool_address)

        slot0 = pool_contract.functions.slot0().call()
        liquidity = pool_contract.functions.liquidity().call()

        return {
            'sqrt_price_x96': slot0[0],
            'tick': slot0[1],
            'observation_index': slot0[2],
            'observation_cardinality': slot0[3],
            'observation_cardinality_next': slot0[4],
            'fee_protocol': slot0[5],
            'unlocked': slot0[6],
            'liquidity': liquidity
        }

    def quote_exact_input_single(self, token_in, token_out, fee, amount_in):
        """Get quote for exact input swap"""
        try:
            amount_out = self.quoter.functions.quoteExactInputSingle(
                token_in,
                token_out,
                fee,
                amount_in,
                0  # sqrtPriceLimitX96
            ).call()
            return amount_out
        except Exception as e:
            # Quote reverted, swap would fail
            return 0

    def calculate_tick_amounts(self, pool_state, amount_in):
        """Calculate output considering tick ranges"""
        current_tick = pool_state['tick']
        liquidity = pool_state['liquidity']
        sqrt_price = pool_state['sqrt_price_x96'] / (2 ** 96)

        # Simplified calculation - production code needs full tick math
        price = sqrt_price ** 2
        amount_out = amount_in * price * 0.997  # Approximate with fee

        return amount_out
```

### Utility Modules

**utils/web3_helpers.py Implementation**

Web3 helper functions improve reliability and performance of blockchain interactions:

```python
class Web3Helper:
    def __init__(self, provider_uri, backup_provider_uris=None):
        self.provider_uri = provider_uri
        self.backup_provider_uris = backup_provider_uris or []
        self.web3 = self._initialize_web3()

    def _initialize_web3(self):
        """Initialize Web3 with retry and fallback logic"""
        try:
            web3 = Web3(Web3.HTTPProvider(self.provider_uri))
            if web3.isConnected():
                return web3
        except Exception as e:
            logger.warning(f"Primary provider failed: {e}")

        # Try backup providers
        for backup_uri in self.backup_provider_uris:
            try:
                web3 = Web3(Web3.HTTPProvider(backup_uri))
                if web3.isConnected():
                    logger.info(f"Connected to backup provider: {backup_uri}")
                    return web3
            except Exception as e:
                logger.warning(f"Backup provider failed: {e}")

        raise ConnectionError("All Web3 providers failed")

    def batch_get_reserves(self, pair_addresses):
        """Batch fetch reserves for multiple pairs"""
        calls = []
        for addr in pair_addresses:
            pair_contract = self._get_pair_contract(addr)
            calls.append(pair_contract.functions.getReserves())

        # Execute batch call
        results = self._execute_batch(calls)
        return dict(zip(pair_addresses, results))

    def _execute_batch(self, calls):
        """Execute multiple calls in a single RPC request"""
        from web3.middleware import construct_result_generator_middleware

        # Use multicall pattern for efficiency
        results = []
        for call in calls:
            try:
                result = call.call()
                results.append(result)
            except Exception as e:
                logger.error(f"Call failed: {e}")
                results.append(None)

        return results

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    def call_with_retry(self, contract_function, *args):
        """Execute contract call with automatic retry"""
        return contract_function(*args).call()
```

**utils/math_utils.py Implementation**

Math utilities for precise financial calculations:

```python
class MathUtils:
    @staticmethod
    def calculate_price_impact(amount_in, reserve_in, reserve_out):
        """Calculate price impact percentage"""
        initial_price = reserve_out / reserve_in

        # Price after trade
        new_reserve_in = reserve_in + amount_in
        # Simplified - assumes no fees for impact calculation
        amount_out = (amount_in * reserve_out) / (reserve_in + amount_in)
        new_reserve_out = reserve_out - amount_out

        final_price = new_reserve_out / new_reserve_in

        price_impact = abs(final_price - initial_price) / initial_price
        return price_impact * 100

    @staticmethod
    def calculate_slippage_tolerance(expected_output, actual_output):
        """Calculate slippage between expected and actual output"""
        slippage = (expected_output - actual_output) / expected_output
        return slippage * 100

    @staticmethod
    def wei_to_ether(wei_amount):
        """Convert Wei to Ether"""
        return wei_amount / 1e18

    @staticmethod
    def ether_to_wei(ether_amount):
        """Convert Ether to Wei"""
        return int(ether_amount * 1e18)

    @staticmethod
    def calculate_geometric_mean(amounts):
        """Calculate geometric mean of amounts"""
        product = 1
        for amount in amounts:
            product *= amount
        return product ** (1 / len(amounts))
```

## Smart Contract Implementation

While this repository focuses on analysis rather than execution, understanding the smart contract patterns it analyzes is crucial. Here's how the contracts it interacts with are structured:

### Uniswap V2 Pair Contract Interaction

```solidity
// The Uniswap V2 Pair contract that the analysis queries
interface IUniswapV2Pair {
    function getReserves() external view returns (
        uint112 reserve0,
        uint112 reserve1,
        uint32 blockTimestampLast
    );

    function token0() external view returns (address);
    function token1() external view returns (address);

    function price0CumulativeLast() external view returns (uint256);
    function price1CumulativeLast() external view returns (uint256);
}
```

The analysis code queries these contracts extensively to build its understanding of pool states. The getReserves() function is called frequently to determine current prices and available liquidity.

### Uniswap V3 Pool Contract Interaction

```solidity
interface IUniswapV3Pool {
    function slot0() external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint16 observationIndex,
        uint16 observationCardinality,
        uint16 observationCardinalityNext,
        uint8 feeProtocol,
        bool unlocked
    );

    function liquidity() external view returns (uint128);

    function ticks(int24 tick) external view returns (
        uint128 liquidityGross,
        int128 liquidityNet,
        uint256 feeGrowthOutside0X128,
        uint256 feeGrowthOutside1X128,
        int56 tickCumulativeOutside,
        uint160 secondsPerLiquidityOutsideX128,
        uint32 secondsOutside,
        bool initialized
    );
}
```

V3 pools are more complex to analyze due to concentrated liquidity. The analysis must consider tick spacing, liquidity distribution, and fee tiers.

### Hypothetical Arbitrage Execution Contract

While not included in the repository, here's what an arbitrage execution contract might look like:

```solidity
// Hypothetical arbitrage contract for educational purposes
contract ArbitrageExecutor {
    address private owner;
    IUniswapV2Router02 private uniswapRouter;
    IUniswapV2Router02 private sushiswapRouter;

    constructor(address _uniswapRouter, address _sushiswapRouter) {
        owner = msg.sender;
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        sushiswapRouter = IUniswapV2Router02(_sushiswapRouter);
    }

    function executeArbitrage(
        address token0,
        address token1,
        uint256 amount0In,
        uint256 minProfit
    ) external {
        require(msg.sender == owner, "Not authorized");

        // Calculate expected amounts
        address[] memory path = new address[](2);
        path[0] = token0;
        path[1] = token1;

        uint256[] memory amounts = uniswapRouter.getAmountsOut(
            amount0In,
            path
        );
        uint256 intermediateAmount = amounts[1];

        // Reverse path for second swap
        path[0] = token1;
        path[1] = token0;

        amounts = sushiswapRouter.getAmountsOut(
            intermediateAmount,
            path
        );
        uint256 finalAmount = amounts[1];

        require(
            finalAmount > amount0In + minProfit,
            "Insufficient profit"
        );

        // Execute swaps
        _executeSwap(token0, token1, amount0In, intermediateAmount);
        _executeSwap(token1, token0, intermediateAmount, finalAmount);
    }

    function _executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) private {
        // Implementation details...
    }
}
```

## Bot Architecture

While the repository is primarily analytical, understanding bot architecture helps contextualize its use:

### Event-Driven Architecture

A production arbitrage bot built on this analysis would use event-driven architecture:

```python
class ArbitrageBot:
    def __init__(self, config):
        self.config = config
        self.detector = MultiHopDetector(config)
        self.executor = TradeExecutor(config)
        self.monitor = PoolMonitor(config)

    async def start(self):
        """Start the bot's main event loop"""
        # Subscribe to new blocks
        self.web3.eth.subscribe('newHeads', self.on_new_block)

        # Subscribe to specific events
        self.monitor.subscribe('Swap', self.on_swap_event)
        self.monitor.subscribe('Sync', self.on_sync_event)

        # Start monitoring loop
        await self.run_forever()

    async def on_new_block(self, block):
        """Handle new block events"""
        # Update pool states
        await self.monitor.update_pools(block)

        # Look for opportunities
        opportunities = await self.detector.find_opportunities()

        # Execute profitable opportunities
        for opp in opportunities:
            if self.should_execute(opp):
                await self.executor.execute(opp)

    async def on_swap_event(self, event):
        """Handle swap events from monitored pools"""
        pool_address = event['address']

        # Update specific pool
        await self.monitor.update_pool(pool_address)

        # Quick check for opportunities involving this pool
        opportunities = await self.detector.find_opportunities_for_pool(
            pool_address
        )

        for opp in opportunities:
            if self.should_execute(opp):
                await self.executor.execute(opp)
```

### Mempool Monitoring

Advanced bots monitor the mempool for pending transactions:

```python
class MempoolMonitor:
    def __init__(self, web3):
        self.web3 = web3
        self.pending_txs = {}

    async def monitor_mempool(self):
        """Monitor pending transactions for arbitrage signals"""
        async for tx in self.web3.eth.subscribe('pendingTransactions'):
            await self.analyze_transaction(tx)

    async def analyze_transaction(self, tx_hash):
        """Analyze pending transaction for impact on arbitrage"""
        tx = await self.web3.eth.get_transaction(tx_hash)

        if self.is_swap_transaction(tx):
            # Decode swap parameters
            swap_params = self.decode_swap(tx)

            # Predict pool state after this transaction
            predicted_state = self.predict_pool_state(
                swap_params['pool'],
                swap_params['amount_in'],
                swap_params['amount_out']
            )

            # Check if this creates arbitrage opportunity
            opportunities = self.find_opportunities_after_tx(
                predicted_state
            )

            return opportunities
```

## Configuration & Setup

### Environment Configuration

The system uses a hierarchical configuration approach:

```python
# config/default.py
DEFAULT_CONFIG = {
    'web3': {
        'provider_uri': 'https://mainnet.infura.io/v3/YOUR_KEY',
        'timeout': 30,
        'max_retries': 3
    },
    'arbitrage': {
        'min_profit_wei': 1e18,  # 1 ETH minimum profit
        'max_hops': 3,
        'gas_price_gwei': 50,
        'slippage_tolerance': 0.01
    },
    'pools': {
        'update_interval': 12,  # seconds
        'cache_ttl': 60
    },
    'tokens': {
        'whitelist': [
            '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',  # WETH
            '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',  # USDC
            '0x6B175474E89094C44Da98b954EedeAC495271d0F',  # DAI
        ]
    }
}

# config/production.py
PRODUCTION_CONFIG = {
    **DEFAULT_CONFIG,
    'arbitrage': {
        **DEFAULT_CONFIG['arbitrage'],
        'min_profit_wei': 5e18,  # Higher threshold for production
        'gas_price_gwei': 100
    }
}
```

### Database Configuration

For production systems, persistent storage is essential:

```python
# Database schema for storing opportunities and executions
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class ArbitrageOpportunity(Base):
    __tablename__ = 'opportunities'

    id = Column(Integer, primary_key=True)
    block_number = Column(Integer, index=True)
    timestamp = Column(DateTime, index=True)
    token_path = Column(String)
    estimated_profit = Column(Float)
    required_capital = Column(Float)
    executed = Column(Boolean, default=False)
    actual_profit = Column(Float, nullable=True)

class PoolState(Base):
    __tablename__ = 'pool_states'

    id = Column(Integer, primary_key=True)
    block_number = Column(Integer, index=True)
    pool_address = Column(String, index=True)
    reserve0 = Column(String)
    reserve1 = Column(String)
    timestamp = Column(DateTime)
```

## Deployment Guide

### Local Development Setup

```bash
# Clone repository
git clone https://github.com/ccyanxyz/uniswap-arbitrage-analysis.git
cd uniswap-arbitrage-analysis

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export WEB3_PROVIDER_URI="https://mainnet.infura.io/v3/YOUR_KEY"
export MIN_PROFIT_ETH="1.0"

# Run tests
pytest tests/

# Start Jupyter for interactive analysis
jupyter notebook notebooks/
```

### Docker Deployment

```dockerfile
# Dockerfile for containerized deployment
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Run the application
CMD ["python", "src/main.py"]
```

```yaml
# docker-compose.yml
version: '3.8'

services:
  arbitrage-analyzer:
    build: .
    environment:
      - WEB3_PROVIDER_URI=${WEB3_PROVIDER_URI}
      - MIN_PROFIT_ETH=1.0
      - DATABASE_URL=postgresql://user:pass@db:5432/arbitrage
    depends_on:
      - db
      - redis
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs

  db:
    image: postgres:13
    environment:
      - POSTGRES_DB=arbitrage
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:6
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Cloud Deployment

For AWS deployment using ECS:

```yaml
# ecs-task-definition.json
{
  "family": "arbitrage-analyzer",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "containerDefinitions": [
    {
      "name": "analyzer",
      "image": "your-account.dkr.ecr.region.amazonaws.com/arbitrage-analyzer:latest",
      "environment": [
        {
          "name": "WEB3_PROVIDER_URI",
          "value": "https://mainnet.infura.io/v3/YOUR_KEY"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/arbitrage-analyzer",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

## API Integrations

### Web3 Provider Integration

```python
class Web3ProviderManager:
    """Manage multiple Web3 providers with failover"""

    def __init__(self, providers):
        self.providers = providers
        self.current_provider_index = 0
        self.web3 = self._connect()

    def _connect(self):
        """Connect to first available provider"""
        for i, provider_config in enumerate(self.providers):
            try:
                if provider_config['type'] == 'http':
                    provider = Web3.HTTPProvider(
                        provider_config['url'],
                        request_kwargs={'timeout': 30}
                    )
                elif provider_config['type'] == 'websocket':
                    provider = Web3.WebsocketProvider(
                        provider_config['url']
                    )

                web3 = Web3(provider)
                if web3.isConnected():
                    self.current_provider_index = i
                    return web3
            except Exception as e:
                logger.warning(f"Provider {i} failed: {e}")

        raise ConnectionError("All providers failed")

    def call_with_failover(self, func, *args, **kwargs):
        """Execute function with automatic failover"""
        attempts = 0
        max_attempts = len(self.providers)

        while attempts < max_attempts:
            try:
                return func(*args, **kwargs)
            except Exception as e:
                logger.warning(f"Call failed: {e}")
                attempts += 1
                self._switch_provider()

        raise Exception("All providers exhausted")

    def _switch_provider(self):
        """Switch to next available provider"""
        self.current_provider_index = (
            self.current_provider_index + 1
        ) % len(self.providers)
        self.web3 = self._connect()
```

### The Graph Integration

For efficient historical data queries:

```python
class TheGraphClient:
    """Client for querying Uniswap subgraph"""

    def __init__(self, subgraph_url):
        self.url = subgraph_url

    def query_swaps(self, pool_address, start_time, end_time):
        """Query swap events for a pool"""
        query = """
        {
          swaps(
            where: {
              pair: "%s",
              timestamp_gte: %d,
              timestamp_lte: %d
            },
            orderBy: timestamp,
            orderDirection: desc,
            first: 1000
          ) {
            id
            timestamp
            pair {
              token0 {
                symbol
              }
              token1 {
                symbol
              }
            }
            amount0In
            amount1In
            amount0Out
            amount1Out
            amountUSD
            sender
          }
        }
        """ % (pool_address.lower(), start_time, end_time)

        response = requests.post(
            self.url,
            json={'query': query}
        )

        return response.json()['data']['swaps']

    def query_pool_states(self, pool_addresses, block_number):
        """Query pool states at specific block"""
        query = """
        {
          pairs(
            where: {
              id_in: %s
            },
            block: {number: %d}
          ) {
            id
            reserve0
            reserve1
            reserveUSD
            token0Price
            token1Price
          }
        }
        """ % (pool_addresses, block_number)

        response = requests.post(
            self.url,
            json={'query': query}
        )

        return response.json()['data']['pairs']
```

## Performance Optimization

### Query Optimization

```python
class OptimizedPoolManager:
    """Pool manager with optimized queries"""

    def __init__(self, web3):
        self.web3 = web3
        self.multicall_contract = self._load_multicall()

    def batch_get_reserves(self, pool_addresses):
        """Get reserves for multiple pools in single call"""
        calls = []

        for addr in pool_addresses:
            # Encode getReserves() call
            call_data = self.web3.eth.contract(
                address=addr,
                abi=PAIR_ABI
            ).encodeABI('getReserves')

            calls.append({
                'target': addr,
                'callData': call_data
            })

        # Execute multicall
        results = self.multicall_contract.functions.aggregate(
            calls
        ).call()

        # Decode results
        reserves = []
        for result in results[1]:
            decoded = self.web3.eth.contract(
                abi=PAIR_ABI
            ).decode_function_result('getReserves', result)
            reserves.append(decoded)

        return dict(zip(pool_addresses, reserves))
```

### Caching Strategy

```python
from functools import lru_cache
import redis

class CacheManager:
    """Multi-level cache for pool data"""

    def __init__(self, redis_client):
        self.redis = redis_client

    @lru_cache(maxsize=1000)
    def get_pool_address(self, token_a, token_b):
        """Cache pool addresses in memory"""
        cache_key = f"pool:{token_a}:{token_b}"

        # Try Redis first
        cached = self.redis.get(cache_key)
        if cached:
            return cached.decode()

        # Query blockchain
        address = self._query_pool_address(token_a, token_b)

        # Cache in Redis (no expiration for immutable data)
        self.redis.set(cache_key, address)

        return address

    def get_pool_reserves(self, pool_address, max_age=12):
        """Cache pool reserves with TTL"""
        cache_key = f"reserves:{pool_address}"

        cached = self.redis.get(cache_key)
        if cached:
            return json.loads(cached)

        # Query blockchain
        reserves = self._query_reserves(pool_address)

        # Cache with TTL
        self.redis.setex(
            cache_key,
            max_age,
            json.dumps(reserves)
        )

        return reserves
```

### Parallel Processing

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

class ParallelAnalyzer:
    """Analyze multiple opportunities in parallel"""

    def __init__(self, max_workers=10):
        self.executor = ThreadPoolExecutor(max_workers=max_workers)

    async def analyze_opportunities_parallel(self, opportunities):
        """Analyze multiple opportunities concurrently"""
        loop = asyncio.get_event_loop()

        tasks = [
            loop.run_in_executor(
                self.executor,
                self._analyze_opportunity,
                opp
            )
            for opp in opportunities
        ]

        results = await asyncio.gather(*tasks)
        return [r for r in results if r is not None]

    def _analyze_opportunity(self, opportunity):
        """CPU-intensive analysis of single opportunity"""
        # Detailed profitability calculation
        # Liquidity analysis
        # Risk assessment
        return analyzed_opportunity
```

## Security Considerations

### Private Key Management

```python
from eth_account import Account
from cryptography.fernet import Fernet

class SecureKeyManager:
    """Secure storage and usage of private keys"""

    def __init__(self, encryption_key):
        self.fernet = Fernet(encryption_key)
        self.account = None

    def load_key(self, encrypted_key):
        """Load encrypted private key"""
        decrypted = self.fernet.decrypt(encrypted_key.encode())
        self.account = Account.from_key(decrypted)

    def sign_transaction(self, transaction):
        """Sign transaction without exposing private key"""
        if not self.account:
            raise ValueError("No key loaded")

        signed = self.account.sign_transaction(transaction)
        return signed

    def get_address(self):
        """Get public address"""
        return self.account.address if self.account else None
```

### Input Validation

```python
class TransactionValidator:
    """Validate transactions before execution"""

    @staticmethod
    def validate_arbitrage_params(params):
        """Validate arbitrage parameters"""
        assert params['amount_in'] > 0, "Invalid input amount"
        assert params['min_profit'] > 0, "Invalid profit threshold"
        assert len(params['path']) >= 2, "Invalid token path"

        # Check for reasonable values
        max_trade_size = 1000 * 1e18  # 1000 ETH
        assert params['amount_in'] < max_trade_size, "Trade size too large"

        # Validate addresses
        for token in params['path']:
            assert Web3.isAddress(token), f"Invalid address: {token}"

        return True

    @staticmethod
    def simulate_transaction(web3, transaction):
        """Simulate transaction before sending"""
        try:
            # Use eth_call to simulate
            result = web3.eth.call(transaction)
            return True
        except Exception as e:
            logger.error(f"Transaction would fail: {e}")
            return False
```

## Testing Strategy

### Unit Tests

```python
import pytest
from src.arbitrage.calculator import ArbitrageCalculator

class TestArbitrageCalculator:
    def test_calculate_uniswap_v2_output(self):
        """Test V2 output calculation"""
        amount_in = 1 * 1e18
        reserve_in = 100 * 1e18
        reserve_out = 200 * 1e18

        amount_out = ArbitrageCalculator.calculate_uniswap_v2_output(
            amount_in,
            reserve_in,
            reserve_out
        )

        # Expected: ~1.98 tokens (accounting for fees)
        expected = 1.98 * 1e18
        assert abs(amount_out - expected) / expected < 0.01

    def test_calculate_two_hop_profit(self):
        """Test two-hop arbitrage calculation"""
        input_amount = 1 * 1e18
        pool_a_reserves = (100 * 1e18, 200 * 1e18)
        pool_b_reserves = (200 * 1e18, 105 * 1e18)

        profit = ArbitrageCalculator.calculate_two_hop_profit(
            input_amount,
            pool_a_reserves,
            pool_b_reserves,
            'USDC'
        )

        # Should be profitable
        assert profit > 0

    def test_optimal_input_calculation(self):
        """Test optimal input amount finding"""
        # Create mock pools
        pool_a = MockPool((100 * 1e18, 200 * 1e18))
        pool_b = MockPool((200 * 1e18, 105 * 1e18))

        optimal = ArbitrageCalculator.calculate_optimal_input(
            pool_a,
            pool_b,
            ['ETH', 'USDC', 'ETH']
        )

        assert optimal is not None
        assert optimal > 0
```

### Integration Tests

```python
class TestUniswapIntegration:
    @pytest.fixture
    def web3(self):
        """Create Web3 instance for testing"""
        return Web3(Web3.HTTPProvider('https://mainnet.infura.io/v3/KEY'))

    def test_fetch_pool_reserves(self, web3):
        """Test fetching real pool reserves"""
        interface = UniswapV2Interface(web3, FACTORY_ADDRESS, ROUTER_ADDRESS)

        # ETH/USDC pool
        pair_address = interface.get_pair_address(WETH_ADDRESS, USDC_ADDRESS)
        assert Web3.isAddress(pair_address)

        reserves = interface.get_reserves(pair_address)
        assert reserves['reserve0'] > 0
        assert reserves['reserve1'] > 0

    @pytest.mark.slow
    def test_historical_analysis(self, web3):
        """Test historical opportunity analysis"""
        analyzer = HistoricalAnalyzer(web3)

        opportunities = analyzer.analyze_block_range(
            start_block=15000000,
            end_block=15000100
        )

        assert len(opportunities) >= 0
        for opp in opportunities:
            assert opp.profit > 0
```

## Gas Optimization

### Gas Estimation Models

```python
class GasEstimator:
    """Accurate gas estimation for arbitrage transactions"""

    # Base costs from empirical data
    BASE_COSTS = {
        'two_pool_v2': 180000,
        'three_pool_v2': 280000,
        'two_pool_v3': 200000,
        'three_pool_v3': 320000,
        'flash_loan_overhead': 80000
    }

    def estimate_arbitrage_gas(self, opportunity):
        """Estimate gas for arbitrage execution"""
        base_gas = self.BASE_COSTS['two_pool_v2']

        # Add gas for each additional hop
        num_hops = len(opportunity.path) - 1
        if num_hops > 2:
            base_gas += (num_hops - 2) * 100000

        # Add gas for flash loan if needed
        if opportunity.requires_flash_loan:
            base_gas += self.BASE_COSTS['flash_loan_overhead']

        # Add 20% buffer for safety
        return int(base_gas * 1.2)

    def calculate_gas_cost_eth(self, gas_amount, gas_price_gwei):
        """Calculate gas cost in ETH"""
        gas_price_wei = gas_price_gwei * 1e9
        gas_cost_wei = gas_amount * gas_price_wei
        return gas_cost_wei / 1e18
```

## Common Issues & Solutions

### Issue: RPC Rate Limiting

```python
class RateLimitedProvider:
    """Web3 provider with built-in rate limiting"""

    def __init__(self, provider_uri, requests_per_second=10):
        self.provider = Web3.HTTPProvider(provider_uri)
        self.web3 = Web3(self.provider)
        self.rate_limiter = RateLimiter(requests_per_second)

        # Add middleware for automatic rate limiting
        self.web3.middleware_onion.inject(
            self._rate_limit_middleware,
            layer=0
        )

    def _rate_limit_middleware(self, make_request, web3):
        """Middleware to rate limit requests"""
        def middleware(method, params):
            self.rate_limiter.wait_if_needed()
            return make_request(method, params)
        return middleware
```

### Issue: Stale Pool Data

```python
class PoolStateManager:
    """Manage pool states with freshness tracking"""

    def __init__(self, max_age_seconds=12):
        self.states = {}
        self.max_age = max_age_seconds

    def get_pool_state(self, pool_address):
        """Get pool state, refresh if stale"""
        if pool_address in self.states:
            state, timestamp = self.states[pool_address]
            age = time.time() - timestamp

            if age < self.max_age:
                return state

        # Refresh stale data
        fresh_state = self._fetch_pool_state(pool_address)
        self.states[pool_address] = (fresh_state, time.time())
        return fresh_state
```

### Issue: Transaction Front-Running

```python
class FrontRunningProtection:
    """Protect against front-running"""

    @staticmethod
    def calculate_minimum_output(expected_output, slippage_tolerance=0.02):
        """Calculate minimum acceptable output"""
        return int(expected_output * (1 - slippage_tolerance))

    @staticmethod
    def use_flashbots(transaction):
        """Submit transaction through Flashbots"""
        flashbots_rpc = "https://relay.flashbots.net"

        # Bundle transaction to avoid public mempool
        bundle = [
            {"signed_transaction": transaction}
        ]

        # Submit bundle
        result = flashbots.send_bundle(
            bundle,
            target_block_number=web3.eth.block_number + 1
        )

        return result
```

## Enhancement Opportunities

### Machine Learning Integration

```python
from sklearn.ensemble import RandomForestRegressor
import numpy as np

class OpportunityPredictor:
    """Predict arbitrage opportunity profitability using ML"""

    def __init__(self):
        self.model = RandomForestRegressor(n_estimators=100)
        self.is_trained = False

    def train(self, historical_opportunities):
        """Train model on historical data"""
        features = []
        labels = []

        for opp in historical_opportunities:
            # Extract features
            feature_vector = [
                opp.price_difference,
                opp.liquidity_depth,
                opp.gas_price,
                opp.num_hops,
                opp.volatility
            ]
            features.append(feature_vector)
            labels.append(opp.actual_profit)

        X = np.array(features)
        y = np.array(labels)

        self.model.fit(X, y)
        self.is_trained = True

    def predict_profit(self, opportunity):
        """Predict actual profit for opportunity"""
        if not self.is_trained:
            raise ValueError("Model not trained")

        features = np.array([[
            opportunity.price_difference,
            opportunity.liquidity_depth,
            opportunity.gas_price,
            opportunity.num_hops,
            opportunity.volatility
        ]])

        predicted_profit = self.model.predict(features)[0]
        return predicted_profit
```

### Advanced Routing Algorithms

```python
class AdvancedRouter:
    """Find optimal routes using advanced algorithms"""

    def find_optimal_route_with_splitting(self, token_in, token_out, amount):
        """Split trade across multiple routes for better execution"""
        # Find all possible routes
        routes = self._find_all_routes(token_in, token_out)

        # Optimize split across routes
        optimal_split = self._optimize_route_split(routes, amount)

        return optimal_split

    def _optimize_route_split(self, routes, total_amount):
        """Use optimization to split amount across routes"""
        from scipy.optimize import minimize

        def objective(splits):
            """Maximize total output"""
            total_output = 0
            for i, split in enumerate(splits):
                output = self._calculate_route_output(routes[i], split)
                total_output += output
            return -total_output  # Negative for maximization

        # Constraints: splits must sum to total_amount
        constraints = {
            'type': 'eq',
            'fun': lambda x: np.sum(x) - total_amount
        }

        # Initial guess: equal split
        x0 = [total_amount / len(routes)] * len(routes)

        result = minimize(
            objective,
            x0,
            method='SLSQP',
            constraints=constraints,
            bounds=[(0, total_amount)] * len(routes)
        )

        return list(zip(routes, result.x))
```

## Code Examples

### Complete Arbitrage Detection Example

```python
# Example: Complete arbitrage detection workflow

from web3 import Web3
from src.uniswap.v2_interface import UniswapV2Interface
from src.arbitrage.detector import TwoPoolDetector
from src.arbitrage.optimizer import ArbitrageOptimizer

# Initialize Web3
web3 = Web3(Web3.HTTPProvider('https://mainnet.infura.io/v3/YOUR_KEY'))

# Initialize Uniswap interface
uniswap = UniswapV2Interface(
    web3,
    factory_address='0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    router_address='0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
)

# Create pool manager
from src.uniswap.pool_manager import PoolManager
pool_manager = PoolManager(uniswap)

# Add pools to monitor
pool_manager.add_pool('ETH', 'USDC')
pool_manager.add_pool('ETH', 'DAI')
pool_manager.add_pool('USDC', 'DAI')

# Create detector
detector = TwoPoolDetector(pool_manager)

# Find opportunities
opportunities = detector.find_opportunities()

# Optimize each opportunity
optimizer = ArbitrageOptimizer(gas_price_gwei=50, config={})

for opp in opportunities:
    optimized = optimizer.optimize_trade_size(opp)
    if optimized:
        print(f"Opportunity found:")
        print(f"  Path: {' -> '.join(opp.path)}")
        print(f"  Optimal input: {optimized['optimal_input'] / 1e18} ETH")
        print(f"  Expected profit: {optimized['expected_profit'] / 1e18} ETH")
        print(f"  Gas cost: {optimized['gas_cost']} ETH")
```

### Historical Analysis Example

```python
# Example: Analyze historical arbitrage opportunities

from src.analysis.historical import HistoricalAnalyzer
import matplotlib.pyplot as plt

# Create analyzer
analyzer = HistoricalAnalyzer(web3)

# Analyze a day of blocks
start_block = 15000000
end_block = 15007200  # Approximately 1 day

opportunities = analyzer.analyze_block_range(start_block, end_block)

# Calculate statistics
profits = [opp.profit / 1e18 for opp in opportunities]
avg_profit = np.mean(profits)
total_profit = np.sum(profits)

print(f"Opportunities found: {len(opportunities)}")
print(f"Total profit: {total_profit} ETH")
print(f"Average profit: {avg_profit} ETH")

# Visualize profit distribution
plt.figure(figsize=(10, 6))
plt.hist(profits, bins=50)
plt.xlabel('Profit (ETH)')
plt.ylabel('Frequency')
plt.title('Arbitrage Opportunity Profit Distribution')
plt.show()

# Analyze by time of day
by_hour = analyzer.group_by_hour(opportunities)
hourly_profits = [sum(opp.profit for opp in opps) / 1e18
                  for opps in by_hour.values()]

plt.figure(figsize=(12, 6))
plt.bar(range(24), hourly_profits)
plt.xlabel('Hour of Day')
plt.ylabel('Total Profit (ETH)')
plt.title('Arbitrage Profit by Hour')
plt.show()
```

This technical deep dive provides comprehensive coverage of the implementation details, architectures, and best practices for the uniswap-arbitrage-analysis repository.
