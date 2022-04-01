pragma solidity 0.5.6;


interface IFactory {
    function tokenToPool(address tokenA, address tokenB) external view returns (address);
}

interface IExchange {
    function estimatePos(address tokenIn, uint amountIn) external view returns (uint);
}

contract MixPriceEstimator {
    IFactory factory = IFactory(0xC6a2Ad8cC6e4A7E08FC37cC5954be07d499E7654);
    function estimatePos(uint amountIn) public view returns (uint amountOut){
        IExchange exchange = IExchange(factory.tokenToPool(0xDd483a970a7A7FeF2B223C3510fAc852799a88BF, 0x0000000000000000000000000000000000000000));
        amountOut = exchange.estimatePos(0xDd483a970a7A7FeF2B223C3510fAc852799a88BF, amountIn);
    }
}