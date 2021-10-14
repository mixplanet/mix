pragma solidity ^0.5.6;

import "../klaytn-contracts/ownership/Ownable.sol";
import "../interfaces/IMixEmitter.sol";
import "../interfaces/IMix.sol";
import "./interfaces/IKlayswapAirdropPool.sol";
import "./interfaces/IKlayswapAirdropOperator.sol";

contract KlayswapAirdropPool is Ownable, IKlayswapAirdropPool {

    IMixEmitter public mixEmitter;
    IMix public mix;
    uint256 public pid;
    address public to;
    IKlayswapAirdropOperator public operator;

    constructor(
        IMixEmitter _mixEmitter,
        uint256 _pid,
        address _to,
        IKlayswapAirdropOperator _operator
    ) public {
        mixEmitter = _mixEmitter;
        mix = _mixEmitter.mix();
        pid = _pid;
        to = _to;
        operator = _operator;
    }

    function setTo(address _to) external onlyOwner {
        to = _to;
        emit SetTo(_to);
    }

    function forward() external onlyOwner {
        mixEmitter.updatePool(pid);
        uint256 amount = mix.balanceOf(address(this));
        mix.transfer(to, amount);
        operator.deposit(amount);
    }

    function changeNextOwner(address nextOwner) external onlyOwner {
        operator.changeNextOwner(nextOwner);
    }

    function changeOwner() external {
        operator.changeOwner();
    }

    function withdraw(address tokenAddr) external onlyOwner {
        operator.withdraw(tokenAddr);
    }

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
    ) {
        return operator.getAirdropStat();
    }

    function createDistribution(
        uint totalAmount,
        uint blockAmount,
        uint startBlock
    ) external onlyOwner {
        operator.createDistribution(totalAmount, blockAmount, startBlock);
    }

    function deposit(uint amount) external onlyOwner {
        operator.deposit(amount);
    }

    function refixBlockAmount(uint blockAmount) external onlyOwner {
        operator.refixBlockAmount(blockAmount);
    }
}
