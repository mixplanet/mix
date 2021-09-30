pragma solidity ^0.5.6;

import "./klaytn-contracts/ownership/Ownable.sol";
import "./interfaces/IMix.sol";
import "./klaytn-contracts/token/KIP7/KIP7.sol";
import "./klaytn-contracts/token/KIP7/KIP7Burnable.sol";
import "./klaytn-contracts/token/KIP7/KIP7Metadata.sol";

contract Mix is Ownable, IMix, KIP7, KIP7Burnable, KIP7Metadata("DSC Mix", "MIX", 18) {

    address public emitter;
    address public booth;

    function setEmitter(address _emitter) onlyOwner external {
        emitter = _emitter;
    }

    function setBooth(address _booth) onlyOwner external {
        booth = _booth;
    }

    modifier onlyEmitter {
        require(msg.sender == emitter);
        _;
    }

    function mint(address to, uint256 amount) onlyEmitter external {
        _mint(to, amount);
    }

    function burn(uint256 amount) public {
        uint256 toBooth = (amount * 3) / 1000;
        transfer(booth, toBooth);
        _burn(msg.sender, amount - toBooth);
    }

    function burnFrom(address account, uint256 amount) public {
        uint256 toBooth = (amount * 3) / 1000;
        transferFrom(account, booth, toBooth);
        _burnFrom(account, amount - toBooth);
    }
}
