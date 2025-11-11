**Source:** https://github.com/Alexanderjr1994/no_gas_labs_sui_flashloan

# Sui Flash Loan dApp - Developer Deep Dive

## Advanced Move Programming Patterns

### Resource-Oriented Architecture

Sui's Move implementation uses a resource-oriented model where digital assets are represented as objects with strict ownership rules. This is fundamental to flash loan security.

```move
module flash_loan::advanced_pool {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::table::{Self, Table};
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::option::{Self, Option};

    /// Advanced pool with time-weighted features
    struct AdvancedPool<phantom T> has key {
        id: UID,
        balance: Balance<T>,
        fee_rate: u64,
        admin: address,

        // Time-weighted metrics
        total_borrowed: u64,
        total_repaid: u64,
        borrow_count: u64,

        // Dynamic fee adjustment
        base_fee: u64,
        utilization_multiplier: u64,

        // Borrower tracking
        borrower_stats: Table<address, BorrowerStats>,

        // Circuit breaker
        max_single_loan: u64,
        daily_borrow_limit: u64,
        daily_borrowed: u64,
        last_reset_day: u64,

        // Emergency controls
        paused: bool,
        emergency_admin: address,
    }

    struct BorrowerStats has store {
        total_borrowed: u64,
        total_repaid: u64,
        loan_count: u64,
        last_borrow_time: u64,
        failed_repayments: u64,
    }

    /// Enhanced flash loan receipt with metadata
    struct EnhancedReceipt<phantom T> has key {
        id: UID,
        pool_id: ID,
        amount: u64,
        fee: u64,
        borrower: address,
        timestamp: u64,
        nonce: u64,
    }

    /// Events
    struct PoolCreated has copy, drop {
        pool_id: ID,
        admin: address,
        initial_balance: u64,
    }

    struct LoanBorrowed has copy, drop {
        pool_id: ID,
        borrower: address,
        amount: u64,
        fee: u64,
        timestamp: u64,
    }

    struct LoanRepaid has copy, drop {
        pool_id: ID,
        borrower: address,
        amount: u64,
        actual_repaid: u64,
        profit: u64,
        timestamp: u64,
    }

    struct UtilizationChanged has copy, drop {
        pool_id: ID,
        utilization_rate: u64,
        new_fee_rate: u64,
    }

    /// Error codes
    const EInsufficientLiquidity: u64 = 0;
    const ERepaymentFailed: u64 = 1;
    const EInvalidFee: u64 = 2;
    const EUnauthorized: u64 = 3;
    const EPoolPaused: u64 = 4;
    const EExceedsMaxLoan: u64 = 5;
    const EExceedsDailyLimit: u64 = 6;
    const EInvalidReceipt: u64 = 7;
    const ERateLimited: u64 = 8;

    /// Initialize advanced pool
    public fun create_advanced_pool<T>(
        initial_balance: Coin<T>,
        base_fee: u64,
        max_single_loan: u64,
        daily_limit: u64,
        emergency_admin: address,
        ctx: &mut TxContext
    ) {
        assert!(base_fee <= 1000, EInvalidFee); // Max 10%

        let sender = tx_context::sender(ctx);
        let balance_amount = coin::value(&initial_balance);

        let pool = AdvancedPool<T> {
            id: object::new(ctx),
            balance: coin::into_balance(initial_balance),
            fee_rate: base_fee,
            admin: sender,
            total_borrowed: 0,
            total_repaid: 0,
            borrow_count: 0,
            base_fee,
            utilization_multiplier: 100, // 1x multiplier initially
            borrower_stats: table::new(ctx),
            max_single_loan,
            daily_borrow_limit: daily_limit,
            daily_borrowed: 0,
            last_reset_day: 0,
            paused: false,
            emergency_admin,
        };

        let pool_id = object::uid_to_inner(&pool.id);

        event::emit(PoolCreated {
            pool_id,
            admin: sender,
            initial_balance: balance_amount,
        });

        transfer::share_object(pool);
    }

    /// Borrow with dynamic fee calculation
    public fun borrow_advanced<T>(
        pool: &mut Pool<T>,
        amount: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): (Coin<T>, EnhancedReceipt<T>) {
        assert!(!pool.paused, EPoolPaused);
        assert!(amount <= pool.max_single_loan, EExceedsMaxLoan);

        let sender = tx_context::sender(ctx);
        let timestamp = clock::timestamp_ms(clock);
        let current_day = timestamp / 86400000; // ms to days

        // Reset daily limit if new day
        if (current_day > pool.last_reset_day) {
            pool.daily_borrowed = 0;
            pool.last_reset_day = current_day;
        };

        assert!(
            pool.daily_borrowed + amount <= pool.daily_borrow_limit,
            EExceedsDailyLimit
        );

        let available = balance::value(&pool.balance);
        assert!(available >= amount, EInsufficientLiquidity);

        // Calculate dynamic fee based on utilization
        let utilization_rate = ((amount * 10000) / available);
        let dynamic_fee = calculate_dynamic_fee(
            pool.base_fee,
            utilization_rate,
            pool.utilization_multiplier
        );

        let fee = (amount * dynamic_fee) / 10000;

        // Update borrower stats
        update_borrower_stats(
            &mut pool.borrower_stats,
            sender,
            amount,
            timestamp,
            ctx
        );

        // Take loan from pool
        let borrowed = coin::take(&mut pool.balance, amount, ctx);

        // Update pool stats
        pool.total_borrowed = pool.total_borrowed + amount;
        pool.borrow_count = pool.borrow_count + 1;
        pool.daily_borrowed = pool.daily_borrowed + amount;

        // Create enhanced receipt
        let receipt = EnhancedReceipt<T> {
            id: object::new(ctx),
            pool_id: object::uid_to_inner(&pool.id),
            amount,
            fee,
            borrower: sender,
            timestamp,
            nonce: pool.borrow_count,
        };

        event::emit(LoanBorrowed {
            pool_id: object::uid_to_inner(&pool.id),
            borrower: sender,
            amount,
            fee,
            timestamp,
        });

        event::emit(UtilizationChanged {
            pool_id: object::uid_to_inner(&pool.id),
            utilization_rate,
            new_fee_rate: dynamic_fee,
        });

        (borrowed, receipt)
    }

    /// Repay with profit tracking
    public fun repay_advanced<T>(
        pool: &mut Pool<T>,
        receipt: EnhancedReceipt<T>,
        repayment: Coin<T>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let EnhancedReceipt {
            id,
            pool_id,
            amount,
            fee,
            borrower,
            timestamp: borrow_timestamp,
            nonce: _,
        } = receipt;

        assert!(pool_id == object::uid_to_inner(&pool.id), EInvalidReceipt);
        assert!(borrower == tx_context::sender(ctx), EUnauthorized);

        let repayment_amount = coin::value(&repayment);
        let required_amount = amount + fee;

        assert!(repayment_amount >= required_amount, ERepaymentFailed);

        let profit = repayment_amount - required_amount;
        let timestamp = clock::timestamp_ms(clock);

        // Update pool
        coin::put(&mut pool.balance, repayment);
        pool.total_repaid = pool.total_repaid + repayment_amount;

        // Update borrower stats
        if (table::contains(&pool.borrower_stats, borrower)) {
            let stats = table::borrow_mut(&mut pool.borrower_stats, borrower);
            stats.total_repaid = stats.total_repaid + repayment_amount;
        };

        event::emit(LoanRepaid {
            pool_id,
            borrower,
            amount,
            actual_repaid: repayment_amount,
            profit,
            timestamp,
        });

        object::delete(id);
    }

    /// Calculate dynamic fee based on utilization
    fun calculate_dynamic_fee(
        base_fee: u64,
        utilization_rate: u64,
        multiplier: u64
    ): u64 {
        // Fee increases with utilization
        // formula: base_fee * (1 + utilization_rate * multiplier / 10000)
        let additional_fee = (utilization_rate * multiplier) / 100;
        base_fee + additional_fee
    }

    /// Update borrower statistics
    fun update_borrower_stats(
        stats_table: &mut Table<address, BorrowerStats>,
        borrower: address,
        amount: u64,
        timestamp: u64,
        ctx: &mut TxContext
    ) {
        if (!table::contains(stats_table, borrower)) {
            let new_stats = BorrowerStats {
                total_borrowed: amount,
                total_repaid: 0,
                loan_count: 1,
                last_borrow_time: timestamp,
                failed_repayments: 0,
            };
            table::add(stats_table, borrower, new_stats);
        } else {
            let stats = table::borrow_mut(stats_table, borrower);
            stats.total_borrowed = stats.total_borrowed + amount;
            stats.loan_count = stats.loan_count + 1;
            stats.last_borrow_time = timestamp;
        };
    }

    /// Admin functions
    public entry fun pause_pool<T>(
        pool: &mut Pool<T>,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(
            sender == pool.admin || sender == pool.emergency_admin,
            EUnauthorized
        );
        pool.paused = true;
    }

    public entry fun unpause_pool<T>(
        pool: &mut Pool<T>,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == pool.admin, EUnauthorized);
        pool.paused = false;
    }

    public entry fun update_fee_parameters<T>(
        pool: &mut Pool<T>,
        new_base_fee: u64,
        new_multiplier: u64,
        ctx: &mut TxContext
    ) {
        assert!(tx_context::sender(ctx) == pool.admin, EUnauthorized);
        assert!(new_base_fee <= 1000, EInvalidFee);

        pool.base_fee = new_base_fee;
        pool.utilization_multiplier = new_multiplier;
    }

    /// View functions
    public fun get_pool_metrics<T>(pool: &Pool<T>): (u64, u64, u64, u64, u64) {
        (
            balance::value(&pool.balance),
            pool.total_borrowed,
            pool.total_repaid,
            pool.borrow_count,
            pool.fee_rate,
        )
    }

    public fun get_borrower_stats<T>(
        pool: &Pool<T>,
        borrower: address
    ): Option<BorrowerStats> {
        if (table::contains(&pool.borrower_stats, borrower)) {
            option::some(*table::borrow(&pool.borrower_stats, borrower))
        } else {
            option::none()
        }
    }

    public fun calculate_current_fee<T>(
        pool: &Pool<T>,
        amount: u64
    ): u64 {
        let available = balance::value(&pool.balance);
        if (available == 0) return 10000; // 100% fee if no liquidity

        let utilization_rate = (amount * 10000) / available;
        let dynamic_fee = calculate_dynamic_fee(
            pool.base_fee,
            utilization_rate,
            pool.utilization_multiplier
        );

        (amount * dynamic_fee) / 10000
    }
}
```

