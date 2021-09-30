pragma solidity ^0.5.6;

import "./klaytn-contracts/token/KIP7/IKIP7.sol";
import "./interfaces/IKIP7StakingPool.sol";
import "./MixDividend.sol";

contract KIP7StakingPool is IKIP7StakingPool, MixDividend {

    IKIP7 private token;

    constructor(
        IMixEmitter mixEmitter,
        IMix mix,
        uint256 pid,
        IKIP7 _token
    ) public MixDividend(mixEmitter, mix, pid) {
        token = _token;
    }

    function stake(uint256 amount) external {
        _addShare(amount);
        token.transferFrom(msg.sender, address(this), amount);
        emit Stake(msg.sender, amount);
    }

    function unstake(uint256 amount) external {
        _subShare(amount);
        token.transfer(msg.sender, amount);
        emit Unstake(msg.sender, amount);
    }
}
