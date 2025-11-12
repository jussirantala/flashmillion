**Source:** https://github.com/gweidart/evm-flashswap-arb
**Date:** November 2022

# EVM Flash Swap Arbitrage: Deep Developer Documentation

## Deep Architecture Analysis

### Flash Swap Mechanism Deep Dive

Flash swaps in Uniswap V2 work fundamentally different from external flash loans:

```
Traditional Flash Loan Flow:
┌──────────────────────────────────────────────┐
│ 1. Call flashLoan() on lending protocol     │
│ 2. Receive borrowed tokens                  │
│ 3. Execute arbitrary logic                  │
│ 4. Repay loan + fee to lending protocol     │
│ 5. Protocol verifies repayment               │
└──────────────────────────────────────────────┘

Flash Swap Flow:
┌──────────────────────────────────────────────┐
│ 1. Call swap() on Uniswap pair              │
│ 2. Receive tokens BEFORE payment            │
│ 3. Pair calls uniswapV2Call() on receiver   │
│ 4. Execute arbitrage in callback            │
│ 5. Transfer repayment to pair               │
│ 6. Pair verifies reserves increased         │
└──────────────────────────────────────────────┘
```

**Key Difference:** Flash swap uses the swap callback mechanism, avoiding external protocol dependencies.

### Mathematical Foundation

#### Constant Product Formula

Uniswap V2 pools maintain the invariant:

```
x * y = k

Where:
x = reserve of token X
y = reserve of token Y
k = constant product
```

#### Swap Output Calculation

With fees (0.3% = 997/1000):

```
Δy = (Δx * 997 * y) / (x * 1000 + Δx * 997)

Where:
Δx = input amount
Δy = output amount
x, y = current reserves
```

#### Optimal Arbitrage Size Derivation

**Setup:**
```
Pool A: reserves (x₁, y₁)
Pool B: reserves (x₂, y₂)

We flash swap Δx from Pool A
Get Δy₁ tokens from Pool A
Swap Δy₁ on Pool B
Get Δy₂ tokens from Pool B
Use Δy₂ to repay Pool A
```

**Profit Function:**
```
P(Δx) = Δy₂ - repayment

Where repayment = Δx * 1000 / 997 (inverse of swap formula)
```

**Calculate Δy₁ (output from Pool A):**
```
Δy₁ = (Δx * 997 * y₁) / (x₁ * 1000 + Δx * 997)
```

**Calculate Δy₂ (output from Pool B, input = Δy₁):**
```
Δy₂ = (Δy₁ * 997 * x₂) / (y₂ * 1000 + Δy₁ * 997)
```

**Substitute Δy₁ into Δy₂:**
```
Δy₂ = ((Δx * 997 * y₁) / (x₁ * 1000 + Δx * 997)) * 997 * x₂ / (y₂ * 1000 + ((Δx * 997 * y₁) / (x₁ * 1000 + Δx * 997)) * 997)
```

**Profit Function:**
```
P(Δx) = Δy₂ - (Δx * 1000 / 997)
```

**Find Maximum (take derivative, set to zero):**
```
dP/dΔx = 0

After significant algebra:

Δx* = sqrt((x₁ * y₁ * x₂ * y₂ * 1000000) / (997 * 997)) - x₁

Simplified:
Δx* = sqrt(x₁ * y₁ * x₂ * y₂ / 0.994009) - x₁
```

**Further simplification (approximate):**
```
Δx* ≈ sqrt(x₁ * y₂) - x₁

(When pools have similar liquidity and price impact is small)
```

## Code Structure and Organization

### Project Layout

