**Source:** https://docs.flashbots.net/

# Flashbots Complete Technical Documentation - Level 2
**Technical Level:** Advanced
**Focus:** RPC API, Bundle Submission, Simulation, MEV-Boost, Searcher Optimization

## Flashbots Architecture Overview

```
┌───────────────────────────────────────────────────────────┐
│                    Flashbots Ecosystem                     │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────┐         ┌──────────────┐               │
│  │   Searcher   │────────▶│ Flashbots    │               │
│  │   (Your Bot) │         │   Relay      │               │
│  └──────────────┘         └──────┬───────┘               │
│                                   │                        │
│                                   │ Private               │
│                                   │ Transaction           │
│                                   │ Pool                  │
│                                   │                        │
│                                   ▼                        │
│                          ┌──────────────┐                 │
│                          │   Builders   │                 │
│                          │  (MEV-Boost) │                 │
│                          └──────┬───────┘                 │
│                                 │                          │
│                                 ▼                          │
│                        ┌──────────────┐                   │
│                        │  Validators  │                   │
│                        │   (Miners)   │                   │
│                        └──────────────┘                   │
│                                                            │
└───────────────────────────────────────────────────────────┘

Benefits:
- No frontrunning (private mempool)
- No failed transactions (simulation first)
- Direct payment to validators (coinbase transfers)
- Transaction ordering guarantees
```

## Flashbots RPC Endpoints

### Network Endpoints

```javascript
const FLASHBOTS_ENDPOINTS = {
    mainnet: 'https://relay.flashbots.net',
    goerli: 'https://relay-goerli.flashbots.net',
    sepolia: 'https://relay-sepolia.flashbots.net',
};

// MEV-Boost Relays (for validators)
const MEV_BOOST_RELAYS = {
    flashbots: 'https://0xac6e77dfe25ecd6110b8e780608cce0dab71fdd5ebea22a16c0205200f2f8e2e3ad3b71d3499c54ad14d6c21b41a37ae@boost-relay.flashbots.net',
    bloxroute: 'https://0x8b5d2e73e2a3a55c6c87b8b6eb92e0149a125c852751db1422fa951e42a09b82c142c3ea98d0d9930b056a3bc9896b8f@bloxroute.max-profit.blxrbdn.com',
    blocknative: 'https://0x9000009807ed12c1f08bf4e81c6da3ba8e3fc3d953898ce0102433094e5f22f21102ec057841fcb81978ed1ea0fa8246@builder-relay-mainnet.blocknative.com',
};
```

### Authentication

```javascript
// Flashbots requires a separate signing key for authentication
// This is NOT your transaction signing key!

const { Wallet } = require('ethers');

// Create reputation/auth key (can be random, used only for signing requests)
const flashbotsAuthKey = Wallet.createRandom();
console.log('Flashbots Auth Private Key:', flashbotsAuthKey.privateKey);

// Your actual transaction key
const transactionKey = process.env.PRIVATE_KEY;
const wallet = new Wallet(transactionKey);
```

## Bundle Submission API

### eth_sendBundle

