**Source:** https://github.com/Whillyyyy/Flashloan-Arbitrage-Bot
**Date:** 2024-2025


# Flashloan-Arbitrage-Bot - Technical Implementation

## Architecture Deep Dive

### Clean Architecture Overview

The Flashloan-Arbitrage-Bot follows Clean Architecture principles, organizing code into distinct layers with clear dependencies flowing inward:

```
Presentation Layer (API/Worker)
        ↓
Application Layer (Services)
        ↓
Domain Layer (Core)
        ↓
Infrastructure Layer (Data/External Services)
```

Each layer has specific responsibilities and dependencies only flow inward, ensuring testability and maintainability.

### Core Domain Layer

The domain layer contains pure business logic with no external dependencies:

```csharp
// Core/Models/ArbitrageOpportunity.cs
public record ArbitrageOpportunity
{
    public Guid Id { get; init; }
    public DateTime DetectedAt { get; init; }
    public TokenPair TokenPair { get; init; }
    public DexType SourceDex { get; init; }
    public DexType TargetDex { get; init; }
    public decimal SourcePrice { get; init; }
    public decimal TargetPrice { get; init; }
    public decimal Spread { get; init; }
    public BigInteger OptimalAmount { get; init; }
    public BigInteger ExpectedProfit { get; init; }
    public BigInteger EstimatedGasCost { get; init; }
    public decimal Confidence { get; init; }
    public TradeRoute Route { get; init; }

    public bool IsProfitable() =>
        ExpectedProfit > EstimatedGasCost + CalculateFlashLoanFee();

    public decimal ProfitMargin() =>
        (ExpectedProfit - EstimatedGasCost) / (decimal)OptimalAmount;

    private BigInteger CalculateFlashLoanFee() =>
        OptimalAmount * 9 / 10000; // 0.09% Aave fee
}

// Core/Models/TradeRoute.cs
public record TradeRoute
{
    public required IReadOnlyList<TradeStep> Steps { get; init; }
    public BigInteger TotalGasEstimate { get; init; }
    public TimeSpan EstimatedDuration { get; init; }

    public bool IsValid() =>
        Steps.Count > 0 &&
        Steps.All(s => s.IsValid()) &&
        Steps.First().TokenIn == Steps.Last().TokenOut;
}

public record TradeStep
{
    public required string TokenIn { get; init; }
    public required string TokenOut { get; init; }
    public required DexType Dex { get; init; }
    public required string PoolAddress { get; init; }
    public BigInteger AmountIn { get; init; }
    public BigInteger ExpectedAmountOut { get; init; }
    public decimal SlippageTolerance { get; init; }

    public bool IsValid() =>
        !string.IsNullOrWhiteSpace(TokenIn) &&
        !string.IsNullOrWhiteSpace(TokenOut) &&
        TokenIn != TokenOut &&
        AmountIn > 0;
}
```

### Service Layer Architecture

The service layer implements business logic using dependency injection:

```csharp
// Services/Arbitrage/ArbitrageDetectionService.cs
public class ArbitrageDetectionService : IArbitrageDetectionService
{
    private readonly IPriceOracleService _priceOracle;
    private readonly IDexAggregatorService _dexAggregator;
    private readonly IProfitCalculationService _profitCalculator;
    private readonly ILogger<ArbitrageDetectionService> _logger;
    private readonly ArbitrageConfiguration _config;

    public ArbitrageDetectionService(
        IPriceOracleService priceOracle,
        IDexAggregatorService dexAggregator,
        IProfitCalculationService profitCalculator,
        ILogger<ArbitrageDetectionService> logger,
        IOptions<ArbitrageConfiguration> config)
    {
        _priceOracle = priceOracle;
        _dexAggregator = dexAggregator;
        _profitCalculator = profitCalculator;
        _logger = logger;
        _config = config.Value;
    }

    public async Task<IReadOnlyList<ArbitrageOpportunity>> DetectOpportunitiesAsync(
        CancellationToken cancellationToken = default)
    {
        var opportunities = new List<ArbitrageOpportunity>();

        foreach (var pair in _config.MonitoredPairs)
        {
            try
            {
                var opportunity = await AnalyzePairAsync(pair, cancellationToken);
                if (opportunity?.IsProfitable() == true)
                {
                    opportunities.Add(opportunity);
                    _logger.LogInformation(
                        "Detected profitable opportunity: {OpportunityId}, " +
                        "Expected Profit: {Profit} wei",
                        opportunity.Id,
                        opportunity.ExpectedProfit);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Error analyzing pair {TokenA}/{TokenB}",
                    pair.TokenA,
                    pair.TokenB);
            }
        }

        return opportunities
            .OrderByDescending(o => o.ExpectedProfit)
            .ToList();
    }

    private async Task<ArbitrageOpportunity?> AnalyzePairAsync(
        TokenPair pair,
        CancellationToken cancellationToken)
    {
        // Fetch prices from all configured DEXs in parallel
        var pricesTasks = _config.MonitoredDexs.Select(dex =>
            _priceOracle.GetPriceAsync(pair, dex, cancellationToken));

        var prices = await Task.WhenAll(pricesTasks);

        // Find minimum and maximum prices
        var minPrice = prices.MinBy(p => p.Price);
        var maxPrice = prices.MaxBy(p => p.Price);

        if (minPrice == null || maxPrice == null)
            return null;

        // Calculate spread
        var spread = (maxPrice.Price - minPrice.Price) / minPrice.Price;

        // Check if spread exceeds minimum threshold
        if (spread < _config.MinSpreadThreshold)
            return null;

        // Calculate optimal trade amount
        var optimalAmount = await CalculateOptimalAmountAsync(
            pair,
            minPrice,
            maxPrice,
            cancellationToken);

        // Build trade route
        var route = BuildTradeRoute(pair, minPrice.Dex, maxPrice.Dex, optimalAmount);

        // Calculate expected profit
        var expectedProfit = await _profitCalculator.CalculateExpectedProfitAsync(
            route,
            optimalAmount,
            cancellationToken);

        // Estimate gas cost
        var gasCost = await EstimateGasCostAsync(route, cancellationToken);

        return new ArbitrageOpportunity
        {
            Id = Guid.NewGuid(),
            DetectedAt = DateTime.UtcNow,
            TokenPair = pair,
            SourceDex = minPrice.Dex,
            TargetDex = maxPrice.Dex,
            SourcePrice = minPrice.Price,
            TargetPrice = maxPrice.Price,
            Spread = spread,
            OptimalAmount = optimalAmount,
            ExpectedProfit = expectedProfit,
            EstimatedGasCost = gasCost,
            Confidence = CalculateConfidence(spread, optimalAmount),
            Route = route
        };
    }

    private async Task<BigInteger> CalculateOptimalAmountAsync(
        TokenPair pair,
        PriceQuote buyPrice,
        PriceQuote sellPrice,
        CancellationToken cancellationToken)
    {
        // Get available liquidity
        var buyLiquidity = await _dexAggregator.GetLiquidityAsync(
            pair,
            buyPrice.Dex,
            cancellationToken);

        var sellLiquidity = await _dexAggregator.GetLiquidityAsync(
            pair,
            sellPrice.Dex,
            cancellationToken);

        // Maximum amount is limited by smaller liquidity pool
        var maxAmount = BigInteger.Min(
            buyLiquidity * _config.MaxLiquidityUsagePercent / 100,
            sellLiquidity * _config.MaxLiquidityUsagePercent / 100);

        // Binary search for optimal amount considering slippage
        return await BinarySearchOptimalAmountAsync(
            pair,
            buyPrice.Dex,
            sellPrice.Dex,
            maxAmount,
            cancellationToken);
    }

    private async Task<BigInteger> BinarySearchOptimalAmountAsync(
        TokenPair pair,
        DexType buyDex,
        DexType sellDex,
        BigInteger maxAmount,
        CancellationToken cancellationToken)
    {
        var low = maxAmount / 100; // Start at 1% of max
        var high = maxAmount;
        var optimalAmount = BigInteger.Zero;
        var maxProfit = BigInteger.Zero;

        while (high - low > Web3.Convert.ToWei(0.01m))
        {
            var mid = (low + high) / 2;

            // Get actual output amounts considering slippage
            var buyAmount = await _dexAggregator.GetAmountOutAsync(
                pair.TokenA,
                pair.TokenB,
                mid,
                buyDex,
                cancellationToken);

            var sellAmount = await _dexAggregator.GetAmountOutAsync(
                pair.TokenB,
                pair.TokenA,
                buyAmount,
                sellDex,
                cancellationToken);

            var profit = sellAmount - mid;

            if (profit > maxProfit)
            {
                maxProfit = profit;
                optimalAmount = mid;
                low = mid;
            }
            else
            {
                high = mid;
            }
        }

        return optimalAmount;
    }

    private decimal CalculateConfidence(decimal spread, BigInteger amount)
    {
        // Confidence based on spread magnitude and trade size
        var spreadConfidence = Math.Min(spread / _config.MinSpreadThreshold, 1.0m);
        var sizeConfidence = amount > Web3.Convert.ToWei(1000) ? 1.0m : 0.5m;

        return (spreadConfidence + sizeConfidence) / 2;
    }
}
```

