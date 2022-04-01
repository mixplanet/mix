pragma solidity ^0.5.6;

import "./klaytn-contracts/ownership/Ownable.sol";
import "./klaytn-contracts/token/KIP17/IKIP17.sol";
import "./klaytn-contracts/math/SafeMath.sol";
import "./libraries/SignedSafeMath.sol";
import "./interfaces/ITurntableKIP17Listeners.sol";
import "./interfaces/IMixEmitter.sol";
import "./interfaces/IMix.sol";
import "./interfaces/ITurntables.sol";

contract TurntableKIP17Listeners is Ownable, ITurntableKIP17Listeners {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    IMixEmitter public mixEmitter;
    IMix public mix;
    uint256 public pid;
    ITurntables public turntables;
    IKIP17 public nft;

    constructor(
        IMixEmitter _mixEmitter,
        uint256 _pid,
        ITurntables _turntables,
        IKIP17 _nft
    ) public {
        mixEmitter = _mixEmitter;
        mix = _mixEmitter.mix();
        pid = _pid;
        turntables = _turntables;
        nft = _nft;
    }

    uint256 private currentBalance = 0;
    uint256 public totalShares = 0;
    mapping(uint256 => mapping(uint256 => bool)) public shares;

    mapping(uint256 => uint256[]) public listeners;
    mapping(uint256 => uint256) private listenersIndex;

    uint256 public turntableFee = 3000;
    mapping(uint256 => uint256) public listeningTo;
    mapping(uint256 => bool) public listening;

    uint256 private constant pointsMultiplier = 2**128;
    uint256 private pointsPerShare = 0;
    mapping(uint256 => mapping(uint256 => int256)) private pointsCorrection;
    mapping(uint256 => mapping(uint256 => uint256)) private claimed;
    mapping(uint256 => mapping(uint256 => uint256)) private realClaimed;

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

    function realClaimedOf(uint256 turntableId, uint256 id) public view returns (uint256) {
        return realClaimed[turntableId][id];
    }

    function accumulativeOf(uint256 turntableId, uint256 id) public view returns (uint256) {
        uint256 _pointsPerShare = pointsPerShare;
        if (totalShares > 0) {
            uint256 balance = mixEmitter.pendingMix(pid).add(mix.balanceOf(address(this)));
            uint256 value = balance.sub(currentBalance);
            if (value > 0) {
                _pointsPerShare = _pointsPerShare.add(value.mul(pointsMultiplier).div(totalShares));
            }
            return
                uint256(int256(shares[turntableId][id] == true ? _pointsPerShare : 0).add(pointsCorrection[turntableId][id]))
                    .div(pointsMultiplier);
        }
        return 0;
    }

    function claimableOf(uint256 turntableId, uint256 id) external view returns (uint256) {
        return
            accumulativeOf(turntableId, id).sub(claimed[turntableId][id]).mul(uint256(1e4).sub(turntableFee)).div(1e4);
    }

    function _accumulativeOf(uint256 turntableId, uint256 id) private view returns (uint256) {
        return
            uint256(int256(shares[turntableId][id] == true ? pointsPerShare : 0).add(pointsCorrection[turntableId][id])).div(
                pointsMultiplier
            );
    }

    function _claimableOf(uint256 turntableId, uint256 id) private view returns (uint256) {
        return _accumulativeOf(turntableId, id).sub(claimed[turntableId][id]);
    }

    function claim(uint256 turntableId, uint256[] calldata ids) external {
        updateBalance();
        uint256 length = ids.length;
        for (uint256 i = 0; i < length; i = i + 1) {
            _claim(turntableId, ids[i]);
        }
        currentBalance = mix.balanceOf(address(this));
    }

    function _claim(uint256 turntableId, uint256 id) internal {
        require(nft.ownerOf(id) == msg.sender && listening[id] && listeningTo[id] == turntableId);
        uint256 claimable = _claimableOf(turntableId, id);
        if (claimable > 0) {
            claimed[turntableId][id] = claimed[turntableId][id].add(claimable);
            emit Claim(turntableId, id, claimable);
            uint256 fee = claimable.mul(turntableFee).div(1e4);
            if (turntables.exists(turntableId)) {
                mix.transfer(turntables.ownerOf(turntableId), fee);
            } else {
                mix.burn(fee);
            }
            mix.transfer(msg.sender, claimable.sub(fee));
            realClaimed[turntableId][id] = realClaimed[turntableId][id].add(claimable.sub(fee));
        }
    }

    function _unlisten(uint256 turntableId, uint256 id) internal {
        uint256 lastIndex = listeners[turntableId].length.sub(1);
        uint256 index = listenersIndex[id];
        if (index != lastIndex) {
            uint256 last = listeners[turntableId][lastIndex];
            listeners[turntableId][index] = last;
            listenersIndex[last] = index;
        }
        listeners[turntableId].length--;
        
        _claim(turntableId, id);
        shares[turntableId][id] = false;
        pointsCorrection[turntableId][id] = pointsCorrection[turntableId][id].add(int256(pointsPerShare));
        emit Unlisten(turntableId, msg.sender, id);
        currentBalance = mix.balanceOf(address(this));
    }

    function listen(uint256 turntableId, uint256[] calldata ids) external {
        require(turntables.exists(turntableId));
        updateBalance();
        uint256 length = ids.length;
        totalShares = totalShares.add(length);
        for (uint256 i = 0; i < length; i = i + 1) {
            uint256 id = ids[i];
            require(nft.ownerOf(id) == msg.sender);

            if (listening[id] && listeningTo[id] != turntableId) {
                totalShares = totalShares.sub(1);
                _unlisten(listeningTo[id], id);
            } else {
                require(!listening[id]);
            }

            shares[turntableId][id] = true;
            
            listenersIndex[id] = listeners[turntableId].length;
            listeners[turntableId].push(id);
            
            pointsCorrection[turntableId][id] = pointsCorrection[turntableId][id].sub(int256(pointsPerShare));
            listeningTo[id] = turntableId;
            listening[id] = true;
            emit Listen(turntableId, msg.sender, id);
        }
    }

    function unlisten(uint256 turntableId, uint256[] calldata ids) external {
        updateBalance();
        uint256 length = ids.length;
        totalShares = totalShares.sub(length);
        for (uint256 i = 0; i < length; i = i + 1) {
            uint256 id = ids[i];
            require(listening[id] && listeningTo[id] == turntableId);
            _unlisten(turntableId, id);
            delete listeningTo[id];
            delete listening[id];
        }
    }

    function listenerCount(uint256 turntableId) external view returns (uint256) {
        return listeners[turntableId].length;
    }
}
