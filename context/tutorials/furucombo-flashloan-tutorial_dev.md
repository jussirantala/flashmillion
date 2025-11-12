**Source:** https://docs.furucombo.app/using-furucombo/tutorials/flashloan-combo
**Date:** 2024-2025


# Furucombo Flash Loan Advanced Implementation - Level 2
**Technical Level:** Advanced
**Focus:** Combo Building, Web3 Integration, Transaction Encoding, Advanced Strategies

## Furucombo Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Furucombo Ecosystem                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐        ┌──────────────────┐              │
│  │  Flash Loan  │───────▶│  Furucombo Proxy │              │
│  │  Provider    │        │  Contract        │              │
│  │  (Aave, etc) │        └────────┬─────────┘              │
│  └──────────────┘                 │                         │
│                                    │                         │
│                                    ▼                         │
│                          ┌──────────────────┐               │
│                          │  Handler System  │               │
│                          │  (Cubes)         │               │
│                          └────────┬─────────┘               │
│                                   │                          │
│                   ┌───────────────┴───────────────┐         │
│                   │                               │         │
│                   ▼                               ▼         │
│         ┌──────────────────┐           ┌──────────────────┐│
│         │  Uniswap Handler │           │  Aave Handler    ││
│         └──────────────────┘           └──────────────────┘│
│                   │                               │         │
│                   ▼                               ▼         │
│         ┌──────────────────┐           ┌──────────────────┐│
│         │   Uniswap DEX    │           │   Aave Pool      ││
│         └──────────────────┘           └──────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘

Concept: "Money Legos"
- Each protocol interaction is a "cube"
- Cubes are combined into "combos"
- One transaction executes entire combo
- Flash loans enable combos without capital
```

## Core Contracts

### Proxy Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title FurucomboProxy
 * @notice Main proxy contract that executes combos
 */
interface IFurucomboProxy {
    /**
     * @notice Execute a combo (sequence of cube calls)
     * @param tos Array of handler addresses (cubes)
     * @param configs Array of configurations for each handler
     * @param datas Array of calldata for each handler
     */
    function batchExec(
        address[] calldata tos,
        bytes32[] calldata configs,
        bytes[] calldata datas
    ) external payable;

    /**
     * @notice Execute combo with delegatecall
     * Allows handlers to modify proxy state
     */
    function execs(
        address[] calldata tos,
        bytes32[] calldata configs,
        bytes[] calldata datas
    ) external payable;
}

/**
 * Config byte structure:
 * - 0x0000000000000000000000000000000000000000000000000000000000000001: staticcall
 * - 0x0000000000000000000000000000000000000000000000000000000000000000: delegatecall
 */
```

### Handler (Cube) Interface

```solidity
/**
 * @title Handler Base
 * @notice Base interface for all Furucombo handlers
 */
abstract contract HandlerBase {
    /**
     * @notice Get handler return amount
     * @param data Encoded data from previous handler
     */
    function getContractName() public pure virtual returns (string memory);

    /**
     * @notice Post-process after execution
     * Called after each cube execution
     */
    function postProcess() external payable virtual {
        // Cleanup logic
    }
}
```

## Building Combos Programmatically

### Combo Builder Class

