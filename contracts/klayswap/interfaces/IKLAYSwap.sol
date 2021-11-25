pragma solidity 0.5.6;

interface IKLAYSwap {
    function exchangeKlayPos(address token, uint amount, address[] calldata path) external payable;
    function exchangeKctPos(address tokenA, uint amountA, address tokenB, uint amountB, address[] calldata path) external;
}
