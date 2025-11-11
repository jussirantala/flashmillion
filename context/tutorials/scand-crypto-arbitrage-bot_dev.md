**Source:** https://scand.com/company/blog/how-to-build-crypto-arbitrage-flash-loan-bot/

# Crypto Arbitrage Bot Development - Level 2
**Technical Level:** Advanced
**Focus:** Development Platforms, DEX Integration, Gas Optimization, Error Handling

## Remix vs Hardhat Comparison

### Remix IDE

**Advantages:**
- Browser-based, no installation required
- Built-in Solidity compiler
- Integrated debugging tools
- Direct deployment to testnets
- Visual interface for contract interaction

**Disadvantages:**
- Limited automation capabilities
- No version control integration
- Difficult to manage large projects
- Limited testing capabilities
- Not suitable for production

```solidity
// Example: Remix-friendly contract structure
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Simple structure for Remix testing
contract SimpleArbitrage {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    // Remix can easily call and test this
    function testArbitrage(
        address tokenIn,
        address tokenOut,
        uint256 amount
    ) external view returns (uint256 expectedProfit) {
        // Calculation logic
        return amount * 110 / 100; // Mock 10% profit
    }
}
```

### Hardhat (Recommended)

**Advantages:**
- Professional development environment
- Automated testing with Mocha/Chai
- Mainnet forking capabilities
- Gas reporting
- Deployment automation
- Plugin ecosystem
- TypeScript support

**Disadvantages:**
- Requires Node.js installation
- Steeper learning curve
- More complex setup

```javascript
// Hardhat project structure
/*
project/
├── contracts/
│   ├── FlashLoanArbitrage.sol
│   ├── interfaces/
│   └── libraries/
├── scripts/
│   ├── deploy.js
│   └── execute-arbitrage.js
├── test/
│   ├── unit/
│   └── integration/
├── hardhat.config.js
└── package.json
*/
```

### Decision Matrix

| Feature | Remix | Hardhat |
|---------|-------|---------|
| Learning | Easy | Moderate |
| Testing | Basic | Advanced |
| Automation | None | Full |
| Production Ready | No | Yes |
| Team Collaboration | Poor | Excellent |
| CI/CD Integration | No | Yes |

**Recommendation:** Use Remix for learning and quick prototyping, Hardhat for production.

## Transaction Batching

### Multi-Call Pattern

```solidity
// contracts/BatchExecutor.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BatchExecutor {
    /**
     * @dev Execute multiple arbitrage opportunities in one transaction
     * Saves gas by amortizing transaction overhead
     */
    function executeBatch(
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes[] calldata strategyData
    ) external returns (uint256 totalProfit) {
        require(tokens.length == amounts.length, "Length mismatch");
        require(tokens.length == strategyData.length, "Length mismatch");

        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 profit = _executeStrategy(
                tokens[i],
                amounts[i],
                strategyData[i]
            );
            totalProfit += profit;
        }

        require(totalProfit > 0, "No profit");
    }

    function _executeStrategy(
        address token,
        uint256 amount,
        bytes calldata data
    ) internal returns (uint256 profit) {
        // Decode strategy
        (address dexBuy, address dexSell) = abi.decode(data, (address, address));

        // Execute arbitrage
        // ... implementation
    }
}
```

### Batch Price Checking

