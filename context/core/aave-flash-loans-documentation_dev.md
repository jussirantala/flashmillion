**Source:** https://aave.com/docs/developers/flash-loans

# Aave V3 Flash Loans Complete API Reference - Level 2
**Technical Level:** Advanced
**Focus:** Complete API, Interface Methods, Parameters, Events, Error Codes, Integration

## Aave V3 Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│                  Aave V3 Protocol                       │
├────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────────────┐      ┌──────────────────┐       │
│  │ PoolAddresses    │◄─────│  Pool (Core)     │       │
│  │ Provider         │      │                  │       │
│  └──────────────────┘      └────────┬─────────┘       │
│                                     │                  │
│                                     ▼                  │
│                          ┌──────────────────┐          │
│                          │  Flash Loan      │          │
│                          │  Logic           │          │
│                          └────────┬─────────┘          │
│                                   │                    │
│  ┌────────────────────────────────▼──────────────┐    │
│  │         Your Contract (Receiver)              │    │
│  │  implements IFlashLoanSimpleReceiver          │    │
│  └───────────────────────────────────────────────┘    │
│                                                         │
└────────────────────────────────────────────────────────┘
```

## Core Interfaces

### IPool Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IPool
 * @notice Defines the basic interface for an Aave Pool
 */
interface IPool {
    /**
     * @notice Flash loan single asset
     * @param receiverAddress Address of contract that will receive tokens and execute logic
     * @param asset Address of the token to flash loan
     * @param amount Amount to flash loan
     * @param params Encoded parameters to pass to receiver
     * @param referralCode Referral code (use 0 if none)
     */
    function flashLoanSimple(
        address receiverAddress,
        address asset,
        uint256 amount,
        bytes calldata params,
        uint16 referralCode
    ) external;

    /**
     * @notice Flash loan multiple assets
     * @param receiverAddress Address of contract that will receive tokens
     * @param assets Array of addresses of tokens to flash loan
     * @param amounts Array of amounts to flash loan for each asset
     * @param interestRateModes Array of interest rate modes (0 = no debt, 1 = stable, 2 = variable)
     * @param onBehalfOf Address that will receive the debt (use address(0) for no debt)
     * @param params Encoded parameters to pass to receiver
     * @param referralCode Referral code (use 0 if none)
     */
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata interestRateModes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;

    /**
     * @notice Supply assets to the pool
     * @param asset Address of the token to supply
     * @param amount Amount to supply
     * @param onBehalfOf Address that will receive the aTokens
     * @param referralCode Referral code (use 0 if none)
     */
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 referralCode
    ) external;

    /**
     * @notice Withdraw assets from the pool
     * @param asset Address of the token to withdraw
     * @param amount Amount to withdraw (use type(uint256).max for all)
     * @param to Address that will receive the tokens
     * @return Amount withdrawn
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256);

    /**
     * @notice Borrow assets from the pool
     * @param asset Address of the token to borrow
     * @param amount Amount to borrow
     * @param interestRateMode Interest rate mode (1 = stable, 2 = variable)
     * @param referralCode Referral code (use 0 if none)
     * @param onBehalfOf Address that will receive the debt
     */
    function borrow(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        uint16 referralCode,
        address onBehalfOf
    ) external;

    /**
     * @notice Repay borrowed assets
     * @param asset Address of the token to repay
     * @param amount Amount to repay (use type(uint256).max for all debt)
     * @param interestRateMode Interest rate mode (1 = stable, 2 = variable)
     * @param onBehalfOf Address whose debt will be repaid
     * @return Amount repaid
     */
    function repay(
        address asset,
        uint256 amount,
        uint256 interestRateMode,
        address onBehalfOf
    ) external returns (uint256);

    /**
     * @notice Get reserve data for an asset
     * @param asset Address of the token
     */
    function getReserveData(address asset)
        external
        view
        returns (ReserveData memory);
}

struct ReserveData {
    ReserveConfigurationMap configuration;
    uint128 liquidityIndex;
    uint128 currentLiquidityRate;
    uint128 variableBorrowIndex;
    uint128 currentVariableBorrowRate;
    uint128 currentStableBorrowRate;
    uint40 lastUpdateTimestamp;
    uint16 id;
    address aTokenAddress;
    address stableDebtTokenAddress;
    address variableDebtTokenAddress;
    address interestRateStrategyAddress;
    uint128 accruedToTreasury;
    uint128 unbacked;
    uint128 isolationModeTotalDebt;
}

struct ReserveConfigurationMap {
    uint256 data;
}
```