### Multi-Protocol Arbitrage Strategy

```move
module flash_loan::multi_protocol_arb {
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::clock::{Self, Clock};
    use flash_loan::advanced_pool::{Self, AdvancedPool, EnhancedReceipt};
    use std::vector;

    /// Arbitrage path
    struct ArbPath has copy, drop, store {
        dex_addresses: vector<address>,
        pool_ids: vector<ID>,
        swap_directions: vector<bool>, // true for A->B, false for B->A
        min_profit_bps: u64, // minimum profit in basis points
    }

    /// Arbitrage execution result
    struct ArbResult has copy, drop {
        executed: bool,
        initial_amount: u64,
        final_amount: u64,
        profit: u64,
        gas_cost: u64,
        hops: u64,
    }

    /// Execute multi-hop arbitrage
    public entry fun execute_multi_hop_arbitrage<T>(
        pool: &mut AdvancedPool<T>,
        amount: u64,
        path: vector<address>,
        pool_ids: vector<ID>,
        min_profit: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        // Borrow flash loan
        let (mut borrowed_coin, receipt) = advanced_pool::borrow_advanced(
            pool,
            amount,
            clock,
            ctx
        );

        let initial_amount = coin::value(&borrowed_coin);
        let mut current_amount = initial_amount;

        // Execute arbitrage hops
        let path_length = vector::length(&path);
        let mut i = 0;

        while (i < path_length) {
            let dex_address = *vector::borrow(&path, i);
            let pool_id = *vector::borrow(&pool_ids, i);

            // Execute swap (mock implementation)
            current_amount = execute_swap(
                &mut borrowed_coin,
                dex_address,
                pool_id,
                ctx
            );

            i = i + 1;
        };

        // Verify profit
        let final_amount = coin::value(&borrowed_coin);
        let fee = advanced_pool::calculate_current_fee(pool, amount);
        let required = amount + fee;

        assert!(final_amount >= required + min_profit, 0);

        // Repay loan
        advanced_pool::repay_advanced(
            pool,
            receipt,
            borrowed_coin,
            clock,
            ctx
        );
    }

    /// Execute swap on DEX (simplified)
    fun execute_swap<T>(
        coin: &mut Coin<T>,
        dex_address: address,
        pool_id: ID,
        ctx: &mut TxContext
    ): u64 {
        // This would integrate with actual DEX contracts
        // For now, return current value
        coin::value(coin)
    }

    /// Calculate optimal arbitrage path
    public fun find_optimal_path(
        available_dexs: vector<address>,
        current_prices: vector<u64>,
        amount: u64
    ): (vector<address>, u64) {
        // Simplified pathfinding algorithm
        // In production, this would use Bellman-Ford or similar
        (available_dexs, 0)
    }
}
```

