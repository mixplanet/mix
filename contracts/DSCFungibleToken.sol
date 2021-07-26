pragma solidity ^0.5.6;

import "./klaytn-contracts/math/SafeMath.sol";
import "./interfaces/IDSCFungibleToken.sol";

contract DSCFungibleToken is IDSCFungibleToken {
    using SafeMath for uint256;
}