```javascript
// comboBuilder.js
const { ethers } = require('ethers');

class FurucomboComboBuilder {
    constructor(provider, proxyAddress) {
        this.provider = provider;
        this.proxyAddress = proxyAddress || '0x17e8Ca1b4798B97602895f63206afCd1Fc90Ca5f'; // Mainnet

        this.handlers = {
            aave: '0x05F51269F5C9941CD8A9B5b30D12EaC3B05aE3d4',
            uniswapV2: '0x4585E557D1D0A7C5Dd7b1A1d76CC52F52b1B3785',
            sushiswap: '0x929e9A0F18c2A83c899c5531Aa36F2f1b1aC7F78',
            curve: '0x5DB3B4c2c6C5dF8D0D8F8d7B7f5d5F5d5F5d5F5d',
        };

        this.tos = [];
        this.configs = [];
        this.datas = [];
    }

    /**
     * Add flash loan cube
     */
    addFlashLoan(provider, assets, amounts) {
        const aaveHandler = this.handlers.aave;

        // Encode flash loan call
        const iface = new ethers.Interface([
            'function flashLoan(address[] assets, uint256[] amounts, uint256[] modes)',
        ]);

        const modes = new Array(assets.length).fill(0); // 0 = no debt
        const data = iface.encodeFunctionData('flashLoan', [assets, amounts, modes]);

        this.tos.push(aaveHandler);
        this.configs.push(this._getDelegateCallConfig());
        this.datas.push(data);

        return this;
    }

    /**
     * Add Uniswap V2 swap cube
     */
    addUniswapSwap(tokenIn, tokenOut, amountIn, minAmountOut) {
        const uniswapHandler = this.handlers.uniswapV2;

        const iface = new ethers.Interface([
            'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to)',
        ]);

        const path = [tokenIn, tokenOut];
        const data = iface.encodeFunctionData('swapExactTokensForTokens', [
            amountIn,
            minAmountOut,
            path,
            this.proxyAddress,
        ]);

        this.tos.push(uniswapHandler);
        this.configs.push(this._getDelegateCallConfig());
        this.datas.push(data);

        return this;
    }

    /**
     * Add SushiSwap swap cube
     */
    addSushiSwap(tokenIn, tokenOut, amountIn, minAmountOut) {
        const sushiHandler = this.handlers.sushiswap;

        const iface = new ethers.Interface([
            'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to)',
        ]);

        const path = [tokenIn, tokenOut];
        const data = iface.encodeFunctionData('swapExactTokensForTokens', [
            amountIn,
            minAmountOut,
            path,
            this.proxyAddress,
        ]);

        this.tos.push(sushiHandler);
        this.configs.push(this._getDelegateCallConfig());
        this.datas.push(data);

        return this;
    }

    /**
     * Add Aave supply cube
     */
    addAaveSupply(asset, amount) {
        const aaveHandler = this.handlers.aave;

        const iface = new ethers.Interface([
            'function supply(address asset, uint256 amount)',
        ]);

        const data = iface.encodeFunctionData('supply', [asset, amount]);

        this.tos.push(aaveHandler);
        this.configs.push(this._getDelegateCallConfig());
        this.datas.push(data);

        return this;
    }

    /**
     * Add Aave repayment cube
     */
    addAaveRepay(asset, amount, rateMode) {
        const aaveHandler = this.handlers.aave;

        const iface = new ethers.Interface([
            'function repay(address asset, uint256 amount, uint256 rateMode)',
        ]);

        const data = iface.encodeFunctionData('repay', [asset, amount, rateMode]);

        this.tos.push(aaveHandler);
        this.configs.push(this._getDelegateCallConfig());
        this.datas.push(data);

        return this;
    }

    /**
     * Add custom handler cube
     */
    addCustomCube(handlerAddress, functionSignature, params) {
        const iface = new ethers.Interface([functionSignature]);
        const functionName = functionSignature.split('(')[0];
        const data = iface.encodeFunctionData(functionName, params);

        this.tos.push(handlerAddress);
        this.configs.push(this._getDelegateCallConfig());
        this.datas.push(data);

        return this;
    }

    /**
     * Build the combo for execution
     */
    build() {
        return {
            tos: this.tos,
            configs: this.configs,
            datas: this.datas,
        };
    }

    /**
     * Execute the combo
     */
    async execute(signer, options = {}) {
        const proxyContract = new ethers.Contract(
            this.proxyAddress,
            [
                'function batchExec(address[] tos, bytes32[] configs, bytes[] datas) payable',
            ],
            signer
        );

        const { tos, configs, datas } = this.build();

        const tx = await proxyContract.batchExec(tos, configs, datas, {
            value: options.value || 0,
            gasLimit: options.gasLimit || 3000000,
            maxFeePerGas: options.maxFeePerGas,
            maxPriorityFeePerGas: options.maxPriorityFeePerGas,
        });

        console.log('Combo transaction sent:', tx.hash);

        const receipt = await tx.wait();
        console.log('Combo executed in block:', receipt.blockNumber);

        return receipt;
    }

    /**
     * Simulate combo execution
     */
    async simulate(signer) {
        const proxyContract = new ethers.Contract(
            this.proxyAddress,
            [
                'function batchExec(address[] tos, bytes32[] configs, bytes[] datas) payable',
            ],
            signer
        );

        const { tos, configs, datas } = this.build();

        try {
            // Use callStatic to simulate
            await proxyContract.batchExec.staticCall(tos, configs, datas);
            console.log('✅ Simulation successful');
            return true;
        } catch (error) {
            console.error('❌ Simulation failed:', error.message);
            return false;
        }
    }

    /**
     * Reset combo builder
     */
    reset() {
        this.tos = [];
        this.configs = [];
        this.datas = [];
        return this;
    }

    /**
     * Get delegatecall config
     */
    _getDelegateCallConfig() {
        return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }

    /**
     * Get staticcall config
     */
    _getStaticCallConfig() {
        return '0x0000000000000000000000000000000000000000000000000000000000000001';
    }
}

module.exports = FurucomboComboBuilder;
```

