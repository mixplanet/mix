pragma solidity ^0.5.6;

interface ITurntableKIP17Listeners {

    event Distribute(address indexed by, uint256 distributed);
    event Claim(uint256 indexed turntableId, uint256 indexed id, uint256 claimed);
    
    event Listen(uint256 indexed turntableId, address indexed owner, uint256 indexed id);
    event Unlisten(uint256 indexed turntableId, address indexed owner, uint256 indexed id);

    function accumulativeOf(uint256 id) external view returns (uint256);
    function claimedOf(uint256 id) external view returns (uint256);
    function claimableOf(uint256 id) external view returns (uint256);
    function claim(uint256[] calldata ids) external;

    function listen(uint256 turntableId, uint256[] calldata ids) external;
    function unlisten(uint256 turntableId, uint256[] calldata ids) external;
}