```
evm-flashswap-arb/
├── contracts/
│   ├── FlashSwapArbitrage.sol       # Main arbitrage contract
│   ├── interfaces/
│   │   ├── IUniswapV2Pair.sol       # Pair interface
│   │   ├── IUniswapV2Factory.sol    # Factory interface
│   │   ├── IUniswapV2Router02.sol   # Router interface
│   │   └── IERC20.sol               # Token interface
│   └── test/
│       └── MockPair.sol             # Testing mock
│
├── src/
│   ├── index.ts                     # Entry point
│   ├── config.ts                    # Configuration
│   ├── types.ts                     # TypeScript types
│   │
│   ├── core/
│   │   ├── PairMonitor.ts           # Pool monitoring
│   │   ├── ArbitrageCalculator.ts   # Optimization math
│   │   ├── OpportunityFinder.ts     # Opportunity detection
│   │   └── Executor.ts              # Transaction execution
│   │
│   ├── utils/
│   │   ├── math.ts                  # Math utilities
│   │   ├── blockchain.ts            # Blockchain helpers
│   │   ├── logger.ts                # Logging
│   │   └── formatters.ts            # Data formatting
│   │
│   └── services/
│       ├── PriceService.ts          # Price fetching
│       ├── GasEstimator.ts          # Gas estimation
│       └── TransactionService.ts    # TX management
│
├── scripts/
│   ├── deploy.ts                    # Deployment script
│   ├── verify.ts                    # Contract verification
│   └── withdraw.ts                  # Withdraw profits
│
├── test/
│   ├── FlashSwapArbitrage.test.ts   # Contract tests
│   ├── ArbitrageCalculator.test.ts  # Math tests
│   └── integration.test.ts          # Integration tests
│
├── hardhat.config.ts
├── package.json
├── tsconfig.json
└── .env.example
```

## Smart Contract Implementation

### Main Arbitrage Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./interfaces/IUniswapV2Factory.sol";