### Flash Loan Service Implementation

The flash loan service handles interaction with lending protocols:

```csharp
// Services/FlashLoan/FlashLoanService.cs
public class FlashLoanService : IFlashLoanService
{
    private readonly IWeb3Service _web3Service;
    private readonly ITransactionService _transactionService;
    private readonly ILogger<FlashLoanService> _logger;
    private readonly FlashLoanConfiguration _config;
    private readonly IFlashLoanProvider _provider;

    public FlashLoanService(
        IWeb3Service web3Service,
        ITransactionService transactionService,
        ILogger<FlashLoanService> logger,
        IOptions<FlashLoanConfiguration> config,
        IFlashLoanProvider provider)
    {
        _web3Service = web3Service;
        _transactionService = transactionService;
        _logger = logger;
        _config = config.Value;
        _provider = provider;
    }

    public async Task<TransactionReceipt> ExecuteFlashLoanAsync(
        ArbitrageOpportunity opportunity,
        CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "Executing flash loan for opportunity {OpportunityId}",
            opportunity.Id);

        try
        {
            // Validate opportunity is still profitable
            await ValidateOpportunityAsync(opportunity, cancellationToken);

            // Build flash loan parameters
            var flashLoanParams = BuildFlashLoanParams(opportunity);

            // Encode arbitrage parameters
            var arbitrageParams = EncodeArbitrageParams(opportunity);

            // Execute flash loan
            var txHash = await _provider.RequestFlashLoanAsync(
                flashLoanParams.Assets,
                flashLoanParams.Amounts,
                arbitrageParams,
                cancellationToken);

            _logger.LogInformation(
                "Flash loan transaction submitted: {TxHash}",
                txHash);

            // Wait for transaction confirmation
            var receipt = await _transactionService.WaitForTransactionAsync(
                txHash,
                _config.ConfirmationBlocks,
                cancellationToken);

            if (receipt.Status.Value == 0)
            {
                throw new FlashLoanExecutionException(
                    "Flash loan transaction failed",
                    txHash);
            }

            _logger.LogInformation(
                "Flash loan executed successfully. Gas used: {GasUsed}",
                receipt.GasUsed.Value);

            return receipt;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to execute flash loan for opportunity {OpportunityId}",
                opportunity.Id);
            throw;
        }
    }

    private async Task ValidateOpportunityAsync(
        ArbitrageOpportunity opportunity,
        CancellationToken cancellationToken)
    {
        // Re-check prices to ensure opportunity still exists
        var currentPrices = await GetCurrentPricesAsync(
            opportunity.TokenPair,
            new[] { opportunity.SourceDex, opportunity.TargetDex },
            cancellationToken);

        var currentSpread = CalculateCurrentSpread(currentPrices);

        if (currentSpread < opportunity.Spread * 0.8m) // 20% tolerance
        {
            throw new PriceSlippageException(
                "Price spread has decreased significantly");
        }
    }

    private FlashLoanParams BuildFlashLoanParams(ArbitrageOpportunity opportunity)
    {
        return new FlashLoanParams
        {
            Assets = new[] { opportunity.TokenPair.TokenA },
            Amounts = new[] { opportunity.OptimalAmount },
            Modes = new[] { 0 }, // 0 = no debt
            OnBehalfOf = _config.ReceiverAddress,
            ReferralCode = 0
        };
    }

    private string EncodeArbitrageParams(ArbitrageOpportunity opportunity)
    {
        // Encode trade route for on-chain execution
        var encoder = new ABIEncode();

        return encoder.GetABIEncoded(
            new ABIValue("address[]", opportunity.Route.Steps.Select(s => s.PoolAddress).ToArray()),
            new ABIValue("uint256[]", opportunity.Route.Steps.Select(s => s.AmountIn).ToArray()),
            new ABIValue("uint256", opportunity.OptimalAmount),
            new ABIValue("uint256", opportunity.ExpectedProfit * 95 / 100) // 5% slippage
        ).ToHex();
    }
}

// Services/FlashLoan/AaveFlashLoanProvider.cs
public class AaveFlashLoanProvider : IFlashLoanProvider
{
    private readonly IWeb3Service _web3Service;
    private readonly Contract _lendingPoolContract;
    private readonly ILogger<AaveFlashLoanProvider> _logger;

    public AaveFlashLoanProvider(
        IWeb3Service web3Service,
        ILogger<AaveFlashLoanProvider> logger)
    {
        _web3Service = web3Service;
        _logger = logger;

        var web3 = _web3Service.GetWeb3();
        _lendingPoolContract = web3.Eth.GetContract(
            AaveAbi.LendingPoolAbi,
            ContractAddresses.AaveLendingPool);
    }

    public async Task<string> RequestFlashLoanAsync(
        string[] assets,
        BigInteger[] amounts,
        string params,
        CancellationToken cancellationToken = default)
    {
        var flashLoanFunction = _lendingPoolContract.GetFunction("flashLoan");

        var receiverAddress = ContractAddresses.FlashLoanReceiver;

        var transactionInput = flashLoanFunction.CreateTransactionInput(
            _web3Service.GetAccount().Address,
            receiverAddress,
            assets,
            amounts,
            new BigInteger[] { 0 }, // modes
            receiverAddress, // onBehalfOf
            params,
            0 // referralCode
        );

        // Estimate gas
        var gas = await flashLoanFunction.EstimateGasAsync(
            _web3Service.GetAccount().Address,
            null,
            null,
            receiverAddress,
            assets,
            amounts,
            new BigInteger[] { 0 },
            receiverAddress,
            params,
            0);

        transactionInput.Gas = gas.Value * 12 / 10; // 20% buffer

        // Get optimal gas price
        var gasPrice = await _web3Service.GetOptimalGasPriceAsync(cancellationToken);
        transactionInput.GasPrice = gasPrice;

        // Send transaction
        var txHash = await _web3Service.GetWeb3().Eth.TransactionManager
            .SendTransactionAsync(transactionInput);

        return txHash;
    }
}
```

