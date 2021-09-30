pragma solidity ^0.5.6;

interface IKIP7StakingPool {
    
    event Stake(address indexed owner, uint256 amount);
    event Unstake(address indexed owner, uint256 amount);

    function stake(uint256 amount) external;
    function unstake(uint256 amount) external;
}
