pragma solidity ^0.5.6;

import "./klaytn-contracts/ownership/Ownable.sol";
import "./interfaces/IMixEmitter.sol";
import "./interfaces/IMix.sol";
import "./interfaces/IForwardingPool.sol";

contract ForwardingPool is Ownable, IForwardingPool {

    IMixEmitter public mixEmitter;
    IMix public mix;
    uint256 public pid;
    address public to;

    constructor(
        IMixEmitter _mixEmitter,
        uint256 _pid,
        address _to
    ) public {
        mixEmitter = _mixEmitter;
        mix = _mixEmitter.mix();
        pid = _pid;
        to = _to;
    }

    function setTo(address _to) external onlyOwner {
        to = _to;
        emit SetTo(_to);
    }

    function forward() external onlyOwner {
        mixEmitter.updatePool(pid);
        mix.transfer(to, mix.balanceOf(address(this)));
    }
}
