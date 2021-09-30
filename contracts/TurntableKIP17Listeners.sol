pragma solidity ^0.5.6;

import "./klaytn-contracts/ownership/Ownable.sol";
import "./klaytn-contracts/math/SafeMath.sol";
import "./interfaces/ITurntableKIP17Listeners.sol";
import "./MixDividend.sol";

contract TurntableKIP17Listeners is Ownable, ITurntableKIP17Listeners, MixDividend {
    using SafeMath for uint256;

}