## Code Analysis

### DEX Adapter Pattern

Each DEX has its own adapter implementing a common interface:

```csharp
// Services/Dex/UniswapV2Adapter.cs
public class UniswapV2Adapter : IDexAdapter
{
    private readonly IWeb3Service _web3Service;
    private readonly Contract _routerContract;
    private readonly Contract _factoryContract;
    private readonly ILogger<UniswapV2Adapter> _logger;

    public DexType DexType => DexType.UniswapV2;

    public UniswapV2Adapter(
        IWeb3Service web3Service,
        ILogger<UniswapV2Adapter> logger)
    {
        _web3Service = web3Service;
        _logger = logger;

        var web3 = web3Service.GetWeb3();
        _routerContract = web3.Eth.GetContract(
            UniswapV2Abi.RouterAbi,
            ContractAddresses.UniswapV2Router);
        _factoryContract = web3.Eth.GetContract(
            UniswapV2Abi.FactoryAbi,
            ContractAddresses.UniswapV2Factory);
    }

    public async Task<PriceQuote> GetPriceAsync(
        TokenPair pair,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var pairAddress = await GetPairAddressAsync(
                pair.TokenA,
                pair.TokenB,
                cancellationToken);

            if (pairAddress == Address.Zero)
            {
                throw new InvalidOperationException("Pair does not exist");
            }

            var pairContract = _web3Service.GetWeb3().Eth.GetContract(
                UniswapV2Abi.PairAbi,
                pairAddress);

            var getReservesFunction = pairContract.GetFunction("getReserves");
            var reserves = await getReservesFunction.CallDeserializingToObjectAsync<ReservesOutput>();

            // Calculate price (reserve1 / reserve0)
            var price = (decimal)reserves.Reserve1 / (decimal)reserves.Reserve0;

            return new PriceQuote
            {
                Dex = DexType.UniswapV2,
                Price = price,
                PoolAddress = pairAddress,
                Liquidity = reserves.Reserve0,
                Timestamp = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Failed to get price for pair {TokenA}/{TokenB}",
                pair.TokenA,
                pair.TokenB);
            throw;
        }
    }

    public async Task<BigInteger> GetAmountOutAsync(
        string tokenIn,
        string tokenOut,
        BigInteger amountIn,
        CancellationToken cancellationToken = default)
    {
        var getAmountsOutFunction = _routerContract.GetFunction("getAmountsOut");

        var amounts = await getAmountsOutFunction.CallAsync<List<BigInteger>>(
            amountIn,
            new[] { tokenIn, tokenOut });

        return amounts[^1]; // Last amount in the array
    }

    public async Task<BigInteger> GetLiquidityAsync(
        TokenPair pair,
        CancellationToken cancellationToken = default)
    {
        var pairAddress = await GetPairAddressAsync(
            pair.TokenA,
            pair.TokenB,
            cancellationToken);

        var pairContract = _web3Service.GetWeb3().Eth.GetContract(
            UniswapV2Abi.PairAbi,
            pairAddress);

        var getReservesFunction = pairContract.GetFunction("getReserves");
        var reserves = await getReservesFunction.CallDeserializingToObjectAsync<ReservesOutput>();

        return reserves.Reserve0;
    }

    private async Task<string> GetPairAddressAsync(
        string tokenA,
        string tokenB,
        CancellationToken cancellationToken)
    {
        var getPairFunction = _factoryContract.GetFunction("getPair");
        var pairAddress = await getPairFunction.CallAsync<string>(tokenA, tokenB);
        return pairAddress;
    }

    [FunctionOutput]
    public class ReservesOutput : IFunctionOutputDTO
    {
        [Parameter("uint112", "reserve0", 1)]
        public BigInteger Reserve0 { get; set; }

        [Parameter("uint112", "reserve1", 2)]
        public BigInteger Reserve1 { get; set; }

        [Parameter("uint32", "blockTimestampLast", 3)]
        public uint BlockTimestampLast { get; set; }
    }
}

// Services/Dex/UniswapV3Adapter.cs
public class UniswapV3Adapter : IDexAdapter
{
    private readonly IWeb3Service _web3Service;
    private readonly Contract _quoterContract;
    private readonly Contract _routerContract;
    private readonly ILogger<UniswapV3Adapter> _logger;

    public DexType DexType => DexType.UniswapV3;

    public async Task<PriceQuote> GetPriceAsync(
        TokenPair pair,
        CancellationToken cancellationToken = default)
    {
        // Uniswap V3 uses concentrated liquidity, need to query quoter
        var quoteExactInputSingleFunction = _quoterContract.GetFunction("quoteExactInputSingle");

        var standardAmount = Web3.Convert.ToWei(1); // Quote for 1 token

        try
        {
            var amountOut = await quoteExactInputSingleFunction.CallAsync<BigInteger>(
                pair.TokenA,
                pair.TokenB,
                3000, // 0.3% fee tier
                standardAmount,
                0); // sqrtPriceLimitX96 = 0 (no limit)

            var price = (decimal)amountOut / (decimal)standardAmount;

            return new PriceQuote
            {
                Dex = DexType.UniswapV3,
                Price = price,
                PoolAddress = await GetPoolAddressAsync(pair, 3000),
                Timestamp = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get Uniswap V3 price");
            throw;
        }
    }

    public async Task<BigInteger> GetAmountOutAsync(
        string tokenIn,
        string tokenOut,
        BigInteger amountIn,
        CancellationToken cancellationToken = default)
    {
        var quoteExactInputSingleFunction = _quoterContract.GetFunction("quoteExactInputSingle");

        return await quoteExactInputSingleFunction.CallAsync<BigInteger>(
            tokenIn,
            tokenOut,
            3000, // 0.3% fee tier
            amountIn,
            0);
    }

    private async Task<string> GetPoolAddressAsync(TokenPair pair, int fee)
    {
        var factoryContract = _web3Service.GetWeb3().Eth.GetContract(
            UniswapV3Abi.FactoryAbi,
            ContractAddresses.UniswapV3Factory);

        var getPoolFunction = factoryContract.GetFunction("getPool");
        return await getPoolFunction.CallAsync<string>(pair.TokenA, pair.TokenB, fee);
    }
}
```