contract FlashSwapArbitrage is Ownable {
    // Events
    event ArbitrageExecuted(
        address indexed borrowPool,
        address indexed arbPool,
        uint256 borrowAmount,
        uint256 profit
    );

    event ProfitWithdrawn(address indexed token, uint256 amount);

    // State variables
    address public immutable factory;
    address public immutable WETH;

    // Struct to pass data in flash swap callback
    struct ArbitrageParams {
        address arbPool;        // Pool to arbitrage on
        address token0;         // First token
        address token1;         // Second token
        uint256 amountBorrowed; // Amount borrowed
        bool isToken0;          // Direction of initial swap
    }

    constructor(address _factory, address _weth) {
        factory = _factory;
        WETH = _weth;
    }

    /**
     * @notice Initiate flash swap arbitrage
     * @param borrowPool Pool to borrow from (flash swap)
     * @param arbPool Pool to execute arbitrage on
     * @param borrowAmount Amount to borrow via flash swap
     * @param isToken0 True if borrowing token0, false if borrowing token1
     */
    function executeArbitrage(
        address borrowPool,
        address arbPool,
        uint256 borrowAmount,
        bool isToken0
    ) external onlyOwner {
        // Verify pools exist and are valid
        require(borrowPool != address(0), "Invalid borrow pool");
        require(arbPool != address(0), "Invalid arb pool");
        require(borrowPool != arbPool, "Pools must be different");

        // Get token addresses
        IUniswapV2Pair pair = IUniswapV2Pair(borrowPool);
        address token0 = pair.token0();
        address token1 = pair.token1();

        // Encode arbitrage parameters
        bytes memory data = abi.encode(
            ArbitrageParams({
                arbPool: arbPool,
                token0: token0,
                token1: token1,
                amountBorrowed: borrowAmount,
                isToken0: isToken0
            })
        );

        // Initiate flash swap
        // Specify amount for token we want to borrow
        (uint256 amount0Out, uint256 amount1Out) = isToken0
            ? (borrowAmount, uint256(0))
            : (uint256(0), borrowAmount);

        // This will trigger uniswapV2Call callback
        pair.swap(amount0Out, amount1Out, address(this), data);
    }

    /**
     * @notice Uniswap V2 flash swap callback
     * @dev Called by Uniswap pair during swap
     */
    function uniswapV2Call(
        address sender,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external {
        // === SECURITY CHECKS ===

        // 1. Verify caller is a legitimate Uniswap pair
        address token0 = IUniswapV2Pair(msg.sender).token0();
        address token1 = IUniswapV2Pair(msg.sender).token1();
        address pair = pairFor(factory, token0, token1);
        require(msg.sender == pair, "Unauthorized: Invalid pair");

        // 2. Verify sender is this contract
        require(sender == address(this), "Unauthorized: Invalid sender");

        // === DECODE PARAMETERS ===
        ArbitrageParams memory params = abi.decode(data, (ArbitrageParams));

        // === EXECUTE ARBITRAGE ===

        // Determine which token we borrowed
        address tokenBorrowed = params.isToken0 ? params.token0 : params.token1;
        address tokenReceived = params.isToken0 ? params.token1 : params.token0;
        uint256 amountBorrowed = params.amountBorrowed;

        // Approve arbitrage pool to spend borrowed tokens
        IERC20(tokenBorrowed).approve(params.arbPool, amountBorrowed);

        // Execute swap on arbitrage pool
        uint256 amountReceived = _executeSwapOnPool(
            params.arbPool,
            tokenBorrowed,
            tokenReceived,
            amountBorrowed
        );

        // === CALCULATE REPAYMENT ===

        // Uniswap V2 requires repayment that maintains x * y >= k
        // For 0.3% fee: repayment = (borrowed * 1000 / 997) + 1
        uint256 amountToRepay = (amountBorrowed * 1000) / 997 + 1;

        // === VERIFY PROFITABILITY ===
        require(amountReceived > amountToRepay, "No profit");

        // === REPAY FLASH SWAP ===
        IERC20(tokenReceived).transfer(msg.sender, amountToRepay);

        // === EMIT EVENT ===
        uint256 profit = amountReceived - amountToRepay;
        emit ArbitrageExecuted(msg.sender, params.arbPool, amountBorrowed, profit);

        // Profit remains in contract (can be withdrawn by owner)
    }

    /**
     * @notice Execute swap on specified pool
     * @dev Internal function to perform swap
     */
    function _executeSwapOnPool(
        address pool,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256 amountOut) {
        IUniswapV2Pair pair = IUniswapV2Pair(pool);

        // Determine token order
        (address token0, ) = sortTokens(tokenIn, tokenOut);
        bool isToken0 = tokenIn == token0;

        // Transfer tokens to pair
        IERC20(tokenIn).transfer(pool, amountIn);

        // Get reserves
        (uint112 reserve0, uint112 reserve1, ) = pair.getReserves();
        (uint112 reserveIn, uint112 reserveOut) = isToken0
            ? (reserve0, reserve1)
            : (reserve1, reserve0);

        // Calculate output amount
        amountOut = getAmountOut(amountIn, reserveIn, reserveOut);

        // Execute swap
        (uint256 amount0Out, uint256 amount1Out) = isToken0
            ? (uint256(0), amountOut)
            : (amountOut, uint256(0));

        pair.swap(amount0Out, amount1Out, address(this), "");
    }

    /**
     * @notice Calculate output amount using constant product formula
     * @dev Includes 0.3% fee
     */
    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) public pure returns (uint256 amountOut) {
        require(amountIn > 0, "Insufficient input amount");
        require(reserveIn > 0 && reserveOut > 0, "Insufficient liquidity");

        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;

        amountOut = numerator / denominator;
    }

    /**
     * @notice Calculate pair address deterministically
     * @dev Uses CREATE2 formula
     */
    function pairFor(
        address _factory,
        address tokenA,
        address tokenB
    ) public pure returns (address pair) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);

        pair = address(
            uint160(
                uint256(
                    keccak256(
                        abi.encodePacked(
                            hex"ff",
                            _factory,
                            keccak256(abi.encodePacked(token0, token1)),
                            hex"96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f" // init code hash
                        )
                    )
                )
            )
        );
    }

    /**
     * @notice Sort tokens by address
     */
    function sortTokens(address tokenA, address tokenB)
        internal
        pure
        returns (address token0, address token1)
    {
        require(tokenA != tokenB, "Identical addresses");
        (token0, token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "Zero address");
    }

    /**
     * @notice Withdraw profits
     * @dev Only owner can withdraw
     */
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        require(amount > 0, "Amount must be > 0");

        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance >= amount, "Insufficient balance");

        IERC20(token).transfer(owner(), amount);

        emit ProfitWithdrawn(token, amount);
    }

    /**
     * @notice Withdraw ETH
     */
    function withdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");

        payable(owner()).transfer(balance);
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
```

### Security Considerations in Contract

**1. Caller Verification:**
```solidity
// Verify caller is legitimate Uniswap pair
address token0 = IUniswapV2Pair(msg.sender).token0();
address token1 = IUniswapV2Pair(msg.sender).token1();
address pair = pairFor(factory, token0, token1);
require(msg.sender == pair, "Unauthorized: Invalid pair");
```

**Why:** Prevents malicious contracts from calling the callback and draining funds.

**2. Sender Verification:**
```solidity
require(sender == address(this), "Unauthorized: Invalid sender");
```

**Why:** Ensures the flash swap was initiated by this contract, not an external attacker.

**3. Profitability Check:**
```solidity
require(amountReceived > amountToRepay, "No profit");
```

**Why:** Prevents executing unprofitable trades that would lose gas fees.

**4. Overflow Protection:**
```solidity
// Using Solidity 0.8.x which has built-in overflow checks
uint256 amountToRepay = (amountBorrowed * 1000) / 997 + 1;
```

**Why:** Prevents integer overflow attacks.

## TypeScript Bot Implementation

### Arbitrage Calculator (Mathematical Optimizer)

```typescript
import { BigNumber } from 'ethers';
import { sqrt, min } from './math';