```javascript
// modules/batchPriceChecker.js
const { ethers } = require('ethers');

class BatchPriceChecker {
  constructor(provider) {
    this.provider = provider;

    // Deploy or use existing multicall contract
    this.multicallAddress = '0xcA11bde05977b3631167028862bE2a173976CA11'; // Multicall3
    this.multicallABI = [
      'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) returns (tuple(bool success, bytes returnData)[] returnData)'
    ];
  }

  /**
   * Batch get prices from multiple DEXs for multiple tokens
   */
  async batchGetPrices(tokens, routers) {
    const multicall = new ethers.Contract(
      this.multicallAddress,
      this.multicallABI,
      this.provider
    );

    // Build calls array
    const calls = [];
    const routerABI = [
      'function getAmountsOut(uint amountIn, address[] memory path) view returns (uint[] memory amounts)'
    ];

    for (const token of tokens) {
      for (const [dexName, routerAddress] of Object.entries(routers)) {
        const routerInterface = new ethers.Interface(routerABI);
        const callData = routerInterface.encodeFunctionData('getAmountsOut', [
          ethers.parseEther('1'),
          [token.address, WETH_ADDRESS]
        ]);

        calls.push({
          target: routerAddress,
          allowFailure: true,
          callData: callData
        });
      }
    }

    // Execute multicall
    const results = await multicall.aggregate3.staticCall(calls);

    // Parse results
    const prices = {};
    let callIndex = 0;

    for (const token of tokens) {
      prices[token.symbol] = {};

      for (const dexName of Object.keys(routers)) {
        const result = results[callIndex];

        if (result.success) {
          const routerInterface = new ethers.Interface(routerABI);
          const decoded = routerInterface.decodeFunctionResult(
            'getAmountsOut',
            result.returnData
          );
          prices[token.symbol][dexName] = decoded[0][1];
        } else {
          prices[token.symbol][dexName] = null;
        }

        callIndex++;
      }
    }

    return prices;
  }

  /**
   * Batch check liquidity across multiple pools
   */
  async batchGetLiquidity(pairs) {
    const multicall = new ethers.Contract(
      this.multicallAddress,
      this.multicallABI,
      this.provider
    );

    const pairABI = [
      'function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)'
    ];

    const calls = pairs.map(pairAddress => {
      const pairInterface = new ethers.Interface(pairABI);
      const callData = pairInterface.encodeFunctionData('getReserves');

      return {
        target: pairAddress,
        allowFailure: true,
        callData: callData
      };
    });

    const results = await multicall.aggregate3.staticCall(calls);

    // Parse results
    const liquidity = [];
    const pairInterface = new ethers.Interface(pairABI);

    for (let i = 0; i < results.length; i++) {
      if (results[i].success) {
        const decoded = pairInterface.decodeFunctionResult(
          'getReserves',
          results[i].returnData
        );

        liquidity.push({
          pair: pairs[i],
          reserve0: decoded[0],
          reserve1: decoded[1],
          timestamp: decoded[2]
        });
      }
    }

    return liquidity;
  }
}

module.exports = BatchPriceChecker;
```

## DEX API Integration

### Uniswap V2 Integration