### Price Oracle Service

Aggregates prices from multiple sources:

```csharp
// Services/Pricing/PriceOracleService.cs
public class PriceOracleService : IPriceOracleService
{
    private readonly IDexAggregatorService _dexAggregator;
    private readonly IPriceCacheService _cacheService;
    private readonly ILogger<PriceOracleService> _logger;

    public async Task<PriceQuote> GetPriceAsync(
        TokenPair pair,
        DexType dex,
        CancellationToken cancellationToken = default)
    {
        // Check cache first
        var cacheKey = $"{pair.TokenA}:{pair.TokenB}:{dex}";
        var cachedPrice = await _cacheService.GetAsync<PriceQuote>(cacheKey);

        if (cachedPrice != null &&
            DateTime.UtcNow - cachedPrice.Timestamp < TimeSpan.FromSeconds(1))
        {
            return cachedPrice;
        }

        // Fetch fresh price
        var adapter = _dexAggregator.GetAdapter(dex);
        var price = await adapter.GetPriceAsync(pair, cancellationToken);

        // Cache the result
        await _cacheService.SetAsync(
            cacheKey,
            price,
            TimeSpan.FromSeconds(2));

        return price;
    }

    public async Task<IReadOnlyList<PriceQuote>> GetPricesAsync(
        TokenPair pair,
        IEnumerable<DexType> dexs,
        CancellationToken cancellationToken = default)
    {
        var tasks = dexs.Select(dex =>
            GetPriceAsync(pair, dex, cancellationToken));

        var prices = await Task.WhenAll(tasks);

        return prices.Where(p => p != null).ToList();
    }
}
```

### Background Worker Service

Continuously monitors for opportunities:

```csharp
// Worker/Services/ArbitrageWorkerService.cs
public class ArbitrageWorkerService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ArbitrageWorkerService> _logger;
    private readonly IHubContext<ArbitrageHub> _hubContext;
    private readonly WorkerConfiguration _config;

    public ArbitrageWorkerService(
        IServiceProvider serviceProvider,
        ILogger<ArbitrageWorkerService> logger,
        IHubContext<ArbitrageHub> hubContext,
        IOptions<WorkerConfiguration> config)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _hubContext = hubContext;
        _config = config.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Arbitrage Worker Service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PerformArbitrageCheckAsync(stoppingToken);
                await Task.Delay(_config.CheckInterval, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in arbitrage worker service");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }

        _logger.LogInformation("Arbitrage Worker Service stopped");
    }

    private async Task PerformArbitrageCheckAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();

        var detectionService = scope.ServiceProvider
            .GetRequiredService<IArbitrageDetectionService>();
        var executionService = scope.ServiceProvider
            .GetRequiredService<IArbitrageExecutionService>();

        // Detect opportunities
        var opportunities = await detectionService.DetectOpportunitiesAsync(cancellationToken);

        if (!opportunities.Any())
        {
            _logger.LogDebug("No profitable opportunities found");
            return;
        }

        _logger.LogInformation(
            "Found {Count} profitable opportunities",
            opportunities.Count);

        // Broadcast to dashboard
        await _hubContext.Clients.All.SendAsync(
            "OpportunitiesDetected",
            opportunities,
            cancellationToken);

        // Execute most profitable opportunity
        var bestOpportunity = opportunities.First();

        if (_config.AutoExecute)
        {
            try
            {
                var result = await executionService.ExecuteAsync(
                    bestOpportunity,
                    cancellationToken);

                await _hubContext.Clients.All.SendAsync(
                    "ExecutionCompleted",
                    result,
                    cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to execute opportunity {OpportunityId}",
                    bestOpportunity.Id);

                await _hubContext.Clients.All.SendAsync(
                    "ExecutionFailed",
                    new { OpportunityId = bestOpportunity.Id, Error = ex.Message },
                    cancellationToken);
            }
        }
    }
}
```

## Smart Contract Details

### Flash Loan Receiver Contract

The on-chain component that receives and executes flash loans:

```solidity
// Contracts/Solidity/FlashLoanArbitrageBot.sol
pragma solidity ^0.8.0;

import "@aave/core-v3/contracts/flashloan/base/FlashLoanReceiverBase.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract FlashLoanArbitrageBot is FlashLoanReceiverBase {
    address private immutable owner;
    IUniswapV2Router02 private immutable uniswapRouter;
    IUniswapV2Router02 private immutable sushiswapRouter;

    event ArbitrageExecuted(
        address indexed token,
        uint256 amount,
        uint256 profit
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(
        address _addressProvider,
        address _uniswapRouter,
        address _sushiswapRouter
    ) FlashLoanReceiverBase(IPoolAddressesProvider(_addressProvider)) {
        owner = msg.sender;
        uniswapRouter = IUniswapV2Router02(_uniswapRouter);
        sushiswapRouter = IUniswapV2Router02(_sushiswapRouter);
    }

    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(initiator == owner, "Unauthorized initiator");

        // Decode arbitrage parameters
        (
            address[] memory poolAddresses,
            uint256[] memory tradeAmounts,
            uint256 totalAmount,
            uint256 minProfit
        ) = abi.decode(params, (address[], uint256[], uint256, uint256));

        // Execute arbitrage trades
        uint256 finalAmount = executeArbitrage(
            assets[0],
            poolAddresses,
            tradeAmounts,
            totalAmount
        );

        // Calculate profit
        uint256 amountOwing = amounts[0] + premiums[0];
        require(finalAmount >= amountOwing, "Insufficient profit");

        uint256 profit = finalAmount - amountOwing;
        require(profit >= minProfit, "Profit below minimum");

        // Approve lending pool to pull the owed amount
        IERC20(assets[0]).approve(address(POOL), amountOwing);

        // Transfer profit to owner
        IERC20(assets[0]).transfer(owner, profit);

        emit ArbitrageExecuted(assets[0], amounts[0], profit);

        return true;
    }

    function executeArbitrage(
        address token,
        address[] memory poolAddresses,
        uint256[] memory amounts,
        uint256 totalAmount
    ) private returns (uint256) {
        uint256 currentAmount = totalAmount;

        for (uint256 i = 0; i < poolAddresses.length; i++) {
            // Determine which router to use based on pool address
            IUniswapV2Router02 router = determineRouter(poolAddresses[i]);

            // Execute swap
            currentAmount = executeSingleSwap(
                router,
                token,
                amounts[i],
                currentAmount
            );
        }

        return currentAmount;
    }

    function executeSingleSwap(
        IUniswapV2Router02 router,
        address token,
        uint256 amountIn,
        uint256 currentAmount
    ) private returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = token;
        path[1] = getTargetToken(token);

        IERC20(token).approve(address(router), amountIn);

        uint256[] memory amounts = router.swapExactTokensForTokens(
            amountIn,
            0, // Accept any amount (slippage handled in params)
            path,
            address(this),
            block.timestamp + 300
        );

        return amounts[amounts.length - 1];
    }

    function determineRouter(address poolAddress)
        private
        view
        returns (IUniswapV2Router02)
    {
        // Logic to determine which router based on pool address
        // This would be more sophisticated in production
        return uniswapRouter;
    }

    function getTargetToken(address token) private pure returns (address) {
        // Determine target token for swap
        // This would be passed in params in production
        return token;
    }

    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    function withdrawETH() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {}
}
```

