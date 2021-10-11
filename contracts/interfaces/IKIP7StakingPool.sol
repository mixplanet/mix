pragma solidity ^0.5.6;

interface IKIP7StakingPool {
    
    event Stake(address indexed owner, uint256 amount);
    event Unstake(address indexed owner, uint256 amount);

    event Distribute(address indexed by, uint256 distributed);
    event Claim(address indexed to, uint256 claimed);

    function stake(uint256 amount) external;
    function unstake(uint256 amount) external;

    function pid() external view returns (uint256);
    function totalShares() external view returns (uint256);
    function shares(address owner) external view returns (uint256);

    function accumulativeOf(address owner) external view returns (uint256);
    function claimedOf(address owner) external view returns (uint256);
    function claimableOf(address owner) external view returns (uint256);
    function claim() external;
}
