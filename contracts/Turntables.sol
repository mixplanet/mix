pragma solidity ^0.5.6;

import "./klaytn-contracts/ownership/Ownable.sol";
import "./klaytn-contracts/math/SafeMath.sol";
import "./klaytn-contracts/token/KIP7/IKIP7.sol";
import "./interfaces/ITurntables.sol";
import "./MixDividend.sol";

contract Turntables is Ownable, ITurntables, MixDividend {
    using SafeMath for uint256;
    
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

    function addType(
        uint256 price,
        uint256 destroyReturn,
        uint256 volume,
        uint256 lifetime
    ) onlyOwner external returns (uint256 typeId) {
        require(price >= destroyReturn);
        typeId = types.length;
        types.push(Type({
            price: price,
            destroyReturn: destroyReturn,
            volume: volume,
            lifetime: lifetime
        }));
        emit AddType(price, destroyReturn, volume, lifetime);
    }

    function typeCount() external view returns (uint256) {
        return types.length;
    }

    function allowType(uint256 typeId) onlyOwner external {
        typeWhitelist[typeId] = true;
        emit AllowType(typeId);
    }

    function denyType(uint256 typeId) onlyOwner external {
        typeWhitelist[typeId] = false;
        emit DenyType(typeId);
    }

    function buy(uint256 typeId) external returns (uint256 turntableId) {
        require(typeWhitelist[typeId] == true);
        Type memory _type = types[typeId];
        turntableId = turntables.length;
        turntables.push(Turntable({
            owner: msg.sender,
            typeId: typeId,
            endBlock: block.number.add(_type.lifetime),
            lastClaimedBlock: block.number
        }));
        _addShare(_type.volume);
        mix.transferFrom(msg.sender, address(this), _type.price);
        emit Buy(msg.sender, turntableId);
    }

    function turntableCount() external view returns (uint256) {
        return turntables.length;
    }

    function destroy(uint256 turntableId) external {
        Turntable memory turntable = turntables[turntableId];
        require(turntable.owner == msg.sender);
        Type memory _type = types[turntable.typeId];
        _subShare(_type.volume);
        mix.transfer(msg.sender, _type.destroyReturn);
        mix.burn(_type.price - _type.destroyReturn);
        delete turntables[turntableId];
        emit Destroy(msg.sender, turntableId);
    }
}