export interface Pool {
    address: string;
    token0: string;
    token1: string;
    reserve0: BigNumber;
    reserve1: BigNumber;
}

export interface ArbitrageOpportunity {
    borrowPool: Pool;
    arbPool: Pool;
    tokenBorrowed: string;
    tokenReceived: string;
    optimalAmount: BigNumber;
    expectedProfit: BigNumber;
    gasEstimate: BigNumber;
    netProfit: BigNumber;
}

export class ArbitrageCalculator {
    private readonly FEE_NUMERATOR = 997;
    private readonly FEE_DENOMINATOR = 1000;

    /**
     * Calculate optimal arbitrage amount using quadratic formula
     */
    calculateOptimalAmount(pool1: Pool, pool2: Pool, isToken0: boolean): BigNumber {
        // Get reserves based on direction
        const [r1In, r1Out] = isToken0
            ? [pool1.reserve0, pool1.reserve1]
            : [pool1.reserve1, pool1.reserve0];

        const [r2In, r2Out] = isToken0
            ? [pool2.reserve1, pool2.reserve0]
            : [pool2.reserve0, pool2.reserve1];

        // Calculate: sqrt((r1In * r1Out * r2In * r2Out) / (fee_factor)) - r1In
        const numerator = r1In.mul(r1Out).mul(r2In).mul(r2Out);

        // fee_factor = (997/1000)^2 = 994009/1000000
        const feeFactor = BigNumber.from(994009);
        const feeScale = BigNumber.from(1000000);

        const sqrtArg = numerator.mul(feeScale).div(feeFactor);
        const sqrtResult = sqrt(sqrtArg);

        const optimal = sqrtResult.sub(r1In);

        // Safety: cap at 90% of pool liquidity
        const maxAmount = r1In.mul(90).div(100);

        return optimal.gt(maxAmount) ? maxAmount : optimal;
    }

    /**
     * Calculate expected profit for given trade amount
     */
    calculateProfit(
        pool1: Pool,
        pool2: Pool,
        amount: BigNumber,
        isToken0: boolean
    ): BigNumber {
        // Step 1: Calculate output from pool1 (flash swap)
        const [r1In, r1Out] = isToken0
            ? [pool1.reserve0, pool1.reserve1]
            : [pool1.reserve1, pool1.reserve0];

        const output1 = this.getAmountOut(amount, r1In, r1Out);

        // Step 2: Calculate output from pool2 (arbitrage)
        const [r2In, r2Out] = isToken0
            ? [pool2.reserve1, pool2.reserve0]
            : [pool2.reserve0, pool2.reserve1];

        const output2 = this.getAmountOut(output1, r2In, r2Out);

        // Step 3: Calculate repayment
        const repayment = this.calculateRepayment(amount);

        // Step 4: Calculate profit
        const profit = output2.sub(repayment);

        return profit;
    }