## Advanced Combo Strategies

### Strategy 1: Flash Loan Arbitrage

```javascript
/**
 * Flash loan arbitrage using Furucombo
 */
async function flashLoanArbitrage() {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const builder = new FurucomboComboBuilder(provider);

    const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';

    const amount = ethers.parseUnits('100000', 6); // 100K USDC

    // Build combo:
    // 1. Flash loan 100K USDC
    // 2. Swap USDC to DAI on Uniswap
    // 3. Swap DAI back to USDC on SushiSwap
    // 4. Repay flash loan
    const combo = builder
        .addFlashLoan('aave', [USDC], [amount])
        .addUniswapSwap(USDC, DAI, amount, 0) // 0 for dynamic calculation
        .addSushiSwap(DAI, USDC, ethers.MaxUint256, 0) // MaxUint256 = use all balance
        .build();

    // Simulate first
    const simSuccess = await builder.simulate(signer);

    if (!simSuccess) {
        console.log('Simulation failed - aborting');
        return;
    }

    // Execute combo
    const receipt = await builder.execute(signer, {
        gasLimit: 2000000,
    });

    console.log('Arbitrage executed:', receipt.hash);
}
```

### Strategy 2: Collateral Swap

```javascript
/**
 * Swap collateral type using Furucombo
 */
async function collateralSwap() {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const builder = new FurucomboComboBuilder(provider);

    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';
    const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

    const debtAmount = ethers.parseUnits('50000', 6); // 50K USDC debt

    // Combo:
    // 1. Flash loan USDC to repay debt
    // 2. Repay USDC debt on Aave
    // 3. Withdraw WETH collateral from Aave
    // 4. Swap WETH to WBTC on Uniswap
    // 5. Supply WBTC as new collateral on Aave
    // 6. Borrow USDC again
    // 7. Repay flash loan
    const combo = builder
        .addFlashLoan('aave', [USDC], [debtAmount])
        .addAaveRepay(USDC, debtAmount, 2) // 2 = variable rate
        // Withdraw WETH - would need custom handler
        .addCustomCube(
            builder.handlers.aave,
            'function withdraw(address asset, uint256 amount, address to)',
            [WETH, ethers.MaxUint256, builder.proxyAddress]
        )
        .addUniswapSwap(WETH, WBTC, ethers.MaxUint256, 0)
        .addAaveSupply(WBTC, ethers.MaxUint256)
        // Borrow USDC - would need custom handler
        .addCustomCube(
            builder.handlers.aave,
            'function borrow(address asset, uint256 amount, uint256 interestRateMode)',
            [USDC, debtAmount, 2]
        )
        .build();

    await builder.execute(signer);
}
```