```javascript
const { ethers } = require('ethers');
const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle');

/**
 * Initialize Flashbots Provider
 */
async function initFlashbots() {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

    // Auth signer (reputation key)
    const authSigner = new ethers.Wallet(process.env.FLASHBOTS_AUTH_KEY);

    // Transaction signer
    const transactionSigner = new ethers.Wallet(
        process.env.PRIVATE_KEY,
        provider
    );

    // Create Flashbots provider
    const flashbotsProvider = await FlashbotsBundleProvider.create(
        provider,
        authSigner,
        'https://relay.flashbots.net',
        'mainnet'
    );

    return { provider, flashbotsProvider, transactionSigner };
}

/**
 * Send a bundle to Flashbots
 */
async function sendBundle() {
    const { provider, flashbotsProvider, transactionSigner } = await initFlashbots();

    const targetBlockNumber = (await provider.getBlockNumber()) + 1;

    // Build your transaction
    const transaction = {
        to: '0x...', // Your flash loan contract
        data: '0x...', // Encoded function call
        gasLimit: 500000,
        maxFeePerGas: ethers.parseUnits('50', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
        nonce: await transactionSigner.getNonce(),
        chainId: 1,
        type: 2, // EIP-1559
    };

    // Sign transaction
    const signedTransaction = await transactionSigner.signTransaction(transaction);

    // Create bundle
    const bundleSubmission = await flashbotsProvider.sendRawBundle(
        [signedTransaction], // Array of signed transactions
        targetBlockNumber    // Block number to target
    );

    console.log('Bundle submitted:', bundleSubmission.bundleHash);

    // Wait for inclusion
    const waitResponse = await bundleSubmission.wait();

    if (waitResponse === FlashbotsBundleResolution.BundleIncluded) {
        console.log('Bundle included in block', targetBlockNumber);
    } else if (waitResponse === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
        console.log('Bundle not included in target block');
    } else if (waitResponse === FlashbotsBundleResolution.AccountNonceTooHigh) {
        console.log('Nonce too high - transaction already mined');
    }

    return waitResponse;
}
```

### Bundle Parameters

```typescript
interface Bundle {
    // Array of signed transactions (hex strings)
    signedTransactions: string[];

    // Target block number
    targetBlockNumber: number;

    // Optional: Minimum timestamp (Unix timestamp)
    minTimestamp?: number;

    // Optional: Maximum timestamp
    maxTimestamp?: number;

    // Optional: Reverting transaction hashes that are allowed
    revertingTxHashes?: string[];
}

// Example
const bundle: Bundle = {
    signedTransactions: [
        '0x02f873018...', // Your arbitrage tx
        '0x02f873019...', // Coinbase payment tx
    ],
    targetBlockNumber: 18500000,
    minTimestamp: 0,
    maxTimestamp: 0,
    revertingTxHashes: [], // Hashes that can revert without failing bundle
};
```

## Bundle Simulation API

### eth_callBundle

```javascript
/**
 * Simulate a bundle before submitting
 */
async function simulateBundle() {
    const { provider, flashbotsProvider, transactionSigner } = await initFlashbots();

    const blockNumber = await provider.getBlockNumber();

    // Build transactions
    const transaction = {
        to: CONTRACT_ADDRESS,
        data: encodedFunctionCall,
        gasLimit: 500000,
        maxFeePerGas: ethers.parseUnits('50', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
        nonce: await transactionSigner.getNonce(),
        chainId: 1,
        type: 2,
    };

    const signedTransaction = await transactionSigner.signTransaction(transaction);

    // Simulate bundle
    const simulation = await flashbotsProvider.simulate(
        [signedTransaction],
        blockNumber
    );

    console.log('Simulation result:', simulation);

    if ('error' in simulation) {
        console.error('Simulation error:', simulation.error.message);
        return null;
    }

    // Check simulation results
    console.log('Coinbase diff:', ethers.formatEther(simulation.coinbaseDiff));
    console.log('Gas used:', simulation.totalGasUsed);
    console.log('State block:', simulation.stateBlockNumber);

    // Check each transaction result
    for (let i = 0; i < simulation.results.length; i++) {
        const result = simulation.results[i];
        console.log(`Transaction ${i}:`);
        console.log('  Gas used:', result.gasUsed);
        console.log('  Gas price:', result.gasPrice);
        console.log('  From:', result.fromAddress);
        console.log('  To:', result.toAddress);
        console.log('  Value:', ethers.formatEther(result.value));

        if (result.error) {
            console.log('  Error:', result.error);
        }

        if (result.revert) {
            console.log('  Revert reason:', result.revert);
        }
    }

    return simulation;
}

/**
 * Simulation Response Type
 */
interface SimulationResponse {
    bundleHash: string;
    coinbaseDiff: bigint; // Profit to miner
    results: Array<{
        txHash: string;
        gasUsed: number;
        gasPrice: string;
        gasFees: string;
        fromAddress: string;
        toAddress: string;
        value: string;
        error?: string;
        revert?: string;
    }>;
    totalGasUsed: number;
    stateBlockNumber: number;
    firstSeenTimestamp: number;
}
```

