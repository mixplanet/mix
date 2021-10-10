pragma solidity ^0.5.6;

interface IForwardingPool {

    event SetTo(address indexed to);

    function pid() external view returns (uint256);
    function to() external view returns (address);
    function forward() external;
}
