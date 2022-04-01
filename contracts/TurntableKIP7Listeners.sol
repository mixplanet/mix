pragma solidity ^0.5.6;

import "./klaytn-contracts/ownership/Ownable.sol";
import "./klaytn-contracts/math/SafeMath.sol";
import "./libraries/SignedSafeMath.sol";
import "./interfaces/ITurntableKIP7Listeners.sol";
import "./interfaces/IMixEmitter.sol";
import "./interfaces/IMix.sol";
import "./interfaces/ITurntables.sol";
import "./klaytn-contracts/token/KIP7/IKIP7.sol";

contract TurntableKIP7Listeners is Ownable, ITurntableKIP7Listeners {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    IMixEmitter public mixEmitter;
    IMix public mix;
    uint256 public pid;
    ITurntables public turntables;
    IKIP7 public token;

    constructor(
        IMixEmitter _mixEmitter,
        uint256 _pid,
        ITurntables _turntables,
        IKIP7 _token
    ) public {
        mixEmitter = _mixEmitter;
        mix = _mixEmitter.mix();
        pid = _pid;
        turntables = _turntables;
        token = _token;
    }

    uint256 private currentBalance = 0;
    uint256 public totalShares = 0;
    mapping(uint256 => mapping(address => uint256)) public shares;

    uint256 public turntableFee = 3000;

    uint256 private constant pointsMultiplier = 2**128;
    uint256 private pointsPerShare = 0;
    mapping(uint256 => mapping(address => int256)) private pointsCorrection;
    mapping(uint256 => mapping(address => uint256)) private claimed;

    function setTurntableFee(uint256 fee) external onlyOwner {
        require(fee < 1e4);
        turntableFee = fee;
        emit SetTurntableFee(fee);
    }

    function updateBalance() private {
        if (totalShares > 0) {
            mixEmitter.updatePool(pid);
            uint256 balance = mix.balanceOf(address(this));
            uint256 value = balance.sub(currentBalance);
            if (value > 0) {
                pointsPerShare = pointsPerShare.add(value.mul(pointsMultiplier).div(totalShares));
                emit Distribute(msg.sender, value);
            }
            currentBalance = balance;
        } else {
            mixEmitter.updatePool(pid);
            uint256 balance = mix.balanceOf(address(this));
            uint256 value = balance.sub(currentBalance);
            if (value > 0) mix.burn(value);
        }
    }

    function claimedOf(uint256 turntableId, address owner) public view returns (uint256) {
        return claimed[turntableId][owner];
    }

    function accumulativeOf(uint256 turntableId, address owner) public view returns (uint256) {
        uint256 _pointsPerShare = pointsPerShare;
        if (totalShares > 0) {
            uint256 balance = mixEmitter.pendingMix(pid).add(mix.balanceOf(address(this)));
            uint256 value = balance.sub(currentBalance);
            if (value > 0) {
                _pointsPerShare = _pointsPerShare.add(value.mul(pointsMultiplier).div(totalShares));
            }
            return
                uint256(
                    int256(_pointsPerShare.mul(shares[turntableId][owner])).add(pointsCorrection[turntableId][owner])
                ).div(pointsMultiplier);
        }
        return 0;
    }

    function claimableOf(uint256 turntableId, address owner) external view returns (uint256) {
        return
            accumulativeOf(turntableId, owner).sub(claimed[turntableId][owner]).mul(uint256(1e4).sub(turntableFee)).div(
                1e4
            );
    }

    function _accumulativeOf(uint256 turntableId, address owner) private view returns (uint256) {
        return
            uint256(int256(pointsPerShare.mul(shares[turntableId][owner])).add(pointsCorrection[turntableId][owner]))
                .div(pointsMultiplier);
    }

    function _claimableOf(uint256 turntableId, address owner) private view returns (uint256) {
        return _accumulativeOf(turntableId, owner).sub(claimed[turntableId][owner]);
    }

    function claim(uint256[] calldata turntableIds) external {
        updateBalance();
        uint256 length = turntableIds.length;
        uint256 totalClaimable = 0;
        for (uint256 i = 0; i < length; i = i + 1) {
            uint256 turntableId = turntableIds[i];
            uint256 claimable = _claimableOf(turntableId, msg.sender);
            if (claimable > 0) {
                claimed[turntableId][msg.sender] = claimed[turntableId][msg.sender].add(claimable);
                emit Claim(turntableId, msg.sender, claimable);
                uint256 fee = claimable.mul(turntableFee).div(1e4);
                if (turntables.exists(turntableId)) {
                    mix.transfer(turntables.ownerOf(turntableId), fee);
                } else {
                    mix.burn(fee);
                }
                mix.transfer(msg.sender, claimable.sub(fee));
                totalClaimable = totalClaimable.add(claimable);
            }
        }
        currentBalance = currentBalance.sub(totalClaimable);
    }

    function listen(uint256 turntableId, uint256 amount) external {
        require(turntables.exists(turntableId));
        updateBalance();
        totalShares = totalShares.add(amount);
        shares[turntableId][msg.sender] = shares[turntableId][msg.sender].add(amount);
        pointsCorrection[turntableId][msg.sender] = pointsCorrection[turntableId][msg.sender].sub(
            int256(pointsPerShare.mul(amount))
        );

        token.transferFrom(msg.sender, address(this), amount);
        emit Listen(turntableId, msg.sender, amount);
    }

    function unlisten(uint256 turntableId, uint256 amount) external {
        updateBalance();
        totalShares = totalShares.sub(amount);
        shares[turntableId][msg.sender] = shares[turntableId][msg.sender].sub(amount);
        pointsCorrection[turntableId][msg.sender] = pointsCorrection[turntableId][msg.sender].add(
            int256(pointsPerShare.mul(amount))
        );

        token.transfer(msg.sender, amount);
        emit Unlisten(turntableId, msg.sender, amount);
    }
}