## Bundle Pricing Strategies

### Coinbase Payment Calculation

```javascript
/**
 * Calculate optimal coinbase payment
 */
class CoinbasePaymentStrategy {
    /**
     * Calculate coinbase payment for bundle
     * @param grossProfit Expected profit before miner payment
     * @param competitionLevel Number of competing searchers
     * @returns Optimal payment to coinbase
     */
    calculatePayment(grossProfit, competitionLevel = 1) {
        // Strategy 1: Percentage of profit
        const percentageStrategy = grossProfit * 0.1; // Pay 10% to miner

        // Strategy 2: Competitive bidding
        // Higher competition = pay more
        const competitiveStrategy = grossProfit * (0.05 + competitionLevel * 0.02);

        // Strategy 3: Fixed minimum + percentage
        const minPayment = ethers.parseEther('0.05'); // 0.05 ETH minimum
        const percentagePayment = grossProfit * 0.15; // 15%
        const hybridStrategy = minPayment > percentagePayment
            ? minPayment
            : percentagePayment;

        return {
            percentage: percentageStrategy,
            competitive: competitiveStrategy,
            hybrid: hybridStrategy,
            recommended: competitiveStrategy, // Use competitive by default
        };
    }

    /**
     * Build coinbase payment transaction
     */
    async buildCoinbasePayment(paymentAmount, signer) {
        // Get current block
        const block = await signer.provider.getBlock('latest');
        const coinbase = block.miner;

        // Build payment transaction
        const paymentTx = {
            to: coinbase,
            value: paymentAmount,
            gasLimit: 21000,
            maxFeePerGas: ethers.parseUnits('50', 'gwei'),
            maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
            nonce: await signer.getNonce(),
            chainId: 1,
            type: 2,
        };

        return paymentTx;
    }
}

/**
 * Example: Arbitrage with coinbase payment
 */
async function executeArbitrageWithPayment() {
    const { provider, flashbotsProvider, transactionSigner } = await initFlashbots();

    const expectedProfit = ethers.parseEther('0.5'); // 0.5 ETH profit expected

    // Calculate coinbase payment
    const paymentStrategy = new CoinbasePaymentStrategy();
    const payments = paymentStrategy.calculatePayment(expectedProfit, 5);

    console.log('Payment strategies:');
    console.log('  Percentage (10%):', ethers.formatEther(payments.percentage));
    console.log('  Competitive:', ethers.formatEther(payments.competitive));
    console.log('  Hybrid:', ethers.formatEther(payments.hybrid));
    console.log('  Recommended:', ethers.formatEther(payments.recommended));

    // Build arbitrage transaction
    const arbTx = {
        to: ARBITRAGE_CONTRACT,
        data: encodedArbitragecall,
        gasLimit: 500000,
        maxFeePerGas: ethers.parseUnits('50', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
        nonce: await transactionSigner.getNonce(),
        chainId: 1,
        type: 2,
    };

    // Build coinbase payment
    const paymentTx = await paymentStrategy.buildCoinbasePayment(
        payments.recommended,
        transactionSigner
    );
    paymentTx.nonce = arbTx.nonce + 1; // Increment nonce

    // Sign both transactions
    const signedArb = await transactionSigner.signTransaction(arbTx);
    const signedPayment = await transactionSigner.signTransaction(paymentTx);

    // Simulate bundle first
    const targetBlock = (await provider.getBlockNumber()) + 1;
    const simulation = await flashbotsProvider.simulate(
        [signedArb, signedPayment],
        targetBlock
    );

    if ('error' in simulation) {
        console.error('Simulation failed:', simulation.error);
        return;
    }

    console.log('Simulation successful!');
    console.log('Coinbase profit:', ethers.formatEther(simulation.coinbaseDiff));

    // Submit bundle
    const bundleSubmission = await flashbotsProvider.sendRawBundle(
        [signedArb, signedPayment],
        targetBlock
    );

    const waitResponse = await bundleSubmission.wait();
    console.log('Bundle result:', waitResponse);
}
```

## Bundle Status Checking

### eth_getBundleStats