### Strategy 3: Leveraged Yield Farming

```javascript
/**
 * Leverage yield farming position with flash loan
 */
async function leveragedYieldFarming() {
    const builder = new FurucomboComboBuilder(provider);

    const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
    const initialAmount = ethers.parseEther('10000'); // 10K DAI
    const leverage = 3; // 3x leverage

    const flashLoanAmount = initialAmount * BigInt(leverage - 1); // 20K DAI

    // Combo for 3x leverage:
    // 1. Flash loan 20K DAI
    // 2. Supply all 30K DAI to Aave (10K own + 20K borrowed)
    // 3. Borrow 20K DAI against collateral
    // 4. Repay flash loan with borrowed DAI
    //
    // Result: 30K DAI deposited, 20K DAI debt = 1.5x collateralization
    const combo = builder
        .addFlashLoan('aave', [DAI], [flashLoanAmount])
        .addAaveSupply(DAI, initialAmount + flashLoanAmount)
        .addCustomCube(
            builder.handlers.aave,
            'function borrow(address asset, uint256 amount, uint256 interestRateMode)',
            [DAI, flashLoanAmount, 2]
        )
        .build();

    await builder.execute(signer);
}
```

### Strategy 4: Multi-Hop Arbitrage

```javascript
/**
 * Complex multi-hop arbitrage across 3 DEXs
 */
async function multiHopArbitrage() {
    const builder = new FurucomboComboBuilder(provider);

    const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    const WBTC = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599';

    const amount = ethers.parseUnits('100000', 6);

    // Arbitrage path:
    // USDC → WETH (Uniswap) → WBTC (SushiSwap) → USDC (Curve)
    const combo = builder
        .addFlashLoan('aave', [USDC], [amount])
        .addUniswapSwap(USDC, WETH, amount, 0)
        .addSushiSwap(WETH, WBTC, ethers.MaxUint256, 0)
        .addCustomCube(
            builder.handlers.curve,
            'function exchange(int128 i, int128 j, uint256 dx, uint256 min_dy)',
            [1, 0, ethers.MaxUint256, 0] // WBTC → USDC on Curve
        )
        .build();

    // Simulate and execute
    if (await builder.simulate(signer)) {
        await builder.execute(signer);
    }
}
```

## Transaction Encoding Utilities

### Parameter Encoding Helper

```javascript
/**
 * Utilities for encoding Furucombo transaction parameters
 */
class FurucomboEncoder {
    /**
     * Encode amount placeholder
     * Use this to reference output from previous cube
     */
    static encodeAmountPlaceholder(cubeIndex, outputIndex = 0) {
        // Placeholder format: 0xffffffff + cubeIndex + outputIndex
        const placeholder = ethers.solidityPacked(
            ['bytes4', 'uint8', 'uint8'],
            ['0xffffffff', cubeIndex, outputIndex]
        );
        return placeholder;
    }

    /**
     * Encode dynamic amount (use entire balance)
     */
    static encodeDynamicAmount() {
        return ethers.MaxUint256;
    }

    /**
     * Encode percentage of balance
     */
    static encodePercentage(percentage) {
        // percentage in basis points (10000 = 100%)
        return ethers.solidityPacked(
            ['bytes4', 'uint16'],
            ['0xfffffffe', percentage]
        );
    }

    /**
     * Encode flash loan callback
     */
    static encodeFlashLoanCallback(cubes) {
        // Encode the cubes to be executed in flash loan callback
        const tos = [];
        const configs = [];
        const datas = [];

        for (const cube of cubes) {
            tos.push(cube.to);
            configs.push(cube.config);
            datas.push(cube.data);
        }

        return ethers.AbiCoder.defaultAbiCoder().encode(
            ['address[]', 'bytes32[]', 'bytes[]'],
            [tos, configs, datas]
        );
    }

    /**
     * Decode combo execution result
     */
    static decodeComboResult(receipt) {
        const results = [];

        // Parse logs for HandlerExecuted events
        for (const log of receipt.logs) {
            try {
                const iface = new ethers.Interface([
                    'event HandlerExecuted(address indexed handler, bytes result)',
                ]);

                const parsed = iface.parseLog(log);
                if (parsed && parsed.name === 'HandlerExecuted') {
                    results.push({
                        handler: parsed.args.handler,
                        result: parsed.args.result,
                    });
                }
            } catch (e) {
                // Not a HandlerExecuted event
            }
        }

        return results;
    }
}

// Usage examples
const useDynamicAmount = FurucomboEncoder.encodeDynamicAmount();
const use50Percent = FurucomboEncoder.encodePercentage(5000); // 50%
const usePreviousOutput = FurucomboEncoder.encodeAmountPlaceholder(0, 0);
```

