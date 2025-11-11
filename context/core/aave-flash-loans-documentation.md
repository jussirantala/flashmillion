**Source:** https://aave.com/docs/developers/flash-loans

# Aave V3 Flash Loans: Developer Documentation

## Overview

Flash Loans enable borrowing assets within a single transaction without requiring collateral upfront, provided the borrowed amount plus fees is returned by transaction end.

**Key Quote:** "These transactions do not require a user to supply collateral prior to engaging in the transaction."

This is the official Aave protocol documentation for implementing flash loans in your smart contracts.

## Two Implementation Options

Aave V3 provides two distinct flash loan methods:

### 1. flashLoan()

**Features:**
- Supports multiple reserves in one transaction
- Optional variable-rate debt positions
- More complex but flexible
- Approved flash borrowers receive waived fees through ACLManager

**Use Cases:**
- Complex multi-asset strategies
- Opening debt positions instead of immediate repayment
- Advanced DeFi composability

### 2. flashLoanSimple()

**Features:**
- Single-reserve transactions only
- Mandatory immediate repayment
- Gas-efficient implementation
- Straightforward for basic use cases

**Use Cases:**
- Simple arbitrage strategies
- Single-asset operations
- Cost-optimized implementations

## Execution Flow

The complete flash loan lifecycle:

```
1. Contract calls Pool requesting flash loan
   └─> flashLoan() or flashLoanSimple()

2. Pool transfers requested amounts to contract
   └─> Tokens arrive in contract balance

3. Pool triggers executeOperation() callback
   └─> Contract executes custom logic
   └─> Perform arbitrage, liquidations, etc.

4. Contract prepares repayment
   └─> flashLoanSimple: Direct repayment
   └─> flashLoan: Repayment OR debt position

5. Pool automatically pulls owed amounts
   └─> Uses pre-approved allowance
   └─> Verifies full repayment + fees
   └─> Transaction succeeds or reverts
```

## Required Interfaces

Your contract must conform to one of these interfaces:

### For flashLoanSimple()
```solidity
interface IFlashLoanSimpleReceiver {
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}
```

### For flashLoan()
```solidity
interface IFlashLoanReceiver {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}
```

## Critical Implementation Requirements

### 1. Inheritance

Your contract should inherit from Aave's base contracts:
```solidity
import {FlashLoanSimpleReceiverBase} from "aave-v3-core/contracts/flashloan/base/FlashLoanSimpleReceiverBase.sol";

contract MyFlashLoanContract is FlashLoanSimpleReceiverBase {
    // Your implementation
}
```

### 2. Approval Management

**IMPORTANT:** Contracts must grant the Pool spending approval for repayment amounts:

```solidity
IERC20(asset).approve(address(POOL), amountOwed);
```

Without proper approval, the Pool cannot pull back the owed funds and the transaction will revert.

### 3. executeOperation() Implementation

This callback contains your custom logic:

```solidity
function executeOperation(
    address asset,
    uint256 amount,
    uint256 premium,
    address initiator,
    bytes calldata params
) external override returns (bool) {
    // Verify caller is the Pool
    require(msg.sender == address(POOL), "Unauthorized");

    // YOUR CUSTOM LOGIC HERE
    // - Perform arbitrage
    // - Execute liquidations
    // - Swap tokens
    // - Any other operations

    // Calculate total owed
    uint256 amountOwed = amount + premium;

    // Approve Pool to pull repayment
    IERC20(asset).approve(address(POOL), amountOwed);

    return true;
}
```

## Fee Structure

### Standard Fees

**FLASHLOAN_PREMIUM_TOTAL:** 0.05% (5 basis points)
- Total fee charged on flash loans
- Distributed between LPs and protocol

**FLASHLOAN_PREMIUM_TO_PROTOCOL:** Variable
- Portion that goes to protocol treasury
- Remainder goes to liquidity providers

### Fee Calculation

```solidity
uint256 premium = (amount * FLASHLOAN_PREMIUM_TOTAL) / 10000;
uint256 totalOwed = amount + premium;
```

**Example:**
- Borrow: 100,000 USDC
- Fee (0.05%): 50 USDC
- Total Repayment: 100,050 USDC

### Fee Waivers

Approved flash borrowers can have fees waived through the ACLManager:
- Requires governance approval
- Typically for strategic partners
- Reduces cost for high-volume users

## Practical Applications

### 1. Arbitrage Trading

**Strategy:** Exploit price differences across DEXs without principal capital

**Flow:**
```
Flash Loan 100 ETH
→ Buy token X on Uniswap (cheaper)
→ Sell token X on SushiSwap (more expensive)
→ Repay 100 ETH + 0.05 ETH fee
→ Keep profit
```

### 2. Collateral Swapping

**Strategy:** Change collateral type without closing position

**Flow:**
```
Flash Loan new collateral
→ Deposit new collateral
→ Withdraw old collateral
→ Swap old → new tokens
→ Repay flash loan
```

