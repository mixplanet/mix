pragma solidity ^0.5.6;

import "./interfaces/IMixEmitter.sol";
import "./interfaces/IMix.sol";
import "./interfaces/IBurnPool.sol";

contract BurnPool is IBurnPool {

    IMixEmitter public mixEmitter;
    IMix public mix;
    uint256 public pid;

    constructor(
        IMixEmitter _mixEmitter,
        uint256 _pid
    ) public {
        mixEmitter = _mixEmitter;
        mix = _mixEmitter.mix();
        pid = _pid;
    }

    function burn() external {
        mixEmitter.updatePool(pid);
        mix.burn(mix.balanceOf(address(this)));
    }
}