### IFlashLoanSimpleReceiver Interface

```solidity
/**
 * @title IFlashLoanSimpleReceiver
 * @notice Interface for flash loan receiver contracts
 */
interface IFlashLoanSimpleReceiver {
    /**
     * @notice Executes an operation after receiving the flash loan
     * @param asset Address of the flash loaned asset
     * @param amount Amount flash loaned
     * @param premium Fee amount
     * @param initiator Address that initiated the flash loan
     * @param params Encoded parameters passed during flash loan request
     * @return bool True if execution was successful
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);

    function ADDRESSES_PROVIDER() external view returns (IPoolAddressesProvider);

    function POOL() external view returns (IPool);
}
```

### IFlashLoanReceiver Interface (Multi-Asset)

```solidity
/**
 * @title IFlashLoanReceiver
 * @notice Interface for multi-asset flash loan receiver
 */
interface IFlashLoanReceiver {
    /**
     * @notice Executes an operation after receiving the flash loaned assets
     * @param assets Array of addresses of flash loaned assets
     * @param amounts Array of amounts flash loaned
     * @param premiums Array of fee amounts for each asset
     * @param initiator Address that initiated the flash loan
     * @param params Encoded parameters passed during flash loan request
     * @return bool True if execution was successful
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);

    function ADDRESSES_PROVIDER() external view returns (IPoolAddressesProvider);

    function POOL() external view returns (IPool);
}
```

## Implementation: Flash Loan Receiver

### Basic Flash Loan Receiver

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FlashLoanSimpleReceiverBase} from "@aave/core-v3/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SimpleFlashLoan is FlashLoanSimpleReceiverBase {
    address payable private immutable owner;

    event FlashLoanExecuted(
        address indexed asset,
        uint256 amount,
        uint256 premium,
        bool success
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    /**
     * @param _addressProvider Aave PoolAddressesProvider
     * Mainnet: 0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e
     */
    constructor(IPoolAddressesProvider _addressProvider)
        FlashLoanSimpleReceiverBase(_addressProvider)
    {
        owner = payable(msg.sender);
    }

    /**
     * @notice Request flash loan
     * @param asset Address of token to borrow
     * @param amount Amount to borrow
     */
    function requestFlashLoan(address asset, uint256 amount) public onlyOwner {
        bytes memory params = "";
        uint16 referralCode = 0;

        POOL.flashLoanSimple(
            address(this),
            asset,
            amount,
            params,
            referralCode
        );
    }

    /**
     * @notice Callback function called by Aave Pool
     * @dev This is where you implement your custom logic
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        // Validate caller
        require(msg.sender == address(POOL), "Caller must be Pool");
        require(initiator == address(this), "Invalid initiator");

        // ===== YOUR CUSTOM LOGIC HERE =====
        // You now have 'amount' of 'asset' in this contract
        // Execute arbitrage, liquidation, etc.

        uint256 currentBalance = IERC20(asset).balanceOf(address(this));
        require(currentBalance >= amount, "Insufficient balance for operation");

        // Example: Call your arbitrage function
        // _executeArbitrage(asset, amount);

        // ===== END CUSTOM LOGIC =====

        // Calculate total amount to repay (borrowed amount + premium)
        uint256 amountOwed = amount + premium;

        // Approve the Pool to pull the funds
        IERC20(asset).approve(address(POOL), amountOwed);

        emit FlashLoanExecuted(asset, amount, premium, true);

        return true;
    }

    /**
     * @notice Withdraw tokens from contract
     */
    function withdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner, balance);
    }

    receive() external payable {}
}
```

### Multi-Asset Flash Loan Receiver

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {FlashLoanReceiverBase} from "@aave/core-v3/contracts/flashloan/base/FlashLoanReceiverBase.sol";
import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MultiAssetFlashLoan is FlashLoanReceiverBase {
    address payable private immutable owner;

    struct FlashLoanParams {
        address[] swapPath;
        address dex;
        uint256 minProfit;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(IPoolAddressesProvider _addressProvider)
        FlashLoanReceiverBase(_addressProvider)
    {
        owner = payable(msg.sender);
    }

    /**
     * @notice Request multi-asset flash loan
     * @param assets Array of token addresses to borrow
     * @param amounts Array of amounts to borrow
     * @param params Encoded parameters for your strategy
     */
    function requestFlashLoan(
        address[] memory assets,
        uint256[] memory amounts,
        bytes memory params
    ) public onlyOwner {
        // interestRateModes: 0 = no debt, 1 = stable, 2 = variable
        // For flash loans, use 0 (no debt incurred)
        uint256[] memory modes = new uint256[](assets.length);

        uint16 referralCode = 0;

        POOL.flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this), // onBehalfOf
            params,
            referralCode
        );
    }

    /**
     * @notice Callback for multi-asset flash loan
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == address(POOL), "Caller must be Pool");
        require(initiator == address(this), "Invalid initiator");

        // Decode parameters
        FlashLoanParams memory flParams = abi.decode(params, (FlashLoanParams));

        // ===== MULTI-ASSET ARBITRAGE LOGIC =====
        // Example: Triangular arbitrage with 3 assets
        // Asset 0 → Asset 1 → Asset 2 → Asset 0

        for (uint256 i = 0; i < assets.length; i++) {
            // Your logic for each asset
        }

        // ===== END LOGIC =====

        // Approve Pool to pull back all assets + premiums
        for (uint256 i = 0; i < assets.length; i++) {
            uint256 amountOwed = amounts[i] + premiums[i];
            IERC20(assets[i]).approve(address(POOL), amountOwed);
        }

        return true;
    }

    function withdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(owner, balance);
    }
}
```

