pragma solidity ^0.5.6;

import "../klaytn-contracts/ownership/Ownable.sol";
import "../interfaces/IMixEmitter.sol";
import "../interfaces/IMix.sol";
import "./EcoPotOperator.sol";

contract EcoPotPool is Ownable {

    event SetOperator(EcoPotOperator indexed operator);
    event SetKeeper(address indexed keeper);

    IMixEmitter public mixEmitter;
    IMix public mix;
    uint256 public pid;
    EcoPotOperator public operator;
    address public keeper;

    constructor(
        IMixEmitter _mixEmitter,
        uint256 _pid,
        EcoPotOperator _operator
    ) public {
        mixEmitter = _mixEmitter;
        mix = _mixEmitter.mix();
        pid = _pid;
        operator = _operator;
        keeper = msg.sender;
    }
    
    function setOperator(EcoPotOperator _operator) external onlyOwner {
        operator = _operator;
        emit SetOperator(_operator);
    }
    
    function setKeeper(address _keeper) external onlyOwner {
        keeper = _keeper;
        emit SetKeeper(_keeper);
    }

    modifier onlyKeeper() {
        require(isOwner() || msg.sender == keeper);
        _;
    }

    function forward() external onlyKeeper {
        mixEmitter.updatePool(pid);
        uint256 amount = mix.balanceOf(address(this));
        mix.transfer(address(operator), amount);
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
        uint256 balance = IKIP7(tokenAddr).balanceOf(address(this));
        if (balance > 0) {
            IKIP7(tokenAddr).transfer(msg.sender, balance);
        }
    }

    function getEcoPotStat() external view returns (
        address ecoPotContract, // airdrop distribution contract address
        uint totalAmount, // Total amount of tokens to be distributed
        uint blockAmount, // Amount of tokens to be distributed per block
        uint distributableBlock, // Block number to airdrop start
        uint endBlock, // Block number to airdrop end
        uint distributed,  // Amount of tokens distributed
        uint remain // amount remaining in the contract
    ) {
        return operator.getEcoPotStat();
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

    function initialize(
        uint totalAmount,
        uint blockAmount,
        uint startBlock
    ) external onlyOwner {
        operator.initialize(totalAmount, blockAmount, startBlock);
    }

    function deposit(uint amount) external onlyOwner {
        operator.deposit(amount);
    }

    function refixBlockAmount(uint blockAmount) external onlyOwner {
        operator.refixBlockAmount(blockAmount);
    }
}