```javascript
// integrations/uniswapV2.js
const { ethers } = require('ethers');

class UniswapV2Integration {
  constructor(provider) {
    this.provider = provider;
    this.factoryAddress = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
    this.routerAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

    this.factoryABI = [
      'function getPair(address tokenA, address tokenB) external view returns (address pair)',
      'function allPairs(uint) external view returns (address pair)',
      'function allPairsLength() external view returns (uint)'
    ];

    this.routerABI = [
      'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
      'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'
    ];

    this.pairABI = [
      'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)'
    ];

    this.factory = new ethers.Contract(
      this.factoryAddress,
      this.factoryABI,
      this.provider
    );

    this.router = new ethers.Contract(
      this.routerAddress,
      this.routerABI,
      this.provider
    );
  }

  async getPairAddress(token0, token1) {
    return await this.factory.getPair(token0, token1);
  }

  async getPairReserves(pairAddress) {
    const pair = new ethers.Contract(pairAddress, this.pairABI, this.provider);
    const [reserve0, reserve1, timestamp] = await pair.getReserves();
    const token0 = await pair.token0();
    const token1 = await pair.token1();

    return {
      reserve0,
      reserve1,
      token0,
      token1,
      timestamp: Number(timestamp)
    };
  }

  async getPrice(tokenIn, tokenOut, amountIn) {
    const path = [tokenIn, tokenOut];
    const amounts = await this.router.getAmountsOut(amountIn, path);
    return amounts[1];
  }

  async calculatePriceImpact(tokenIn, tokenOut, amountIn) {
    // Get pair
    const pairAddress = await this.getPairAddress(tokenIn, tokenOut);
    const reserves = await this.getPairReserves(pairAddress);

    // Determine which reserve is which
    const isToken0 = tokenIn.toLowerCase() === reserves.token0.toLowerCase();
    const reserveIn = isToken0 ? reserves.reserve0 : reserves.reserve1;
    const reserveOut = isToken0 ? reserves.reserve1 : reserves.reserve0;

    // Calculate price impact using constant product formula
    // amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
    const amountInWithFee = amountIn * 997n;
    const numerator = amountInWithFee * reserveOut;
    const denominator = reserveIn * 1000n + amountInWithFee;
    const amountOut = numerator / denominator;

    // Price without impact (small trade)
    const smallAmount = ethers.parseEther('1');
    const smallAmountWithFee = smallAmount * 997n;
    const smallNumerator = smallAmountWithFee * reserveOut;
    const smallDenominator = reserveIn * 1000n + smallAmountWithFee;
    const smallAmountOut = smallNumerator / smallDenominator;

    // Calculate impact
    const actualPrice = amountOut * ethers.WeiPerEther / amountIn;
    const idealPrice = smallAmountOut;

    const impact = (idealPrice - actualPrice) * 10000n / idealPrice;

    return {
      amountOut,
      priceImpactBps: Number(impact),
      reserveIn,
      reserveOut
    };
  }

  async getAllPairs(limit = 100) {
    const pairsLength = await this.factory.allPairsLength();
    const total = Number(pairsLength);
    const pairsToFetch = Math.min(limit, total);

    const pairs = [];
    for (let i = 0; i < pairsToFetch; i++) {
      const pairAddress = await this.factory.allPairs(i);
      pairs.push(pairAddress);
    }

    return pairs;
  }
}

module.exports = UniswapV2Integration;
```

### SushiSwap Integration

```javascript
// integrations/sushiswap.js
const UniswapV2Integration = require('./uniswapV2');

class SushiSwapIntegration extends UniswapV2Integration {
  constructor(provider) {
    super(provider);

    // Override with SushiSwap addresses
    this.factoryAddress = '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac';
    this.routerAddress = '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F';

    // Reinitialize contracts with SushiSwap addresses
    this.factory = new ethers.Contract(
      this.factoryAddress,
      this.factoryABI,
      this.provider
    );

    this.router = new ethers.Contract(
      this.routerAddress,
      this.routerABI,
      this.provider
    );
  }
}

module.exports = SushiSwapIntegration;
```

### Uniswap V3 Integration

```javascript
// integrations/uniswapV3.js
const { ethers } = require('ethers');

class UniswapV3Integration {
  constructor(provider) {
    this.provider = provider;
    this.quoterAddress = '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6';
    this.routerAddress = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

    this.quoterABI = [
      'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)'
    ];

    this.quoter = new ethers.Contract(
      this.quoterAddress,
      this.quoterABI,
      this.provider
    );
  }

  async getPrice(tokenIn, tokenOut, amountIn, fee = 3000) {
    // Fee tiers: 500 (0.05%), 3000 (0.3%), 10000 (1%)
    try {
      const amountOut = await this.quoter.quoteExactInputSingle.staticCall(
        tokenIn,
        tokenOut,
        fee,
        amountIn,
        0 // sqrtPriceLimitX96 = 0 means no limit
      );

      return amountOut;
    } catch (error) {
      console.error('V3 quote error:', error);
      return 0n;
    }
  }

  async getBestFee(tokenIn, tokenOut, amountIn) {
    const fees = [500, 3000, 10000];
    let bestFee = 3000;
    let bestAmountOut = 0n;

    for (const fee of fees) {
      const amountOut = await this.getPrice(tokenIn, tokenOut, amountIn, fee);
      if (amountOut > bestAmountOut) {
        bestAmountOut = amountOut;
        bestFee = fee;
      }
    }

    return { fee: bestFee, amountOut: bestAmountOut };
  }
}

module.exports = UniswapV3Integration;
```

