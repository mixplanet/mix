pragma solidity ^0.5.6;

import "./interfaces/IMix.sol";
import "./interfaces/IBurnPool.sol";

contract BurnPool is IBurnPool {
    IMix public mix;

    constructor(IMix _mix) public {
        mix = _mix;
    }

    function burn() external {
        mix.burn(mix.balanceOf(address(this)));
    }
}
