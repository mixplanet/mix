pragma solidity ^0.5.6;

import "./klaytn-contracts/token/KIP17/IKIP17Enumerable.sol";
import "./klaytn-contracts/math/SafeMath.sol";
import "./libraries/SignedSafeMath.sol";
import "./interfaces/IKIP17Dividend.sol";
import "./interfaces/IMixEmitter.sol";
import "./interfaces/IMix.sol";

contract KIP17Dividend is IKIP17Dividend {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    IMixEmitter private mixEmitter;
    IMix private mix;
    uint256 private pid;
    IKIP17Enumerable private nft;   //Q. All of these variables are private?

    constructor(
        IMixEmitter _mixEmitter,
        IMix _mix,
        uint256 _pid,
        IKIP17Enumerable _nft
    ) public {
        mixEmitter = _mixEmitter;
        mix = _mix;
        pid = _pid;
        nft = _nft;
    }

    uint256 internal currentBalance = 0;

    uint256 constant internal pointsMultiplier = 2**128;
    uint256 internal pointsPerShare = 0;
    mapping(uint256 => int256) internal pointsCorrection;
    mapping(uint256 => uint256) internal claimed;

    function updateBalance() internal {
        uint256 totalShares = nft.totalSupply();
        if (totalShares > 0) {
            mixEmitter.updatePool(pid);
            uint256 balance = mix.balanceOf(address(this));
            uint256 value = balance.sub(currentBalance);
            if (value > 0) {
                pointsPerShare = pointsPerShare.add(value.mul(pointsMultiplier).div(totalShares));
                emit Distribute(msg.sender, value);
            }
            currentBalance = balance;
        }
    }

    function claimedOf(uint256 id) public view returns (uint256) {
        return claimed[id];
    }

    function accumulativeOf(uint256 id) public view returns (uint256) {
        uint256 _pointsPerShare = pointsPerShare;
        uint256 totalShares = nft.totalSupply();
        if (totalShares > 0) {
            uint256 balance = mixEmitter.pendingMix(pid).add(mix.balanceOf(address(this)));
            uint256 value = balance.sub(currentBalance);
            if (value > 0) {
                _pointsPerShare = _pointsPerShare.add(value.mul(pointsMultiplier).div(totalShares));
            }
            return uint256(int256(_pointsPerShare).add(pointsCorrection[id])).div(pointsMultiplier);
        }
        return 0;
    }

    function claimableOf(uint256 id) external view returns (uint256) {
        return accumulativeOf(id).sub(claimed[id]);
    }

    function _accumulativeOf(uint256 id) internal view returns (uint256) {
        return uint256(int256(pointsPerShare).add(pointsCorrection[id])).div(pointsMultiplier);
    }

    function _claimableOf(uint256 id) internal view returns (uint256) {
        return _accumulativeOf(id).sub(claimed[id]);
    }

    function claim(uint256[] calldata ids) external returns (uint256 totalClaimable) {
        updateBalance();
        uint256 length = ids.length;
        for (uint256 i = 0; i < length; i = i.add(1)) {
            uint256 id = ids[i];
            require(nft.ownerOf(id) == msg.sender);
            uint256 claimable = _claimableOf(id);
            if (claimable > 0) {
                claimed[id] = claimed[id].add(claimable);
                emit Claim(id, claimable);
                totalClaimable = totalClaimable.add(claimable);
            }
        }
        uint256 prepayment = totalClaimable.div(10);
        mix.transferFrom(msg.sender, address(this), prepayment);
        mix.transfer(msg.sender, totalClaimable.add(prepayment));
        currentBalance = currentBalance.sub(totalClaimable);
    }
}
