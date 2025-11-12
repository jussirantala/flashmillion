**Source:** https://github.com/kmoussai/flash-loan
**Date:** 2024-2025


# flash-loan - Technical Implementation

## Architecture Deep Dive

### System Architecture Overview

The flash-loan TypeScript implementation follows a layered architecture pattern that separates concerns and promotes maintainability. The system is designed around three primary layers:

1. **Service Layer**: Handles business logic and orchestrates flash loan operations
2. **Contract Layer**: Manages blockchain interactions and smart contract communications
3. **Strategy Layer**: Implements various trading and arbitrage strategies

### Component Interaction Flow

```
User/Script → FlashLoanService → TransactionService → Blockchain
                     ↓                    ↓
              ArbitrageService → PriceService → DEXs/Protocols
                     ↓
              Strategy Pattern → Execution
```

### Core Service Architecture

**FlashLoanService**: The central coordinator that manages the entire flash loan lifecycle:
- Validates flash loan parameters
- Calculates required amounts and fees
- Orchestrates transaction building
- Handles callback execution
- Manages error recovery

**ArbitrageService**: Identifies profitable opportunities:
- Monitors price feeds from multiple DEXs
- Calculates potential profits
- Accounts for gas costs and fees
- Ranks opportunities by profitability
- Validates minimum profit thresholds

**PriceService**: Provides real-time price data:
- Aggregates prices from multiple sources
- Calculates optimal routes
- Handles slippage calculations
- Updates price caches
- Monitors liquidity pools

**TransactionService**: Manages blockchain transactions:
- Builds transaction parameters
- Estimates gas requirements
- Signs and broadcasts transactions
- Monitors transaction status
- Implements retry logic

### Type System Architecture

The TypeScript implementation leverages a comprehensive type system:

```typescript
// Core domain types
interface FlashLoanParams {
  asset: string;
  amount: BigNumber;
  premium: number;
  initiator: string;
  params: string;
}

interface ArbitrageOpportunity {
  profitable: boolean;
  expectedProfit: BigNumber;
  path: TradePath[];
  gasEstimate: BigNumber;
  confidence: number;
}

interface TradePath {
  protocol: Protocol;
  tokenIn: string;
  tokenOut: string;
  amountIn: BigNumber;
  expectedOut: BigNumber;
  poolAddress: string;
}
```

### Design Patterns Implemented

**Strategy Pattern**: Different arbitrage strategies implement a common interface:
```typescript
interface IArbitrageStrategy {
  analyze(): Promise<ArbitrageOpportunity>;
  execute(opportunity: ArbitrageOpportunity): Promise<TransactionReceipt>;
  validate(opportunity: ArbitrageOpportunity): boolean;
}
```

**Factory Pattern**: Creates appropriate service instances based on configuration:
```typescript
class FlashLoanProviderFactory {
  static create(provider: ProviderType, config: Config): IFlashLoanProvider {
    switch(provider) {
      case 'AAVE_V2': return new AaveV2Provider(config);
      case 'AAVE_V3': return new AaveV3Provider(config);
      case 'DYDX': return new DydxProvider(config);
      default: throw new Error('Unsupported provider');
    }
  }
}
```

**Observer Pattern**: Event-driven architecture for monitoring blockchain events:
```typescript
class BlockchainMonitor extends EventEmitter {
  onNewBlock(callback: (block: Block) => void): void;
  onPriceUpdate(pair: string, callback: (price: Price) => void): void;
  onLiquidationOpportunity(callback: (opp: Liquidation) => void): void;
}
```

### Dependency Injection

Services are designed to accept dependencies through constructors, enabling testability:

```typescript
class FlashLoanService {
  constructor(
    private provider: Provider,
    private signer: Signer,
    private config: Config,
    private logger: ILogger,
    private priceService: IPriceService
  ) {}
}
```

## Code Analysis

### Flash Loan Execution Core

The core flash loan execution logic demonstrates proper error handling and transaction management:

```typescript
class FlashLoanService {
  async executeFlashLoan(
    asset: string,
    amount: BigNumber,
    strategy: IArbitrageStrategy
  ): Promise<TransactionReceipt> {
    // Validate inputs
    this.validateFlashLoanParams(asset, amount);

    // Calculate premium
    const premium = amount.mul(this.config.FLASH_LOAN_PREMIUM).div(10000);
    const amountToRepay = amount.add(premium);

    // Check if strategy will be profitable
    const opportunity = await strategy.analyze();
    if (!opportunity.profitable) {
      throw new Error('Strategy not profitable');
    }

    // Ensure we can repay the loan
    if (opportunity.expectedProfit.lt(amountToRepay)) {
      throw new Error('Insufficient profit to repay flash loan');
    }

    // Build transaction data
    const params = this.encodeStrategyParams(strategy, opportunity);

    // Get lending pool contract
    const lendingPool = this.getLendingPoolContract();

    // Execute flash loan
    const tx = await lendingPool.flashLoan(
      this.config.RECEIVER_ADDRESS,
      [asset],
      [amount],
      [0], // mode 0 = no debt
      this.config.RECEIVER_ADDRESS,
      params,
      0, // referral code
      {
        gasLimit: this.estimateGasLimit(opportunity),
        gasPrice: await this.getOptimalGasPrice()
      }
    );

    // Wait for confirmation
    const receipt = await tx.wait();

    // Log results
    this.logger.info('Flash loan executed', {
      txHash: receipt.transactionHash,
      gasUsed: receipt.gasUsed.toString(),
      profit: this.calculateActualProfit(receipt)
    });

    return receipt;
  }

  private validateFlashLoanParams(asset: string, amount: BigNumber): void {
    if (!ethers.utils.isAddress(asset)) {
      throw new Error('Invalid asset address');
    }

    if (amount.lte(0)) {
      throw new Error('Amount must be greater than 0');
    }

    if (amount.gt(this.config.MAX_FLASH_LOAN_AMOUNT)) {
      throw new Error('Amount exceeds maximum flash loan limit');
    }
  }

  private async getOptimalGasPrice(): Promise<BigNumber> {
    const currentGasPrice = await this.provider.getGasPrice();
    const fastGasPrice = currentGasPrice.mul(120).div(100); // 20% higher for faster inclusion

    return BigNumber.min(
      fastGasPrice,
      ethers.utils.parseUnits(this.config.MAX_GAS_PRICE_GWEI.toString(), 'gwei')
    );
  }
}
```

