pragma solidity ^0.5.6;

interface IKIP17Dividend {

    event Distribute(address indexed by, uint256 distributed);
    event Claim(uint256 indexed id, uint256 claimed);

    function pid() external view returns (uint256);
    function accumulativeOf() external view returns (uint256);
    function claimedOf(uint256 id) external view returns (uint256);
    function claimableOf(uint256 id) external view returns (uint256);
    function claim(uint256[] calldata ids) external returns (uint256);
}
