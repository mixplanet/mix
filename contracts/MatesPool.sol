pragma solidity ^0.5.6;

import "./klaytn-contracts/token/KIP17/IKIP17Enumerable.sol";
import "./klaytn-contracts/math/SafeMath.sol";
import "./libraries/SignedSafeMath.sol";
import "./interfaces/IKIP17Dividend.sol";
import "./interfaces/IMixEmitter.sol";
import "./interfaces/IMix.sol";

contract MatesPool is IKIP17Dividend {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    IMixEmitter public mixEmitter;
    IMix public mix;
    uint256 public pid;
    IKIP17Enumerable public nft;
    uint256 public maxNFTSupply;

    constructor(
        IMixEmitter _mixEmitter,
        uint256 _pid,
        IKIP17Enumerable _nft,
        uint256 _maxNFTSupply
    ) public {
        mixEmitter = _mixEmitter;
        mix = _mixEmitter.mix();
        pid = _pid;
        nft = _nft;
        maxNFTSupply = _maxNFTSupply;
    }

    uint256 internal currentBalance = 0;

    uint256 internal constant pointsMultiplier = 2**128;
    uint256 internal pointsPerShare = 0;
    mapping(uint256 => uint256) internal claimed;

    function updateBalance() internal {
        if (maxNFTSupply > 0) {
            mixEmitter.updatePool(pid);
            uint256 balance = mix.balanceOf(address(this));
            uint256 value = balance.sub(currentBalance);
            if (value > 0) {
                pointsPerShare = pointsPerShare.add(value.mul(pointsMultiplier).div(maxNFTSupply));
                emit Distribute(msg.sender, value);
            }
            currentBalance = balance;
        }
    }

    function claimedOf(uint256 id) public view returns (uint256) {
        return claimed[id];
    }

    function accumulativeOf() public view returns (uint256) {
        uint256 _pointsPerShare = pointsPerShare;
        if (maxNFTSupply > 0) {
            uint256 balance = mixEmitter.pendingMix(pid).add(mix.balanceOf(address(this)));
            uint256 value = balance.sub(currentBalance);
            if (value > 0) {
                _pointsPerShare = _pointsPerShare.add(value.mul(pointsMultiplier).div(maxNFTSupply));
            }
            return uint256(int256(_pointsPerShare)).div(pointsMultiplier);
        }
        return 0;
    }

    function claimableOf(uint256 id) external view returns (uint256) {
        require(id < maxNFTSupply);
        return accumulativeOf().sub(claimed[id]);
    }

    function _accumulativeOf() internal view returns (uint256) {
        return uint256(int256(pointsPerShare)).div(pointsMultiplier);
    }

    function _claimableOf(uint256 id) internal view returns (uint256) {
        return _accumulativeOf().sub(claimed[id]);
    }

    function claim(uint256[] calldata ids) external returns (uint256 totalClaimable) {
        updateBalance();
        uint256 length = ids.length;
        for (uint256 i = 0; i < length; i = i + 1) {
            uint256 id = ids[i];
            require(id < maxNFTSupply && nft.ownerOf(id) == msg.sender);
            uint256 claimable = _claimableOf(id);
            if (claimable > 0) {
                claimed[id] = claimed[id].add(claimable);
                emit Claim(id, claimable);
                totalClaimable = totalClaimable.add(claimable);
            }
        }
        mix.burnFrom(msg.sender, totalClaimable.div(10));
        mix.transfer(msg.sender, totalClaimable);
        currentBalance = currentBalance.sub(totalClaimable);
    }
}