    /**
     * Calculate output using constant product formula with fees
     */
    getAmountOut(amountIn: BigNumber, reserveIn: BigNumber, reserveOut: BigNumber): BigNumber {
        if (amountIn.isZero() || reserveIn.isZero() || reserveOut.isZero()) {
            return BigNumber.from(0);
        }

        const amountInWithFee = amountIn.mul(this.FEE_NUMERATOR);
        const numerator = amountInWithFee.mul(reserveOut);
        const denominator = reserveIn.mul(this.FEE_DENOMINATOR).add(amountInWithFee);

        return numerator.div(denominator);
    }

    /**
     * Calculate flash swap repayment amount
     */
    calculateRepayment(amountBorrowed: BigNumber): BigNumber {
        // Repayment = (borrowed * 1000 / 997) + 1
        return amountBorrowed.mul(this.FEE_DENOMINATOR).div(this.FEE_NUMERATOR).add(1);
    }

    /**
     * Find arbitrage opportunity between two pools
     */
    findOpportunity(
        pool1: Pool,
        pool2: Pool,
        gasPrice: BigNumber,
        minProfitWei: BigNumber
    ): ArbitrageOpportunity | null {
        // Check both directions
        const directions = [
            { isToken0: true, tokenBorrowed: pool1.token0, tokenReceived: pool1.token1 },
            { isToken0: false, tokenBorrowed: pool1.token1, tokenReceived: pool1.token0 },
        ];

        for (const direction of directions) {
            // Calculate optimal amount
            const optimalAmount = this.calculateOptimalAmount(
                pool1,
                pool2,
                direction.isToken0
            );

            // Calculate expected profit
            const expectedProfit = this.calculateProfit(
                pool1,
                pool2,
                optimalAmount,
                direction.isToken0
            );

            // Estimate gas cost
            const gasEstimate = BigNumber.from(180000); // Typical flash swap arbitrage
            const gasCost = gasEstimate.mul(gasPrice);

            // Calculate net profit
            const netProfit = expectedProfit.sub(gasCost);

            // Check if profitable
            if (netProfit.gt(minProfitWei)) {
                return {
                    borrowPool: pool1,
                    arbPool: pool2,
                    tokenBorrowed: direction.tokenBorrowed,
                    tokenReceived: direction.tokenReceived,
                    optimalAmount,
                    expectedProfit,
                    gasEstimate,
                    netProfit,
                };
            }
        }

        return null;
    }
}
```

### Square Root Implementation

```typescript
import { BigNumber } from 'ethers';

/**
 * Calculate integer square root using Newton's method
 * @param value Value to calculate sqrt of
 * @returns Square root (floor)
 */
export function sqrt(value: BigNumber): BigNumber {
    if (value.isZero()) {
        return BigNumber.from(0);
    }

    if (value.lt(4)) {
        return BigNumber.from(1);
    }

    // Initial guess: value / 2
    let z = value.div(2);
    let x = value;

    // Newton's method: x_{n+1} = (x_n + value / x_n) / 2
    while (z.lt(x)) {
        x = z;
        z = value.div(x).add(x).div(2);
    }

    return x;
}

/**
 * Alternative: Binary search square root
 */
export function sqrtBinarySearch(value: BigNumber): BigNumber {
    if (value.isZero()) {
        return BigNumber.from(0);
    }

    let left = BigNumber.from(1);
    let right = value;

    while (left.lte(right)) {
        const mid = left.add(right).div(2);
        const midSquared = mid.mul(mid);

        if (midSquared.eq(value)) {
            return mid;
        } else if (midSquared.lt(value)) {
            left = mid.add(1);
        } else {
            right = mid.sub(1);
        }
    }

    return right;
}
```

### Opportunity Finder

```typescript
import { Contract, providers } from 'ethers';
import { ArbitrageCalculator, ArbitrageOpportunity, Pool } from './ArbitrageCalculator';