## Advanced Frontend Implementation

### Comprehensive State Management

```javascript
// src/store/flashLoanStore.js
import create from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import SuiFlashLoanClient from '../services/suiClient';

const useFlashLoanStore = create(
  devtools(
    persist(
      (set, get) => ({
        // State
        client: null,
        poolInfo: null,
        transactions: [],
        liveEvents: [],
        strategies: [],
        profitHistory: [],
        settings: {
          network: 'testnet',
          autoRefresh: true,
          refreshInterval: 10000,
          slippageTolerance: 0.5,
          gasLimit: 1000000,
        },

        // Initialization
        initialize: async (network = 'testnet') => {
          const client = new SuiFlashLoanClient(network);
          set({ client });
          await get().loadPoolInfo();
          get().startAutoRefresh();
        },

        // Pool operations
        loadPoolInfo: async () => {
          const { client } = get();
          if (!client) return;

          try {
            const poolInfo = await client.getPoolInfo();
            set({ poolInfo });
          } catch (error) {
            console.error('Failed to load pool info:', error);
          }
        },

        // Flash loan execution
        executeFlashLoan: async (params) => {
          const { client } = get();
          if (!client) throw new Error('Client not initialized');

          set((state) => ({
            transactions: [
              {
                id: Date.now(),
                status: 'pending',
                params,
                timestamp: new Date(),
              },
              ...state.transactions,
            ],
          }));

          try {
            const tx = await client.executeFlashLoan(
              params.walletAddress,
              params.amount,
              params.strategy
            );

            return tx;
          } catch (error) {
            console.error('Flash loan execution failed:', error);
            throw error;
          }
        },

        // Strategy management
        addStrategy: (strategy) => {
          set((state) => ({
            strategies: [...state.strategies, strategy],
          }));
        },

        removeStrategy: (strategyId) => {
          set((state) => ({
            strategies: state.strategies.filter((s) => s.id !== strategyId),
          }));
        },

        updateStrategy: (strategyId, updates) => {
          set((state) => ({
            strategies: state.strategies.map((s) =>
              s.id === strategyId ? { ...s, ...updates } : s
            ),
          }));
        },

        // Profit tracking
        addProfitRecord: (record) => {
          set((state) => ({
            profitHistory: [record, ...state.profitHistory].slice(0, 100),
          }));
        },

        calculateTotalProfit: () => {
          const { profitHistory } = get();
          return profitHistory.reduce((sum, record) => sum + record.profit, 0);
        },

        // Event handling
        addLiveEvent: (event) => {
          set((state) => ({
            liveEvents: [event, ...state.liveEvents].slice(0, 50),
          }));
        },

        clearEvents: () => {
          set({ liveEvents: [] });
        },

        // Auto-refresh
        startAutoRefresh: () => {
          const { settings } = get();
          if (!settings.autoRefresh) return;

          const interval = setInterval(() => {
            get().loadPoolInfo();
          }, settings.refreshInterval);

          set({ refreshInterval: interval });
        },

        stopAutoRefresh: () => {
          const { refreshInterval } = get();
          if (refreshInterval) {
            clearInterval(refreshInterval);
            set({ refreshInterval: null });
          }
        },

        // Settings
        updateSettings: (newSettings) => {
          set((state) => ({
            settings: { ...state.settings, ...newSettings },
          }));
        },
      }),
      {
        name: 'flash-loan-storage',
        partialize: (state) => ({
          strategies: state.strategies,
          settings: state.settings,
          profitHistory: state.profitHistory,
        }),
      }
    )
  )
);

export default useFlashLoanStore;
```

