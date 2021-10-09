pragma solidity ^0.5.6;

interface ITurntableKIP7Listeners {

    event Distribute(address indexed by, uint256 distributed);
    event Claim(uint256 indexed turntableId, address indexed to, uint256 claimed);
    
    event Listen(uint256 indexed turntableId, address indexed owner, uint256 amount);
    event Unlisten(uint256 indexed turntableId, address indexed owner, uint256 amount);
    
    event SetTurntableFee(uint256 fee);

    function totalShares() external view returns (uint256);
    function turntableFee() external view returns (uint256);
    function shares(uint256 turntableId, address owner) external view returns (uint256);
    function accumulativeOf(uint256 turntableId, address owner) external view returns (uint256);
    function claimedOf(uint256 turntableId, address owner) external view returns (uint256);
    function claimableOf(uint256 turntableId, address owner) external view returns (uint256);
    function claim(uint256[] calldata turntableIds) external;

    function listen(uint256 turntableId, uint256 amount) external;
    function unlisten(uint256 turntableId, uint256 amount) external;
}