### 3. Self-Liquidation

**Strategy:** Liquidate your own position efficiently

**Flow:**
```
Flash Loan to cover debt
→ Repay your debt position
→ Withdraw collateral
→ Sell collateral at better price
→ Repay flash loan + fee
→ Keep remaining collateral value
```

### 4. Leveraged Positions

**Strategy:** Increase exposure without multiple transactions

**Flow:**
Flash Loan asset
→ Deposit as collateral
→ Borrow against it
→ Use borrowed amount to repay flash loan
→ Net result: Leveraged position
```

## Security Considerations

### 1. Access Control
```solidity
require(msg.sender == address(POOL), "Caller must be Pool");
```
Always verify the caller is the legitimate Aave Pool.

### 2. Reentrancy Protection
```solidity
bool private locked;

modifier noReentrancy() {
    require(!locked, "No reentrancy");
    locked = true;
    _;
    locked = false;
}
```

### 3. Amount Validation
```solidity
require(amount > 0, "Invalid amount");
require(amount == expectedAmount, "Amount mismatch");
```

### 4. Balance Checks
```solidity
uint256 balanceBefore = IERC20(asset).balanceOf(address(this));
// Execute operations
uint256 balanceAfter = IERC20(asset).balanceOf(address(this));
require(balanceAfter >= balanceBefore + amount, "Insufficient funds");
```

## Gas Optimization Tips

1. **Use flashLoanSimple() when possible** - Lower gas costs for single-asset operations
2. **Minimize storage operations** - Use memory variables
3. **Batch operations** - Combine multiple actions in one transaction
4. **Optimize approval calls** - Approve max amount once if safe
5. **Efficient data packing** - Use bytes for parameters to reduce calldata costs

## Testing Recommendations

### Testnet Deployment
1. Deploy to Sepolia or Goerli
2. Test with small amounts first
3. Verify all callbacks execute correctly
4. Confirm fee calculations accurate

### Mainnet Fork Testing
```javascript
// Hardhat fork testing
await network.provider.request({
  method: "hardhat_reset",
  params: [{
    forking: {
      jsonRpcUrl: MAINNET_RPC_URL,
      blockNumber: RECENT_BLOCK
    }
  }]
});
```

### Edge Cases to Test
- Insufficient liquidity scenarios
- Failed arbitrage (unprofitable trades)
- Slippage beyond tolerance
- Gas price spikes
- DEX failures or reverts

## Common Pitfalls

### 1. Forgetting Approval
```solidity
// WRONG - No approval
return true;

// CORRECT - Approve before return
IERC20(asset).approve(address(POOL), amountOwed);
return true;
```

### 2. Incorrect Fee Calculation
```solidity
// WRONG
uint256 amountOwed = amount;

// CORRECT
uint256 amountOwed = amount + premium;
```

### 3. Missing Profitability Check
```solidity
// Add before executing trades
uint256 estimatedProfit = calculateProfit();
require(estimatedProfit > premium + gasCost, "Not profitable");
```

### 4. Ignoring Slippage
```solidity
// Add slippage protection
uint256 minAmountOut = calculateMinAmount(amountIn, slippageTolerance);
require(amountOut >= minAmountOut, "Slippage too high");
```

## Integration Checklist

- [ ] Contract inherits from FlashLoanSimpleReceiverBase or FlashLoanReceiverBase
- [ ] executeOperation() implemented correctly
- [ ] Pool approval granted before repayment
- [ ] Fee calculation includes premium
- [ ] Access control checks in place
- [ ] Profitability validation before execution
- [ ] Slippage protection implemented
- [ ] Emergency withdrawal function
- [ ] Comprehensive testing on testnet
- [ ] Security audit completed
- [ ] Gas optimization reviewed
- [ ] Monitoring and alerting configured

## Additional Resources

### Official Aave Resources
- Aave V3 Core Contracts: GitHub repository
- Aave Developer Discord: Community support
- Aave Governance Forum: Protocol updates

### Development Tools
- Hardhat: Smart contract development
- Remix IDE: Browser-based testing
- Tenderly: Transaction simulation and debugging
- Slither: Security analysis

## Key Takeaways

1. **Two Methods Available:** flashLoan() for complex cases, flashLoanSimple() for basic use
2. **Atomic Execution:** Everything must happen in single transaction
3. **Mandatory Repayment:** Loan + 0.05% fee must be repaid or transaction reverts
4. **Approval Required:** Contract must approve Pool to pull repayment
5. **Security Critical:** Proper validation and access control essential
6. **Testing Essential:** Comprehensive testing before mainnet deployment
7. **Gas Awareness:** Optimize for cost-effectiveness
8. **Profitability:** Account for fees and gas costs in strategy

Flash loans are powerful DeFi primitives enabling capital-efficient strategies, but require careful implementation and thorough testing to ensure security and profitability.