## Web3 Integration

### React Hook for Furucombo

```javascript
// useFurucombo.js
import { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import FurucomboComboBuilder from './comboBuilder';

export function useFurucombo() {
    const [isExecuting, setIsExecuting] = useState(false);
    const [lastTxHash, setLastTxHash] = useState(null);

    const executeCombo = useCallback(async (provider, signer, comboSteps) => {
        setIsExecuting(true);

        try {
            const builder = new FurucomboComboBuilder(provider);

            // Build combo from steps
            for (const step of comboSteps) {
                switch (step.type) {
                    case 'flashloan':
                        builder.addFlashLoan(
                            step.provider,
                            step.assets,
                            step.amounts
                        );
                        break;

                    case 'swap':
                        if (step.dex === 'uniswap') {
                            builder.addUniswapSwap(
                                step.tokenIn,
                                step.tokenOut,
                                step.amountIn,
                                step.minAmountOut
                            );
                        } else if (step.dex === 'sushiswap') {
                            builder.addSushiSwap(
                                step.tokenIn,
                                step.tokenOut,
                                step.amountIn,
                                step.minAmountOut
                            );
                        }
                        break;

                    case 'supply':
                        builder.addAaveSupply(step.asset, step.amount);
                        break;

                    case 'repay':
                        builder.addAaveRepay(step.asset, step.amount, step.rateMode);
                        break;
                }
            }

            // Simulate first
            const simSuccess = await builder.simulate(signer);

            if (!simSuccess) {
                throw new Error('Simulation failed');
            }

            // Execute
            const receipt = await builder.execute(signer);

            setLastTxHash(receipt.hash);

            return receipt;
        } catch (error) {
            console.error('Combo execution failed:', error);
            throw error;
        } finally {
            setIsExecuting(false);
        }
    }, []);

    return {
        executeCombo,
        isExecuting,
        lastTxHash,
    };
}
```

### Combo Visualization

```javascript
/**
 * Generate visual representation of combo
 */
class ComboVisualizer {
    static generateDiagram(combo) {
        let diagram = 'Combo Flow:\n';
        diagram += '═══════════\n\n';

        for (let i = 0; i < combo.tos.length; i++) {
            const handler = this.getHandlerName(combo.tos[i]);
            const action = this.getActionName(combo.datas[i]);

            diagram += `${i + 1}. ${handler}: ${action}\n`;
            if (i < combo.tos.length - 1) {
                diagram += '   ↓\n';
            }
        }

        return diagram;
    }

    static getHandlerName(address) {
        const handlers = {
            '0x05F51269F5C9941CD8A9B5b30D12EaC3B05aE3d4': 'Aave',
            '0x4585E557D1D0A7C5Dd7b1A1d76CC52F52b1B3785': 'Uniswap',
            '0x929e9A0F18c2A83c899c5531Aa36F2f1b1aC7F78': 'SushiSwap',
        };

        return handlers[address] || 'Unknown';
    }

    static getActionName(data) {
        // Decode function selector
        const selector = data.slice(0, 10);

        const actions = {
            '0x1b11d0ff': 'Flash Loan',
            '0x38ed1739': 'Swap Exact Tokens',
            '0x617ba037': 'Supply',
            '0x573ade81': 'Repay',
            '0x69328dec': 'Withdraw',
        };

        return actions[selector] || 'Unknown Action';
    }

    static calculateEstimatedGas(combo) {
        const baseGas = 50000; // Base transaction
        const perCubeGas = 100000; // Average per cube

        return baseGas + combo.tos.length * perCubeGas;
    }
}

// Usage
const combo = builder.build();
console.log(ComboVisualizer.generateDiagram(combo));
console.log('Estimated gas:', ComboVisualizer.calculateEstimatedGas(combo));
```