### Contract Interaction from C#

Using Nethereum to interact with the contract:

```csharp
// Services/Blockchain/Web3Service.cs
public class Web3Service : IWeb3Service
{
    private readonly Web3 _web3;
    private readonly Account _account;
    private readonly BlockchainConfiguration _config;

    public Web3Service(IOptions<BlockchainConfiguration> config)
    {
        _config = config.Value;
        _account = new Account(_config.PrivateKey, _config.ChainId);
        _web3 = new Web3(_account, _config.RpcUrl);
    }

    public Web3 GetWeb3() => _web3;

    public Account GetAccount() => _account;

    public async Task<BigInteger> GetOptimalGasPriceAsync(
        CancellationToken cancellationToken = default)
    {
        var gasPrice = await _web3.Eth.GasPrice.SendRequestAsync();

        // Add 10% to ensure inclusion
        return gasPrice * 110 / 100;
    }

    public async Task<string> DeployContractAsync<TDeployment>(
        TDeployment deployment,
        CancellationToken cancellationToken = default)
        where TDeployment : ContractDeploymentMessage, new()
    {
        var receipt = await _web3.Eth.GetContractDeploymentHandler<TDeployment>()
            .SendRequestAndWaitForReceiptAsync(deployment, cancellationToken);

        return receipt.ContractAddress;
    }
}

// Contract Deployment
[Function("FlashLoanArbitrageBot")]
public class FlashLoanArbitrageBotDeployment : ContractDeploymentMessage
{
    public FlashLoanArbitrageBotDeployment() : base(BYTECODE) { }

    [Parameter("address", "_addressProvider", 1)]
    public string AddressProvider { get; set; }

    [Parameter("address", "_uniswapRouter", 2)]
    public string UniswapRouter { get; set; }

    [Parameter("address", "_sushiswapRouter", 3)]
    public string SushiswapRouter { get; set; }

    private const string BYTECODE = "0x..."; // Contract bytecode
}
```

## API Integration

### REST API Controllers

Expose functionality through REST endpoints:

```csharp
// Api/Controllers/ArbitrageController.cs
[ApiController]
[Route("api/[controller]")]
public class ArbitrageController : ControllerBase
{
    private readonly IArbitrageDetectionService _detectionService;
    private readonly IArbitrageExecutionService _executionService;
    private readonly ILogger<ArbitrageController> _logger;

    public ArbitrageController(
        IArbitrageDetectionService detectionService,
        IArbitrageExecutionService executionService,
        ILogger<ArbitrageController> logger)
    {
        _detectionService = detectionService;
        _executionService = executionService;
        _logger = logger;
    }

    [HttpGet("opportunities")]
    [ProducesResponseType(typeof(IReadOnlyList<ArbitrageOpportunity>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOpportunities(
        CancellationToken cancellationToken)
    {
        var opportunities = await _detectionService.DetectOpportunitiesAsync(cancellationToken);
        return Ok(opportunities);
    }

    [HttpPost("execute/{opportunityId}")]
    [ProducesResponseType(typeof(ExecutionResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ExecuteOpportunity(
        Guid opportunityId,
        CancellationToken cancellationToken)
    {
        try
        {
            // Get opportunity details
            var opportunities = await _detectionService.DetectOpportunitiesAsync(cancellationToken);
            var opportunity = opportunities.FirstOrDefault(o => o.Id == opportunityId);

            if (opportunity == null)
            {
                return NotFound("Opportunity not found or expired");
            }

            // Execute
            var result = await _executionService.ExecuteAsync(opportunity, cancellationToken);

            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to execute opportunity {OpportunityId}", opportunityId);
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("statistics")]
    [ProducesResponseType(typeof(ArbitrageStatistics), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetStatistics(
        [FromQuery] DateTime? from,
        [FromQuery] DateTime? to,
        CancellationToken cancellationToken)
    {
        var statistics = await _executionService.GetStatisticsAsync(
            from ?? DateTime.UtcNow.AddDays(-7),
            to ?? DateTime.UtcNow,
            cancellationToken);

        return Ok(statistics);
    }
}
```

### SignalR Hub for Real-Time Updates

```csharp
// Api/Hubs/ArbitrageHub.cs
public class ArbitrageHub : Hub
{
    private readonly IArbitrageDetectionService _detectionService;
    private readonly ILogger<ArbitrageHub> _logger;

    public ArbitrageHub(
        IArbitrageDetectionService detectionService,
        ILogger<ArbitrageHub> logger)
    {
        _detectionService = detectionService;
        _logger = logger;
    }

    public override async Task OnConnectedAsync()
    {
        _logger.LogInformation("Client connected: {ConnectionId}", Context.ConnectionId);
        await base.OnConnectedAsync();
    }

    public async Task SubscribeToOpportunities()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "opportunities");
        _logger.LogInformation(
            "Client {ConnectionId} subscribed to opportunities",
            Context.ConnectionId);
    }

    public async Task UnsubscribeFromOpportunities()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "opportunities");
    }

    public async Task<IReadOnlyList<ArbitrageOpportunity>> GetCurrentOpportunities()
    {
        return await _detectionService.DetectOpportunitiesAsync();
    }
}

// Usage in worker service to broadcast updates
await _hubContext.Clients.Group("opportunities").SendAsync(
    "OpportunityDetected",
    opportunity,
    cancellationToken);
```

## Configuration

### Application Settings

Comprehensive configuration using appsettings.json:

```json
{
  "Blockchain": {
    "Network": "mainnet",
    "RpcUrl": "https://mainnet.infura.io/v3/YOUR_PROJECT_ID",
    "FallbackRpcUrls": [
      "https://eth-mainnet.alchemyapi.io/v2/YOUR_API_KEY",
      "https://cloudflare-eth.com"
    ],
    "ChainId": 1,
    "ConfirmationBlocks": 2,
    "MaxGasPrice": 200
  },
  "FlashLoan": {
    "Provider": "Aave",
    "ReceiverAddress": "0x...",
    "Premium": 0.0009,
    "MaxLoanAmount": "1000000000000000000000000",
    "MinLoanAmount": "1000000000000000000"
  },
  "Arbitrage": {
    "MonitoredPairs": [
      {
        "TokenA": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        "TokenB": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        "Name": "WETH/DAI"
      }
    ],
    "MonitoredDexs": ["UniswapV2", "SushiSwap", "UniswapV3"],
    "MinSpreadThreshold": 0.005,
    "MinProfitThreshold": "100000000000000000",
    "MaxLiquidityUsagePercent": 10,
    "SlippageTolerance": 0.01
  },
  "Worker": {
    "CheckInterval": "00:00:01",
    "AutoExecute": false,
    "MaxConcurrentExecutions": 1
  },
  "Caching": {
    "Provider": "Redis",
    "ConnectionString": "localhost:6379",
    "DefaultExpiration": "00:00:05"
  },
  "Database": {
    "ConnectionString": "Server=localhost;Database=FlashLoanBot;Trusted_Connection=True;",
    "Provider": "SqlServer"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft": "Warning",
      "System": "Warning"
    }
  },
  "ApplicationInsights": {
    "InstrumentationKey": "YOUR_KEY"
  }
}
```