export class OpportunityFinder {
    private calculator: ArbitrageCalculator;
    private provider: providers.Provider;
    private minProfitWei: BigNumber;

    constructor(provider: providers.Provider, minProfitWei: BigNumber) {
        this.calculator = new ArbitrageCalculator();
        this.provider = provider;
        this.minProfitWei = minProfitWei;
    }

    /**
     * Scan for arbitrage opportunities across all pool pairs
     */
    async findOpportunities(pools: Pool[]): Promise<ArbitrageOpportunity[]> {
        const opportunities: ArbitrageOpportunity[] = [];

        // Get current gas price
        const gasPrice = await this.provider.getGasPrice();

        // Compare all pool pairs
        for (let i = 0; i < pools.length; i++) {
            for (let j = i + 1; j < pools.length; j++) {
                const pool1 = pools[i];
                const pool2 = pools[j];

                // Check if pools trade the same token pair
                if (this.haveSameTokens(pool1, pool2)) {
                    // Try pool1 -> pool2
                    const opp1 = this.calculator.findOpportunity(
                        pool1,
                        pool2,
                        gasPrice,
                        this.minProfitWei
                    );

                    if (opp1) {
                        opportunities.push(opp1);
                    }

                    // Try pool2 -> pool1
                    const opp2 = this.calculator.findOpportunity(
                        pool2,
                        pool1,
                        gasPrice,
                        this.minProfitWei
                    );

                    if (opp2) {
                        opportunities.push(opp2);
                    }
                }
            }
        }

        // Sort by net profit (highest first)
        opportunities.sort((a, b) => (b.netProfit.gt(a.netProfit) ? 1 : -1));

        return opportunities;
    }

    /**
     * Check if two pools trade the same tokens
     */
    private haveSameTokens(pool1: Pool, pool2: Pool): boolean {
        return (
            (pool1.token0 === pool2.token0 && pool1.token1 === pool2.token1) ||
            (pool1.token0 === pool2.token1 && pool1.token1 === pool2.token0)
        );
    }

    /**
     * Refresh pool data from blockchain
     */
    async refreshPools(pools: Pool[]): Promise<Pool[]> {
        const PAIR_ABI = [
            'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
            'function token0() external view returns (address)',
            'function token1() external view returns (address)',
        ];

        const refreshPromises = pools.map(async (pool) => {
            const pairContract = new Contract(pool.address, PAIR_ABI, this.provider);

            const [reserves, token0, token1] = await Promise.all([
                pairContract.getReserves(),
                pairContract.token0(),
                pairContract.token1(),
            ]);

            return {
                address: pool.address,
                token0,
                token1,
                reserve0: reserves.reserve0,
                reserve1: reserves.reserve1,
            };
        });

        return Promise.all(refreshPromises);
    }
}
```

### Transaction Executor

```typescript
import { Contract, Wallet, providers, BigNumber } from 'ethers';
import { ArbitrageOpportunity } from './ArbitrageCalculator';

export class ArbitrageExecutor {
    private contract: Contract;
    private wallet: Wallet;
    private provider: providers.Provider;

    constructor(contractAddress: string, wallet: Wallet, provider: providers.Provider) {
        const ABI = [
            'function executeArbitrage(address borrowPool, address arbPool, uint256 borrowAmount, bool isToken0) external',
        ];

        this.wallet = wallet;
        this.provider = provider;
        this.contract = new Contract(contractAddress, ABI, wallet);
    }