## Gas Optimization Techniques

### Smart Contract Optimizations

```solidity
// contracts/GasOptimizedArbitrage.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract GasOptimizedArbitrage {
    // ========== STORAGE OPTIMIZATION ==========

    // ❌ BAD: Each variable takes full 32-byte slot
    address public owner;           // 20 bytes
    bool public paused;            // 1 byte
    uint256 public minProfit;      // 32 bytes
    address public weth;           // 20 bytes
    // Total: 4 slots = 8,400 gas for cold access

    // ✅ GOOD: Pack variables to save slots
    address public owner2;          // 20 bytes
    bool public paused2;           // 1 byte
    uint96 public minProfit2;      // 12 bytes (sufficient for most values)
    // Total: 1 slot = 2,100 gas for cold access

    address public weth2;           // 20 bytes
    uint96 public maxProfit2;      // 12 bytes
    // Total: 1 slot = 2,100 gas for cold access
    // Saved: 4,200 gas!

    // ========== IMMUTABLE FOR CONSTANTS ==========

    // ❌ BAD: Storage variable (2,100 gas per read)
    address public aavePool;

    // ✅ GOOD: Immutable (3 gas per read)
    address public immutable AAVE_POOL;
    address public immutable UNISWAP_ROUTER;
    address public immutable SUSHISWAP_ROUTER;

    constructor(address _pool, address _uni, address _sushi) {
        AAVE_POOL = _pool;
        UNISWAP_ROUTER = _uni;
        SUSHISWAP_ROUTER = _sushi;
        owner2 = msg.sender;
    }

    // ========== CUSTOM ERRORS ==========

    // ❌ BAD: String errors are expensive
    function badRevert() external pure {
        require(false, "This is a long error message that costs gas");
        // Cost: ~100+ gas for string
    }

    // ✅ GOOD: Custom errors are cheaper
    error Unauthorized();
    error InsufficientProfit(uint256 expected, uint256 actual);

    function goodRevert() external pure {
        revert Unauthorized();
        // Cost: ~20 gas
    }

    // ========== UNCHECKED MATH ==========

    function badMath(uint256 a, uint256 b) external pure returns (uint256) {
        // Automatic overflow checks (added in Solidity 0.8)
        return a + b; // ~100 gas
    }

    function goodMath(uint256 a, uint256 b) external pure returns (uint256) {
        // If we know overflow is impossible, use unchecked
        unchecked {
            return a + b; // ~25 gas
        }
        // ONLY use when you're CERTAIN no overflow possible!
    }

    // ========== CALLDATA vs MEMORY ==========

    // ❌ BAD: Copies array to memory
    function badArray(uint256[] memory arr) external pure returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = 0; i < arr.length; i++) {
            sum += arr[i];
        }
        return sum;
    }

    // ✅ GOOD: Read directly from calldata
    function goodArray(uint256[] calldata arr) external pure returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = 0; i < arr.length; i++) {
            sum += arr[i];
        }
        return sum;
    }

    // ========== CACHE ARRAY LENGTH ==========

    function badLoop(uint256[] calldata arr) external pure returns (uint256) {
        uint256 sum = 0;
        // arr.length is read on every iteration!
        for (uint256 i = 0; i < arr.length; i++) {
            sum += arr[i];
        }
        return sum;
    }

    function goodLoop(uint256[] calldata arr) external pure returns (uint256) {
        uint256 sum = 0;
        uint256 length = arr.length; // Cache length
        for (uint256 i = 0; i < length; i++) {
            sum += arr[i];
        }
        return sum;
    }

    // ========== SHORT-CIRCUIT EVALUATION ==========

    function badCondition(uint256 x) external view returns (bool) {
        // Expensive check first
        return expensiveCheck() && x > 100;
    }

    function goodCondition(uint256 x) external view returns (bool) {
        // Cheap check first - short-circuits if false
        return x > 100 && expensiveCheck();
    }

    function expensiveCheck() internal view returns (bool) {
        // Simulate expensive operation
        return block.timestamp > 0;
    }

    // ========== BATCH OPERATIONS ==========

    function badMultiSwap(
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external {
        for (uint256 i = 0; i < tokens.length; i++) {
            _swap(tokens[i], amounts[i]);
        }
    }

    function goodMultiSwap(
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external {
        uint256 length = tokens.length;
        for (uint256 i = 0; i < length; ) {
            _swap(tokens[i], amounts[i]);
            unchecked { ++i; } // Cheaper increment
        }
    }

    function _swap(address token, uint256 amount) internal {
        // Swap logic
    }

    // ========== MINIMAL PROXY PATTERN ==========
    // For deploying multiple similar contracts

    function badDeploy() external returns (address) {
        // Deploys full contract every time
        // ~200,000 gas
        FlashLoanArbitrage arb = new FlashLoanArbitrage();
        return address(arb);
    }

    function goodDeploy(address implementation) external returns (address) {
        // Deploy minimal proxy (EIP-1167)
        // ~45,000 gas
        bytes20 targetBytes = bytes20(implementation);
        address proxy;
        assembly {
            let clone := mload(0x40)
            mstore(clone, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(clone, 0x14), targetBytes)
            mstore(add(clone, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            proxy := create(0, clone, 0x37)
        }
        return proxy;
    }
}

contract FlashLoanArbitrage {
    // Implementation
}
```

