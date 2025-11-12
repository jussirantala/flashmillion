// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SandwichContract
 * @notice Educational sandwich attack contract for private blockchain testing
 * @dev DO NOT USE ON MAINNET - FOR EDUCATIONAL PURPOSES ONLY
 */

interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);

    function swapExactTokensForETH(
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

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract SandwichContract {
    address public immutable owner;
    address public immutable uniswapRouter;
    address public immutable WETH;

    event SandwichExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 profit
    );

    event SandwichFailed(
        address indexed tokenIn,
        address indexed tokenOut,
        string reason
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor(address _uniswapRouter, address _weth) {
        owner = msg.sender;
        uniswapRouter = _uniswapRouter;
        WETH = _weth;
    }

    /**
     * @notice Execute a sandwich attack
     * @param tokenIn The token to start with (usually WETH)
     * @param tokenOut The token to sandwich with
     * @param amountIn Amount of tokenIn to use for frontrun
     * @param minProfit Minimum acceptable profit
     */
    function executeSandwich(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minProfit
    ) external payable onlyOwner {
        require(amountIn > 0, "Invalid amount");

        uint256 balanceBefore = IERC20(tokenIn).balanceOf(address(this));

        // Step 1: FRONTRUN - Buy tokenOut with tokenIn
        uint256 tokenOutReceived = _swap(tokenIn, tokenOut, amountIn);

        require(tokenOutReceived > 0, "Frontrun failed");

        // Step 2: Victim transaction happens here (in real scenario)
        // In this educational version, we assume it happens between our calls

        // Step 3: BACKRUN - Sell tokenOut back to tokenIn
        uint256 tokenInReceived = _swap(tokenOut, tokenIn, tokenOutReceived);

        uint256 balanceAfter = IERC20(tokenIn).balanceOf(address(this));

        // Calculate profit
        uint256 profit = balanceAfter > balanceBefore
            ? balanceAfter - balanceBefore
            : 0;

        require(profit >= minProfit, "Insufficient profit");

        emit SandwichExecuted(tokenIn, tokenOut, amountIn, profit);
    }

    /**
     * @notice Internal swap function
     * @param tokenIn Input token
     * @param tokenOut Output token
     * @param amountIn Amount to swap
     * @return amountOut Amount received
     */
    function _swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (uint256 amountOut) {
        // Approve router to spend tokens
        IERC20(tokenIn).approve(uniswapRouter, amountIn);

        // Build path
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        // Get expected output
        uint[] memory amountsOut = IUniswapV2Router02(uniswapRouter).getAmountsOut(
            amountIn,
            path
        );

        // Allow 1% slippage
        uint256 amountOutMin = (amountsOut[1] * 99) / 100;

        // Execute swap
        uint[] memory amounts = IUniswapV2Router02(uniswapRouter).swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            address(this),
            block.timestamp + 300 // 5 minutes deadline
        );

        return amounts[1];
    }

    /**
     * @notice Simulate a sandwich to check profitability
     * @dev View function - doesn't change state
     */
    function simulateSandwich(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 estimatedProfit) {
        address[] memory path = new address[](2);

        // Frontrun simulation
        path[0] = tokenIn;
        path[1] = tokenOut;
        uint[] memory frontrunAmounts = IUniswapV2Router02(uniswapRouter).getAmountsOut(
            amountIn,
            path
        );

        // Backrun simulation
        path[0] = tokenOut;
        path[1] = tokenIn;
        uint[] memory backrunAmounts = IUniswapV2Router02(uniswapRouter).getAmountsOut(
            frontrunAmounts[1],
            path
        );

        // Calculate profit
        if (backrunAmounts[1] > amountIn) {
            estimatedProfit = backrunAmounts[1] - amountIn;
        } else {
            estimatedProfit = 0;
        }
    }

    /**
     * @notice Withdraw tokens from contract
     */
    function withdraw(address token, uint256 amount) external onlyOwner {
        require(
            IERC20(token).transfer(owner, amount),
            "Transfer failed"
        );
    }

    /**
     * @notice Withdraw ETH from contract
     */
    function withdrawETH() external onlyOwner {
        (bool success, ) = owner.call{value: address(this).balance}("");
        require(success, "ETH transfer failed");
    }

    /**
     * @notice Emergency stop - withdraw all tokens
     */
    function emergencyWithdraw(address[] calldata tokens) external onlyOwner {
        for (uint i = 0; i < tokens.length; i++) {
            uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
            if (balance > 0) {
                IERC20(tokens[i]).transfer(owner, balance);
            }
        }

        if (address(this).balance > 0) {
            (bool success, ) = owner.call{value: address(this).balance}("");
            require(success, "ETH transfer failed");
        }
    }

    // Allow contract to receive ETH
    receive() external payable {}
}
