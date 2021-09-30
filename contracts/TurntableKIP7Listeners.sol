pragma solidity ^0.5.6;

import "./klaytn-contracts/ownership/Ownable.sol";
import "./klaytn-contracts/math/SafeMath.sol";
import "./interfaces/ITurntableKIP7Listeners.sol";
import "./MixDividend.sol";

contract TurntableKIP7Listeners is Ownable, ITurntableKIP7Listeners, MixDividend {
    using SafeMath for uint256;

}