## Events

### Pool Events

```solidity
/**
 * @notice Emitted when a flash loan is executed
 * @param target Address of the flash loan receiver contract
 * @param initiator Address that initiated the flash loan
 * @param asset Address of the flash loaned asset
 * @param amount Amount flash loaned
 * @param interestRateMode Interest rate mode (0 for flash loans)
 * @param premium Fee paid for flash loan
 * @param referralCode Referral code used
 */
event FlashLoan(
    address indexed target,
    address initiator,
    address indexed asset,
    uint256 amount,
    uint256 interestRateMode,
    uint256 premium,
    uint16 indexed referralCode
);

/**
 * @notice Emitted when assets are supplied to the pool
 */
event Supply(
    address indexed reserve,
    address user,
    address indexed onBehalfOf,
    uint256 amount,
    uint16 indexed referralCode
);

/**
 * @notice Emitted when assets are withdrawn from the pool
 */
event Withdraw(
    address indexed reserve,
    address indexed user,
    address indexed to,
    uint256 amount
);
```

## Error Codes

```solidity
/**
 * Aave V3 Error Codes
 */

// Common Errors
string constant CALLER_NOT_POOL_ADMIN = '1'; // The caller must be the pool admin
string constant CALLER_NOT_EMERGENCY_ADMIN = '2'; // The caller must be the emergency admin
string constant CALLER_NOT_POOL_OR_EMERGENCY_ADMIN = '3';
string constant CALLER_NOT_RISK_OR_POOL_ADMIN = '4';
string constant CALLER_NOT_ASSET_LISTING_OR_POOL_ADMIN = '5';
string constant CALLER_NOT_BRIDGE = '6';
string constant ADDRESSES_PROVIDER_NOT_REGISTERED = '7';
string constant INVALID_ADDRESSES_PROVIDER_ID = '8';
string constant NOT_CONTRACT = '9';

// Reserve/Asset Errors
string constant RESERVE_INACTIVE = '27'; // Action requires an active reserve
string constant RESERVE_FROZEN = '28'; // Action requires an unfrozen reserve
string constant RESERVE_PAUSED = '29'; // Action requires an unpaused reserve
string constant BORROWING_NOT_ENABLED = '30';
string constant STABLE_BORROWING_NOT_ENABLED = '31';
string constant NOT_ENOUGH_AVAILABLE_USER_BALANCE = '32';
string constant INVALID_INTEREST_RATE_MODE_SELECTED = '33';

// Flash Loan Specific Errors
string constant COLLATERAL_BALANCE_IS_ZERO = '34';
string constant HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD = '35';
string constant COLLATERAL_CANNOT_COVER_NEW_BORROW = '36';
string constant COLLATERAL_SAME_AS_BORROWING_CURRENCY = '37';
string constant AMOUNT_BIGGER_THAN_MAX_LOAN_SIZE_STABLE = '38';
string constant NO_DEBT_OF_SELECTED_TYPE = '39';
string constant NO_EXPLICIT_AMOUNT_TO_REPAY_ON_BEHALF = '40';
string constant FLASHLOAN_PREMIUM_INVALID = '83';
string constant INCONSISTENT_FLASHLOAN_PARAMS = '84'; // Inconsistent flashloan parameters

// Usage example
require(assets.length == amounts.length, Errors.INCONSISTENT_FLASHLOAN_PARAMS);
```

