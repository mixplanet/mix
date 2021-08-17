pragma solidity ^0.5.6;

import "./klaytn-contracts/token/KIP17/KIP17Full.sol";
import "./klaytn-contracts/token/KIP17/KIP17Mintable.sol";
import "./klaytn-contracts/token/KIP17/KIP17Burnable.sol";
import "./klaytn-contracts/token/KIP17/KIP17Pausable.sol";

contract DogeSoundClubMate is KIP17Full("DOGESOUNDCLUB MATES", "MATE"), KIP17Mintable, KIP17Burnable, KIP17Pausable {

    string public hash = "6110b42d1575f2bfb80a98cb6ce7d6743fa249b6ee2be08467487c12f5f95753";
    string public ipfs = "QmfTimyAQTQjQsnvECn9U44LdnPzSDF2XREoP2WFdjHitQ";

    function tokenURI(uint256 tokenId) public view returns (string memory) {
        require(_exists(tokenId), "KIP17Metadata: URI query for nonexistent token");
        
        if (tokenId == 0) {
            return "https://api.dogesound.club/mate/0";
        }

        string memory baseURI = "https://api.dogesound.club/mate/";
        string memory idstr;
        
        uint256 temp = tokenId;
        uint256 digits;
        while (temp != 0) {
            digits += 1;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (tokenId != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(tokenId % 10)));
            tokenId /= 10;
        }
        idstr = string(buffer);

        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, idstr)) : "";
    }

    function bulkTransfer(address[] calldata tos, uint256[] calldata ids) external {
        uint256 length = ids.length;
        for (uint256 i = 0; i < length; i += 1) {
            transferFrom(msg.sender, tos[i], ids[i]);
        }
    }

    // lv is 1~16
    function massMint(uint256 lv) external onlyMinter {
        uint256 from = 625 * (lv - 1);
        uint256 to = 625 * lv;
        for (uint256 i = from; i < to; i += 1) {
            mint(msg.sender, i);
        }
    }
}
