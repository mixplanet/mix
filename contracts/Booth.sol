pragma solidity ^0.5.6;

import "./klaytn-contracts/token/KIP7/KIP7.sol";
import "./klaytn-contracts/token/KIP7/KIP7Metadata.sol";
import "./klaytn-contracts/math/SafeMath.sol";
import "./interfaces/IBooth.sol";
import "./interfaces/IMix.sol";

contract Booth is IBooth, KIP7, KIP7Metadata("DSC Mixset", "MIXSET", 18) {
    using SafeMath for uint256;

    IMix public mix;

    constructor(IMix _mix) public {
        mix = _mix;
    }

    function stake(uint256 amount) external {
        uint256 totalMix = mix.balanceOf(address(this));
        uint256 totalShares = totalSupply();
        if (totalShares == 0 || totalMix == 0) {
            _mint(msg.sender, amount);
        } else {
            uint256 what = amount.mul(totalShares).div(totalMix);
            _mint(msg.sender, what);
        }
        mix.transferFrom(msg.sender, address(this), amount);
        emit Stake(msg.sender, amount);
    }

    function unstake(uint256 share) external {
        uint256 totalShares = totalSupply();
        uint256 what = share.mul(mix.balanceOf(address(this))).div(totalShares);
        _burn(msg.sender, share);
        mix.transfer(msg.sender, what);
        emit Unstake(msg.sender, share);
    }
}