```javascript
/**
 * Get statistics for submitted bundles
 */
async function getBundleStats() {
    const { flashbotsProvider } = await initFlashbots();

    // Get stats for current account
    const stats = await flashbotsProvider.getUserStats();

    console.log('Flashbots User Stats:');
    console.log('  Is high priority:', stats.isHighPriority);
    console.log('  All-time validator payments:', ethers.formatEther(stats.allTimeValidatorPayments));
    console.log('  All-time gas simulated:', stats.allTimeGasSimulated);
    console.log('  Last 7d validator payments:', ethers.formatEther(stats.last7dValidatorPayments));
    console.log('  Last 7d gas simulated:', stats.last7dGasSimulated);
    console.log('  Last 1d validator payments:', ethers.formatEther(stats.last1dValidatorPayments));
    console.log('  Last 1d gas simulated:', stats.last1dGasSimulated);

    return stats;
}

/**
 * Get specific bundle stats by hash
 */
async function getBundleStatsV2(bundleHash, blockNumber) {
    const { flashbotsProvider } = await initFlashbots();

    const stats = await flashbotsProvider.getBundleStatsV2(
        bundleHash,
        blockNumber
    );

    console.log('Bundle Stats:');
    console.log('  Submitted:', stats.isSimulated);
    console.log('  Sent to miners:', stats.isSentToMiners);
    console.log('  High priority:', stats.isHighPriority);

    return stats;
}
```

### Bundle Monitoring

```javascript
/**
 * Monitor bundle submission results
 */
class BundleMonitor {
    constructor(flashbotsProvider) {
        this.flashbotsProvider = flashbotsProvider;
        this.submittedBundles = new Map();
    }

    /**
     * Submit bundle and track it
     */
    async submitAndTrack(signedTransactions, targetBlockNumber) {
        const submission = await this.flashbotsProvider.sendRawBundle(
            signedTransactions,
            targetBlockNumber
        );

        const bundleId = `${submission.bundleHash}-${targetBlockNumber}`;

        this.submittedBundles.set(bundleId, {
            bundleHash: submission.bundleHash,
            targetBlock: targetBlockNumber,
            submittedAt: Date.now(),
            status: 'pending',
        });

        // Monitor in background
        this.monitorBundle(submission, bundleId);

        return submission;
    }

    /**
     * Monitor bundle status
     */
    async monitorBundle(submission, bundleId) {
        try {
            const waitResponse = await submission.wait();

            const bundle = this.submittedBundles.get(bundleId);

            if (waitResponse === FlashbotsBundleResolution.BundleIncluded) {
                bundle.status = 'included';
                console.log(`✅ Bundle ${bundleId} included!`);
            } else if (waitResponse === FlashbotsBundleResolution.BlockPassedWithoutInclusion) {
                bundle.status = 'missed';
                console.log(`❌ Bundle ${bundleId} not included`);
            } else if (waitResponse === FlashbotsBundleResolution.AccountNonceTooHigh) {
                bundle.status = 'nonce_error';
                console.log(`⚠️  Bundle ${bundleId} nonce too high`);
            }

            this.submittedBundles.set(bundleId, bundle);
        } catch (error) {
            console.error(`Error monitoring bundle ${bundleId}:`, error);
        }
    }

    /**
     * Get bundle statistics
     */
    getStats() {
        const bundles = Array.from(this.submittedBundles.values());

        const stats = {
            total: bundles.length,
            included: bundles.filter(b => b.status === 'included').length,
            missed: bundles.filter(b => b.status === 'missed').length,
            pending: bundles.filter(b => b.status === 'pending').length,
            errors: bundles.filter(b => b.status === 'nonce_error').length,
        };

        stats.inclusionRate = stats.total > 0
            ? (stats.included / stats.total) * 100
            : 0;

        return stats;
    }
}

// Usage
const monitor = new BundleMonitor(flashbotsProvider);
await monitor.submitAndTrack([signedTx], targetBlock);

// Later, check stats
const stats = monitor.getStats();
console.log('Bundle Stats:', stats);
```

## MEV-Boost Integration

