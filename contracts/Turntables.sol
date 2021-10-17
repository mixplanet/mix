pragma solidity ^0.5.6;

import "./klaytn-contracts/math/SafeMath.sol";
import "./libraries/SignedSafeMath.sol";
import "./klaytn-contracts/ownership/Ownable.sol";
import "./klaytn-contracts/token/KIP7/IKIP7.sol";
import "./interfaces/IMixEmitter.sol";
import "./interfaces/IMix.sol";
import "./interfaces/ITurntables.sol";

contract Turntables is Ownable, ITurntables {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    IMixEmitter public mixEmitter;
    IMix public mix;
    uint256 public pid;

    constructor(IMixEmitter _mixEmitter, uint256 _pid) public {
        require(_mixEmitter.started());
        mixEmitter = _mixEmitter;
        mix = _mixEmitter.mix();
        pid = _pid;
    }

    uint256 internal currentBalance = 0;
    uint256 public totalVolume = 0;

    uint256 internal constant pointsMultiplier = 2**128;
    uint256 internal pointsPerShare = 0;
    mapping(uint256 => int256) internal pointsCorrection;
    mapping(uint256 => uint256) internal claimed;
    mapping(uint256 => uint256) internal realClaimed;

    struct Type {
        uint256 price;
        uint256 destroyReturn;
        uint256 volume;
        uint256 lifetime;
    }
    Type[] public types;
    mapping(uint256 => bool) public typeWhitelist;

    struct Turntable {
        address owner;
        uint256 typeId;
        uint256 endBlock;
        uint256 lastClaimedBlock;
    }
    Turntable[] public turntables;

    uint256 public chargingEfficiency = 200; // 1e2

    function addType(
        uint256 price,
        uint256 destroyReturn,
        uint256 volume,
        uint256 lifetime
    ) external onlyOwner returns (uint256 typeId) {
        require(price >= destroyReturn);
        typeId = types.length;
        types.push(Type({price: price, destroyReturn: destroyReturn, volume: volume, lifetime: lifetime}));
        emit AddType(price, destroyReturn, volume, lifetime);
    }

    function typeCount() external view returns (uint256) {
        return types.length;
    }

    function allowType(uint256 typeId) external onlyOwner {
        typeWhitelist[typeId] = true;
        emit AllowType(typeId);
    }

    function denyType(uint256 typeId) external onlyOwner {
        typeWhitelist[typeId] = false;
        emit DenyType(typeId);
    }

    function setChargingEfficiency(uint256 value) external onlyOwner {
        chargingEfficiency = value;
        emit ChangeChargingEfficiency(value);
    }

    function buy(uint256 typeId) external returns (uint256 turntableId) {
        require(typeWhitelist[typeId]);
        Type memory _type = types[typeId];
        turntableId = turntables.length;
        turntables.push(
            Turntable({
                owner: msg.sender,
                typeId: typeId,
                endBlock: block.number.add(_type.lifetime),
                lastClaimedBlock: block.number
            })
        );

        updateBalance();
        totalVolume = totalVolume.add(_type.volume);
        pointsCorrection[turntableId] = int256(pointsPerShare.mul(_type.volume)).mul(-1);

        mix.transferFrom(msg.sender, address(this), _type.price);
        currentBalance = mix.balanceOf(address(this));
        emit Buy(msg.sender, turntableId);
    }

    function turntableLength() external view returns (uint256) {
        return turntables.length;
    }

    function ownerOf(uint256 turntableId) public view returns (address) {
        return turntables[turntableId].owner;
    }

    function exists(uint256 turntableId) external view returns (bool) {
        return turntables[turntableId].owner != address(0);
    }

    function charge(uint256 turntableId, uint256 amount) external {
        require(amount > 0);

        Turntable storage turntable = turntables[turntableId];
        require(turntable.owner == msg.sender);
        Type memory _type = types[turntable.typeId];

        uint256[] memory turntableIds = new uint256[](1);
        turntableIds[0] = turntableId;
        claim(turntableIds);

        uint256 changedLifetime = _type.lifetime.mul(amount).mul(chargingEfficiency).div(100).div(_type.price);
        uint256 oldEndBlock = turntable.endBlock;
        turntable.endBlock = (block.number < oldEndBlock ? oldEndBlock : block.number).add(changedLifetime);

        mix.burnFrom(msg.sender, amount);
        currentBalance = mix.balanceOf(address(this));
        emit Charge(msg.sender, turntableId, amount);
    }

    function destroy(uint256 turntableId) external {
        Turntable memory turntable = turntables[turntableId];
        require(turntable.owner == msg.sender);

        uint256[] memory turntableIds = new uint256[](1);
        turntableIds[0] = turntableId;
        claim(turntableIds);

        Type memory _type = types[turntable.typeId];
        totalVolume = totalVolume.sub(_type.volume);
        delete pointsCorrection[turntableId];

        mix.transfer(msg.sender, _type.destroyReturn);
        mix.burn(_type.price - _type.destroyReturn);
        delete turntables[turntableId];

        currentBalance = mix.balanceOf(address(this));
        emit Destroy(msg.sender, turntableId);
    }

    function updateBalance() internal {
        if (totalVolume > 0) {
            mixEmitter.updatePool(pid);
            uint256 balance = mix.balanceOf(address(this));
            uint256 value = balance.sub(currentBalance);
            if (value > 0) {
                pointsPerShare = pointsPerShare.add(value.mul(pointsMultiplier).div(totalVolume));
                emit Distribute(msg.sender, value);
            }
        } else {
            mixEmitter.updatePool(pid);
            uint256 balance = mix.balanceOf(address(this));
            uint256 value = balance.sub(currentBalance);
            if (value > 0) mix.burn(value);
        }
    }

    function claimedOf(uint256 turntableId) public view returns (uint256) {
        return realClaimed[turntableId];
    }

    function accumulativeOf(uint256 turntableId) public view returns (uint256) {
        uint256 _pointsPerShare = pointsPerShare;
        if (totalVolume > 0) {
            uint256 balance = mixEmitter.pendingMix(pid).add(mix.balanceOf(address(this)));
            uint256 value = balance.sub(currentBalance);
            if (value > 0) {
                _pointsPerShare = _pointsPerShare.add(value.mul(pointsMultiplier).div(totalVolume));
            }
            return
                uint256(
                    int256(_pointsPerShare.mul(types[turntables[turntableId].typeId].volume)).add(
                        pointsCorrection[turntableId]
                    )
                ).div(pointsMultiplier);
        }
        return 0;
    }

    function claimableOf(uint256 turntableId) external view returns (uint256) {
        uint256 claimable = accumulativeOf(turntableId).sub(claimed[turntableId]);
        Turntable memory turntable = turntables[turntableId];
        if (turntable.endBlock <= turntable.lastClaimedBlock) {
            return 0;
        } else if (turntable.endBlock < block.number) {
            return
                claimable.mul(turntable.endBlock.sub(turntable.lastClaimedBlock)).div(
                    block.number.sub(turntable.lastClaimedBlock)
                );
        } else {
            return claimable;
        }
    }

    function _accumulativeOf(uint256 turntableId) internal view returns (uint256) {
        return uint256(int256(pointsPerShare.mul(types[turntables[turntableId].typeId].volume)).add(pointsCorrection[turntableId])).div(pointsMultiplier);
    }

    function _claimableOf(uint256 turntableId) internal view returns (uint256) {
        return _accumulativeOf(turntableId).sub(claimed[turntableId]);
    }

    function claim(uint256[] memory turntableIds) public returns (uint256 totalClaimable) {
        updateBalance();

        uint256 toBurn = 0;
        uint256 length = turntableIds.length;
        for (uint256 i = 0; i < length; i = i + 1) {
            uint256 turntableId = turntableIds[i];
            require(ownerOf(turntableId) == msg.sender);
            uint256 claimable = _claimableOf(turntableId);
            if (claimable > 0) {
                uint256 realClaimable = 0;

                Turntable memory turntable = turntables[turntableId];
                if (turntable.endBlock <= turntable.lastClaimedBlock) {
                    // ignore.
                } else if (turntable.endBlock < block.number) {
                    realClaimable = claimable.mul(turntable.endBlock.sub(turntable.lastClaimedBlock)).div(
                        block.number.sub(turntable.lastClaimedBlock)
                    );
                } else {
                    realClaimable = claimable;
                }

                toBurn = toBurn.add(claimable.sub(realClaimable));
                if (realClaimable > 0) {
                    realClaimed[turntableId] = realClaimed[turntableId].add(realClaimable);
                    emit Claim(turntableId, realClaimable);
                    totalClaimable = totalClaimable.add(realClaimable);
                }

                claimed[turntableId] = claimed[turntableId].add(claimable);
                turntables[turntableId].lastClaimedBlock = block.number;
            }
        }

        if (totalClaimable > 0) mix.transfer(msg.sender, totalClaimable);
        if (toBurn > 0) mix.burn(toBurn);
        currentBalance = mix.balanceOf(address(this));
    }
}
