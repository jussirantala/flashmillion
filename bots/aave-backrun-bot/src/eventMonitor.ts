import { ethers } from 'ethers';
import { config } from './config';
import { AaveEvent } from './types';

const AAVE_POOL_ABI = [
  'event Supply(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint16 indexed referralCode)',
  'event Borrow(address indexed reserve, address user, address indexed onBehalfOf, uint256 amount, uint8 interestRateMode, uint256 borrowRate, uint16 indexed referralCode)',
  'event Repay(address indexed reserve, address user, address indexed repayer, uint256 amount, bool useATokens)',
  'event Withdraw(address indexed reserve, address indexed user, address indexed to, uint256 amount)',
  'event LiquidationCall(address indexed collateralAsset, address indexed debtAsset, address indexed user, uint256 debtToCover, uint256 liquidatedCollateralAmount, address liquidator, bool receiveAToken)'
];

export class EventMonitor {
  private provider: ethers.WebSocketProvider;
  private poolContract: ethers.Contract;

  constructor() {
    this.provider = new ethers.WebSocketProvider(config.wsUrl);
    this.poolContract = new ethers.Contract(
      config.aavePool,
      AAVE_POOL_ABI,
      this.provider
    );
  }

  async start(onEvent: (event: AaveEvent) => void) {
    console.log('[INFO] Starting Aave event monitoring...');
    console.log('[INFO] Watching for: ' + config.monitorOperations.join(', '));

    // Listen for Borrow events
    if (config.monitorOperations.includes('borrow')) {
      this.poolContract.on('Borrow', (reserve, user, onBehalfOf, amount, rateMode, borrowRate, referralCode, event) => {
        const aaveEvent: AaveEvent = {
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber,
          operation: 'borrow',
          user: user,
          asset: reserve,
          amount: amount,
          timestamp: Date.now()
        };
        console.log(`[EVENT] Borrow detected: ${amount} of ${reserve.substring(0, 10)}...`);
        onEvent(aaveEvent);
      });
    }

    // Listen for Liquidation events
    if (config.monitorOperations.includes('liquidation')) {
      this.poolContract.on('LiquidationCall', (collateralAsset, debtAsset, user, debtToCover, liquidatedCollateral, liquidator, receiveAToken, event) => {
        const aaveEvent: AaveEvent = {
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber,
          operation: 'liquidation',
          user: user,
          asset: debtAsset,
          amount: debtToCover,
          timestamp: Date.now()
        };
        console.log(`[EVENT] Liquidation detected: ${user.substring(0, 10)}...`);
        onEvent(aaveEvent);
      });
    }

    // Listen for Repay events
    if (config.monitorOperations.includes('repay')) {
      this.poolContract.on('Repay', (reserve, user, repayer, amount, useATokens, event) => {
        const aaveEvent: AaveEvent = {
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber,
          operation: 'repay',
          user: user,
          asset: reserve,
          amount: amount,
          timestamp: Date.now()
        };
        console.log(`[EVENT] Repay detected: ${amount} of ${reserve.substring(0, 10)}...`);
        onEvent(aaveEvent);
      });
    }

    // Listen for Supply events
    this.poolContract.on('Supply', (reserve, user, onBehalfOf, amount, referralCode, event) => {
      const aaveEvent: AaveEvent = {
        txHash: event.log.transactionHash,
        blockNumber: event.log.blockNumber,
        operation: 'supply',
        user: user,
        asset: reserve,
        amount: amount,
        timestamp: Date.now()
      };
      console.log(`[EVENT] Supply detected: ${amount} of ${reserve.substring(0, 10)}...`);
      onEvent(aaveEvent);
    });

    console.log('[SUCCESS] Event monitoring active');
  }

  async stop() {
    this.poolContract.removeAllListeners();
    await this.provider.destroy();
    console.log('[INFO] Event monitoring stopped');
  }
}