## Fee Calculation

```solidity
/**
 * @title Flash Loan Fee Calculator
 */
contract FeeCalculator {
    // Aave V3 flash loan premium: 0.09% (9 basis points)
    uint256 public constant FLASHLOAN_PREMIUM_TOTAL = 9;

    /**
     * @notice Calculate flash loan fee
     * @param amount Amount borrowed
     * @return premium Fee to be paid
     */
    function calculatePremium(uint256 amount) public pure returns (uint256 premium) {
        premium = (amount * FLASHLOAN_PREMIUM_TOTAL) / 10000;
    }

    /**
     * @notice Calculate total repayment amount
     * @param amount Amount borrowed
     * @return totalRepayment Amount to repay (borrowed + fee)
     */
    function calculateTotalRepayment(uint256 amount) public pure returns (uint256) {
        return amount + calculatePremium(amount);
    }

    /**
     * @notice Calculate required profit for profitability
     * @param amount Amount to borrow
     * @param gasCost Estimated gas cost in token terms
     * @return minProfit Minimum profit needed to break even
     */
    function calculateMinProfit(
        uint256 amount,
        uint256 gasCost
    ) public pure returns (uint256 minProfit) {
        uint256 premium = calculatePremium(amount);
        minProfit = premium + gasCost;
    }
}

/**
 * Fee Examples:
 *
 * Borrow 100,000 USDC:
 * Premium = 100,000 * 9 / 10,000 = 90 USDC
 * Total Repayment = 100,090 USDC
 *
 * Borrow 1,000 ETH (at $3,000 = $3,000,000):
 * Premium = 1,000 * 9 / 10,000 = 0.9 ETH ($2,700)
 * Total Repayment = 1,000.9 ETH
 *
 * Borrow 50 WBTC (at $60,000 = $3,000,000):
 * Premium = 50 * 9 / 10,000 = 0.045 WBTC ($2,700)
 * Total Repayment = 50.045 WBTC
 */
```

## Advanced Use Cases

### 1. Collateral Swap

```solidity
/**
 * @title Collateral Swap
 * @notice Swap collateral type without closing position
 */
contract CollateralSwap is FlashLoanSimpleReceiverBase {
    constructor(IPoolAddressesProvider provider)
        FlashLoanSimpleReceiverBase(provider)
    {}

    /**
     * @notice Swap collateral from assetA to assetB
     * @dev Uses flash loan to temporarily repay debt
     */
    function swapCollateral(
        address assetA, // Current collateral
        address assetB, // New collateral
        uint256 debtAmount,
        address dex
    ) external {
        // Request flash loan for debt amount
        bytes memory params = abi.encode(assetA, assetB, dex);
        POOL.flashLoanSimple(address(this), assetA, debtAmount, params, 0);
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        (address assetA, address assetB, address dex) = abi.decode(
            params,
            (address, address, address)
        );

        // 1. Repay debt with flash loaned assetA
        IERC20(assetA).approve(address(POOL), amount);
        POOL.repay(assetA, amount, 2, initiator); // 2 = variable rate

        // 2. Withdraw original collateral (assetA)
        POOL.withdraw(assetA, type(uint256).max, address(this));

        // 3. Swap assetA to assetB on DEX
        uint256 assetBAmount = _swapOnDex(assetA, assetB, amount, dex);

        // 4. Supply assetB as new collateral
        IERC20(assetB).approve(address(POOL), assetBAmount);
        POOL.supply(assetB, assetBAmount, initiator, 0);

        // 5. Borrow assetA again to repay flash loan
        POOL.borrow(assetA, amount + premium, 2, 0, initiator);

        // 6. Approve flash loan repayment
        IERC20(assetA).approve(address(POOL), amount + premium);

        return true;
    }

    function _swapOnDex(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address dex
    ) internal returns (uint256) {
        // DEX swap logic
    }
}
```

### 2. Self-Liquidation