### Configuration Classes

Strongly-typed configuration:

```csharp
// Infrastructure/Configuration/BlockchainConfiguration.cs
public class BlockchainConfiguration
{
    public const string Section = "Blockchain";

    public string Network { get; set; } = "mainnet";
    public string RpcUrl { get; set; } = string.Empty;
    public List<string>? FallbackRpcUrls { get; set; }
    public string PrivateKey { get; set; } = string.Empty;
    public int ChainId { get; set; } = 1;
    public int ConfirmationBlocks { get; set; } = 2;
    public int MaxGasPrice { get; set; } = 200;

    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(RpcUrl))
            throw new InvalidOperationException("RpcUrl is required");

        if (string.IsNullOrWhiteSpace(PrivateKey))
            throw new InvalidOperationException("PrivateKey is required");

        if (ChainId <= 0)
            throw new InvalidOperationException("Invalid ChainId");
    }
}

// Startup registration
builder.Services.Configure<BlockchainConfiguration>(
    builder.Configuration.GetSection(BlockchainConfiguration.Section));

builder.Services.AddSingleton<IValidateOptions<BlockchainConfiguration>,
    ValidateOptions<BlockchainConfiguration>>();
```

## Deployment Guide

### Local Development Setup

Step-by-step setup for development:

```powershell
# 1. Clone repository
git clone https://github.com/Whillyyyy/Flashloan-Arbitrage-Bot.git
cd Flashloan-Arbitrage-Bot

# 2. Install .NET SDK (if not already installed)
# Download from https://dotnet.microsoft.com/download

# 3. Restore dependencies
dotnet restore

# 4. Set up user secrets
cd src/FlashLoanBot.Api
dotnet user-secrets init
dotnet user-secrets set "Blockchain:PrivateKey" "your_private_key"
dotnet user-secrets set "Blockchain:RpcUrl" "your_rpc_url"

# 5. Start dependencies (Redis, SQL Server)
docker-compose up -d redis sqlserver

# 6. Run migrations
cd ../FlashLoanBot.Infrastructure
dotnet ef database update

# 7. Run tests
cd ../../tests/FlashLoanBot.Tests.Unit
dotnet test

# 8. Start API
cd ../../src/FlashLoanBot.Api
dotnet run

# 9. Start Worker (in new terminal)
cd ../FlashLoanBot.Worker
dotnet run
```

### Docker Deployment

Complete Docker setup:

```dockerfile
# docker/Dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:7.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:7.0 AS build
WORKDIR /src

# Copy csproj files and restore
COPY ["src/FlashLoanBot.Api/FlashLoanBot.Api.csproj", "FlashLoanBot.Api/"]
COPY ["src/FlashLoanBot.Core/FlashLoanBot.Core.csproj", "FlashLoanBot.Core/"]
COPY ["src/FlashLoanBot.Services/FlashLoanBot.Services.csproj", "FlashLoanBot.Services/"]
COPY ["src/FlashLoanBot.Infrastructure/FlashLoanBot.Infrastructure.csproj", "FlashLoanBot.Infrastructure/"]

RUN dotnet restore "FlashLoanBot.Api/FlashLoanBot.Api.csproj"

# Copy everything else and build
COPY src/ .
WORKDIR "/src/FlashLoanBot.Api"
RUN dotnet build "FlashLoanBot.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "FlashLoanBot.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "FlashLoanBot.Api.dll"]
```

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "5000:80"
      - "5001:443"
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
      - Blockchain__RpcUrl=${RPC_URL}
      - Blockchain__PrivateKey=${PRIVATE_KEY}
      - Caching__ConnectionString=redis:6379
      - Database__ConnectionString=Server=sqlserver;Database=FlashLoanBot;User=sa;Password=${SA_PASSWORD}
    depends_on:
      - redis
      - sqlserver
    networks:
      - flashloan-network

  worker:
    build:
      context: ..
      dockerfile: docker/Dockerfile.Worker
    environment:
      - DOTNET_ENVIRONMENT=Production
      - Blockchain__RpcUrl=${RPC_URL}
      - Blockchain__PrivateKey=${PRIVATE_KEY}
      - Caching__ConnectionString=redis:6379
      - Database__ConnectionString=Server=sqlserver;Database=FlashLoanBot;User=sa;Password=${SA_PASSWORD}
    depends_on:
      - redis
      - sqlserver
      - api
    networks:
      - flashloan-network

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - flashloan-network

  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    environment:
      - ACCEPT_EULA=Y
      - SA_PASSWORD=${SA_PASSWORD}
    ports:
      - "1433:1433"
    volumes:
      - sqlserver-data:/var/opt/mssql
    networks:
      - flashloan-network

volumes:
  redis-data:
  sqlserver-data:

networks:
  flashloan-network:
    driver: bridge
```

### Azure Deployment

Deploy to Azure using CLI:

```powershell
# 1. Login to Azure
az login

# 2. Create resource group
az group create --name flashloan-bot-rg --location eastus

# 3. Create container registry
az acr create --resource-group flashloan-bot-rg \
  --name flashloanbotacr --sku Basic

# 4. Build and push image
az acr build --registry flashloanbotacr \
  --image flashloan-bot:latest .

# 5. Create AKS cluster
az aks create --resource-group flashloan-bot-rg \
  --name flashloan-bot-aks \
  --node-count 2 \
  --generate-ssh-keys \
  --attach-acr flashloanbotacr

# 6. Get credentials
az aks get-credentials --resource-group flashloan-bot-rg \
  --name flashloan-bot-aks

# 7. Deploy to Kubernetes
kubectl apply -f kubernetes/deployment.yml
kubectl apply -f kubernetes/service.yml

# 8. Configure secrets
kubectl create secret generic blockchain-secrets \
  --from-literal=private-key=$PRIVATE_KEY \
  --from-literal=rpc-url=$RPC_URL
```

## Testing Strategy

### Unit Testing

Comprehensive unit tests:

```csharp
// Tests/Unit/Services/ArbitrageDetectionServiceTests.cs
public class ArbitrageDetectionServiceTests
{
    private readonly Mock<IPriceOracleService> _priceOracleMock;
    private readonly Mock<IDexAggregatorService> _dexAggregatorMock;
    private readonly Mock<IProfitCalculationService> _profitCalculatorMock;
    private readonly Mock<ILogger<ArbitrageDetectionService>> _loggerMock;
    private readonly ArbitrageConfiguration _config;
    private readonly ArbitrageDetectionService _service;

