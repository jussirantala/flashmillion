// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IPoolAddressesProvider} from "@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol";
import {IPool} from "@aave/core-v3/contracts/interfaces/IPool.sol";
import {IERC20} from "@aave/core-v3/contracts/dependencies/openzeppelin/contracts/IERC20.sol";

/**
 * @title FlashloanArbitrage
 * @notice Educational Aave V3 flashloan arbitrage contract
 * @dev FOR EDUCATIONAL USE ONLY - PRIVATE BLOCKCHAIN ONLY
 */

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function getAmountsOut(
        uint amountIn,
        address[] calldata path
    ) external view returns (uint[] memory amounts);
}

contract FlashloanArbitrage {
    address public immutable owner;
    IPoolAddressesProvider public immutable ADDRESSES_PROVIDER;
    IPool public immutable POOL;

    address public immutable uniswapV2Router;
    address public immutable sushiswapRouter;

    event ArbitrageExecuted(
        address indexed token,
        uint256 amount,
        uint256 profit,
        address buyDex,
        address sellDex
    );

    event FlashloanExecuted(
        address indexed asset,
        uint256 amount,
        uint256 premium
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(
        address _addressProvider,
        address _uniswapV2Router,
        address _sushiswapRouter
    ) {
        owner = msg.sender;
        ADDRESSES_PROVIDER = IPoolAddressesProvider(_addressProvider);
        POOL = IPool(ADDRESSES_PROVIDER.getPool());
        uniswapV2Router = _uniswapV2Router;
        sushiswapRouter = _sushiswapRouter;
    }

    /**
     * @notice Execute flashloan arbitrage
     * @param asset Token to borrow
     * @param amount Amount to borrow
     * @param buyDex DEX to buy on (0 = Uniswap, 1 = Sushiswap)
     * @param sellDex DEX to sell on (0 = Uniswap, 1 = Sushiswap)
     * @param path Trading path [tokenIn, tokenOut]
     */
    function executeArbitrage(
        address asset,
        uint256 amount,
        uint8 buyDex,
        uint8 sellDex,
        address[] calldata path
    ) external onlyOwner {
        require(buyDex != sellDex, "Must use different DEXs");
        require(path.length == 2, "Path must be exactly 2 tokens");

        // Prepare parameters for flashloan callback
        bytes memory params = abi.encode(buyDex, sellDex, path);

        // Execute flashloan
        address[] memory assets = new address[](1);
        assets[0] = asset;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;

        uint256[] memory modes = new uint256[](1);
        modes[0] = 0; // 0 = no debt, must repay in same transaction

        POOL.flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            params,
            0 // referral code
        );
    }

    /**
     * @notice Aave flashloan callback
     * @dev This function is called by Aave Pool after flashloan is granted
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool) {
        require(msg.sender == address(POOL), "Caller must be Pool");
        require(initiator == address(this), "Initiator must be this contract");

        address asset = assets[0];
        uint256 amount = amounts[0];
        uint256 premium = premiums[0];

        // Decode parameters
        (uint8 buyDex, uint8 sellDex, address[] memory path) = abi.decode(
            params,
            (uint8, uint8, address[])
        );

        uint256 balanceBefore = IERC20(path[0]).balanceOf(address(this));

        // Step 1: Buy on cheaper DEX
        uint256 tokensBought = _swap(
            _getDexRouter(buyDex),
            amount,
            path
        );

        // Step 2: Sell on expensive DEX (reverse path)
        address[] memory reversePath = new address[](2);
        reversePath[0] = path[1];
        reversePath[1] = path[0];

        uint256 tokensReceived = _swap(
            _getDexRouter(sellDex),
            tokensBought,
            reversePath
        );

        uint256 balanceAfter = IERC20(path[0]).balanceOf(address(this));

        // Calculate profit
        uint256 profit = balanceAfter > balanceBefore
            ? balanceAfter - balanceBefore
            : 0;

        // Calculate total amount to repay
        uint256 totalDebt = amount + premium;

        // Ensure we have enough to repay
        require(
            balanceAfter >= totalDebt,
            "Insufficient profit to repay flashloan"
        );

        // Approve Pool to pull the debt
        IERC20(asset).approve(address(POOL), totalDebt);

        emit FlashloanExecuted(asset, amount, premium);
        emit ArbitrageExecuted(
            asset,
            amount,
            profit,
            _getDexRouter(buyDex),
            _getDexRouter(sellDex)
        );

        return true;
    }

    /**
     * @notice Internal swap function
     */
    function _swap(
        address router,
        uint256 amountIn,
        address[] memory path
    ) internal returns (uint256) {
        IERC20(path[0]).approve(router, amountIn);

        uint[] memory amountsOut = IUniswapV2Router(router).getAmountsOut(
            amountIn,
            path
        );

        uint256 amountOutMin = (amountsOut[1] * 99) / 100; // 1% slippage

        uint[] memory amounts = IUniswapV2Router(router).swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            address(this),
            block.timestamp + 300
        );

        return amounts[amounts.length - 1];
    }

    /**
     * @notice Get DEX router address
     */
    function _getDexRouter(uint8 dex) internal view returns (address) {
        if (dex == 0) return uniswapV2Router;
        if (dex == 1) return sushiswapRouter;
        revert("Invalid DEX");
    }

    /**
     * @notice Simulate arbitrage profitability
     */
    function simulateArbitrage(
        address asset,
        uint256 amount,
        uint8 buyDex,
        uint8 sellDex,
        address[] calldata path
    ) external view returns (uint256 estimatedProfit, uint256 totalCost) {
        address buyRouter = _getDexRouter(buyDex);
        address sellRouter = _getDexRouter(sellDex);

        // Get buy price
        uint[] memory buyAmounts = IUniswapV2Router(buyRouter).getAmountsOut(
            amount,
            path
        );

        // Get sell price (reverse path)
        address[] memory reversePath = new address[](2);
        reversePath[0] = path[1];
        reversePath[1] = path[0];

        uint[] memory sellAmounts = IUniswapV2Router(sellRouter).getAmountsOut(
            buyAmounts[1],
            reversePath
        );

        // Calculate profit
        uint256 totalReceived = sellAmounts[1];
        uint256 flashloanFee = (amount * 5) / 10000; // 0.05%
        totalCost = amount + flashloanFee;

        if (totalReceived > totalCost) {
            estimatedProfit = totalReceived - totalCost;
        } else {
            estimatedProfit = 0;
        }
    }

    /**
     * @notice Withdraw tokens
     */
    function withdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    /**
     * @notice Withdraw ETH
     */
    function withdrawETH() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {}
}