### Advanced Transaction Builder

```javascript
// src/services/advancedTransactionBuilder.js
import { TransactionBlock } from '@mysten/sui.js/transactions';

class AdvancedTransactionBuilder {
  constructor(client) {
    this.client = client;
    this.packageId = process.env.REACT_APP_PACKAGE_ID;
  }

  /**
   * Build complex multi-hop arbitrage transaction
   */
  buildMultiHopArbitrage(params) {
    const {
      poolId,
      amount,
      path,
      minProfit,
      maxGas,
      slippage,
    } = params;

    const tx = new TransactionBlock();
    tx.setGasBudget(maxGas);

    // Get clock object
    const clock = tx.sharedObjectRef({
      objectId: '0x6',
      initialSharedVersion: 1,
      mutable: false,
    });

    // Borrow from flash loan pool
    const [borrowedCoin, receipt] = tx.moveCall({
      target: `${this.packageId}::advanced_pool::borrow_advanced`,
      arguments: [
        tx.object(poolId),
        tx.pure(amount),
        clock,
      ],
      typeArguments: ['0x2::sui::SUI'],
    });

    // Execute arbitrage path
    let currentCoin = borrowedCoin;

    for (let i = 0; i < path.length; i++) {
      const hop = path[i];
      const minOutput = this.calculateMinOutput(
        hop.expectedOutput,
        slippage
      );

      currentCoin = tx.moveCall({
        target: `${hop.dexPackage}::swap::swap_exact_input`,
        arguments: [
          tx.object(hop.poolId),
          currentCoin,
          tx.pure(minOutput),
        ],
        typeArguments: hop.typeArgs,
      });
    }

    // Verify minimum profit
    const finalAmount = tx.moveCall({
      target: '0x2::coin::value',
      arguments: [currentCoin],
      typeArguments: ['0x2::sui::SUI'],
    });

    // Repay flash loan
    tx.moveCall({
      target: `${this.packageId}::advanced_pool::repay_advanced`,
      arguments: [
        tx.object(poolId),
        receipt,
        currentCoin,
        clock,
      ],
      typeArguments: ['0x2::sui::SUI'],
    });

    return tx;
  }

  /**
   * Build liquidation transaction
   */
  buildLiquidation(params) {
    const {
      poolId,
      amount,
      lendingProtocol,
      targetPosition,
      collateralToken,
      debtToken,
    } = params;

    const tx = new TransactionBlock();

    const clock = tx.sharedObjectRef({
      objectId: '0x6',
      initialSharedVersion: 1,
      mutable: false,
    });

    // Borrow flash loan
    const [borrowedCoin, receipt] = tx.moveCall({
      target: `${this.packageId}::advanced_pool::borrow_advanced`,
      arguments: [
        tx.object(poolId),
        tx.pure(amount),
        clock,
      ],
      typeArguments: [debtToken],
    });

    // Liquidate position
    const collateralCoin = tx.moveCall({
      target: `${lendingProtocol}::liquidation::liquidate`,
      arguments: [
        tx.object(targetPosition),
        borrowedCoin,
        tx.pure(amount),
      ],
      typeArguments: [collateralToken, debtToken],
    });

    // Swap collateral for debt token
    const repaymentCoin = tx.moveCall({
      target: `${params.dexPackage}::swap::swap_exact_input`,
      arguments: [
        tx.object(params.swapPoolId),
        collateralCoin,
        tx.pure(0),
      ],
      typeArguments: [collateralToken, debtToken],
    });

    // Repay flash loan
    tx.moveCall({
      target: `${this.packageId}::advanced_pool::repay_advanced`,
      arguments: [
        tx.object(poolId),
        receipt,
        repaymentCoin,
        clock,
      ],
      typeArguments: [debtToken],
    });

    return tx;
  }

  /**
   * Build batch arbitrage transaction
   */
  buildBatchArbitrage(opportunities) {
    const tx = new TransactionBlock();

    opportunities.forEach((opp) => {
      // Each opportunity is executed independently
      this.addArbitrageToTransaction(tx, opp);
    });

    return tx;
  }

  addArbitrageToTransaction(tx, opportunity) {
    const clock = tx.sharedObjectRef({
      objectId: '0x6',
      initialSharedVersion: 1,
      mutable: false,
    });

    const [coin, receipt] = tx.moveCall({
      target: `${this.packageId}::advanced_pool::borrow_advanced`,
      arguments: [
        tx.object(opportunity.poolId),
        tx.pure(opportunity.amount),
        clock,
      ],
      typeArguments: [opportunity.tokenType],
    });

    // Execute strategy
    const resultCoin = this.executeStrategy(tx, coin, opportunity.strategy);

    // Repay
    tx.moveCall({
      target: `${this.packageId}::advanced_pool::repay_advanced`,
      arguments: [
        tx.object(opportunity.poolId),
        receipt,
        resultCoin,
        clock,
      ],
      typeArguments: [opportunity.tokenType],
    });
  }

  executeStrategy(tx, coin, strategy) {
    // Strategy-specific execution logic
    switch (strategy.type) {
      case 'simple_swap':
        return this.executeSimpleSwap(tx, coin, strategy);
      case 'multi_hop':
        return this.executeMultiHop(tx, coin, strategy);
      default:
        return coin;
    }
  }

  executeSimpleSwap(tx, coin, strategy) {
    return tx.moveCall({
      target: `${strategy.dexPackage}::swap::swap_exact_input`,
      arguments: [
        tx.object(strategy.poolId),
        coin,
        tx.pure(strategy.minOutput),
      ],
      typeArguments: strategy.typeArgs,
    });
  }

  executeMultiHop(tx, coin, strategy) {
    let currentCoin = coin;

    strategy.hops.forEach((hop) => {
      currentCoin = tx.moveCall({
        target: `${hop.dexPackage}::swap::swap_exact_input`,
        arguments: [
          tx.object(hop.poolId),
          currentCoin,
          tx.pure(hop.minOutput),
        ],
        typeArguments: hop.typeArgs,
      });
    });

    return currentCoin;
  }

  calculateMinOutput(expectedOutput, slippage) {
    const slippageFactor = 1 - slippage / 100;
    return Math.floor(expectedOutput * slippageFactor);
  }

  /**
   * Estimate gas cost for transaction
   */
  async estimateGas(tx) {
    try {
      const dryRun = await this.client.client.dryRunTransactionBlock({
        transactionBlock: await tx.build({ client: this.client.client }),
      });

      return {
        computationCost: dryRun.effects.gasUsed.computationCost,
        storageCost: dryRun.effects.gasUsed.storageCost,
        storageRebate: dryRun.effects.gasUsed.storageRebate,
        totalCost:
          parseInt(dryRun.effects.gasUsed.computationCost) +
          parseInt(dryRun.effects.gasUsed.storageCost) -
          parseInt(dryRun.effects.gasUsed.storageRebate),
      };
    } catch (error) {
      console.error('Gas estimation failed:', error);
      return null;
    }
  }
}

export default AdvancedTransactionBuilder;
```