### Builder API Integration

```javascript
/**
 * MEV-Boost relay integration for block builders
 */
class MEVBoostClient {
    constructor() {
        this.relays = [
            'https://boost-relay.flashbots.net',
            'https://relay.ultrasound.money',
            'https://agnostic-relay.net',
        ];
    }

    /**
     * Submit block to multiple relays
     */
    async submitBlock(blockData) {
        const submissions = this.relays.map(relay =>
            this.submitToRelay(relay, blockData)
        );

        const results = await Promise.allSettled(submissions);

        return results;
    }

    async submitToRelay(relayUrl, blockData) {
        // Implementation depends on relay spec
        // This is simplified
        const response = await fetch(`${relayUrl}/relay/v1/builder/blocks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(blockData),
        });

        return response.json();
    }

    /**
     * Get validator registrations
     */
    async getValidatorRegistrations(relayUrl) {
        const response = await fetch(
            `${relayUrl}/relay/v1/data/validator_registration`
        );

        return response.json();
    }
}
```

## Advanced Bundle Strategies

### Multi-Block Submission

```javascript
/**
 * Submit bundle to multiple consecutive blocks
 */
async function submitMultiBlock() {
    const { provider, flashbotsProvider, transactionSigner } = await initFlashbots();

    const currentBlock = await provider.getBlockNumber();

    // Build transaction
    const transaction = {
        to: CONTRACT_ADDRESS,
        data: encodedCall,
        gasLimit: 500000,
        maxFeePerGas: ethers.parseUnits('50', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
        nonce: await transactionSigner.getNonce(),
        chainId: 1,
        type: 2,
    };

    const signedTx = await transactionSigner.signTransaction(transaction);

    // Submit to next 3 blocks
    const submissions = [];
    for (let i = 1; i <= 3; i++) {
        const targetBlock = currentBlock + i;

        const submission = await flashbotsProvider.sendRawBundle(
            [signedTx],
            targetBlock
        );

        submissions.push({
            targetBlock,
            submission,
        });

        console.log(`Submitted to block ${targetBlock}`);
    }

    // Monitor all submissions
    for (const { targetBlock, submission } of submissions) {
        const result = await submission.wait();

        if (result === FlashbotsBundleResolution.BundleIncluded) {
            console.log(`✅ Included in block ${targetBlock}!`);
            break; // Success, stop monitoring others
        }
    }
}
```

### Conditional Bundles

```javascript
/**
 * Bundle that depends on external conditions
 */
async function conditionalBundle() {
    const { flashbotsProvider, transactionSigner } = await initFlashbots();

    // Build base transaction
    const baseTx = await transactionSigner.signTransaction({
        to: CONTRACT_ADDRESS,
        data: encodeCall('baseFunction'),
        gasLimit: 300000,
        maxFeePerGas: ethers.parseUnits('50', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
        nonce: await transactionSigner.getNonce(),
        chainId: 1,
        type: 2,
    });

    // Build conditional transaction (only executes if base succeeds)
    const conditionalTx = await transactionSigner.signTransaction({
        to: CONTRACT_ADDRESS,
        data: encodeCall('conditionalFunction'),
        gasLimit: 200000,
        maxFeePerGas: ethers.parseUnits('50', 'gwei'),
        maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
        nonce: (await transactionSigner.getNonce()) + 1,
        chainId: 1,
        type: 2,
    });

    const targetBlock = (await flashbotsProvider.provider.getBlockNumber()) + 1;

    // Both transactions in bundle - if first fails, second won't execute
    const submission = await flashbotsProvider.sendRawBundle(
        [baseTx, conditionalTx],
        targetBlock
    );

    return submission;
}
```

## Error Handling

### Common Errors and Solutions

```javascript
/**
 * Comprehensive error handling for Flashbots
 */
class FlashbotsErrorHandler {
    handleError(error) {
        const message = error.message.toLowerCase();

        if (message.includes('bundle already exists')) {
            console.log('⚠️  Bundle already submitted for this block');
            return 'ALREADY_SUBMITTED';
        }

        if (message.includes('insufficient funds')) {
            console.error('❌ Insufficient funds for gas');
            return 'INSUFFICIENT_FUNDS';
        }

        if (message.includes('nonce too low')) {
            console.error('❌ Nonce too low - transaction already mined');
            return 'NONCE_TOO_LOW';
        }

        if (message.includes('nonce too high')) {
            console.error('❌ Nonce too high - gap in nonce sequence');
            return 'NONCE_TOO_HIGH';
        }

        if (message.includes('replacement transaction underpriced')) {
            console.error('❌ Need higher gas price to replace');
            return 'UNDERPRICED';
        }

        if (message.includes('max fee per gas less than block base fee')) {
            console.error('❌ maxFeePerGas too low');
            return 'FEE_TOO_LOW';
        }

        console.error('❌ Unknown error:', error);
        return 'UNKNOWN';
    }

    async handleBundleFailure(bundleId, reason) {
        console.log(`Bundle ${bundleId} failed: ${reason}`);

        switch (reason) {
            case 'BlockPassedWithoutInclusion':
                // Normal - bundle competed out or conditions not met
                console.log('Bundle not competitive enough or conditions failed');
                break;

            case 'AccountNonceTooHigh':
                // Transaction already mined outside bundle
                console.log('Transaction already executed');
                break;

            default:
                console.error('Unexpected failure reason:', reason);
        }
    }
}
```

## Best Practices

### Optimization Tips

```javascript
/**
 * Best practices for Flashbots bundles
 */
class FlashbotsBestPractices {
    /**
     * 1. Always simulate before submitting
     */
    async simulateFirst(bundle, targetBlock) {
        const simulation = await flashbotsProvider.simulate(bundle, targetBlock);

        if ('error' in simulation) {
            throw new Error(`Simulation failed: ${simulation.error.message}`);
        }

        return simulation;
    }

    /**
     * 2. Calculate realistic coinbase payment
     */
    calculateCoinbasePayment(grossProfit) {
        // Never pay more than 90% of profit
        const maxPayment = grossProfit * 0.9;

        // Start with 10%, increase if bundle frequently missed
        const basePayment = grossProfit * 0.1;

        return {
            base: basePayment,
            max: maxPayment,
        };
    }

    /**
     * 3. Use appropriate gas prices
     */
    async getOptimalGasPrice(provider) {
        const feeData = await provider.getFeeData();
        const baseFee = await provider.getBlock('latest').then(b => b.baseFeePerGas);

        // Flashbots bundles compete on coinbase payment, not gas price
        // Use moderate gas prices to avoid wasting profit
        return {
            maxFeePerGas: baseFee * 2n, // 2x base fee
            maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'), // Small tip
        };
    }

    /**
     * 4. Monitor bundle inclusion rate
     */
    trackInclusionRate(monitor) {
        const stats = monitor.getStats();

        if (stats.inclusionRate < 10) {
            console.warn('⚠️  Low inclusion rate - increase coinbase payment');
        } else if (stats.inclusionRate > 90) {
            console.log('✅ High inclusion rate - can try lower payments');
        }

        return stats.inclusionRate;
    }

    /**
     * 5. Handle nonce management carefully
     */
    async getNonceForBundle(wallet) {
        // Get pending nonce to avoid conflicts
        const nonce = await wallet.getNonce('pending');

        // Track used nonces to avoid reuse
        return nonce;
    }

    /**
     * 6. Set realistic target blocks
     */
    getTargetBlocks(currentBlock, urgency = 'normal') {
        switch (urgency) {
            case 'urgent':
                return [currentBlock + 1]; // Next block only

            case 'normal':
                return [currentBlock + 1, currentBlock + 2]; // Next 2 blocks

            case 'patient':
                return [currentBlock + 1, currentBlock + 2, currentBlock + 3]; // Next 3

            default:
                return [currentBlock + 1];
        }
    }
}
```

## Complete Example: Flashbots Arbitrage Bot

```javascript
/**
 * Complete Flashbots arbitrage implementation
 */
class FlashbotsArbitrageBot {
    constructor(config) {
        this.config = config;
        this.monitor = null;
    }

    async initialize() {
        const { provider, flashbotsProvider, transactionSigner } = await initFlashbots();

        this.provider = provider;
        this.flashbotsProvider = flashbotsProvider;
        this.signer = transactionSigner;
        this.monitor = new BundleMonitor(flashbotsProvider);
    }

    async executeArbitrage(opportunity) {
        const currentBlock = await this.provider.getBlockNumber();
        const targetBlock = currentBlock + 1;

        // 1. Build arbitrage transaction
        const arbTx = await this.buildArbitrageTx(opportunity);

        // 2. Calculate coinbase payment
        const payment = this.calculatePayment(opportunity.expectedProfit);

        // 3. Build payment transaction
        const paymentTx = await this.buildPaymentTx(payment);

        // 4. Sign transactions
        const signedArb = await this.signer.signTransaction(arbTx);
        const signedPayment = await this.signer.signTransaction(paymentTx);

        // 5. Simulate bundle
        const simulation = await this.flashbotsProvider.simulate(
            [signedArb, signedPayment],
            currentBlock
        );

        if ('error' in simulation) {
            console.error('Simulation failed:', simulation.error);
            return null;
        }

        console.log('Simulation successful!');
        console.log('Expected coinbase diff:', ethers.formatEther(simulation.coinbaseDiff));

        // 6. Check if profitable after payment
        const netProfit = opportunity.expectedProfit - payment;
        if (netProfit <= 0) {
            console.log('Not profitable after coinbase payment');
            return null;
        }

        // 7. Submit bundle
        const submission = await this.monitor.submitAndTrack(
            [signedArb, signedPayment],
            targetBlock
        );

        return submission;
    }

    async buildArbitrageTx(opportunity) {
        const nonce = await this.signer.getNonce('pending');

        return {
            to: this.config.contractAddress,
            data: this.encodeArbitrageCall(opportunity),
            gasLimit: 500000,
            maxFeePerGas: ethers.parseUnits('50', 'gwei'),
            maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
            nonce,
            chainId: 1,
            type: 2,
        };
    }

    async buildPaymentTx(paymentAmount) {
        const block = await this.provider.getBlock('latest');
        const nonce = (await this.signer.getNonce('pending')) + 1;

        return {
            to: block.miner, // Coinbase address
            value: paymentAmount,
            gasLimit: 21000,
            maxFeePerGas: ethers.parseUnits('50', 'gwei'),
            maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
            nonce,
            chainId: 1,
            type: 2,
        };
    }

    calculatePayment(grossProfit) {
        // Pay 15% of gross profit to miner
        return grossProfit * 15n / 100n;
    }

    encodeArbitrageCall(opportunity) {
        // Encode your contract call
        const iface = new ethers.Interface([
            'function executeArbitrage(address token, uint256 amount, bytes data)',
        ]);

        return iface.encodeFunctionData('executeArbitrage', [
            opportunity.token,
            opportunity.amount,
            opportunity.data,
        ]);
    }
}

// Usage
const bot = new FlashbotsArbitrageBot(config);
await bot.initialize();

// When opportunity found
const opportunity = {
    token: '0x...',
    amount: ethers.parseEther('1000'),
    expectedProfit: ethers.parseEther('0.5'),
    data: '0x...',
};

await bot.executeArbitrage(opportunity);
```

## Summary

**Flashbots Advantages:**
- Private transaction pool (no frontrunning)
- Transaction simulation before execution
- Direct validator payments
- Bundle atomicity guarantees
- MEV extraction democratization

**Key Concepts:**
- Bundles: Ordered transaction groups
- Coinbase payments: Miner bribes for inclusion
- Simulation: Pre-execution testing
- MEV-Boost: Validator/builder separation

**Best Practices:**
- Always simulate first
- Calculate appropriate coinbase payments
- Monitor inclusion rates
- Handle nonces carefully
- Use multiple target blocks
- Implement comprehensive error handling

**Common Pitfalls:**
- Insufficient coinbase payment
- Poor nonce management
- Not simulating bundles
- Excessive gas prices
- Ignoring competition levels
