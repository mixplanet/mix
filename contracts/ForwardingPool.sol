pragma solidity ^0.5.6;

import "./interfaces/IMixEmitter.sol";
import "./interfaces/IMix.sol";
import "./interfaces/IForwardingPool.sol";

contract ForwardingPool is IForwardingPool {

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

    function forward() external {
        mixEmitter.updatePool(pid);
        mix.transfer(to, mix.balanceOf(address(this)));
    }
}