    /**
     * Execute arbitrage opportunity
     */
    async execute(opportunity: ArbitrageOpportunity): Promise<string> {
        const isToken0 = opportunity.tokenBorrowed === opportunity.borrowPool.token0;

        // Estimate gas
        const gasEstimate = await this.contract.estimateGas.executeArbitrage(
            opportunity.borrowPool.address,
            opportunity.arbPool.address,
            opportunity.optimalAmount,
            isToken0
        );

        // Add 20% buffer to gas estimate
        const gasLimit = gasEstimate.mul(120).div(100);

        // Get current gas price
        const gasPrice = await this.provider.getGasPrice();

        // Build transaction
        const tx = await this.contract.executeArbitrage(
            opportunity.borrowPool.address,
            opportunity.arbPool.address,
            opportunity.optimalAmount,
            isToken0,
            {
                gasLimit,
                gasPrice,
            }
        );

        console.log(`Transaction submitted: ${tx.hash}`);

        // Wait for confirmation
        const receipt = await tx.wait();

        console.log(`Transaction confirmed in block ${receipt.blockNumber}`);
        console.log(`Gas used: ${receipt.gasUsed.toString()}`);

        return tx.hash;
    }

    /**
     * Simulate arbitrage before execution
     */
    async simulate(opportunity: ArbitrageOpportunity): Promise<boolean> {
        try {
            const isToken0 = opportunity.tokenBorrowed === opportunity.borrowPool.token0;

            await this.contract.callStatic.executeArbitrage(
                opportunity.borrowPool.address,
                opportunity.arbPool.address,
                opportunity.optimalAmount,
                isToken0
            );

            return true;
        } catch (error) {
            console.error('Simulation failed:', error);
            return false;
        }
    }
}
```

### Main Bot Loop

```typescript
import { ethers } from 'ethers';
import { OpportunityFinder } from './OpportunityFinder';
import { ArbitrageExecutor } from './ArbitrageExecutor';
import { PairMonitor } from './PairMonitor';