```solidity
/**
 * @title Self Liquidation
 * @notice Liquidate own position to avoid liquidation penalty
 */
contract SelfLiquidation is FlashLoanSimpleReceiverBase {
    constructor(IPoolAddressesProvider provider)
        FlashLoanSimpleReceiverBase(provider)
    {}

    /**
     * @notice Self-liquidate to avoid penalty
     * @param debtAsset Asset borrowed
     * @param collateralAsset Asset used as collateral
     * @param debtAmount Amount of debt to repay
     */
    function selfLiquidate(
        address debtAsset,
        address collateralAsset,
        uint256 debtAmount
    ) external {
        bytes memory params = abi.encode(collateralAsset);
        POOL.flashLoanSimple(address(this), debtAsset, debtAmount, params, 0);
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        address collateralAsset = abi.decode(params, (address));

        // 1. Repay debt
        IERC20(asset).approve(address(POOL), amount);
        POOL.repay(asset, amount, 2, initiator);

        // 2. Withdraw collateral
        uint256 collateralAmount = POOL.withdraw(
            collateralAsset,
            type(uint256).max,
            address(this)
        );

        // 3. Swap collateral to debt asset
        uint256 receivedDebt = _swapCollateralForDebt(
            collateralAsset,
            asset,
            collateralAmount
        );

        // 4. Repay flash loan
        uint256 totalDebt = amount + premium;
        require(receivedDebt >= totalDebt, "Insufficient proceeds");

        IERC20(asset).approve(address(POOL), totalDebt);

        // 5. Return remaining to user
        uint256 remaining = receivedDebt - totalDebt;
        if (remaining > 0) {
            IERC20(asset).transfer(initiator, remaining);
        }

        return true;
    }

    function _swapCollateralForDebt(
        address from,
        address to,
        uint256 amount
    ) internal returns (uint256) {
        // Swap logic
    }
}
```

### 3. Arbitrage with Debt Position

```solidity
/**
 * @title Leveraged Arbitrage
 * @notice Use flash loan to create leveraged arbitrage position
 */
contract LeveragedArbitrage is FlashLoanSimpleReceiverBase {
    constructor(IPoolAddressesProvider provider)
        FlashLoanSimpleReceiverBase(provider)
    {}

    struct ArbitrageParams {
        address dexBuy;
        address dexSell;
        address intermediateToken;
        uint256 minProfit;
    }

    function executeArbitrage(
        address asset,
        uint256 amount,
        ArbitrageParams memory params
    ) external {
        bytes memory encodedParams = abi.encode(params);
        POOL.flashLoanSimple(address(this), asset, amount, encodedParams, 0);
    }

    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        ArbitrageParams memory arbParams = abi.decode(params, (ArbitrageParams));

        // Execute arbitrage trades
        uint256 profit = _executeArbitrageTrades(
            asset,
            amount,
            arbParams.dexBuy,
            arbParams.dexSell,
            arbParams.intermediateToken
        );

        // Check profitability
        require(profit > premium, "Unprofitable after fees");
        require(profit - premium >= arbParams.minProfit, "Below min profit");

        // Approve repayment
        IERC20(asset).approve(address(POOL), amount + premium);

        return true;
    }

    function _executeArbitrageTrades(
        address asset,
        uint256 amount,
        address dexBuy,
        address dexSell,
        address intermediate
    ) internal returns (uint256 profit) {
        // Trade execution logic
    }
}
```

## Integration Patterns

### JavaScript/TypeScript Integration