    public ArbitrageDetectionServiceTests()
    {
        _priceOracleMock = new Mock<IPriceOracleService>();
        _dexAggregatorMock = new Mock<IDexAggregatorService>();
        _profitCalculatorMock = new Mock<IProfitCalculationService>();
        _loggerMock = new Mock<ILogger<ArbitrageDetectionService>>();

        _config = new ArbitrageConfiguration
        {
            MonitoredPairs = new[]
            {
                new TokenPair
                {
                    TokenA = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
                    TokenB = "0x6B175474E89094C44Da98b954EedeAC495271d0F"  // DAI
                }
            },
            MonitoredDexs = new[] { DexType.UniswapV2, DexType.SushiSwap },
            MinSpreadThreshold = 0.005m,
            MinProfitThreshold = Web3.Convert.ToWei(0.1m)
        };

        _service = new ArbitrageDetectionService(
            _priceOracleMock.Object,
            _dexAggregatorMock.Object,
            _profitCalculatorMock.Object,
            _loggerMock.Object,
            Options.Create(_config));
    }

    [Fact]
    public async Task DetectOpportunitiesAsync_WhenProfitableSpreadExists_ReturnsOpportunity()
    {
        // Arrange
        var pair = _config.MonitoredPairs.First();

        _priceOracleMock
            .Setup(x => x.GetPriceAsync(pair, DexType.UniswapV2, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PriceQuote
            {
                Dex = DexType.UniswapV2,
                Price = 1.0m,
                Timestamp = DateTime.UtcNow
            });

        _priceOracleMock
            .Setup(x => x.GetPriceAsync(pair, DexType.SushiSwap, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PriceQuote
            {
                Dex = DexType.SushiSwap,
                Price = 1.02m, // 2% spread
                Timestamp = DateTime.UtcNow
            });

        _dexAggregatorMock
            .Setup(x => x.GetLiquidityAsync(It.IsAny<TokenPair>(), It.IsAny<DexType>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Web3.Convert.ToWei(1000000));

        _profitCalculatorMock
            .Setup(x => x.CalculateExpectedProfitAsync(It.IsAny<TradeRoute>(), It.IsAny<BigInteger>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Web3.Convert.ToWei(1)); // 1 ETH profit

        // Act
        var opportunities = await _service.DetectOpportunitiesAsync();

        // Assert
        opportunities.Should().NotBeEmpty();
        opportunities.First().Should().Match<ArbitrageOpportunity>(o =>
            o.IsProfitable() && o.Spread > _config.MinSpreadThreshold);
    }

    [Fact]
    public async Task DetectOpportunitiesAsync_WhenSpreadBelowThreshold_ReturnsEmpty()
    {
        // Arrange
        var pair = _config.MonitoredPairs.First();

        _priceOracleMock
            .Setup(x => x.GetPriceAsync(It.IsAny<TokenPair>(), It.IsAny<DexType>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PriceQuote
            {
                Price = 1.0m, // No spread
                Timestamp = DateTime.UtcNow
            });

        // Act
        var opportunities = await _service.DetectOpportunitiesAsync();

        // Assert
        opportunities.Should().BeEmpty();
    }
}
```

### Integration Testing

Test full workflows:

```csharp
// Tests/Integration/FlashLoanExecutionTests.cs
public class FlashLoanExecutionTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public FlashLoanExecutionTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // Replace production services with test doubles
                services.AddSingleton<IWeb3Service, TestWeb3Service>();
            });

            builder.ConfigureAppConfiguration((context, config) =>
            {
                config.AddInMemoryCollection(new Dictionary<string, string>
                {
                    ["Blockchain:Network"] = "goerli",
                    ["Blockchain:RpcUrl"] = "https://goerli.infura.io/v3/test",
                    ["Worker:AutoExecute"] = "false"
                });
            });
        });

        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task GetOpportunities_ReturnsSuccessStatusCode()
    {
        // Act
        var response = await _client.GetAsync("/api/arbitrage/opportunities");

        // Assert
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync();
        var opportunities = JsonSerializer.Deserialize<List<ArbitrageOpportunity>>(content);

        opportunities.Should().NotBeNull();
    }
}
```

## Performance Optimization

### Async/Await Best Practices

```csharp
// Efficient parallel processing
public async Task<IReadOnlyList<PriceQuote>> GetAllPricesAsync(
    TokenPair pair,
    CancellationToken cancellationToken = default)
{
    // BAD: Sequential execution
    // var price1 = await GetPriceFromDex1(pair);
    // var price2 = await GetPriceFromDex2(pair);
    // var price3 = await GetPriceFromDex3(pair);

    // GOOD: Parallel execution
    var tasks = new[]
    {
        GetPriceFromDex1(pair, cancellationToken),
        GetPriceFromDex2(pair, cancellationToken),
        GetPriceFromDex3(pair, cancellationToken)
    };

    var prices = await Task.WhenAll(tasks);
    return prices.ToList();
}
```

### Memory Optimization

```csharp
// Use ArrayPool for temporary arrays
public class PriceProcessor
{
    private static readonly ArrayPool<byte> _arrayPool = ArrayPool<byte>.Shared;

    public async Task<byte[]> ProcessPriceDataAsync(int size)
    {
        byte[] buffer = _arrayPool.Rent(size);
        try
        {
            // Use buffer
            await ProcessAsync(buffer);
            return buffer[..size];
        }
        finally
        {
            _arrayPool.Return(buffer);
        }
    }
}
```

### Caching Strategy

```csharp
// Multi-level caching
public class MultiLevelCacheService
{
    private readonly IMemoryCache _l1Cache; // Fast, small
    private readonly IDistributedCache _l2Cache; // Slower, larger

    public async Task<T?> GetOrSetAsync<T>(
        string key,
        Func<Task<T>> factory,
        TimeSpan expiration)
    {
        // Check L1 cache
        if (_l1Cache.TryGetValue(key, out T? value))
            return value;

        // Check L2 cache
        var bytes = await _l2Cache.GetAsync(key);
        if (bytes != null)
        {
            value = JsonSerializer.Deserialize<T>(bytes);
            _l1Cache.Set(key, value, TimeSpan.FromSeconds(5));
            return value;
        }

        // Fetch from source
        value = await factory();

        // Store in both caches
        _l1Cache.Set(key, value, TimeSpan.FromSeconds(5));
        await _l2Cache.SetAsync(
            key,
            JsonSerializer.SerializeToUtf8Bytes(value),
            new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = expiration });