async function main() {
    // Setup
    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

    const pairMonitor = new PairMonitor(provider, process.env.FACTORY_ADDRESS!);
    const opportunityFinder = new OpportunityFinder(
        provider,
        ethers.utils.parseEther(process.env.MIN_PROFIT_ETH!)
    );
    const executor = new ArbitrageExecutor(
        process.env.CONTRACT_ADDRESS!,
        wallet,
        provider
    );

    console.log('Bot started');
    console.log('Wallet:', wallet.address);
    console.log('Contract:', process.env.CONTRACT_ADDRESS);

    // Discover pairs
    console.log('Discovering pairs...');
    let pools = await pairMonitor.discoverPairs();
    console.log(`Found ${pools.length} pairs`);

    // Main loop
    while (true) {
        try {
            // Refresh pool data
            pools = await opportunityFinder.refreshPools(pools);

            // Find opportunities
            const opportunities = await opportunityFinder.findOpportunities(pools);

            if (opportunities.length > 0) {
                console.log(`Found ${opportunities.length} opportunities`);

                for (const opp of opportunities) {
                    console.log(`Potential profit: ${ethers.utils.formatEther(opp.netProfit)} ETH`);

                    // Simulate first
                    const simulationSuccess = await executor.simulate(opp);

                    if (simulationSuccess) {
                        console.log('Simulation successful, executing...');

                        // Execute
                        const txHash = await executor.execute(opp);
                        console.log(`Executed: ${txHash}`);

                        // Wait before next execution
                        await sleep(5000);
                    } else {
                        console.log('Simulation failed, skipping');
                    }
                }
            }

            // Wait before next scan
            await sleep(parseInt(process.env.SCAN_INTERVAL_MS!));
        } catch (error) {
            console.error('Error in main loop:', error);
            await sleep(5000);
        }
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch(console.error);
```

## Testing Strategy

### Unit Tests (Solidity)

```typescript
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Contract } from 'ethers';

describe('FlashSwapArbitrage', function () {
    let flashSwap: Contract;
    let mockPair1: Contract;
    let mockPair2: Contract;

    beforeEach(async function () {
        // Deploy contracts
        const FlashSwap = await ethers.getContractFactory('FlashSwapArbitrage');
        flashSwap = await FlashSwap.deploy(FACTORY_ADDRESS, WETH_ADDRESS);

        // Deploy mock pairs
        const MockPair = await ethers.getContractFactory('MockPair');
        mockPair1 = await MockPair.deploy(TOKEN_A, TOKEN_B, RESERVE_A, RESERVE_B);
        mockPair2 = await MockPair.deploy(TOKEN_A, TOKEN_B, RESERVE_A * 1.1, RESERVE_B * 0.9);
    });

    it('Should calculate correct output amount', async function () {
        const amountIn = ethers.utils.parseEther('1');
        const reserveIn = ethers.utils.parseEther('100');
        const reserveOut = ethers.utils.parseEther('100');

        const amountOut = await flashSwap.getAmountOut(amountIn, reserveIn, reserveOut);

        // Expected: (1 * 997 * 100) / (100 * 1000 + 1 * 997) ≈ 0.996 ETH
        expect(amountOut).to.be.closeTo(ethers.utils.parseEther('0.996'), ethers.utils.parseEther('0.001'));
    });

    it('Should execute profitable arbitrage', async function () {
        const borrowAmount = ethers.utils.parseEther('10');

        await flashSwap.executeArbitrage(mockPair1.address, mockPair2.address, borrowAmount, true);

        // Verify profit was realized (check contract balance)
        const balance = await tokenA.balanceOf(flashSwap.address);
        expect(balance).to.be.gt(0);
    });

    it('Should revert on unprofitable arbitrage', async function () {
        // Set equal reserves (no arbitrage opportunity)
        await mockPair2.setReserves(RESERVE_A, RESERVE_B);

        const borrowAmount = ethers.utils.parseEther('10');

        await expect(
            flashSwap.executeArbitrage(mockPair1.address, mockPair2.address, borrowAmount, true)
        ).to.be.revertedWith('No profit');
    });
});
```

### Integration Tests (TypeScript)

```typescript
import { expect } from 'chai';
import { ArbitrageCalculator } from '../src/ArbitrageCalculator';
import { ethers } from 'ethers';

describe('ArbitrageCalculator', function () {
    let calculator: ArbitrageCalculator;

    beforeEach(function () {
        calculator = new ArbitrageCalculator();
    });

    it('Should calculate optimal amount correctly', function () {
        const pool1 = {
            reserve0: ethers.utils.parseEther('100'),
            reserve1: ethers.utils.parseEther('100'),
        };

        const pool2 = {
            reserve0: ethers.utils.parseEther('110'),
            reserve1: ethers.utils.parseEther('90'),
        };

        const optimal = calculator.calculateOptimalAmount(pool1, pool2, true);

        // Verify optimal is reasonable
        expect(optimal).to.be.gt(0);
        expect(optimal).to.be.lt(pool1.reserve0.mul(90).div(100)); // Less than 90% of liquidity
    });

    it('Should calculate profit correctly', function () {
        const pool1 = createMockPool(100, 100);
        const pool2 = createMockPool(110, 90);

        const amount = ethers.utils.parseEther('10');
        const profit = calculator.calculateProfit(pool1, pool2, amount, true);

        expect(profit).to.be.gt(0);
    });
});
```

## Performance Optimization

### Batch RPC Calls

```typescript
import { ethers } from 'ethers';

async function batchGetReserves(pairAddresses: string[], provider: ethers.providers.Provider) {
    const PAIR_ABI = ['function getReserves() view returns (uint112, uint112, uint32)'];

    const multicall = new ethers.Contract(MULTICALL_ADDRESS, MULTICALL_ABI, provider);

    const calls = pairAddresses.map((address) => ({
        target: address,
        callData: new ethers.utils.Interface(PAIR_ABI).encodeFunctionData('getReserves'),
    }));

    const { returnData } = await multicall.callStatic.aggregate(calls);

    return returnData.map((data: string) => {
        const [reserve0, reserve1] = ethers.utils.defaultAbiCoder.decode(['uint112', 'uint112', 'uint32'], data);
        return { reserve0, reserve1 };
    });
}
```

This comprehensive developer documentation provides everything needed to understand, deploy, and optimize the flash swap arbitrage bot for production use.