```typescript
// Integration with Ethers.js v6
import { ethers } from 'ethers';

// Contract ABIs
import PoolABI from './abis/Pool.json';
import FlashLoanReceiverABI from './abis/FlashLoanReceiver.json';

class AaveFlashLoanClient {
    private provider: ethers.Provider;
    private wallet: ethers.Wallet;
    private poolContract: ethers.Contract;
    private flashLoanContract: ethers.Contract;

    // Mainnet addresses
    private readonly POOL_ADDRESS = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
    private readonly ADDRESSES_PROVIDER = '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e';

    constructor(
        rpcUrl: string,
        privateKey: string,
        flashLoanContractAddress: string
    ) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.wallet = new ethers.Wallet(privateKey, this.provider);

        this.poolContract = new ethers.Contract(
            this.POOL_ADDRESS,
            PoolABI,
            this.wallet
        );

        this.flashLoanContract = new ethers.Contract(
            flashLoanContractAddress,
            FlashLoanReceiverABI,
            this.wallet
        );
    }

    /**
     * Request a simple flash loan
     */
    async requestSimpleFlashLoan(
        asset: string,
        amount: bigint,
        params: string = '0x'
    ): Promise<ethers.ContractTransactionResponse> {
        const tx = await this.flashLoanContract.requestFlashLoan(
            asset,
            amount,
            params
        );

        console.log('Flash loan requested:', tx.hash);
        const receipt = await tx.wait();
        console.log('Flash loan executed in block:', receipt?.blockNumber);

        return tx;
    }

    /**
     * Request multi-asset flash loan
     */
    async requestMultiAssetFlashLoan(
        assets: string[],
        amounts: bigint[],
        params: string = '0x'
    ): Promise<ethers.ContractTransactionResponse> {
        const tx = await this.flashLoanContract.requestMultiFlashLoan(
            assets,
            amounts,
            params
        );

        return tx;
    }

    /**
     * Check if flash loan would be profitable
     */
    async checkProfitability(
        asset: string,
        amount: bigint,
        expectedProfit: bigint
    ): Promise<boolean> {
        // Calculate premium (0.09%)
        const premium = (amount * 9n) / 10000n;

        // Estimate gas cost
        const gasEstimate = await this.flashLoanContract.requestFlashLoan.estimateGas(
            asset,
            amount
        );

        const feeData = await this.provider.getFeeData();
        const gasCost = gasEstimate * (feeData.maxFeePerGas || 0n);

        // Convert gas cost to asset terms (simplified)
        const gasCostInAsset = gasCost; // In production, convert ETH to asset

        const totalCost = premium + gasCostInAsset;
        const netProfit = expectedProfit - totalCost;

        console.log('Profitability Analysis:');
        console.log('  Premium:', ethers.formatUnits(premium, 6), 'USDC');
        console.log('  Gas Cost:', ethers.formatEther(gasCost), 'ETH');
        console.log('  Expected Profit:', ethers.formatUnits(expectedProfit, 6));
        console.log('  Net Profit:', ethers.formatUnits(netProfit, 6));

        return netProfit > 0n;
    }

    /**
     * Get reserve data for an asset
     */
    async getReserveData(asset: string) {
        const data = await this.poolContract.getReserveData(asset);

        return {
            availableLiquidity: data.availableLiquidity,
            totalStableDebt: data.totalStableDebt,
            totalVariableDebt: data.totalVariableDebt,
            liquidityRate: data.liquidityRate,
            variableBorrowRate: data.variableBorrowRate,
            stableBorrowRate: data.stableBorrowRate,
            liquidityIndex: data.liquidityIndex,
            variableBorrowIndex: data.variableBorrowIndex,
        };
    }

    /**
     * Monitor flash loan events
     */
    async monitorFlashLoans() {
        this.poolContract.on('FlashLoan', (
            target,
            initiator,
            asset,
            amount,
            interestRateMode,
            premium,
            referralCode,
            event
        ) => {
            console.log('Flash Loan Event:');
            console.log('  Target:', target);
            console.log('  Asset:', asset);
            console.log('  Amount:', ethers.formatUnits(amount, 6));
            console.log('  Premium:', ethers.formatUnits(premium, 6));
            console.log('  Block:', event.blockNumber);
        });
    }
}

export default AaveFlashLoanClient;
```

## Network Addresses

### Mainnet (Ethereum)

```javascript
const MAINNET_ADDRESSES = {
    PoolAddressesProvider: '0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e',
    Pool: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
    PoolConfigurator: '0x64b761D848206f447Fe2dd461b0c635Ec39EbB27',
    Oracle: '0x54586bE62E3c3580375aE3723C145253060Ca0C2',

    // Major assets
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
};
```

### Polygon

```javascript
const POLYGON_ADDRESSES = {
    PoolAddressesProvider: '0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb',
    Pool: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',

    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
};
```

## Best Practices

1. **Always validate caller in executeOperation**
2. **Use nonReentrant modifier**
3. **Calculate exact amounts needed for repayment**
4. **Handle approval correctly**
5. **Implement emergency withdrawal**
6. **Test extensively on testnet**
7. **Monitor gas costs**
8. **Implement circuit breakers**
9. **Use events for monitoring**
10. **Keep contracts upgradeable if needed**

## Common Pitfalls

1. **Forgetting to approve Pool for repayment**
2. **Not accounting for premium in calculations**
3. **Missing validation checks**
4. **Incorrect parameter encoding**
5. **Not handling failed swaps**
6. **Insufficient gas estimation**
7. **Not checking reserve liquidity**
8. **Forgetting initiator validation**