## Testing Framework

### Combo Test Suite

```javascript
// test/furucombo.test.js
const { expect } = require('chai');
const { ethers } = require('hardhat');
const FurucomboComboBuilder = require('../src/comboBuilder');

describe('Furucombo Combo Tests', function () {
    let builder, signer, provider;

    before(async function () {
        // Fork mainnet
        await network.provider.request({
            method: 'hardhat_reset',
            params: [{
                forking: {
                    jsonRpcUrl: process.env.MAINNET_RPC_URL,
                    blockNumber: 18500000,
                },
            }],
        });

        [signer] = await ethers.getSigners();
        provider = ethers.provider;

        builder = new FurucomboComboBuilder(provider);
    });

    it('Should execute flash loan arbitrage combo', async function () {
        const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
        const DAI = '0x6B175474E89094C44Da98b954EedeAC495271d0F';

        const amount = ethers.parseUnits('100000', 6);

        builder
            .addFlashLoan('aave', [USDC], [amount])
            .addUniswapSwap(USDC, DAI, amount, 0)
            .addSushiSwap(DAI, USDC, ethers.MaxUint256, 0);

        const simSuccess = await builder.simulate(signer);
        expect(simSuccess).to.be.true;

        const receipt = await builder.execute(signer);
        expect(receipt.status).to.equal(1);
    });

    it('Should handle failed simulation', async function () {
        const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

        // This should fail - insufficient liquidity
        const hugeAmount = ethers.parseUnits('1000000000', 6);

        builder.reset().addFlashLoan('aave', [USDC], [hugeAmount]);

        const simSuccess = await builder.simulate(signer);
        expect(simSuccess).to.be.false;
    });
});
```

## Best Practices

1. **Always simulate before executing**
2. **Use dynamic amounts (MaxUint256) for intermediary steps**
3. **Add slippage protection on final swap**
4. **Monitor gas costs - combos can be expensive**
5. **Test on mainnet fork before production**
6. **Handle reverts gracefully**
7. **Use Flashbots for competitive strategies**
8. **Keep combos simple when possible**

## Common Pitfalls

1. **Forgetting to approve tokens** - Proxy needs approvals
2. **Incorrect config values** - Use delegatecall for most cubes
3. **Not accounting for fees** - DEX fees, flash loan fees
4. **Hardcoded amounts** - Use dynamic amounts for chaining
5. **Gas estimation failures** - Complex combos need manual gas limits
6. **Token precision errors** - Handle decimals correctly
7. **Handler address changes** - Verify addresses before use

## Summary

**Furucombo Advantages:**
- Visual combo building interface
- Reusable cube system
- One-transaction execution
- Gas optimization through batching
- No coding required (for UI users)

**Programmatic Use Cases:**
- Automated arbitrage bots
- Complex DeFi strategies
- Portfolio rebalancing
- Collateral management
- Leverage management

**Key Concepts:**
- Cubes: Individual protocol interactions
- Combos: Sequences of cubes
- Handlers: Smart contracts for each protocol
- Proxy: Main execution contract
- Dynamic amounts: Using output from previous cubes
