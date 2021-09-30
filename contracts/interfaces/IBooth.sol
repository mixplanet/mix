pragma solidity ^0.5.6;

interface IBooth {
    
    event Stake(address indexed owner, uint256 amount);
    event Unstake(address indexed owner, uint256 share);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function stake(uint256 amount) external;
    function unstake(uint256 share) external;

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}