### JavaScript Gas Optimization

```javascript
// modules/gasOptimizer.js
const { ethers } = require('ethers');

class GasOptimizer {
  constructor(provider) {
    this.provider = provider;
    this.gasHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Dynamically calculate optimal gas price based on network conditions
   */
  async getOptimalGasPrice(urgency = 'medium') {
    const feeData = await this.provider.getFeeData();
    const block = await this.provider.getBlock('latest');

    // Analyze base fee trend
    const baseFee = block.baseFeePerGas;

    // Get current priority fees
    const { maxFeePerGas, maxPriorityFeePerGas } = feeData;

    // Urgency multipliers
    const multipliers = {
      low: { base: 1.0, priority: 0.5 },
      medium: { base: 1.1, priority: 1.0 },
      high: { base: 1.3, priority: 2.0 },
      urgent: { base: 1.5, priority: 3.0 }
    };

    const mult = multipliers[urgency];

    // Calculate optimal fees
    const optimalMaxFee = (baseFee * BigInt(Math.floor(mult.base * 100)) / 100n) +
                          (maxPriorityFeePerGas * BigInt(Math.floor(mult.priority * 100)) / 100n);
    const optimalPriorityFee = maxPriorityFeePerGas * BigInt(Math.floor(mult.priority * 100)) / 100n;

    return {
      maxFeePerGas: optimalMaxFee,
      maxPriorityFeePerGas: optimalPriorityFee,
      baseFee,
      urgency
    };
  }

  /**
   * Estimate gas with high accuracy
   */
  async estimateGasAccurate(contract, method, args, options = {}) {
    try {
      // Get base estimate
      const estimate = await contract[method].estimateGas(...args, options);

      // Add buffer (10-20% depending on complexity)
      const buffer = options.complexOperation ? 20 : 10;
      const gasLimit = estimate * BigInt(100 + buffer) / 100n;

      return gasLimit;
    } catch (error) {
      console.error('Gas estimation failed:', error);

      // Fallback to conservative estimate
      return ethers.parseUnits('500000', 'wei');
    }
  }

  /**
   * Calculate if transaction is profitable after gas costs
   */
  async isProfitableAfterGas(expectedProfitUSD, gasLimit, ethPriceUSD) {
    const gasPrice = await this.getOptimalGasPrice('medium');

    // Calculate gas cost in ETH
    const gasCostWei = gasLimit * gasPrice.maxFeePerGas;
    const gasCostETH = Number(ethers.formatEther(gasCostWei));

    // Convert to USD
    const gasCostUSD = gasCostETH * ethPriceUSD;

    // Net profit
    const netProfitUSD = expectedProfitUSD - gasCostUSD;

    return {
      profitable: netProfitUSD > 0,
      expectedProfitUSD,
      gasCostUSD,
      netProfitUSD,
      gasCostWei,
      gasLimit: gasLimit.toString()
    };
  }

  /**
   * Record gas usage for analytics
   */
  recordGasUsage(txReceipt) {
    const gasUsed = txReceipt.gasUsed;
    const effectiveGasPrice = txReceipt.effectiveGasPrice || txReceipt.gasPrice;

    const record = {
      gasUsed: gasUsed.toString(),
      gasPrice: effectiveGasPrice.toString(),
      gasCost: (gasUsed * effectiveGasPrice).toString(),
      timestamp: Date.now(),
      blockNumber: txReceipt.blockNumber
    };

    this.gasHistory.push(record);

    // Maintain max history size
    if (this.gasHistory.length > this.maxHistorySize) {
      this.gasHistory.shift();
    }

    return record;
  }

  /**
   * Get gas usage statistics
   */
  getGasStats() {
    if (this.gasHistory.length === 0) {
      return null;
    }

    const gasUsedValues = this.gasHistory.map(r => BigInt(r.gasUsed));
    const gasCostValues = this.gasHistory.map(r => BigInt(r.gasCost));

    const avgGasUsed = gasUsedValues.reduce((a, b) => a + b, 0n) / BigInt(gasUsedValues.length);
    const avgGasCost = gasCostValues.reduce((a, b) => a + b, 0n) / BigInt(gasCostValues.length);

    const maxGasUsed = gasUsedValues.reduce((a, b) => a > b ? a : b, 0n);
    const minGasUsed = gasUsedValues.reduce((a, b) => a < b ? a : b, gasUsedValues[0]);

    return {
      averageGasUsed: avgGasUsed.toString(),
      averageGasCost: ethers.formatEther(avgGasCost),
      maxGasUsed: maxGasUsed.toString(),
      minGasUsed: minGasUsed.toString(),
      totalTransactions: this.gasHistory.length
    };
  }
}

module.exports = GasOptimizer;
```

