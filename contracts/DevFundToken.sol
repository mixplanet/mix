pragma solidity ^0.5.6;

import "./klaytn-contracts/token/KIP7/KIP7.sol";
import "./klaytn-contracts/token/KIP7/KIP7Metadata.sol";

contract DevFundToken is KIP7, KIP7Metadata("DSC Dev Fund Token", "DSCDEV", 18) {
    constructor() public {
        _mint(msg.sender, 100 * 1e18);
    }
}