### Real-Time Price Monitor

```javascript
// src/services/priceMonitor.js
import { EventEmitter } from 'events';

class PriceMonitor extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.prices = new Map();
    this.subscriptions = new Map();
    this.updateInterval = 1000; // 1 second
  }

  /**
   * Start monitoring price for a token pair on multiple DEXs
   */
  async monitorPair(tokenA, tokenB, dexes) {
    const pairKey = `${tokenA}-${tokenB}`;

    if (this.subscriptions.has(pairKey)) {
      return; // Already monitoring
    }

    const interval = setInterval(async () => {
      try {
        const prices = await this.fetchPrices(tokenA, tokenB, dexes);
        this.prices.set(pairKey, prices);

        // Check for arbitrage opportunities
        const opportunity = this.findArbitrageOpportunity(prices);

        if (opportunity) {
          this.emit('opportunity', {
            pair: pairKey,
            ...opportunity,
          });
        }

        this.emit('priceUpdate', {
          pair: pairKey,
          prices,
          timestamp: Date.now(),
        });
      } catch (error) {
        console.error(`Failed to fetch prices for ${pairKey}:`, error);
      }
    }, this.updateInterval);

    this.subscriptions.set(pairKey, interval);
  }

  /**
   * Fetch prices from multiple DEXs
   */
  async fetchPrices(tokenA, tokenB, dexes) {
    const pricePromises = dexes.map(async (dex) => {
      try {
        const price = await this.fetchDexPrice(tokenA, tokenB, dex);
        return {
          dex: dex.name,
          price,
          liquidity: await this.fetchLiquidity(tokenA, tokenB, dex),
          timestamp: Date.now(),
        };
      } catch (error) {
        console.error(`Failed to fetch price from ${dex.name}:`, error);
        return null;
      }
    });

    const prices = await Promise.all(pricePromises);
    return prices.filter((p) => p !== null);
  }

  /**
   * Fetch price from a specific DEX
   */
  async fetchDexPrice(tokenA, tokenB, dex) {
    // Query the DEX pool for current price
    const poolObject = await this.client.client.getObject({
      id: dex.poolId,
      options: { showContent: true },
    });

    const poolData = poolObject.data.content.fields;

    // Calculate price from reserves (for constant product AMM)
    const reserveA = BigInt(poolData.reserve_a);
    const reserveB = BigInt(poolData.reserve_b);

    return Number(reserveB) / Number(reserveA);
  }

  /**
   * Fetch liquidity from pool
   */
  async fetchLiquidity(tokenA, tokenB, dex) {
    const poolObject = await this.client.client.getObject({
      id: dex.poolId,
      options: { showContent: true },
    });

    const poolData = poolObject.data.content.fields;
    return {
      tokenA: poolData.reserve_a,
      tokenB: poolData.reserve_b,
    };
  }

  /**
   * Find arbitrage opportunities
   */
  findArbitrageOpportunity(prices) {
    if (prices.length < 2) return null;

    // Find highest and lowest prices
    let lowestPrice = prices[0];
    let highestPrice = prices[0];

    prices.forEach((p) => {
      if (p.price < lowestPrice.price) lowestPrice = p;
      if (p.price > highestPrice.price) highestPrice = p;
    });

    // Calculate potential profit
    const priceDiff = highestPrice.price - lowestPrice.price;
    const profitPercentage = (priceDiff / lowestPrice.price) * 100;

    // Minimum 0.5% profit to account for fees and gas
    if (profitPercentage > 0.5) {
      return {
        buyDex: lowestPrice.dex,
        sellDex: highestPrice.dex,
        buyPrice: lowestPrice.price,
        sellPrice: highestPrice.price,
        profitPercentage,
        estimatedProfit: priceDiff,
      };
    }

    return null;
  }

  /**
   * Calculate optimal trade size
   */
  calculateOptimalSize(opportunity, maxAmount) {
    // Consider slippage and liquidity
    const buyLiquidity = opportunity.buyDex.liquidity;
    const sellLiquidity = opportunity.sellDex.liquidity;

    // Use smaller liquidity as constraint
    const maxLiquidity = Math.min(
      buyLiquidity.tokenA,
      sellLiquidity.tokenB
    );

    // Don't use more than 10% of available liquidity
    const liquidityConstraint = maxLiquidity * 0.1;

    return Math.min(maxAmount, liquidityConstraint);
  }

  /**
   * Stop monitoring a pair
   */
  stopMonitoring(tokenA, tokenB) {
    const pairKey = `${tokenA}-${tokenB}`;
    const interval = this.subscriptions.get(pairKey);

    if (interval) {
      clearInterval(interval);
      this.subscriptions.delete(pairKey);
      this.prices.delete(pairKey);
    }
  }

  /**
   * Stop all monitoring
   */
  stopAll() {
    this.subscriptions.forEach((interval) => clearInterval(interval));
    this.subscriptions.clear();
    this.prices.clear();
  }

  /**
   * Get current prices for a pair
   */
  getCurrentPrices(tokenA, tokenB) {
    const pairKey = `${tokenA}-${tokenB}`;
    return this.prices.get(pairKey) || [];
  }
}

export default PriceMonitor;
```