## Error Handling Patterns

### Comprehensive Error Handler

```javascript
// modules/errorHandler.js
const logger = require('./logger');

class ErrorHandler {
  constructor(telegramBot) {
    this.telegramBot = telegramBot;
    this.errorCounts = new Map();
    this.errorThreshold = 10; // Max errors before circuit breaker
    this.resetInterval = 3600000; // Reset counts every hour
    this.circuitOpen = false;

    // Start periodic reset
    setInterval(() => this.resetErrorCounts(), this.resetInterval);
  }

  /**
   * Handle different types of errors
   */
  async handleError(error, context = {}) {
    const errorType = this.classifyError(error);

    logger.error('Error occurred', {
      type: errorType,
      message: error.message,
      stack: error.stack,
      context
    });

    // Increment error count
    this.incrementErrorCount(errorType);

    // Check circuit breaker
    if (this.shouldOpenCircuit(errorType)) {
      await this.openCircuit(errorType);
    }

    // Handle based on type
    switch (errorType) {
      case 'INSUFFICIENT_FUNDS':
        await this.handleInsufficientFunds(error, context);
        break;

      case 'TRANSACTION_FAILED':
        await this.handleTransactionFailed(error, context);
        break;

      case 'NETWORK_ERROR':
        await this.handleNetworkError(error, context);
        break;

      case 'REVERT':
        await this.handleRevert(error, context);
        break;

      case 'GAS_ESTIMATION_FAILED':
        await this.handleGasEstimationFailed(error, context);
        break;

      case 'NONCE_ERROR':
        await this.handleNonceError(error, context);
        break;

      default:
        await this.handleUnknownError(error, context);
    }
  }

  classifyError(error) {
    const message = error.message.toLowerCase();

    if (message.includes('insufficient funds')) {
      return 'INSUFFICIENT_FUNDS';
    } else if (message.includes('transaction failed')) {
      return 'TRANSACTION_FAILED';
    } else if (message.includes('network') || message.includes('timeout')) {
      return 'NETWORK_ERROR';
    } else if (message.includes('revert')) {
      return 'REVERT';
    } else if (message.includes('gas')) {
      return 'GAS_ESTIMATION_FAILED';
    } else if (message.includes('nonce')) {
      return 'NONCE_ERROR';
    }

    return 'UNKNOWN';
  }

  async handleInsufficientFunds(error, context) {
    logger.warn('Insufficient funds for transaction');

    // Send alert
    await this.sendAlert('⚠️ Insufficient Funds',
      'Bot wallet needs funding to continue operations');

    // Pause bot
    this.circuitOpen = true;
  }

  async handleTransactionFailed(error, context) {
    // Transaction was sent but failed
    const txHash = context.txHash;

    logger.info('Transaction failed but was mined', { txHash });

    // This is normal for competitive arbitrage
    // Don't send alert unless frequent
  }

  async handleNetworkError(error, context) {
    logger.warn('Network error occurred, will retry');

    // Switch to backup RPC if available
    if (context.retryCount < 3) {
      await this.switchRPC();
    }
  }

  async handleRevert(error, context) {
    // Extract revert reason
    const reason = this.extractRevertReason(error);

    logger.info('Transaction would revert', { reason, context });

    // Common revert reasons
    if (reason.includes('Unprofitable')) {
      // This is normal, opportunity disappeared
      return;
    } else if (reason.includes('Slippage')) {
      // Price moved too much
      logger.info('Slippage too high');
    } else {
      // Unexpected revert
      await this.sendAlert('⚠️ Unexpected Revert', reason);
    }
  }

  async handleGasEstimationFailed(error, context) {
    logger.warn('Gas estimation failed, using fallback');

    // Use conservative gas limit
    context.useConservativeGas = true;
  }

  async handleNonceError(error, context) {
    logger.warn('Nonce error, resetting nonce tracking');

    // Reset nonce
    if (context.wallet) {
      const nonce = await context.wallet.getNonce('latest');
      logger.info('Reset nonce to', nonce);
    }
  }

  async handleUnknownError(error, context) {
    logger.error('Unknown error type', {
      error: error.message,
      stack: error.stack,
      context
    });

    // Send alert for unknown errors
    await this.sendAlert('🚨 Unknown Error', error.message);
  }

  extractRevertReason(error) {
    // Try to extract revert reason from error
    if (error.reason) return error.reason;
    if (error.message) {
      const match = error.message.match(/reverted with reason string '(.*)'/);
      if (match) return match[1];
    }
    return 'Unknown revert reason';
  }

  incrementErrorCount(errorType) {
    const count = this.errorCounts.get(errorType) || 0;
    this.errorCounts.set(errorType, count + 1);
  }

  shouldOpenCircuit(errorType) {
    const count = this.errorCounts.get(errorType) || 0;
    return count >= this.errorThreshold;
  }

  async openCircuit(errorType) {
    if (this.circuitOpen) return;

    this.circuitOpen = true;
    logger.error('Circuit breaker opened', { errorType });

    await this.sendAlert(
      '🛑 Circuit Breaker Activated',
      `Too many ${errorType} errors. Bot operations paused.`
    );
  }

  async closeCircuit() {
    this.circuitOpen = false;
    this.resetErrorCounts();
    logger.info('Circuit breaker closed');

    await this.sendAlert(
      '✅ Circuit Breaker Reset',
      'Bot operations resumed'
    );
  }

  resetErrorCounts() {
    this.errorCounts.clear();
  }

  async switchRPC() {
    // Implementation to switch to backup RPC
    logger.info('Switching to backup RPC');
  }

  async sendAlert(title, message) {
    if (this.telegramBot) {
      await this.telegramBot.sendMessage(`${title}\n\n${message}`);
    }
  }

  isCircuitOpen() {
    return this.circuitOpen;
  }
}

module.exports = ErrorHandler;
```

