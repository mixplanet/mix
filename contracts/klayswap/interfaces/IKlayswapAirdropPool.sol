pragma solidity ^0.5.6;

import "./IKlayswapAirdropOperator.sol";

interface IKlayswapAirdropPool {

    event SetOperator(IKlayswapAirdropOperator indexed operator);
    event SetKeeper(address indexed keeper);

    function pid() external view returns (uint256);
    function operator() external view returns (IKlayswapAirdropOperator);
    function forward() external;

    function changeNextOwner(address _nextOwner) external;
    function changeOwner() external;
    function withdraw(address tokenAddr) external;

    function getAirdropStat() external view returns (
        address distributionContract, // airdrop distribution contract address
        uint totalAmount, // Total amount of tokens to be distributed
        uint blockAmount, // Amount of tokens to be distributed per block
        uint distributableBlock, // Block number to airdrop start
        uint endBlock, // Block number to airdrop end
        uint distributed,  // Amount of tokens distributed
        uint remain, // amount remaining in the contract 
        uint targetCount, // airdrop target LP count
        address[] memory targets, // airdrop target LP list
        uint[] memory rates // airdrop target lp rate list
    );

    function createDistribution(
        uint totalAmount,
        uint blockAmount,
        uint startBlock
    ) external;

    function deposit(uint amount) external;
    function refixBlockAmount(uint blockAmount) external;
}