## Testing and Quality Assurance

### Comprehensive Move Tests

```move
#[test_only]
module flash_loan::advanced_pool_tests {
    use flash_loan::advanced_pool;
    use sui::test_scenario::{Self as ts};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use sui::test_utils;

    const ADMIN: address = @0xAD;
    const BORROWER: address = @0xB0;
    const EMERGENCY: address = @0xE0;

    #[test]
    fun test_pool_creation() {
        let mut scenario = ts::begin(ADMIN);

        ts::next_tx(&mut scenario, ADMIN);
        {
            let initial = coin::mint_for_testing<SUI>(1000000000, ts::ctx(&mut scenario));
            advanced_pool::create_advanced_pool(
                initial,
                30, // 0.3% base fee
                100000000, // max single loan
                1000000000, // daily limit
                EMERGENCY,
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, ADMIN);
        {
            let pool = ts::take_shared<advanced_pool::AdvancedPool<SUI>>(&scenario);
            let (balance, borrowed, repaid, count, fee) = advanced_pool::get_pool_metrics(&pool);

            assert!(balance == 1000000000, 0);
            assert!(borrowed == 0, 1);
            assert!(repaid == 0, 2);
            assert!(count == 0, 3);
            assert!(fee == 30, 4);

            ts::return_shared(pool);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_flash_loan_cycle() {
        let mut scenario = ts::begin(ADMIN);
        let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));

        // Create pool
        ts::next_tx(&mut scenario, ADMIN);
        {
            let initial = coin::mint_for_testing<SUI>(1000000000, ts::ctx(&mut scenario));
            advanced_pool::create_advanced_pool(
                initial,
                30,
                100000000,
                1000000000,
                EMERGENCY,
                ts::ctx(&mut scenario)
            );
        };

        // Borrow
        ts::next_tx(&mut scenario, BORROWER);
        {
            let mut pool = ts::take_shared<advanced_pool::AdvancedPool<SUI>>(&scenario);
            let (borrowed, receipt) = advanced_pool::borrow_advanced(
                &mut pool,
                100000000,
                &clock,
                ts::ctx(&mut scenario)
            );

            // Simulate arbitrage profit (2%)
            let profit = 2000000;
            let repayment_amount = coin::value(&borrowed) + profit;
            let repayment = coin::mint_for_testing<SUI>(
                repayment_amount,
                ts::ctx(&mut scenario)
            );

            coin::burn_for_testing(borrowed);

            advanced_pool::repay_advanced(
                &mut pool,
                receipt,
                repayment,
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_shared(pool);
        };

        // Verify pool state
        ts::next_tx(&mut scenario, ADMIN);
        {
            let pool = ts::take_shared<advanced_pool::AdvancedPool<SUI>>(&scenario);
            let (balance, borrowed, repaid, count, _) = advanced_pool::get_pool_metrics(&pool);

            assert!(borrowed == 100000000, 0);
            assert!(repaid > borrowed, 1); // Profit was added
            assert!(count == 1, 2);

            ts::return_shared(pool);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = advanced_pool::EPoolPaused)]
    fun test_paused_pool() {
        let mut scenario = ts::begin(ADMIN);
        let clock = clock::create_for_testing(ts::ctx(&mut scenario));

        ts::next_tx(&mut scenario, ADMIN);
        {
            let initial = coin::mint_for_testing<SUI>(1000000000, ts::ctx(&mut scenario));
            advanced_pool::create_advanced_pool(
                initial,
                30,
                100000000,
                1000000000,
                EMERGENCY,
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut pool = ts::take_shared<advanced_pool::AdvancedPool<SUI>>(&scenario);
            advanced_pool::pause_pool(&mut pool, ts::ctx(&mut scenario));
            ts::return_shared(pool);
        };

        ts::next_tx(&mut scenario, BORROWER);
        {
            let mut pool = ts::take_shared<advanced_pool::AdvancedPool<SUI>>(&scenario);
            let (_borrowed, _receipt) = advanced_pool::borrow_advanced(
                &mut pool,
                100000000,
                &clock,
                ts::ctx(&mut scenario)
            );
            ts::return_shared(pool);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
```

