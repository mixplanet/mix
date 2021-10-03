pragma solidity ^0.5.6;

import "../klaytn-contracts/token/KIP17/KIP17Full.sol";
import "../klaytn-contracts/token/KIP17/KIP17Mintable.sol";
import "../klaytn-contracts/token/KIP17/KIP17Burnable.sol";
import "../klaytn-contracts/token/KIP17/KIP17Pausable.sol";

contract TestNFT is KIP17Full("TEST NFT", "TNFT"), KIP17Mintable, KIP17Burnable, KIP17Pausable {
    function bulkTransfer(address[] calldata tos, uint256[] calldata ids) external {
        uint256 length = ids.length;
        for (uint256 i = 0; i < length; i++) {
            transferFrom(msg.sender, tos[i], ids[i]);
        }
    }

    function massMint(uint256 amount) external onlyMinter {
        for (uint256 i = 0; i < amount; i++) {
            mint(msg.sender, i);
        }
    }
}
