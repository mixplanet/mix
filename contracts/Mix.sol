pragma solidity ^0.5.6;

import "./interfaces/IMix.sol";
import "./interfaces/IMixEmitter.sol";
import "./klaytn-contracts/token/KIP7/KIP7.sol";
import "./klaytn-contracts/token/KIP7/KIP7Burnable.sol";
import "./klaytn-contracts/token/KIP7/KIP7Metadata.sol";

contract Mix is IMix, KIP7, KIP7Burnable, KIP7Metadata("DOGESOUNDCLUB MIX", "$MIX", 18) {

    IMixEmitter public emitter;
    
    constructor() public {
        emitter = IMixEmitter(msg.sender);
    }

    modifier onlyEmitter {
        require(msg.sender == address(emitter));
        _;
    }

    function mint(address to, uint256 amount) onlyEmitter external {
        _mint(to, amount);
    }
}
