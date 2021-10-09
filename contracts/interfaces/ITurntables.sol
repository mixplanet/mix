pragma solidity ^0.5.6;

interface ITurntables {
    
    event AddType(
        uint256 price,
        uint256 destroyReturn,
        uint256 volume,
        uint256 lifetime
    );

    event AllowType(uint256 indexed typeId);
    event DenyType(uint256 indexed typeId);
    event ChangeChargingEfficiency(uint256 value);

    event Buy(address indexed owner, uint256 indexed turntableId);
    event Charge(address indexed owner, uint256 indexed turntableId, uint256 amount);
    event Destroy(address indexed owner, uint256 indexed turntableId);

    event Distribute(address indexed by, uint256 distributed);
    event Claim(uint256 indexed turntableId, uint256 claimed);

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

    function totalVolume() external view returns (uint256);
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
    function turntableLength() external view returns (uint256);
    function ownerOf(uint256 turntableId) external view returns (address);
    function exists(uint256 turntableId) external view returns (bool);
    function charge(uint256 turntableId, uint256 amount) external;
    function destroy(uint256 turntableId) external;

    function pid() external view returns (uint256);
    function accumulativeOf(uint256 turntableId) external view returns (uint256);
    function claimedOf(uint256 turntableId) external view returns (uint256);
    function claimableOf(uint256 turntableId) external view returns (uint256);
    function claim(uint256[] calldata turntableIds) external returns (uint256);
}