### Arbitrage Detection Algorithm

The arbitrage detection system implements a sophisticated multi-DEX comparison algorithm:

```typescript
class ArbitrageService {
  async findBestOpportunity(): Promise<ArbitrageOpportunity> {
    const opportunities: ArbitrageOpportunity[] = [];

    // Check all configured token pairs
    for (const pair of this.config.TRADING_PAIRS) {
      // Get prices from all DEXs
      const prices = await Promise.all([
        this.priceService.getPrice(pair, 'UNISWAP_V2'),
        this.priceService.getPrice(pair, 'UNISWAP_V3'),
        this.priceService.getPrice(pair, 'SUSHISWAP'),
        this.priceService.getPrice(pair, 'BALANCER')
      ]);

      // Find price discrepancies
      const minPrice = Math.min(...prices.map(p => p.price));
      const maxPrice = Math.max(...prices.map(p => p.price));
      const spread = (maxPrice - minPrice) / minPrice;

      // Check if spread is profitable
      if (spread > this.config.MIN_SPREAD_THRESHOLD) {
        const buyDex = prices.find(p => p.price === minPrice)!.dex;
        const sellDex = prices.find(p => p.price === maxPrice)!.dex;

        // Calculate optimal trade size
        const optimalAmount = await this.calculateOptimalTradeSize(
          pair,
          buyDex,
          sellDex,
          spread
        );

        // Build trade path
        const path = this.buildTradePath(pair, buyDex, sellDex, optimalAmount);

        // Estimate gas costs
        const gasEstimate = await this.estimateGasCost(path);

        // Calculate expected profit
        const expectedProfit = this.calculateExpectedProfit(
          optimalAmount,
          spread,
          gasEstimate
        );

        if (expectedProfit.gt(this.config.MIN_PROFIT_THRESHOLD)) {
          opportunities.push({
            profitable: true,
            expectedProfit,
            path,
            gasEstimate,
            confidence: this.calculateConfidence(spread, optimalAmount)
          });
        }
      }
    }

    // Return best opportunity
    return opportunities.sort((a, b) =>
      b.expectedProfit.sub(a.expectedProfit).toNumber()
    )[0] || this.getEmptyOpportunity();
  }

  private async calculateOptimalTradeSize(
    pair: TradingPair,
    buyDex: DEX,
    sellDex: DEX,
    spread: number
  ): Promise<BigNumber> {
    // Get liquidity for both DEXs
    const buyLiquidity = await this.priceService.getLiquidity(pair, buyDex);
    const sellLiquidity = await this.priceService.getLiquidity(pair, sellDex);

    // Optimal size is limited by the smaller liquidity
    const maxSize = BigNumber.min(
      buyLiquidity.mul(this.config.MAX_LIQUIDITY_USAGE_PERCENT).div(100),
      sellLiquidity.mul(this.config.MAX_LIQUIDITY_USAGE_PERCENT).div(100)
    );

    // Calculate size that maximizes profit considering slippage
    let optimalSize = maxSize;
    let maxProfit = BigNumber.from(0);

    // Binary search for optimal size
    let low = maxSize.div(100); // Start at 1% of max
    let high = maxSize;

    while (high.sub(low).gt(ethers.utils.parseEther('0.01'))) {
      const mid = low.add(high).div(2);

      const buyPrice = await this.priceService.getPriceWithSlippage(
        pair, buyDex, mid
      );
      const sellPrice = await this.priceService.getPriceWithSlippage(
        pair, sellDex, mid
      );

      const profit = mid.mul(sellPrice.sub(buyPrice)).div(ethers.constants.WeiPerEther);

      if (profit.gt(maxProfit)) {
        maxProfit = profit;
        optimalSize = mid;
        low = mid;
      } else {
        high = mid;
      }
    }

    return optimalSize;
  }

  private calculateExpectedProfit(
    amount: BigNumber,
    spread: number,
    gasEstimate: BigNumber
  ): BigNumber {
    const grossProfit = amount.mul(Math.floor(spread * 10000)).div(10000);
    const flashLoanFee = amount.mul(this.config.FLASH_LOAN_PREMIUM).div(10000);
    const gasCost = gasEstimate.mul(await this.provider.getGasPrice());

    return grossProfit.sub(flashLoanFee).sub(gasCost);
  }
}
```

### Price Service Implementation

The price service aggregates data from multiple sources with caching and error handling:

