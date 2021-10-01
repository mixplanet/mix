pragma solidity ^0.5.6;

interface ITurntables {

    event Distribute(address indexed by, uint256 distributed);
    event Claim(address indexed to, uint256 claimed);
    
    event AddType(
        uint256 price,
        uint256 destroyReturn,
        uint256 volume,
        uint256 lifetime
    );

    event AllowType(uint256 indexed typeId);
    event DenyType(uint256 indexed typeId);
    event Buy(address indexed owner, uint256 indexed turntableId);
    event Destroy(address indexed owner, uint256 indexed turntableId);

    function accumulativeOf(address owner) external view returns (uint256);
    function claimedOf(address owner) external view returns (uint256);
    function claimableOf(address owner) external view returns (uint256);
    function claim() external;

    function types(uint256 typeId) external view returns (
        uint256 price,
        uint256 destroyReturn,
        uint256 volume,
        uint256 lifetime
    );

    function addType(
        uint256 price,
        uint256 destroyReturn,
        uint256 volume,
        uint256 lifetime
    ) external returns (uint256 typeId);

    function typeCount() external view returns (uint256);
    function allowType(uint256 typeId) external;
    function denyType(uint256 typeId) external;

    function turntables(uint256 turntableId) external view returns (
        address owner,
        uint256 typeId,
        uint256 endBlock,
        uint256 lastClaimedBlock
    );

    function buy(uint256 typeId) external returns (uint256 turntableId);
    function turntableCount() external view returns (uint256);
    function ownerOf(uint256 turntableId) external returns (address);
    function exists(uint256 turntableId) external returns (bool);
    function destroy(uint256 turntableId) external;
}
