# Optimizing Gas Fees: A Comprehensive Guide

**Source:** Internal compilation from Ethereum optimization research
**Date:** November 2024

## Table of Contents

1. [Understanding Gas Costs](#understanding-gas-costs)
2. [Smart Contract Optimization Techniques](#smart-contract-optimization-techniques)
3. [Storage Optimization](#storage-optimization)
4. [Memory vs Calldata vs Storage](#memory-vs-calldata-vs-storage)
5. [Loop Optimization](#loop-optimization)
6. [Function Visibility and Modifiers](#function-visibility-and-modifiers)
7. [EVM Assembly for Critical Sections](#evm-assembly-for-critical-sections)
8. [Transaction-Level Optimization](#transaction-level-optimization)
9. [Batching Operations](#batching-operations)
10. [Gas Profiling Tools](#gas-profiling-tools)
11. [Common Gas-Wasting Patterns](#common-gas-wasting-patterns)
12. [Gas Golf Techniques](#gas-golf-techniques)
13. [Key Takeaways](#key-takeaways)

---

## Understanding Gas Costs

Gas is the computational unit that measures the work done on Ethereum. Every operation has a specific gas cost.

### Core Opcode Costs (Post-EIP-2929)

| Operation | Cold Access | Warm Access | Description |
|-----------|-------------|-------------|-------------|
| SLOAD | 2,100 gas | 100 gas | Load from storage |
| SSTORE (new) | 22,100 gas | - | Set storage slot from zero |
| SSTORE (modify) | 5,000 gas | 100 gas | Modify existing storage |
| SSTORE (delete) | 5,000 gas | 100 gas | Delete (refund 4,800 gas) |
| MLOAD | 3 gas | - | Load from memory |
| MSTORE | 3 gas | - | Store to memory |
| CALLDATALOAD | 3 gas | - | Load from calldata |
| ADD/SUB/MUL | 3 gas | - | Basic arithmetic |
| DIV/MOD | 5 gas | - | Division/modulo |
| JUMPI | 10 gas | - | Conditional jump |
| CALL (warm) | 100 gas | - | External call (warm) |
| CALL (cold) | 2,600 gas | - | External call (cold) |

### Gas Cost Example

```solidity
// EXPENSIVE: ~22,100 gas (cold SSTORE)
contract Expensive {
    uint256 public value;

    function setValue(uint256 _value) external {
        value = _value; // SSTORE: 22,100 gas (first time)
    }
}

// CHEAPER: ~100 gas (warm SSTORE)
contract Cheaper {
    uint256 public value = 1; // Already initialized

    function setValue(uint256 _value) external {
        value = _value; // SSTORE: 5,000 gas (modification)
    }
}
```

### Understanding the Gas Cost Breakdown

```solidity
contract GasBreakdown {
    uint256 public count;
    mapping(address => uint256) public balances;

    // Gas cost: ~48,000 gas
    function expensiveOperation() external {
        count++;                           // SLOAD (2,100) + SSTORE (5,000) = 7,100
        balances[msg.sender] = 100;        // SSTORE (22,100) = 22,100
        balances[msg.sender] += 50;        // SLOAD (100) + SSTORE (5,000) = 5,100
        // Base transaction cost: 21,000
        // Total: ~48,000 gas
    }
}
```

---

## Smart Contract Optimization Techniques

### Variable Packing

Solidity stores variables in 32-byte (256-bit) slots. Packing multiple variables into a single slot saves gas.

```solidity
// INEFFICIENT: 3 storage slots = 3 SLOADs
contract Inefficient {
    uint256 a;  // Slot 0
    uint256 b;  // Slot 1
    uint256 c;  // Slot 2

    function getSum() external view returns (uint256) {
        return a + b + c; // 3 SLOADs = 6,300 gas (cold)
    }
}

// EFFICIENT: 1 storage slot = 1 SLOAD
contract Efficient {
    uint128 a;  // Slot 0 (first 16 bytes)
    uint64 b;   // Slot 0 (next 8 bytes)
    uint64 c;   // Slot 0 (last 8 bytes)

    function getSum() external view returns (uint256) {
        return uint256(a) + uint256(b) + uint256(c); // 1 SLOAD = 2,100 gas (cold)
    }
}

// Gas savings: ~4,200 gas (66% reduction)
```

### Struct Packing

```solidity
// INEFFICIENT: 5 storage slots
struct UserBad {
    uint256 id;        // Slot 0
    address wallet;    // Slot 1
    uint256 balance;   // Slot 2
    bool active;       // Slot 3
    uint256 timestamp; // Slot 4
}

// EFFICIENT: 3 storage slots
struct UserGood {
    uint256 id;        // Slot 0
    uint256 balance;   // Slot 1
    uint256 timestamp; // Slot 2
    address wallet;    // Slot 3 (20 bytes)
    bool active;       // Slot 3 (1 byte) - packed with address
}

contract StructPacking {
    UserGood public user;

    // Reading all fields: 3 SLOADs instead of 5
    // Gas savings: ~4,200 gas per read
}
```

### Immutable and Constant Variables

```solidity
contract VariableTypes {
    // MOST EXPENSIVE: Storage variable
    uint256 public storageVar = 100;  // SLOAD: 2,100 gas per read

    // CHEAP: Immutable (set once in constructor)
    uint256 public immutable immutableVar; // Embedded in bytecode: ~3 gas

    // CHEAPEST: Constant (compile-time)
    uint256 public constant CONSTANT_VAR = 100; // Embedded in bytecode: ~3 gas

    constructor(uint256 _immutableValue) {
        immutableVar = _immutableValue;
    }

    function readStorage() external view returns (uint256) {
        return storageVar; // 2,100 gas (cold)
    }

    function readImmutable() external view returns (uint256) {
        return immutableVar; // ~3 gas
    }

    function readConstant() external pure returns (uint256) {
        return CONSTANT_VAR; // ~3 gas
    }
}

// Gas savings: ~2,097 gas per read (99.8% reduction)
```

### Use Events Instead of Storage

```solidity
// EXPENSIVE: Store all history in storage
contract ExpensiveHistory {
    struct Action {
        address user;
        uint256 amount;
        uint256 timestamp;
    }

    Action[] public history; // Very expensive to store

    function recordAction(uint256 amount) external {
        history.push(Action(msg.sender, amount, block.timestamp));
        // Cost: ~44,000 gas (3 SSTOREs for new slot)
    }
}

// CHEAP: Use events for history
contract CheapHistory {
    event ActionRecorded(address indexed user, uint256 amount, uint256 timestamp);

    function recordAction(uint256 amount) external {
        emit ActionRecorded(msg.sender, amount, block.timestamp);
        // Cost: ~1,500 gas (event emission)
    }
}

// Gas savings: ~42,500 gas per action (95% reduction)
```

---

## Storage Optimization

### Delete Variables to Get Refunds

```solidity
contract StorageRefunds {
    mapping(address => uint256) public balances;

    function deposit() external payable {
        balances[msg.sender] += msg.value; // 22,100 gas (new) or 5,000 gas (update)
    }

    function withdraw() external {
        uint256 balance = balances[msg.sender];
        require(balance > 0, "No balance");

        delete balances[msg.sender]; // Refund: 4,800 gas
        payable(msg.sender).transfer(balance);
    }
}
```

### Avoid Redundant Storage Writes

```solidity
// INEFFICIENT: Always writes to storage
contract Inefficient {
    uint256 public value;

    function setValue(uint256 newValue) external {
        value = newValue; // Always costs gas, even if same value
    }
}

// EFFICIENT: Check before writing
contract Efficient {
    uint256 public value;

    function setValue(uint256 newValue) external {
        if (value != newValue) {
            value = newValue; // Only write if changed
        }
    }
}

// Gas savings: ~5,000 gas when value unchanged
```

### Pack Boolean Flags into Bitmap

```solidity
// INEFFICIENT: Multiple boolean storage slots
contract IneffientFlags {
    bool public flag1;
    bool public flag2;
    bool public flag3;
    // Each bool takes a full 32-byte slot

    function setFlags(bool f1, bool f2, bool f3) external {
        flag1 = f1; // SSTORE
        flag2 = f2; // SSTORE
        flag3 = f3; // SSTORE
        // Cost: ~15,000 gas (3 SSTOREs)
    }
}

// EFFICIENT: Pack into single uint256
contract EfficientFlags {
    uint256 private flags;

    function setFlags(bool f1, bool f2, bool f3) external {
        flags = (f1 ? 1 : 0) | (f2 ? 2 : 0) | (f3 ? 4 : 0);
        // Cost: ~5,000 gas (1 SSTORE)
    }

    function getFlag1() external view returns (bool) {
        return flags & 1 != 0;
    }

    function getFlag2() external view returns (bool) {
        return flags & 2 != 0;
    }

    function getFlag3() external view returns (bool) {
        return flags & 4 != 0;
    }
}

// Gas savings: ~10,000 gas (66% reduction)
```

---

## Memory vs Calldata vs Storage

### Cost Comparison

```solidity
contract DataLocation {
    uint256[] public storageArray;

    // EXPENSIVE: Storage (~2,100 gas per read)
    function sumStorage() external view returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = 0; i < storageArray.length; i++) {
            sum += storageArray[i]; // SLOAD each iteration
        }
        return sum;
    }

    // CHEAP: Memory (~3 gas per read)
    function sumMemory(uint256[] memory arr) external pure returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = 0; i < arr.length; i++) {
            sum += arr[i]; // MLOAD each iteration
        }
        return sum;
    }

    // CHEAPEST: Calldata (no copy, ~3 gas per read)
    function sumCalldata(uint256[] calldata arr) external pure returns (uint256) {
        uint256 sum = 0;
        for (uint256 i = 0; i < arr.length; i++) {
            sum += arr[i]; // CALLDATALOAD each iteration
        }
        return sum;
    }
}
```

### Calldata vs Memory for External Functions

```solidity
// EXPENSIVE: Copies calldata to memory
function processMemory(uint256[] memory data) external {
    // Cost: ~3 gas per element to copy + memory expansion
    // For 10 elements: ~500 gas overhead
}

// CHEAP: Reads directly from calldata
function processCalldata(uint256[] calldata data) external {
    // Cost: No copy overhead
    // For 10 elements: ~100 gas saved
}
```

### Memory Expansion Costs

```solidity
contract MemoryExpansion {
    // Memory expansion cost = words_used² / 512 + 3 * words_used

    function expensiveMemory() external pure returns (bytes memory) {
        bytes memory data = new bytes(10000); // Large allocation
        // Memory expansion: ~15,000 gas
        return data;
    }

    function cheapMemory() external pure returns (bytes memory) {
        bytes memory data = new bytes(100); // Small allocation
        // Memory expansion: ~100 gas
        return data;
    }
}
```

---

## Loop Optimization

### Cache Array Length

```solidity
// INEFFICIENT: Read length every iteration
function sumInefficient(uint256[] memory arr) external pure returns (uint256) {
    uint256 sum = 0;
    for (uint256 i = 0; i < arr.length; i++) { // MLOAD arr.length each time
        sum += arr[i];
    }
    return sum;
}

// EFFICIENT: Cache length
function sumEfficient(uint256[] memory arr) external pure returns (uint256) {
    uint256 sum = 0;
    uint256 length = arr.length; // Cache length
    for (uint256 i = 0; i < length; i++) {
        sum += arr[i];
    }
    return sum;
}

// Gas savings: ~3 gas per iteration
// For 100 elements: ~300 gas saved
```

### Unchecked Arithmetic in Loops

```solidity
// EXPENSIVE: Overflow checks every iteration
function loopWithChecks(uint256 n) external pure returns (uint256) {
    uint256 sum = 0;
    for (uint256 i = 0; i < n; i++) { // Checked increment
        sum += i;
    }
    return sum;
}

// CHEAP: Skip overflow checks
function loopUnchecked(uint256 n) external pure returns (uint256) {
    uint256 sum = 0;
    for (uint256 i = 0; i < n; ) {
        sum += i;
        unchecked { ++i; } // No overflow check
    }
    return sum;
}

// Gas savings: ~20 gas per iteration
// For 100 iterations: ~2,000 gas saved
```

### Prefix Increment vs Postfix

```solidity
// SLIGHTLY MORE EXPENSIVE: Postfix (i++)
function postfixLoop(uint256 n) external pure returns (uint256) {
    uint256 sum = 0;
    for (uint256 i = 0; i < n; i++) { // Creates temporary variable
        sum += i;
    }
    return sum;
}

// SLIGHTLY CHEAPER: Prefix (++i)
function prefixLoop(uint256 n) external pure returns (uint256) {
    uint256 sum = 0;
    for (uint256 i = 0; i < n; ++i) { // No temporary variable
        sum += i;
    }
    return sum;
}

// Gas savings: ~5 gas per iteration
```

### Avoid Storage Operations in Loops

```solidity
// VERY EXPENSIVE: Storage operations in loop
contract ExpensiveLoop {
    uint256 public total;

    function addNumbers(uint256[] calldata numbers) external {
        for (uint256 i = 0; i < numbers.length; i++) {
            total += numbers[i]; // SLOAD + SSTORE each iteration!
        }
        // For 10 numbers: ~71,000 gas
    }
}

// CHEAP: Cache to memory, write once
contract CheapLoop {
    uint256 public total;

    function addNumbers(uint256[] calldata numbers) external {
        uint256 _total = total; // SLOAD once
        for (uint256 i = 0; i < numbers.length; i++) {
            _total += numbers[i]; // Memory operation
        }
        total = _total; // SSTORE once
        // For 10 numbers: ~7,500 gas
    }
}

// Gas savings: ~63,500 gas for 10 numbers (90% reduction)
```

---

## Function Visibility and Modifiers

### External vs Public Functions

```solidity
contract FunctionVisibility {
    // EXPENSIVE: Public (can be called internally or externally)
    function publicFunction(uint256[] memory data) public pure returns (uint256) {
        // Copies calldata to memory even for external calls
        return data.length;
    }

    // CHEAP: External (only external calls)
    function externalFunction(uint256[] calldata data) external pure returns (uint256) {
        // Reads directly from calldata
        return data.length;
    }
}

// Gas savings: ~200-500 gas for array parameters
```

### Custom Modifiers Cost

```solidity
contract ModifierCost {
    address public owner;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    // Using modifier
    function withModifier() external onlyOwner {
        // Function logic
    }

    // Inline check (slightly cheaper)
    function inlineCheck() external {
        require(msg.sender == owner, "Not owner");
        // Function logic
    }
}

// Modifier cost: ~24 gas overhead (function call)
// Use modifiers for readability, inline for extreme optimization
```

### Short-Circuit Require Statements

```solidity
// EXPENSIVE: All checks evaluated
function expensiveRequire(uint256 value) external view {
    require(
        expensiveCheck1() &&
        expensiveCheck2() &&
        value > 0
    );
}

// CHEAP: Cheap checks first (short-circuit)
function cheapRequire(uint256 value) external view {
    require(value > 0); // Cheap check first
    require(expensiveCheck1());
    require(expensiveCheck2());
}

// If value is 0, saves gas from expensive checks
```

---

## EVM Assembly for Critical Sections

### Assembly Basics

```solidity
contract AssemblyOptimization {
    // SOLIDITY: ~100 gas
    function addSolidity(uint256 a, uint256 b) external pure returns (uint256) {
        return a + b;
    }

    // ASSEMBLY: ~80 gas
    function addAssembly(uint256 a, uint256 b) external pure returns (uint256 result) {
        assembly {
            result := add(a, b)
        }
    }
}
```

### Efficient Keccak256

```solidity
// SOLIDITY: ~180 gas
function hashSolidity(uint256 a, uint256 b) external pure returns (bytes32) {
    return keccak256(abi.encodePacked(a, b));
}

// ASSEMBLY: ~120 gas
function hashAssembly(uint256 a, uint256 b) external pure returns (bytes32 result) {
    assembly {
        mstore(0x00, a)
        mstore(0x20, b)
        result := keccak256(0x00, 0x40)
    }
}

// Gas savings: ~60 gas (33% reduction)
```

### Custom Errors with Assembly

```solidity
contract CustomErrors {
    error InsufficientBalance(uint256 available, uint256 required);

    // EXPENSIVE: String revert
    function revertString(uint256 balance, uint256 amount) external pure {
        require(balance >= amount, "Insufficient balance");
        // Cost: ~1,000 gas for revert
    }

    // CHEAP: Custom error
    function revertCustom(uint256 balance, uint256 amount) external pure {
        if (balance < amount) {
            revert InsufficientBalance(balance, amount);
        }
        // Cost: ~200 gas for revert
    }
}

// Gas savings: ~800 gas per revert (80% reduction)
```

### Efficient Balance Checks

```solidity
contract BalanceCheck {
    // SOLIDITY: ~100 gas
    function getBalanceSolidity(address account) external view returns (uint256) {
        return account.balance;
    }

    // ASSEMBLY: ~60 gas
    function getBalanceAssembly(address account) external view returns (uint256 bal) {
        assembly {
            bal := balance(account)
        }
    }
}
```

---

## Transaction-Level Optimization

### Understanding EIP-1559

After EIP-1559, transaction fees consist of:
- **Base Fee**: Burned, adjusts based on network congestion
- **Priority Fee (Tip)**: Paid to validators, incentivizes inclusion

```javascript
// Optimal gas price calculation
const baseFee = await provider.getBlock('latest').baseFeePerGas;
const maxPriorityFeePerGas = ethers.utils.parseUnits('2', 'gwei'); // Tip
const maxFeePerGas = baseFee.mul(2).add(maxPriorityFeePerGas); // 2x base + tip

const tx = {
    to: contractAddress,
    data: contractInterface.encodeFunctionData('transfer', [recipient, amount]),
    maxFeePerGas: maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFeePerGas,
    gasLimit: 50000
};
```

### Gas Price Strategies

```javascript
// Strategy 1: Fast inclusion (high priority)
const fastTx = {
    maxPriorityFeePerGas: ethers.utils.parseUnits('5', 'gwei'), // High tip
    maxFeePerGas: baseFee.mul(2).add(ethers.utils.parseUnits('5', 'gwei'))
};

// Strategy 2: Cost-efficient (low priority)
const cheapTx = {
    maxPriorityFeePerGas: ethers.utils.parseUnits('0.5', 'gwei'), // Low tip
    maxFeePerGas: baseFee.mul(1.5).add(ethers.utils.parseUnits('0.5', 'gwei'))
};

// Strategy 3: Dynamic based on congestion
const adaptiveTx = async () => {
    const gasPrice = await provider.getGasPrice();
    const feeData = await provider.getFeeData();

    return {
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
        maxFeePerGas: feeData.maxFeePerGas
    };
};
```

### Gas Limit Estimation

```javascript
// Accurate gas estimation
const estimatedGas = await contract.estimateGas.transfer(recipient, amount);

// Add buffer for safety (10-20%)
const gasLimit = estimatedGas.mul(110).div(100);

const tx = await contract.transfer(recipient, amount, {
    gasLimit: gasLimit
});
```

---

## Batching Operations

### Batch Multiple Transfers

```solidity
// INEFFICIENT: Individual transfers
contract IndividualTransfers {
    function transfer(address recipient, uint256 amount) external {
        // Base cost: 21,000 gas per transaction
    }

    // 10 transfers = 210,000 gas in base costs alone
}

// EFFICIENT: Batch transfer
contract BatchTransfer {
    function batchTransfer(
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        require(recipients.length == amounts.length, "Length mismatch");

        for (uint256 i = 0; i < recipients.length; i++) {
            payable(recipients[i]).transfer(amounts[i]);
        }
        // 10 transfers = 21,000 base + ~10,000 per transfer = ~121,000 gas
    }
}

// Gas savings: ~89,000 gas for 10 transfers (42% reduction)
```

### Batch Approval and Transfer

```solidity
contract BatchOperations {
    IERC20 public token;

    // Single approve + transferFrom
    function singleOperation(address from, address to, uint256 amount) external {
        token.approve(address(this), amount);      // ~46,000 gas
        token.transferFrom(from, to, amount);      // ~35,000 gas
        // Total: ~81,000 gas
    }

    // Batch approve + multiple transfers
    function batchOperation(
        address from,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            total += amounts[i];
        }

        token.approve(address(this), total);       // ~46,000 gas once

        for (uint256 i = 0; i < recipients.length; i++) {
            token.transferFrom(from, recipients[i], amounts[i]); // ~35,000 per transfer
        }
        // For 5 transfers: ~221,000 gas vs ~405,000 gas individual
    }
}

// Gas savings: ~184,000 gas for 5 transfers (45% reduction)
```

### Multicall Pattern

```solidity
contract Multicall {
    function multicall(bytes[] calldata data) external returns (bytes[] memory results) {
        results = new bytes[](data.length);

        for (uint256 i = 0; i < data.length; i++) {
            (bool success, bytes memory result) = address(this).delegatecall(data[i]);
            require(success, "Multicall failed");
            results[i] = result;
        }

        return results;
    }

    // Example usage: batch multiple function calls in one transaction
    // Gas savings: One base transaction cost (21,000 gas) instead of N
}
```

---

## Gas Profiling Tools

### Hardhat Gas Reporter

```javascript
// hardhat.config.js
require("hardhat-gas-reporter");

module.exports = {
    gasReporter: {
        enabled: true,
        currency: 'USD',
        gasPrice: 21,
        coinmarketcap: process.env.COINMARKETCAP_API_KEY
    }
};
```

```javascript
// test/GasTest.js
const { expect } = require("chai");

describe("Gas Optimization Tests", function() {
    it("Should compare gas costs", async function() {
        const GasTest = await ethers.getContractFactory("GasTest");
        const gasTest = await GasTest.deploy();

        // Test inefficient version
        const tx1 = await gasTest.inefficientFunction();
        const receipt1 = await tx1.wait();
        console.log("Inefficient gas:", receipt1.gasUsed.toString());

        // Test optimized version
        const tx2 = await gasTest.optimizedFunction();
        const receipt2 = await tx2.wait();
        console.log("Optimized gas:", receipt2.gasUsed.toString());

        // Calculate savings
        const savings = receipt1.gasUsed.sub(receipt2.gasUsed);
        console.log("Gas saved:", savings.toString());
    });
});
```

### Foundry Gas Snapshots

```solidity
// test/GasTest.t.sol
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/GasTest.sol";

contract GasTestTest is Test {
    GasTest gasTest;

    function setUp() public {
        gasTest = new GasTest();
    }

    function testGasInefficient() public {
        uint256 gasBefore = gasleft();
        gasTest.inefficientFunction();
        uint256 gasAfter = gasleft();
        console.log("Inefficient gas:", gasBefore - gasAfter);
    }

    function testGasOptimized() public {
        uint256 gasBefore = gasleft();
        gasTest.optimizedFunction();
        uint256 gasAfter = gasleft();
        console.log("Optimized gas:", gasBefore - gasAfter);
    }
}
```

```bash
# Run gas snapshot
forge snapshot

# Compare snapshots
forge snapshot --diff

# Specific gas report
forge test --gas-report
```

### Manual Gas Measurement

```solidity
contract GasMeasurement {
    event GasUsed(string operation, uint256 gasUsed);

    function measureGas() external {
        uint256 gasBefore = gasleft();

        // Operation to measure
        expensiveOperation();

        uint256 gasAfter = gasleft();
        uint256 gasUsed = gasBefore - gasAfter;

        emit GasUsed("expensiveOperation", gasUsed);
    }

    function expensiveOperation() internal {
        // Some operation
    }
}
```

---

## Common Gas-Wasting Patterns

### Pattern 1: Unnecessary Storage Reads

```solidity
// BAD: Multiple storage reads
contract Bad {
    uint256 public value;

    function calculate() external view returns (uint256) {
        return value * 2 + value * 3 + value * 4; // 3 SLOADs
        // Cost: ~6,300 gas
    }
}

// GOOD: Single storage read
contract Good {
    uint256 public value;

    function calculate() external view returns (uint256) {
        uint256 _value = value; // 1 SLOAD
        return _value * 2 + _value * 3 + _value * 4;
        // Cost: ~2,120 gas
    }
}

// Gas savings: ~4,180 gas (66% reduction)
```

### Pattern 2: Redundant Checks

```solidity
// BAD: Redundant zero-address check
contract Bad {
    mapping(address => uint256) public balances;

    function transfer(address to, uint256 amount) external {
        require(to != address(0), "Zero address"); // Check 1
        require(balances[msg.sender] >= amount, "Insufficient");

        balances[msg.sender] -= amount;
        balances[to] += amount; // Will fail on zero address anyway
    }
}

// GOOD: Remove redundant check if not critical
contract Good {
    mapping(address => uint256) public balances;

    function transfer(address to, uint256 amount) external {
        require(balances[msg.sender] >= amount, "Insufficient");

        balances[msg.sender] -= amount;
        balances[to] += amount;
    }
}

// Gas savings: ~100 gas per call
```

### Pattern 3: Large Arrays in Storage

```solidity
// BAD: Large array iteration
contract Bad {
    address[] public users;

    function getTotalBalance() external view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < users.length; i++) {
            total += users[i].balance;
        }
        return total;
        // For 100 users: ~210,000 gas
    }
}

// GOOD: Keep running total
contract Good {
    address[] public users;
    uint256 public totalBalance; // Running total

    function addUser(address user) external {
        users.push(user);
        totalBalance += user.balance;
    }

    function getTotalBalance() external view returns (uint256) {
        return totalBalance; // 2,100 gas
    }
}

// Gas savings: ~207,900 gas for 100 users (99% reduction)
```

### Pattern 4: Unnecessary Events

```solidity
// BAD: Too many events
contract Bad {
    event Step1();
    event Step2();
    event Step3();

    function process() external {
        emit Step1(); // ~1,500 gas
        // Process step 1
        emit Step2(); // ~1,500 gas
        // Process step 2
        emit Step3(); // ~1,500 gas
        // Process step 3
        // Total event cost: ~4,500 gas
    }
}

// GOOD: Single comprehensive event
contract Good {
    event ProcessComplete(uint256 step1Result, uint256 step2Result, uint256 step3Result);

    function process() external {
        uint256 result1 = processStep1();
        uint256 result2 = processStep2();
        uint256 result3 = processStep3();

        emit ProcessComplete(result1, result2, result3);
        // Total event cost: ~2,000 gas
    }
}

// Gas savings: ~2,500 gas (55% reduction)
```

---

## Gas Golf Techniques

### Technique 1: Bit Manipulation

```solidity
contract BitManipulation {
    // EXPENSIVE: Division and modulo
    function isEvenExpensive(uint256 n) external pure returns (bool) {
        return n % 2 == 0; // ~25 gas
    }

    // CHEAP: Bit manipulation
    function isEvenCheap(uint256 n) external pure returns (bool) {
        return n & 1 == 0; // ~10 gas
    }

    // EXPENSIVE: Multiply by power of 2
    function multiplyExpensive(uint256 n) external pure returns (uint256) {
        return n * 8; // ~15 gas
    }

    // CHEAP: Bit shift
    function multiplyCheap(uint256 n) external pure returns (uint256) {
        return n << 3; // ~8 gas
    }
}
```

### Technique 2: Minimize Opcodes

```solidity
// EXPENSIVE: Multiple operations
function expensiveMin(uint256 a, uint256 b) external pure returns (uint256) {
    if (a < b) {
        return a;
    } else {
        return b;
    }
    // ~50 gas
}

// CHEAP: Ternary operator (fewer opcodes)
function cheapMin(uint256 a, uint256 b) external pure returns (uint256) {
    return a < b ? a : b;
    // ~35 gas
}

// Gas savings: ~15 gas (30% reduction)
```

### Technique 3: Use Errors Instead of Strings

```solidity
// EXPENSIVE: String errors
contract ExpensiveErrors {
    function checkValue(uint256 value) external pure {
        require(value > 0, "Value must be greater than zero");
        require(value < 100, "Value must be less than 100");
        // String storage cost: ~1,000 gas per require
    }
}

// CHEAP: Custom errors
error ValueTooLow();
error ValueTooHigh();

contract CheapErrors {
    function checkValue(uint256 value) external pure {
        if (value == 0) revert ValueTooLow();
        if (value >= 100) revert ValueTooHigh();
        // Custom error cost: ~200 gas per revert
    }
}

// Gas savings: ~800 gas per error (80% reduction)
```

### Technique 4: Short-Circuit Boolean Logic

```solidity
contract ShortCircuit {
    function expensiveCheck() internal pure returns (bool) {
        // Simulate expensive operation
        uint256 sum = 0;
        for (uint256 i = 0; i < 100; i++) {
            sum += i;
        }
        return sum > 0;
    }

    // BAD: Expensive check first
    function badOrder(bool quick) external pure returns (bool) {
        return expensiveCheck() && quick; // Always runs expensive check
    }

    // GOOD: Quick check first
    function goodOrder(bool quick) external pure returns (bool) {
        return quick && expensiveCheck(); // Short-circuits if quick is false
    }
}
```

### Technique 5: Avoid Zero Initialization

```solidity
// BAD: Explicit zero initialization
function badLoop(uint256 n) external pure returns (uint256) {
    uint256 sum = 0; // Unnecessary, variables are zero by default
    for (uint256 i = 0; i < n; i++) { // i = 0 also unnecessary
        sum += i;
    }
    return sum;
}

// GOOD: Implicit zero initialization
function goodLoop(uint256 n) external pure returns (uint256) {
    uint256 sum; // Implicitly zero
    for (uint256 i; i < n; i++) { // i implicitly zero
        sum += i;
    }
    return sum;
}

// Gas savings: ~6 gas per variable
```

### Technique 6: Function Name Optimization

```solidity
// Function selector is first 4 bytes of keccak256(functionSignature)
// Functions with lower selector values cost slightly less gas

contract FunctionNames {
    // Higher selector value (more expensive to call)
    function thisIsAVeryLongFunctionName() external {} // Selector: 0xXXXXXXXX

    // Lower selector value (cheaper to call)
    function a() external {} // Selector: potentially lower value

    // Difference is negligible (~1-2 gas), only for extreme optimization
}
```

---

## Real-World Optimization Examples

### Example 1: NFT Minting Optimization

```solidity
// BEFORE: ~180,000 gas per mint
contract NFTBefore {
    uint256 public totalSupply;
    mapping(uint256 => address) public owners;
    mapping(address => uint256) public balances;

    function mint() external {
        totalSupply++;
        uint256 tokenId = totalSupply;
        owners[tokenId] = msg.sender;
        balances[msg.sender]++;
    }
}

// AFTER: ~120,000 gas per mint
contract NFTAfter {
    uint256 public totalSupply;
    mapping(uint256 => address) public owners;
    mapping(address => uint256) public balances;

    function mint() external {
        uint256 tokenId = ++totalSupply; // Pre-increment, cached
        owners[tokenId] = msg.sender;
        unchecked {
            balances[msg.sender]++; // Unchecked (overflow impossible in practice)
        }
    }
}

// Gas savings: ~60,000 gas per mint (33% reduction)
```

### Example 2: DEX Swap Optimization

```solidity
// BEFORE: ~125,000 gas per swap
contract DEXBefore {
    mapping(address => uint256) public balances;
    uint256 public reserve0;
    uint256 public reserve1;

    function swap(uint256 amount0, uint256 amount1) external {
        require(balances[msg.sender] >= amount0, "Insufficient balance");

        balances[msg.sender] -= amount0;
        balances[msg.sender] += amount1;

        reserve0 += amount0;
        reserve1 -= amount1;
    }
}

// AFTER: ~85,000 gas per swap
contract DEXAfter {
    mapping(address => uint256) public balances;
    uint256 public reserve0;
    uint256 public reserve1;

    error InsufficientBalance();

    function swap(uint256 amount0, uint256 amount1) external {
        uint256 balance = balances[msg.sender]; // Cache
        if (balance < amount0) revert InsufficientBalance(); // Custom error

        unchecked {
            balances[msg.sender] = balance - amount0 + amount1; // Single SSTORE
            reserve0 += amount0;
            reserve1 -= amount1;
        }
    }
}

// Gas savings: ~40,000 gas per swap (32% reduction)
```

### Example 3: Voting System Optimization

```solidity
// BEFORE: ~95,000 gas per vote
contract VotingBefore {
    struct Proposal {
        string description;
        uint256 voteCount;
        bool executed;
        mapping(address => bool) hasVoted;
    }

    mapping(uint256 => Proposal) public proposals;

    function vote(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.hasVoted[msg.sender], "Already voted");
        require(!proposal.executed, "Proposal executed");

        proposal.hasVoted[msg.sender] = true;
        proposal.voteCount++;
    }
}

// AFTER: ~55,000 gas per vote
contract VotingAfter {
    struct Proposal {
        uint128 voteCount;    // Packed
        bool executed;        // Packed (total: 1 slot)
        mapping(address => bool) hasVoted;
    }

    mapping(uint256 => Proposal) public proposals;

    error AlreadyVoted();
    error ProposalExecuted();

    function vote(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        if (proposal.hasVoted[msg.sender]) revert AlreadyVoted();
        if (proposal.executed) revert ProposalExecuted();

        proposal.hasVoted[msg.sender] = true;
        unchecked { proposal.voteCount++; } // Unchecked increment
    }
}

// Gas savings: ~40,000 gas per vote (42% reduction)
```

---

## Advanced Optimization Strategies

### Strategy 1: Proxy Pattern for Deployment

```solidity
// Instead of deploying full contract multiple times
// Deploy minimal proxy (EIP-1167)

// Implementation contract (deploy once)
contract Implementation {
    address public owner;
    uint256 public value;

    function initialize(address _owner) external {
        owner = _owner;
    }
}

// Minimal proxy (deploy multiple times)
// Deployment cost: ~45,000 gas vs ~200,000 gas for full contract
contract MinimalProxy {
    // 55 bytes of bytecode that delegates all calls
    // Gas savings: ~155,000 gas per deployment (77% reduction)
}
```

### Strategy 2: Merkle Tree for Allowlists

```solidity
// EXPENSIVE: Store allowlist in mapping
contract AllowlistExpensive {
    mapping(address => bool) public allowlist;

    function addToAllowlist(address[] calldata addresses) external {
        for (uint256 i = 0; i < addresses.length; i++) {
            allowlist[addresses[i]] = true; // 22,100 gas per address
        }
        // For 1000 addresses: ~22,100,000 gas
    }
}

// CHEAP: Use Merkle tree
contract AllowlistCheap {
    bytes32 public merkleRoot; // Single storage slot

    function setMerkleRoot(bytes32 root) external {
        merkleRoot = root; // 22,100 gas once
    }

    function verify(bytes32[] calldata proof, address account) external view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(account));
        return MerkleProof.verify(proof, merkleRoot, leaf);
        // ~5,000 gas per verification
    }
}

// Gas savings: ~22,100,000 - 22,100 = ~22,077,900 gas (99.9% reduction for setup)
```

### Strategy 3: Bitmap for Tracking

```solidity
// EXPENSIVE: Mapping for tracking
contract TrackingExpensive {
    mapping(uint256 => bool) public claimed;

    function claim(uint256 id) external {
        require(!claimed[id], "Already claimed");
        claimed[id] = true; // 22,100 gas
    }
}

// CHEAP: Bitmap
contract TrackingCheap {
    mapping(uint256 => uint256) private claimedBitmap;

    function claim(uint256 id) external {
        uint256 bucket = id / 256;
        uint256 position = id % 256;
        uint256 bitmap = claimedBitmap[bucket];

        require((bitmap & (1 << position)) == 0, "Already claimed");
        claimedBitmap[bucket] = bitmap | (1 << position); // 5,000 gas (warm)

        // First claim in bucket: 22,100 gas
        // Subsequent claims in same bucket: 5,000 gas
    }
}

// Gas savings: ~17,100 gas per claim (77% reduction for warm slots)
```

---

## Gas Optimization Checklist

### Pre-Deployment Checklist

- [ ] Variables packed efficiently in storage
- [ ] Constants and immutables used where possible
- [ ] Custom errors instead of string reverts
- [ ] External instead of public for functions not called internally
- [ ] Calldata instead of memory for external function parameters
- [ ] Arrays cached outside loops
- [ ] Unchecked arithmetic where overflow impossible
- [ ] Prefix increment (++i) instead of postfix (i++)
- [ ] Storage reads minimized and cached
- [ ] Events used instead of storage for historical data
- [ ] Bitmap used for boolean flags
- [ ] Merkle trees for large allowlists
- [ ] Batch operations where possible
- [ ] Assembly used for critical paths
- [ ] Zero values deleted to get refunds

### Testing Checklist

- [ ] Gas reporter enabled (Hardhat or Foundry)
- [ ] Gas snapshots created
- [ ] Gas costs compared before/after optimization
- [ ] Edge cases tested for gas costs
- [ ] Integration tests confirm gas efficiency

### Monitoring Checklist

- [ ] Gas costs monitored in production
- [ ] Alerts set for unusual gas consumption
- [ ] User transactions optimized (batch where possible)
- [ ] Gas price strategies implemented

---

## Key Takeaways

### Critical Optimizations (High Impact)

1. **Use Custom Errors**: Save ~800 gas per revert (80% reduction)
2. **Pack Storage Variables**: Save ~2,100 gas per SLOAD (50-70% reduction)
3. **Use Immutable/Constant**: Save ~2,097 gas per read (99% reduction)
4. **Cache Storage Reads**: Save ~2,000 gas per cached read (95% reduction)
5. **Use Events for History**: Save ~42,500 gas per record (95% reduction)
6. **Batch Operations**: Save ~21,000 gas per additional operation (42-50% reduction)
7. **Calldata vs Memory**: Save ~200-500 gas for array parameters
8. **Unchecked Arithmetic**: Save ~20 gas per operation

### Medium Impact Optimizations

1. **External vs Public**: Save ~200-500 gas
2. **Prefix Increment**: Save ~5 gas per operation
3. **Cache Array Length**: Save ~3 gas per iteration
4. **Bit Manipulation**: Save ~15 gas per operation
5. **Short-Circuit Logic**: Save gas on expensive checks
6. **Bitmap for Booleans**: Save ~17,100 gas per flag (77% reduction)

### Best Practices

1. **Measure First**: Always profile before optimizing
2. **Optimize Hot Paths**: Focus on frequently called functions
3. **Balance Readability**: Don't sacrifice security for gas
4. **Test Thoroughly**: Optimizations can introduce bugs
5. **Document Changes**: Explain non-obvious optimizations
6. **Consider Trade-offs**: Sometimes readability > gas savings

### Gas Cost Reference Table

| Operation | Gas Cost | Optimization Strategy |
|-----------|----------|----------------------|
| SSTORE (new) | 22,100 | Avoid or batch |
| SSTORE (modify) | 5,000 | Cache and write once |
| SLOAD (cold) | 2,100 | Cache to memory |
| SLOAD (warm) | 100 | Still cache in loops |
| MLOAD/MSTORE | 3 | Use liberally |
| CALLDATALOAD | 3 | Prefer over memory |
| Base transaction | 21,000 | Batch operations |
| Custom error | ~200 | Always use |
| String revert | ~1,000 | Never use |
| Event emission | ~1,500 | Use for history |

### Final Tips

1. **Start with low-hanging fruit**: Custom errors, storage packing, constants
2. **Measure everything**: Use gas reporters and snapshots
3. **Iterate**: Optimize, test, measure, repeat
4. **Learn from others**: Study optimized contracts (Uniswap, OpenZeppelin)
5. **Stay updated**: New EIPs may change gas costs
6. **Prioritize security**: Never sacrifice safety for gas savings

Gas optimization is an ongoing process. Focus on the highest-impact changes first, measure results, and iterate. Remember that readable, secure code is more important than extreme gas optimization in most cases.

---

**End of Guide**

Total reading time: ~45 minutes
Difficulty: Intermediate to Advanced
Prerequisites: Solidity basics, understanding of Ethereum transactions