### Frontend Integration Tests

```javascript
// src/__tests__/FlashLoanIntegration.test.js
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { SuiClient } from '@mysten/sui.js/client';
import { Ed25519Keypair } from '@mysten/sui.js/keypairs/ed25519';
import SuiFlashLoanClient from '../services/suiClient';
import AdvancedTransactionBuilder from '../services/advancedTransactionBuilder';

describe('Flash Loan Integration Tests', () => {
  let client;
  let keypair;
  let txBuilder;

  beforeEach(async () => {
    keypair = Ed25519Keypair.generate();
    client = new SuiFlashLoanClient('testnet');
    txBuilder = new AdvancedTransactionBuilder(client);

    // Fund test account
    await fundAccount(keypair.getPublicKey().toSuiAddress());
  });

  afterEach(() => {
    client.stopAll();
  });

  it('should fetch pool information', async () => {
    const poolInfo = await client.getPoolInfo();

    expect(poolInfo).toBeDefined();
    expect(poolInfo.balance).toBeGreaterThan(0);
    expect(poolInfo.feeRate).toBeGreaterThan(0);
  });

  it('should build valid flash loan transaction', async () => {
    const amount = 1000000000; // 1 SUI
    const strategy = {
      type: 'dex_arbitrage',
      dex1: {
        packageId: '0x123',
        poolId: '0x456',
      },
      dex2: {
        packageId: '0x789',
        poolId: '0xabc',
      },
      tokenPath: ['0x2::sui::SUI', '0x2::sui::SUI'],
    };

    const tx = await client.executeFlashLoan(
      keypair.getPublicKey().toSuiAddress(),
      amount,
      strategy
    );

    expect(tx).toBeDefined();
    expect(tx.blockData).toBeDefined();
  });

  it('should estimate gas correctly', async () => {
    const tx = txBuilder.buildMultiHopArbitrage({
      poolId: process.env.REACT_APP_POOL_OBJECT_ID,
      amount: 1000000000,
      path: [],
      minProfit: 10000,
      maxGas: 1000000,
      slippage: 0.5,
    });

    const gasEstimate = await txBuilder.estimateGas(tx);

    expect(gasEstimate).toBeDefined();
    expect(gasEstimate.totalCost).toBeGreaterThan(0);
  });

  it('should detect arbitrage opportunities', async () => {
    const prices = [
      { dex: 'DEX1', price: 1.0, liquidity: { tokenA: 1000000, tokenB: 1000000 } },
      { dex: 'DEX2', price: 1.02, liquidity: { tokenA: 1000000, tokenB: 1020000 } },
    ];

    const monitor = new PriceMonitor(client);
    const opportunity = monitor.findArbitrageOpportunity(prices);

    expect(opportunity).toBeDefined();
    expect(opportunity.profitPercentage).toBeGreaterThan(0.5);
    expect(opportunity.buyDex).toBe('DEX1');
    expect(opportunity.sellDex).toBe('DEX2');
  });
});

async function fundAccount(address) {
  // Request test tokens from faucet
  // Implementation depends on testnet faucet API
}
```

