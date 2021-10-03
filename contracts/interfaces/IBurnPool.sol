pragma solidity ^0.5.6;

interface IBurnPool {
    function pid() external view returns (uint256);
    function burn(uint256 amount) external;
}
