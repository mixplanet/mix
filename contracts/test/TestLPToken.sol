pragma solidity ^0.5.6;

import "../klaytn-contracts/token/KIP7/KIP7.sol";

contract TestLPToken is KIP7 {
    constructor() public {
        _mint(msg.sender, 10000);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