```typescript
class PriceService {
  private priceCache: Map<string, CachedPrice> = new Map();
  private readonly CACHE_TTL = 1000; // 1 second

  async getPrice(pair: TradingPair, dex: DEX): Promise<PriceQuote> {
    const cacheKey = `${pair.token0}-${pair.token1}-${dex}`;
    const cached = this.priceCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.price;
    }

    try {
      const price = await this.fetchPrice(pair, dex);
      this.priceCache.set(cacheKey, {
        price,
        timestamp: Date.now()
      });
      return price;
    } catch (error) {
      this.logger.error(`Failed to fetch price from ${dex}`, error);
      // Return cached price if available, even if stale
      if (cached) {
        this.logger.warn(`Using stale cached price for ${cacheKey}`);
        return cached.price;
      }
      throw error;
    }
  }

  private async fetchPrice(pair: TradingPair, dex: DEX): Promise<PriceQuote> {
    switch(dex) {
      case 'UNISWAP_V2':
        return this.fetchUniswapV2Price(pair);
      case 'UNISWAP_V3':
        return this.fetchUniswapV3Price(pair);
      case 'SUSHISWAP':
        return this.fetchSushiswapPrice(pair);
      case 'BALANCER':
        return this.fetchBalancerPrice(pair);
      default:
        throw new Error(`Unsupported DEX: ${dex}`);
    }
  }

  private async fetchUniswapV2Price(pair: TradingPair): Promise<PriceQuote> {
    const factory = new ethers.Contract(
      this.config.UNISWAP_V2_FACTORY,
      UNISWAP_V2_FACTORY_ABI,
      this.provider
    );

    const pairAddress = await factory.getPair(pair.token0, pair.token1);

    if (pairAddress === ethers.constants.AddressZero) {
      throw new Error('Pair does not exist');
    }

    const pairContract = new ethers.Contract(
      pairAddress,
      UNISWAP_V2_PAIR_ABI,
      this.provider
    );

    const [reserve0, reserve1] = await pairContract.getReserves();

    // Calculate price (reserve1 / reserve0)
    const price = reserve1.mul(ethers.constants.WeiPerEther).div(reserve0);

    return {
      price: parseFloat(ethers.utils.formatEther(price)),
      dex: 'UNISWAP_V2',
      poolAddress: pairAddress,
      liquidity: reserve0,
      timestamp: Date.now()
    };
  }

  async getPriceWithSlippage(
    pair: TradingPair,
    dex: DEX,
    amount: BigNumber
  ): Promise<BigNumber> {
    const router = this.getRouterContract(dex);

    try {
      const amounts = await router.getAmountsOut(amount, [
        pair.token0,
        pair.token1
      ]);

      return amounts[amounts.length - 1];
    } catch (error) {
      this.logger.error('Failed to get price with slippage', error);
      throw error;
    }
  }
}
```

### Transaction Building and Execution

Sophisticated transaction building with proper error handling:

```typescript
class TransactionService {
  async buildAndExecute(
    target: string,
    data: string,
    value: BigNumber = BigNumber.from(0)
  ): Promise<TransactionReceipt> {
    // Estimate gas
    const gasEstimate = await this.estimateGas(target, data, value);
    const gasLimit = gasEstimate.mul(120).div(100); // 20% buffer

    // Get optimal gas price
    const gasPrice = await this.getOptimalGasPrice();

    // Build transaction
    const tx = {
      to: target,
      data,
      value,
      gasLimit,
      gasPrice,
      nonce: await this.signer.getTransactionCount('pending')
    };

    // Validate transaction
    await this.validateTransaction(tx);

    // Send transaction with retry logic
    return await this.sendWithRetry(tx);
  }

  private async sendWithRetry(
    tx: TransactionRequest,
    maxRetries: number = 3
  ): Promise<TransactionReceipt> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const sentTx = await this.signer.sendTransaction(tx);
        this.logger.info(`Transaction sent: ${sentTx.hash}`);

        // Wait for confirmation
        const receipt = await sentTx.wait(this.config.CONFIRMATIONS);

        if (receipt.status === 0) {
          throw new Error('Transaction failed');
        }

        return receipt;
      } catch (error) {
        this.logger.error(`Transaction attempt ${i + 1} failed`, error);

        if (i === maxRetries - 1) {
          throw error;
        }

        // Increase gas price for retry
        tx.gasPrice = tx.gasPrice!.mul(110).div(100);

        // Update nonce
        tx.nonce = await this.signer.getTransactionCount('pending');

        // Wait before retry
        await this.delay(2000);
      }
    }

    throw new Error('Transaction failed after all retries');
  }

  private async validateTransaction(tx: TransactionRequest): Promise<void> {
    // Validate gas limit
    if (tx.gasLimit!.gt(this.config.MAX_GAS_LIMIT)) {
      throw new Error('Gas limit exceeds maximum');
    }

    // Validate gas price
    if (tx.gasPrice!.gt(ethers.utils.parseUnits('500', 'gwei'))) {
      throw new Error('Gas price too high');
    }

    // Check wallet balance
    const balance = await this.signer.getBalance();
    const totalCost = tx.gasLimit!.mul(tx.gasPrice!).add(tx.value || 0);

    if (balance.lt(totalCost)) {
      throw new Error('Insufficient balance for transaction');
    }
  }

  private async estimateGas(
    target: string,
    data: string,
    value: BigNumber
  ): Promise<BigNumber> {
    try {
      return await this.provider.estimateGas({
        to: target,
        data,
        value,
        from: await this.signer.getAddress()
      });
    } catch (error) {
      this.logger.error('Gas estimation failed', error);
      // Return fallback estimate
      return BigNumber.from(this.config.DEFAULT_GAS_LIMIT);
    }
  }
}
```

## Smart Contract Details

### Flash Loan Receiver Interface

The TypeScript implementation interacts with flash loan receiver contracts that implement the following interface:

```typescript
interface IFlashLoanReceiver {
  /**
   * Executes an operation after receiving the flash loan
   * @param assets The addresses of the flash-borrowed assets
   * @param amounts The amounts of the flash-borrowed assets
   * @param premiums The fee of each flash-borrowed asset
   * @param initiator The address of the flashLoan initiator
   * @param params The byte-encoded params passed when initiating the flashloan
   * @return True if the execution of the operation succeeds, false otherwise
   */
  executeOperation(
    assets: string[],
    amounts: BigNumber[],
    premiums: BigNumber[],
    initiator: string,
    params: string
  ): Promise<boolean>;
}
```

### Aave V2 Integration

TypeChain-generated types for Aave V2 lending pool interactions:

```typescript
interface ILendingPool {
  flashLoan(
    receiverAddress: string,
    assets: string[],
    amounts: BigNumber[],
    modes: number[],
    onBehalfOf: string,
    params: string,
    referralCode: number,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  getReserveData(asset: string): Promise<{
    configuration: BigNumber;
    liquidityIndex: BigNumber;
    variableBorrowIndex: BigNumber;
    currentLiquidityRate: BigNumber;
    currentVariableBorrowRate: BigNumber;
    currentStableBorrowRate: BigNumber;
    lastUpdateTimestamp: number;
    aTokenAddress: string;
    stableDebtTokenAddress: string;
    variableDebtTokenAddress: string;
    interestRateStrategyAddress: string;
    id: number;
  }>;
}
```

### Contract ABI Integration

The project uses TypeChain to generate type-safe contract wrappers:

```typescript
// typechain/factories/ILendingPool__factory.ts
export class ILendingPool__factory {
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): ILendingPool {
    return new Contract(address, _abi, signerOrProvider) as ILendingPool;
  }
}

// Usage in code
const lendingPool = ILendingPool__factory.connect(
  AAVE_LENDING_POOL_ADDRESS,
  signer
);
```

### DEX Router Interfaces

Typed interfaces for DEX interactions:

```typescript
interface IUniswapV2Router {
  swapExactTokensForTokens(
    amountIn: BigNumber,
    amountOutMin: BigNumber,
    path: string[],
    to: string,
    deadline: BigNumber,
    overrides?: Overrides
  ): Promise<ContractTransaction>;

  getAmountsOut(
    amountIn: BigNumber,
    path: string[]
  ): Promise<BigNumber[]>;
}

interface IUniswapV3Router {
  exactInputSingle(
    params: {
      tokenIn: string;
      tokenOut: string;
      fee: number;
      recipient: string;
      deadline: BigNumber;
      amountIn: BigNumber;
      amountOutMinimum: BigNumber;
      sqrtPriceLimitX96: BigNumber;
    },
    overrides?: Overrides
  ): Promise<ContractTransaction>;
}
```

## API Integration

### Web3 Provider Configuration

The system supports multiple provider configurations:

```typescript
class ProviderManager {
  private providers: Map<string, Provider> = new Map();

  getProvider(network: string): Provider {
    if (!this.providers.has(network)) {
      const config = this.getNetworkConfig(network);

      const provider = new ethers.providers.JsonRpcProvider({
        url: config.rpcUrl,
        timeout: config.timeout || 30000,
        headers: config.headers
      }, {
        name: network,
        chainId: config.chainId
      });

      // Add fallback providers
      if (config.fallbackRpcUrls) {
        const fallbackProvider = new ethers.providers.FallbackProvider(
          config.fallbackRpcUrls.map((url, priority) => ({
            provider: new ethers.providers.JsonRpcProvider(url),
            priority,
            stallTimeout: 2000,
            weight: 1
          }))
        );
        this.providers.set(network, fallbackProvider);
      } else {
        this.providers.set(network, provider);
      }
    }

    return this.providers.get(network)!;
  }
}
```

### External API Integrations

Integration with price feeds and data providers:

```typescript
class ExternalAPIService {
  async getGasPrices(): Promise<GasPrices> {
    try {
      const response = await axios.get('https://api.etherscan.io/api', {
        params: {
          module: 'gastracker',
          action: 'gasoracle',
          apikey: this.config.ETHERSCAN_API_KEY
        },
        timeout: 5000
      });

      return {
        slow: ethers.utils.parseUnits(response.data.result.SafeGasPrice, 'gwei'),
        standard: ethers.utils.parseUnits(response.data.result.ProposeGasPrice, 'gwei'),
        fast: ethers.utils.parseUnits(response.data.result.FastGasPrice, 'gwei')
      };
    } catch (error) {
      this.logger.error('Failed to fetch gas prices', error);
      return this.getFallbackGasPrices();
    }
  }

  async getTokenPrice(tokenAddress: string): Promise<number> {
    try {
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/token_price/ethereum`,
        {
          params: {
            contract_addresses: tokenAddress,
            vs_currencies: 'usd'
          },
          timeout: 5000
        }
      );

      return response.data[tokenAddress.toLowerCase()].usd;
    } catch (error) {
      this.logger.error('Failed to fetch token price', error);
      throw error;
    }
  }
}
```

### The Graph Integration

Querying blockchain data using GraphQL:

```typescript
class GraphService {
  private client: ApolloClient<any>;

  constructor(graphUrl: string) {
    this.client = new ApolloClient({
      uri: graphUrl,
      cache: new InMemoryCache()
    });
  }