## Performance Monitoring

### Transaction Analytics

```javascript
// src/services/analytics.js
class FlashLoanAnalytics {
  constructor() {
    this.metrics = {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalProfit: 0,
      totalGasSpent: 0,
      averageExecutionTime: 0,
      profitByStrategy: new Map(),
    };
  }

  recordExecution(result) {
    this.metrics.totalExecutions++;

    if (result.success) {
      this.metrics.successfulExecutions++;
      this.metrics.totalProfit += result.profit;

      const strategyProfit = this.metrics.profitByStrategy.get(result.strategy) || 0;
      this.metrics.profitByStrategy.set(result.strategy, strategyProfit + result.profit);
    } else {
      this.metrics.failedExecutions++;
    }

    this.metrics.totalGasSpent += result.gasUsed;
    this.updateAverageExecutionTime(result.executionTime);
  }

  updateAverageExecutionTime(newTime) {
    const { totalExecutions, averageExecutionTime } = this.metrics;
    this.metrics.averageExecutionTime =
      (averageExecutionTime * (totalExecutions - 1) + newTime) / totalExecutions;
  }

  getSuccessRate() {
    return (this.metrics.successfulExecutions / this.metrics.totalExecutions) * 100;
  }

  getNetProfit() {
    return this.metrics.totalProfit - this.metrics.totalGasSpent;
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.getSuccessRate(),
      netProfit: this.getNetProfit(),
    };
  }

  exportData() {
    return JSON.stringify(this.metrics, null, 2);
  }
}

export default FlashLoanAnalytics;
```

This comprehensive developer documentation provides all the tools and patterns needed to build, test, and deploy production-ready flash loan applications on the Sui blockchain.