## Monitoring Setup

### Health Check and Metrics

```javascript
// modules/monitoring.js
const express = require('express');
const prometheus = require('prom-client');

class MonitoringServer {
  constructor(port = 3000) {
    this.app = express();
    this.port = port;

    // Create Prometheus metrics
    this.register = new prometheus.Registry();

    // Metrics
    this.opportunitiesDetected = new prometheus.Counter({
      name: 'arbitrage_opportunities_detected_total',
      help: 'Total number of arbitrage opportunities detected',
      registers: [this.register]
    });

    this.opportunitiesExecuted = new prometheus.Counter({
      name: 'arbitrage_opportunities_executed_total',
      help: 'Total number of arbitrage opportunities executed',
      labelNames: ['success'],
      registers: [this.register]
    });

    this.profitGauge = new prometheus.Gauge({
      name: 'arbitrage_profit_usd',
      help: 'Current profit in USD',
      registers: [this.register]
    });

    this.gasUsedHistogram = new prometheus.Histogram({
      name: 'gas_used',
      help: 'Gas used per transaction',
      buckets: [100000, 200000, 300000, 500000, 750000, 1000000],
      registers: [this.register]
    });

    this.setupRoutes();
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    // Metrics endpoint for Prometheus
    this.app.get('/metrics', async (req, res) => {
      res.set('Content-Type', this.register.contentType);
      const metrics = await this.register.metrics();
      res.send(metrics);
    });

    // Status endpoint
    this.app.get('/status', (req, res) => {
      res.json(this.getStatus());
    });
  }

  getStatus() {
    return {
      status: 'running',
      timestamp: new Date().toISOString(),
      metrics: {
        // Will be populated by bot
      }
    };
  }

  start() {
    this.server = this.app.listen(this.port, () => {
      console.log(`Monitoring server running on port ${this.port}`);
      console.log(`Health: http://localhost:${this.port}/health`);
      console.log(`Metrics: http://localhost:${this.port}/metrics`);
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
    }
  }

  // Record metrics
  recordOpportunity() {
    this.opportunitiesDetected.inc();
  }

  recordExecution(success) {
    this.opportunitiesExecuted.inc({ success: success.toString() });
  }

  updateProfit(profitUSD) {
    this.profitGauge.set(profitUSD);
  }

  recordGasUsed(gasUsed) {
    this.gasUsedHistogram.observe(Number(gasUsed));
  }
}

module.exports = MonitoringServer;
```

## Best Practices Summary

1. **Development Platform**
   - Start with Remix for learning
   - Use Hardhat for production
   - Leverage mainnet forking for testing

2. **Transaction Batching**
   - Use Multicall3 for batched reads
   - Batch multiple arbitrage opportunities when possible
   - Amortize fixed transaction costs

3. **DEX Integration**
   - Support multiple DEX versions (V2, V3)
   - Calculate price impact before execution
   - Check liquidity depth
   - Handle integration failures gracefully

4. **Gas Optimization**
   - Use immutable for constants
   - Pack storage variables
   - Use custom errors
   - Cache array lengths
   - Use calldata instead of memory

5. **Error Handling**
   - Classify errors by type
   - Implement circuit breakers
   - Log all errors
   - Alert on critical issues
   - Retry with exponential backoff

6. **Monitoring**
   - Track all key metrics
   - Expose health check endpoint
   - Use Prometheus for metrics
   - Set up alerts
   - Monitor gas usage trends