  async getRecentTrades(
    pair: string,
    limit: number = 100
  ): Promise<Trade[]> {
    const query = gql`
      query GetRecentTrades($pair: String!, $limit: Int!) {
        swaps(
          first: $limit
          orderBy: timestamp
          orderDirection: desc
          where: { pair: $pair }
        ) {
          id
          timestamp
          amount0In
          amount1In
          amount0Out
          amount1Out
          amountUSD
          to
        }
      }
    `;

    const result = await this.client.query({
      query,
      variables: { pair, limit }
    });

    return result.data.swaps;
  }
}
```

## Configuration

### Environment Variables

Comprehensive environment configuration:

```typescript
// src/config/environment.ts
export interface EnvironmentConfig {
  // Network Configuration
  NETWORK: string;
  RPC_URL: string;
  CHAIN_ID: number;
  FALLBACK_RPC_URLS?: string[];

  // Wallet Configuration
  PRIVATE_KEY: string;
  PUBLIC_ADDRESS: string;

  // Flash Loan Configuration
  FLASH_LOAN_PREMIUM: number; // 0.09% = 9 basis points
  MAX_FLASH_LOAN_AMOUNT: string;
  MIN_PROFIT_THRESHOLD: string;

  // Gas Configuration
  DEFAULT_GAS_LIMIT: number;
  MAX_GAS_LIMIT: number;
  MAX_GAS_PRICE_GWEI: number;

  // DEX Configuration
  UNISWAP_V2_ROUTER: string;
  UNISWAP_V2_FACTORY: string;
  UNISWAP_V3_ROUTER: string;
  SUSHISWAP_ROUTER: string;
  BALANCER_VAULT: string;

  // Protocol Addresses
  AAVE_LENDING_POOL: string;
  AAVE_DATA_PROVIDER: string;
  COMPOUND_COMPTROLLER: string;

  // API Keys
  INFURA_API_KEY?: string;
  ALCHEMY_API_KEY?: string;
  ETHERSCAN_API_KEY?: string;
  COINGECKO_API_KEY?: string;

  // Trading Configuration
  TRADING_PAIRS: string[];
  MIN_SPREAD_THRESHOLD: number;
  MAX_LIQUIDITY_USAGE_PERCENT: number;
  SLIPPAGE_TOLERANCE: number;

  // Monitoring Configuration
  BLOCK_CONFIRMATION_COUNT: number;
  PRICE_UPDATE_INTERVAL: number;
  HEALTH_CHECK_INTERVAL: number;

  // Logging Configuration
  LOG_LEVEL: string;
  LOG_FILE_PATH?: string;
}