        return value;
    }
}
```

## Security Considerations

### Private Key Management

```csharp
// Never store private keys in code or config files
// Use Azure Key Vault or similar
public class SecureWeb3Service
{
    public static async Task<Web3> CreateSecureWeb3Async(
        string keyVaultUrl,
        string secretName,
        string rpcUrl)
    {
        var client = new SecretClient(
            new Uri(keyVaultUrl),
            new DefaultAzureCredential());

        var secret = await client.GetSecretAsync(secretName);
        var privateKey = secret.Value.Value;

        var account = new Account(privateKey);
        return new Web3(account, rpcUrl);
    }
}
```

### Input Validation

```csharp
// Validate all inputs
public class SecurityValidator
{
    public static void ValidateAddress(string address)
    {
        if (!address.IsValidEthereumAddressHexFormat())
            throw new ArgumentException("Invalid Ethereum address", nameof(address));

        if (IsBlacklisted(address))
            throw new SecurityException("Address is blacklisted");
    }

    public static void ValidateAmount(BigInteger amount, BigInteger maxAmount)
    {
        if (amount <= 0)
            throw new ArgumentException("Amount must be positive", nameof(amount));

        if (amount > maxAmount)
            throw new ArgumentException("Amount exceeds maximum", nameof(amount));
    }

    private static bool IsBlacklisted(string address)
    {
        // Check against known malicious addresses
        return false;
    }
}
```

## Advanced Features

### MEV Protection via Flashbots

```csharp
// Integrate Flashbots to avoid front-running
public class FlashbotsService
{
    private readonly HttpClient _httpClient;
    private readonly string _flashbotsRpcUrl = "https://relay.flashbots.net";

    public async Task<string> SendPrivateBundleAsync(
        string signedTransaction,
        int targetBlock)
    {
        var bundle = new
        {
            jsonrpc = "2.0",
            id = 1,
            method = "eth_sendBundle",
            @params = new[]
            {
                new
                {
                    txs = new[] { signedTransaction },
                    blockNumber = $"0x{targetBlock:X}",
                    minTimestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                    maxTimestamp = DateTimeOffset.UtcNow.AddMinutes(1).ToUnixTimeSeconds()
                }
            }
        };

        var response = await _httpClient.PostAsJsonAsync(_flashbotsRpcUrl, bundle);
        var result = await response.Content.ReadAsStringAsync();

        return result;
    }
}
```

### Machine Learning Price Prediction

```csharp
// Use ML.NET for price prediction
public class PricePredictionService
{
    private readonly PredictionEngine<PriceData, PricePrediction> _predictionEngine;

    public PricePredictionService(MLContext mlContext, string modelPath)
    {
        var model = mlContext.Model.Load(modelPath, out _);
        _predictionEngine = mlContext.Model.CreatePredictionEngine<PriceData, PricePrediction>(model);
    }

    public float PredictNextPrice(List<decimal> historicalPrices)
    {
        var features = CalculateFeatures(historicalPrices);
        var prediction = _predictionEngine.Predict(features);
        return prediction.Price;
    }

    private PriceData CalculateFeatures(List<decimal> prices)
    {
        return new PriceData
        {
            CurrentPrice = (float)prices.Last(),
            MovingAverage5 = (float)prices.TakeLast(5).Average(),
            MovingAverage20 = (float)prices.TakeLast(20).Average(),
            Volatility = CalculateVolatility(prices)
        };
    }

    private float CalculateVolatility(List<decimal> prices)
    {
        var returns = prices.Zip(prices.Skip(1), (a, b) => (float)((b - a) / a));
        var mean = returns.Average();
        var variance = returns.Select(r => Math.Pow(r - mean, 2)).Average();
        return (float)Math.Sqrt(variance);
    }
}

public class PriceData
{
    public float CurrentPrice { get; set; }
    public float MovingAverage5 { get; set; }
    public float MovingAverage20 { get; set; }
    public float Volatility { get; set; }
}

public class PricePrediction
{
    [ColumnName("Score")]
    public float Price { get; set; }
}
```

## Common Issues & Solutions

### Issue: RPC Rate Limiting

```csharp
// Implement retry with exponential backoff
public class ResilientWeb3Service
{
    public async Task<T> ExecuteWithRetryAsync<T>(
        Func<Task<T>> operation,
        int maxRetries = 3)
    {
        for (int i = 0; i < maxRetries; i++)
        {
            try
            {
                return await operation();
            }
            catch (RpcResponseException ex) when (ex.Message.Contains("rate limit"))
            {
                if (i == maxRetries - 1)
                    throw;

                var delay = TimeSpan.FromSeconds(Math.Pow(2, i));
                await Task.Delay(delay);
            }
        }

        throw new InvalidOperationException("Should not reach here");
    }
}
```

### Issue: Transaction Nonce Conflicts

```csharp
// Manage nonce properly
public class NonceManager
{
    private readonly SemaphoreSlim _nonceLock = new(1, 1);
    private BigInteger _currentNonce;

    public async Task<BigInteger> GetNextNonceAsync(Web3 web3, string address)
    {
        await _nonceLock.WaitAsync();
        try
        {
            var pendingNonce = await web3.Eth.Transactions.GetTransactionCount
                .SendRequestAsync(address, BlockParameter.CreatePending());

            if (_currentNonce < pendingNonce)
                _currentNonce = pendingNonce;

            return _currentNonce++;
        }
        finally
        {
            _nonceLock.Release();
        }
    }
}
```

## Enhancement Opportunities

### Multi-Chain Support

```csharp
// Abstract chain-specific logic
public interface IChainAdapter
{
    string ChainName { get; }
    int ChainId { get; }
    IFlashLoanProvider GetFlashLoanProvider();
    IReadOnlyList<IDexAdapter> GetDexAdapters();
    BigInteger GetBlockTime();
}

public class PolygonAdapter : IChainAdapter
{
    public string ChainName => "Polygon";
    public int ChainId => 137;

    public IFlashLoanProvider GetFlashLoanProvider()
    {
        return new AavePolygonFlashLoanProvider();
    }

    public IReadOnlyList<IDexAdapter> GetDexAdapters()
    {
        return new IDexAdapter[]
        {
            new QuickSwapAdapter(),
            new SushiSwapPolygonAdapter()
        };
    }

    public BigInteger GetBlockTime() => 2; // 2 seconds
}
```

### Advanced Analytics Dashboard

```csharp
// Real-time analytics service
public class AnalyticsService
{
    public async Task<DashboardMetrics> GetMetricsAsync(TimeSpan timeWindow)
    {
        var endTime = DateTime.UtcNow;
        var startTime = endTime - timeWindow;

        var metrics = await _repository.GetExecutionsAsync(startTime, endTime);

        return new DashboardMetrics
        {
            TotalExecutions = metrics.Count,
            SuccessfulExecutions = metrics.Count(m => m.Successful),
            TotalProfit = metrics.Sum(m => m.Profit),
            AverageProfit = metrics.Average(m => m.Profit),
            AverageGasCost = metrics.Average(m => m.GasCost),
            WinRate = (decimal)metrics.Count(m => m.Successful) / metrics.Count,
            MostProfitablePair = metrics
                .GroupBy(m => m.TokenPair)
                .OrderByDescending(g => g.Sum(m => m.Profit))
                .First().Key
        };
    }
}
```

This comprehensive technical implementation guide provides .NET developers with everything needed to understand, build, and deploy a production-ready flash loan arbitrage bot using C# and the Nethereum library.