export function loadEnvironmentConfig(): EnvironmentConfig {
  dotenv.config();

  return {
    NETWORK: process.env.NETWORK || 'mainnet',
    RPC_URL: requireEnv('RPC_URL'),
    CHAIN_ID: parseInt(process.env.CHAIN_ID || '1'),
    FALLBACK_RPC_URLS: process.env.FALLBACK_RPC_URLS?.split(','),

    PRIVATE_KEY: requireEnv('PRIVATE_KEY'),
    PUBLIC_ADDRESS: process.env.PUBLIC_ADDRESS || '',

    FLASH_LOAN_PREMIUM: parseFloat(process.env.FLASH_LOAN_PREMIUM || '0.0009'),
    MAX_FLASH_LOAN_AMOUNT: process.env.MAX_FLASH_LOAN_AMOUNT || '1000000',
    MIN_PROFIT_THRESHOLD: process.env.MIN_PROFIT_THRESHOLD || '100',

    DEFAULT_GAS_LIMIT: parseInt(process.env.DEFAULT_GAS_LIMIT || '500000'),
    MAX_GAS_LIMIT: parseInt(process.env.MAX_GAS_LIMIT || '2000000'),
    MAX_GAS_PRICE_GWEI: parseInt(process.env.MAX_GAS_PRICE_GWEI || '500'),

    UNISWAP_V2_ROUTER: requireEnv('UNISWAP_V2_ROUTER'),
    UNISWAP_V2_FACTORY: requireEnv('UNISWAP_V2_FACTORY'),
    UNISWAP_V3_ROUTER: requireEnv('UNISWAP_V3_ROUTER'),
    SUSHISWAP_ROUTER: requireEnv('SUSHISWAP_ROUTER'),
    BALANCER_VAULT: requireEnv('BALANCER_VAULT'),

    AAVE_LENDING_POOL: requireEnv('AAVE_LENDING_POOL'),
    AAVE_DATA_PROVIDER: requireEnv('AAVE_DATA_PROVIDER'),
    COMPOUND_COMPTROLLER: process.env.COMPOUND_COMPTROLLER || '',

    INFURA_API_KEY: process.env.INFURA_API_KEY,
    ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY,
    ETHERSCAN_API_KEY: process.env.ETHERSCAN_API_KEY,
    COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,

    TRADING_PAIRS: (process.env.TRADING_PAIRS || '').split(','),
    MIN_SPREAD_THRESHOLD: parseFloat(process.env.MIN_SPREAD_THRESHOLD || '0.005'),
    MAX_LIQUIDITY_USAGE_PERCENT: parseInt(process.env.MAX_LIQUIDITY_USAGE_PERCENT || '10'),
    SLIPPAGE_TOLERANCE: parseFloat(process.env.SLIPPAGE_TOLERANCE || '0.01'),

    BLOCK_CONFIRMATION_COUNT: parseInt(process.env.BLOCK_CONFIRMATION_COUNT || '2'),
    PRICE_UPDATE_INTERVAL: parseInt(process.env.PRICE_UPDATE_INTERVAL || '1000'),
    HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000'),

    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_FILE_PATH: process.env.LOG_FILE_PATH
  };
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
```

### TypeScript Configuration

Optimized tsconfig.json for blockchain development:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node",
    "types": ["node", "jest"],
    "typeRoots": ["./node_modules/@types", "./src/types"],
    "paths": {
      "@contracts/*": ["./src/contracts/*"],
      "@services/*": ["./src/services/*"],
      "@utils/*": ["./src/utils/*"],
      "@config/*": ["./src/config/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

## Deployment Guide

### Prerequisites Setup

Step 1: Environment preparation

```bash
# Install Node.js v16+
nvm install 16
nvm use 16

# Clone repository
git clone https://github.com/kmoussai/flash-loan.git
cd flash-loan

# Install dependencies
npm install

# Install development dependencies
npm install --save-dev @types/node @types/jest hardhat
```

Step 2: Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env file with your configuration
nano .env
```

### Testnet Deployment

Deploy to Goerli testnet for testing:

```typescript
// scripts/deploy.ts
import { ethers } from 'hardhat';
import { FlashLoanService } from '../src/services/FlashLoanService';

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying with account:', deployer.address);
  console.log('Account balance:', (await deployer.getBalance()).toString());

  // Deploy flash loan receiver contract
  const FlashLoanReceiver = await ethers.getContractFactory('FlashLoanReceiver');
  const receiver = await FlashLoanReceiver.deploy(
    process.env.AAVE_LENDING_POOL!,
    process.env.UNISWAP_V2_ROUTER!,
    process.env.SUSHISWAP_ROUTER!
  );

  await receiver.deployed();

  console.log('FlashLoanReceiver deployed to:', receiver.address);

  // Verify deployment
  console.log('Verifying deployment...');
  const code = await ethers.provider.getCode(receiver.address);
  if (code === '0x') {
    throw new Error('Deployment failed: no code at address');
  }

  console.log('Deployment successful!');

  // Save deployment address
  const fs = require('fs');
  fs.writeFileSync(
    './deployments/goerli.json',
    JSON.stringify({
      receiver: receiver.address,
      deployer: deployer.address,
      timestamp: Date.now()
    }, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

Run deployment:

```bash
# Deploy to Goerli
npm run deploy:goerli

# Verify on Etherscan
npm run verify:goerli
```

### Mainnet Deployment

Critical steps for production deployment:

```bash
# 1. Run full test suite
npm test

# 2. Run security checks
npm run security:check

# 3. Deploy to mainnet
npm run deploy:mainnet

# 4. Verify contract
npm run verify:mainnet

# 5. Fund contract with gas money
npm run fund:mainnet

# 6. Test with small amount
npm run test:mainnet:small

# 7. Monitor closely
npm run monitor:mainnet
```

### Continuous Deployment

GitHub Actions workflow for automated deployment:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '16'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Deploy to testnet
        if: github.ref == 'refs/heads/develop'
        env:
          PRIVATE_KEY: ${{ secrets.TESTNET_PRIVATE_KEY }}
          RPC_URL: ${{ secrets.GOERLI_RPC_URL }}
        run: npm run deploy:goerli

      - name: Deploy to mainnet
        if: github.ref == 'refs/heads/main'
        env:
          PRIVATE_KEY: ${{ secrets.MAINNET_PRIVATE_KEY }}
          RPC_URL: ${{ secrets.MAINNET_RPC_URL }}
        run: npm run deploy:mainnet
```

## Testing Strategy

### Unit Testing

Comprehensive unit tests for all services:

```typescript
// test/unit/FlashLoanService.test.ts
import { FlashLoanService } from '../../src/services/FlashLoanService';
import { MockProvider, MockSigner } from '../mocks';

describe('FlashLoanService', () => {
  let service: FlashLoanService;
  let provider: MockProvider;
  let signer: MockSigner;

  beforeEach(() => {
    provider = new MockProvider();
    signer = new MockSigner();
    service = new FlashLoanService(provider, signer, testConfig);
  });

  describe('executeFlashLoan', () => {
    it('should execute flash loan successfully', async () => {
      const asset = '0x6B175474E89094C44Da98b954EedeAC495271d0F'; // DAI
      const amount = ethers.utils.parseEther('10000');

      const mockStrategy = {
        analyze: jest.fn().mockResolvedValue({
          profitable: true,
          expectedProfit: ethers.utils.parseEther('100')
        }),
        execute: jest.fn(),
        validate: jest.fn().mockReturnValue(true)
      };

      const receipt = await service.executeFlashLoan(
        asset,
        amount,
        mockStrategy
      );

      expect(receipt).toBeDefined();
      expect(receipt.status).toBe(1);
      expect(mockStrategy.analyze).toHaveBeenCalled();
    });

    it('should reject unprofitable opportunities', async () => {
      const asset = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
      const amount = ethers.utils.parseEther('10000');

      const mockStrategy = {
        analyze: jest.fn().mockResolvedValue({
          profitable: false,
          expectedProfit: ethers.utils.parseEther('-10')
        }),
        execute: jest.fn(),
        validate: jest.fn().mockReturnValue(true)
      };

      await expect(
        service.executeFlashLoan(asset, amount, mockStrategy)
      ).rejects.toThrow('Strategy not profitable');
    });

    it('should validate flash loan parameters', async () => {
      const invalidAsset = 'not-an-address';
      const amount = ethers.utils.parseEther('10000');
      const mockStrategy = {} as any;

      await expect(
        service.executeFlashLoan(invalidAsset, amount, mockStrategy)
      ).rejects.toThrow('Invalid asset address');
    });
  });
});
```

### Integration Testing

Test complete workflows:

```typescript
// test/integration/fullFlow.test.ts
import { FlashLoanService } from '../../src/services/FlashLoanService';
import { ArbitrageService } from '../../src/services/ArbitrageService';
import { ethers } from 'hardhat';

describe('Full Flash Loan Flow', () => {
  let flashLoanService: FlashLoanService;
  let arbitrageService: ArbitrageService;

  before(async () => {
    // Setup test environment
    const [signer] = await ethers.getSigners();
    const provider = ethers.provider;

    flashLoanService = new FlashLoanService(provider, signer, config);
    arbitrageService = new ArbitrageService(provider, config);
  });

  it('should find and execute profitable arbitrage', async () => {
    // Find opportunity
    const opportunity = await arbitrageService.findBestOpportunity();

    if (opportunity.profitable) {
      // Execute via flash loan
      const receipt = await flashLoanService.executeArbitrage(opportunity);

      expect(receipt.status).toBe(1);

      // Verify profit
      const profit = await calculateActualProfit(receipt);
      expect(profit.gt(0)).toBe(true);
    }
  }).timeout(30000);
});
```

### Gas Cost Analysis

Test gas consumption:

```typescript
// test/gas/gasAnalysis.test.ts
describe('Gas Cost Analysis', () => {
  it('should track gas costs for flash loan', async () => {
    const tx = await flashLoanService.executeFlashLoan(/*...*/);
    const receipt = await tx.wait();

    console.log('Gas used:', receipt.gasUsed.toString());
    console.log('Gas price:', tx.gasPrice.toString());
    console.log('Total cost:', receipt.gasUsed.mul(tx.gasPrice).toString());

    // Assert gas is within acceptable range
    expect(receipt.gasUsed.lt(ethers.BigNumber.from('1000000'))).toBe(true);
  });
});
```

## Performance Optimization

### Gas Optimization Techniques

Minimize gas consumption:

```typescript
class GasOptimizer {
  // Batch multiple operations
  async batchOperations(operations: Operation[]): Promise<TransactionReceipt> {
    const multicall = new ethers.Contract(
      MULTICALL_ADDRESS,
      MULTICALL_ABI,
      this.signer
    );

    const calls = operations.map(op => ({
      target: op.target,
      callData: op.data
    }));

    return await multicall.aggregate(calls);
  }

  // Use optimal gas price
  async getOptimalGasPrice(): Promise<BigNumber> {
    const [block, gasPrices] = await Promise.all([
      this.provider.getBlock('latest'),
      this.externalAPI.getGasPrices()
    ]);

    // Use base fee + priority fee model (EIP-1559)
    if (block.baseFeePerGas) {
      const maxPriorityFeePerGas = gasPrices.fast.sub(block.baseFeePerGas);
      return {
        maxFeePerGas: gasPrices.fast,
        maxPriorityFeePerGas
      };
    }

    return gasPrices.standard;
  }
}
```

### Caching Strategies

Implement intelligent caching:

```typescript
class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = 5000
  ): Promise<T> {
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.value as T;
    }

    const value = await fetcher();
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });

    return value;
  }

  invalidate(pattern: string): void {
    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}
```

### Parallel Processing

Execute independent operations concurrently:

```typescript
async function findOpportunitiesParallel(): Promise<ArbitrageOpportunity[]> {
  const pairs = config.TRADING_PAIRS;

  // Process pairs in parallel
  const opportunities = await Promise.all(
    pairs.map(async (pair) => {
      try {
        return await analyzePair(pair);
      } catch (error) {
        logger.error(`Failed to analyze pair ${pair}`, error);
        return null;
      }
    })
  );

  return opportunities.filter(opp => opp !== null && opp.profitable);
}
```

## Security Considerations

### Input Validation

Rigorous validation of all inputs:

```typescript
class SecurityValidator {
  validateAddress(address: string): void {
    if (!ethers.utils.isAddress(address)) {
      throw new SecurityError('Invalid address format');
    }

    if (this.isBlacklisted(address)) {
      throw new SecurityError('Address is blacklisted');
    }
  }

  validateAmount(amount: BigNumber): void {
    if (amount.lte(0)) {
      throw new SecurityError('Amount must be positive');
    }

    if (amount.gt(this.config.MAX_AMOUNT)) {
      throw new SecurityError('Amount exceeds maximum limit');
    }
  }

  validateTransaction(tx: TransactionRequest): void {
    // Check gas limits
    if (tx.gasLimit!.gt(this.config.MAX_GAS_LIMIT)) {
      throw new SecurityError('Gas limit too high');
    }

    // Verify destination
    this.validateAddress(tx.to!);

    // Check value
    if (tx.value) {
      this.validateAmount(tx.value);
    }
  }
}
```

### Reentrancy Protection

Implement checks-effects-interactions pattern:

```typescript
class ReentrancyGuard {
  private locked: boolean = false;

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.locked) {
      throw new Error('Reentrancy detected');
    }

    this.locked = true;
    try {
      return await fn();
    } finally {
      this.locked = false;
    }
  }
}
```

### Rate Limiting

Protect against abuse:

```typescript
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  checkLimit(key: string, maxRequests: number, windowMs: number): void {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests outside window
    const recentRequests = requests.filter(time => now - time < windowMs);

    if (recentRequests.length >= maxRequests) {
      throw new Error('Rate limit exceeded');
    }

    recentRequests.push(now);
    this.requests.set(key, recentRequests);
  }
}
```

## Advanced Features

### MEV Protection

Implement flashbots integration to avoid front-running:

```typescript
class FlashbotsService {
  private flashbotsProvider: FlashbotsBundleProvider;

  async sendPrivateTransaction(
    tx: TransactionRequest
  ): Promise<TransactionReceipt> {
    const signedTx = await this.signer.signTransaction(tx);

    const bundle = [
      { signedTransaction: signedTx }
    ];

    const targetBlock = await this.provider.getBlockNumber() + 1;

    const simulation = await this.flashbotsProvider.simulate(
      bundle,
      targetBlock
    );

    if ('error' in simulation) {
      throw new Error(`Simulation failed: ${simulation.error.message}`);
    }

    const bundleSubmission = await this.flashbotsProvider.sendRawBundle(
      bundle,
      targetBlock
    );

    const receipt = await bundleSubmission.wait();

    if (receipt === FlashbotsBundleResolution.BundleIncluded) {
      return await this.provider.getTransactionReceipt(tx.hash!);
    }

    throw new Error('Bundle not included');
  }
}
```

### Machine Learning Integration

Use ML for opportunity prediction:

```typescript
class MLPredictor {
  private model: any; // TensorFlow.js model

  async predictProfitability(
    opportunity: ArbitrageOpportunity
  ): Promise<number> {
    const features = this.extractFeatures(opportunity);
    const prediction = await this.model.predict(features);
    return prediction.dataSync()[0];
  }

  private extractFeatures(opportunity: ArbitrageOpportunity): Tensor {
    return tensor2d([[
      opportunity.expectedProfit.toNumber(),
      opportunity.gasEstimate.toNumber(),
      opportunity.path.length,
      opportunity.confidence,
      this.getHistoricalSuccessRate(opportunity.path)
    ]]);
  }
}
```

## Common Issues & Solutions

### Issue: Transaction Reverts

**Problem**: Flash loan transaction reverts without clear error message.

**Solution**:
```typescript
try {
  await flashLoanService.executeFlashLoan(asset, amount, strategy);
} catch (error) {
  if (error.message.includes('execution reverted')) {
    // Decode revert reason
    const reason = await this.decodeRevertReason(error);
    logger.error('Transaction reverted:', reason);

    // Common causes:
    // 1. Insufficient profit to repay loan
    // 2. Slippage too high
    // 3. Liquidity dried up
    // 4. Price moved against us
  }
}
```

### Issue: High Gas Costs

**Problem**: Gas costs eating into profits.

**Solution**:
```typescript
// Monitor gas prices and wait for favorable conditions
async function waitForLowGas(maxGasPrice: BigNumber): Promise<void> {
  while (true) {
    const currentGas = await provider.getGasPrice();
    if (currentGas.lte(maxGasPrice)) {
      break;
    }
    await delay(5000);
  }
}

// Use before executing
await waitForLowGas(ethers.utils.parseUnits('50', 'gwei'));
```

### Issue: Price Slippage

**Problem**: Actual execution price differs from quoted price.

**Solution**:
```typescript
// Add slippage tolerance and update quote before execution
async function executeWithSlippageProtection(
  trade: Trade,
  maxSlippage: number = 0.01
): Promise<void> {
  // Get fresh quote
  const currentPrice = await priceService.getPrice(trade.pair, trade.dex);

  // Check if price moved too much
  const slippage = Math.abs(currentPrice.price - trade.expectedPrice) / trade.expectedPrice;

  if (slippage > maxSlippage) {
    throw new Error(`Slippage ${slippage} exceeds maximum ${maxSlippage}`);
  }

  // Execute with minimum output amount
  const minOutput = trade.expectedOutput.mul(100 - maxSlippage * 100).div(100);
  await router.swap(trade.input, minOutput, trade.path);
}
```

## Enhancement Opportunities

### Multi-Chain Support

Extend to support multiple blockchains:

```typescript
interface ChainAdapter {
  getFlashLoanProvider(): IFlashLoanProvider;
  getDEXRouter(dex: string): Contract;
  getBlockTime(): number;
  getGasToken(): string;
}

class PolygonAdapter implements ChainAdapter {
  // Implement Polygon-specific logic
}

class ArbitrumAdapter implements ChainAdapter {
  // Implement Arbitrum-specific logic
}
```

### Advanced Strategies

Implement sophisticated trading strategies:

```typescript
class TriangularArbitrageStrategy implements IArbitrageStrategy {
  async analyze(): Promise<ArbitrageOpportunity> {
    // Find triangular arbitrage: A -> B -> C -> A
    const opportunities = [];

    for (const path of this.generateTriangularPaths()) {
      const profit = await this.calculateTriangularProfit(path);
      if (profit.gt(this.minProfit)) {
        opportunities.push({
          path,
          profit,
          type: 'triangular'
        });
      }
    }

    return this.selectBestOpportunity(opportunities);
  }
}
```

### Real-Time Monitoring Dashboard

Build a monitoring interface:

```typescript
class MonitoringService {
  private ws: WebSocket;

  startMonitoring(): void {
    this.ws = new WebSocket('ws://localhost:8080');

    // Stream opportunities
    this.on('opportunity', (opp) => {
      this.ws.send(JSON.stringify({
        type: 'opportunity',
        data: opp
      }));
    });

    // Stream executions
    this.on('execution', (tx) => {
      this.ws.send(JSON.stringify({
        type: 'execution',
        data: tx
      }));
    });
  }
}
```

### Automated Strategy Optimization

Use genetic algorithms to optimize parameters:

```typescript
class StrategyOptimizer {
  async optimize(
    strategy: IArbitrageStrategy,
    historicalData: MarketData[]
  ): Promise<OptimizedParameters> {
    let population = this.generateInitialPopulation();

    for (let generation = 0; generation < 100; generation++) {
      // Evaluate fitness
      const fitness = await this.evaluateFitness(population, historicalData);

      // Select best performers
      const selected = this.selection(population, fitness);

      // Create next generation
      population = this.crossoverAndMutate(selected);
    }

    return this.getBestIndividual(population);
  }
}
```
