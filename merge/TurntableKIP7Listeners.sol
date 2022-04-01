pragma solidity ^0.5.6;


/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be aplied to your functions to restrict their use to
 * the owner.
 */
contract Ownable {
    address payable private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor () internal {
        _owner = msg.sender;
        emit OwnershipTransferred(address(0), _owner);
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view returns (address payable) {
        return _owner;
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        require(isOwner(), "Ownable: caller is not the owner");
        _;
    }

    /**
     * @dev Returns true if the caller is the current owner.
     */
    function isOwner() public view returns (bool) {
        return msg.sender == _owner;
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions anymore. Can only be called by the current owner.
     *
     * > Note: Renouncing ownership will leave the contract without an owner,
     * thereby removing any functionality that is only available to the owner.
     */
    function renounceOwnership() public onlyOwner {
        emit OwnershipTransferred(_owner, address(0));
        _owner = address(0);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address payable newOwner) public onlyOwner {
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     */
    function _transferOwnership(address payable newOwner) internal {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }
}

/**
 * @dev Wrappers over Solidity's arithmetic operations with added overflow
 * checks.
 *
 * Arithmetic operations in Solidity wrap on overflow. This can easily result
 * in bugs, because programmers usually assume that an overflow raises an
 * error, which is the standard behavior in high level programming languages.
 * `SafeMath` restores this intuition by reverting the transaction when an
 * operation overflows.
 *
 * Using this library instead of the unchecked operations eliminates an entire
 * class of bugs, so it's recommended to use it always.
 */
library SafeMath {
    /**
     * @dev Returns the addition of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     * - Addition cannot overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");

        return c;
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     * - Subtraction cannot overflow.
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        return sub(a, b, "SafeMath: subtraction overflow");
    }

    /**
     * @dev Returns the subtraction of two unsigned integers, reverting with custom message on
     * overflow (when the result is negative).
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     * - Subtraction cannot overflow.
     *
     * _Available since v2.4.0._
     */
    function sub(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b <= a, errorMessage);
        uint256 c = a - b;

        return c;
    }

    /**
     * @dev Returns the multiplication of two unsigned integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     * - Multiplication cannot overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        return div(a, b, "SafeMath: division by zero");
    }

    /**
     * @dev Returns the integer division of two unsigned integers. Reverts with custom message on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     *
     * _Available since v2.4.0._
     */
    function div(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        // Solidity only automatically asserts when dividing by 0
        require(b > 0, errorMessage);
        uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold

        return c;
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     */
    function mod(uint256 a, uint256 b) internal pure returns (uint256) {
        return mod(a, b, "SafeMath: modulo by zero");
    }

    /**
     * @dev Returns the remainder of dividing two unsigned integers. (unsigned integer modulo),
     * Reverts with custom message when dividing by zero.
     *
     * Counterpart to Solidity's `%` operator. This function uses a `revert`
     * opcode (which leaves remaining gas untouched) while Solidity uses an
     * invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     * - The divisor cannot be zero.
     *
     * _Available since v2.4.0._
     */
    function mod(uint256 a, uint256 b, string memory errorMessage) internal pure returns (uint256) {
        require(b != 0, errorMessage);
        return a % b;
    }
}

/**
 * @title SignedSafeMath
 * @dev Signed math operations with safety checks that revert on error.
 */
library SignedSafeMath {
    int256 constant private _INT256_MIN = -2**255;

        /**
     * @dev Returns the multiplication of two signed integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `*` operator.
     *
     * Requirements:
     *
     * - Multiplication cannot overflow.
     */
    function mul(int256 a, int256 b) internal pure returns (int256) {
        // Gas optimization: this is cheaper than requiring 'a' not being zero, but the
        // benefit is lost if 'b' is also tested.
        // See: https://github.com/OpenZeppelin/openzeppelin-contracts/pull/522
        if (a == 0) {
            return 0;
        }

        require(!(a == -1 && b == _INT256_MIN), "SignedSafeMath: multiplication overflow");

        int256 c = a * b;
        require(c / a == b, "SignedSafeMath: multiplication overflow");

        return c;
    }

    /**
     * @dev Returns the integer division of two signed integers. Reverts on
     * division by zero. The result is rounded towards zero.
     *
     * Counterpart to Solidity's `/` operator. Note: this function uses a
     * `revert` opcode (which leaves remaining gas untouched) while Solidity
     * uses an invalid opcode to revert (consuming all remaining gas).
     *
     * Requirements:
     *
     * - The divisor cannot be zero.
     */
    function div(int256 a, int256 b) internal pure returns (int256) {
        require(b != 0, "SignedSafeMath: division by zero");
        require(!(b == -1 && a == _INT256_MIN), "SignedSafeMath: division overflow");

        int256 c = a / b;

        return c;
    }

    /**
     * @dev Returns the subtraction of two signed integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `-` operator.
     *
     * Requirements:
     *
     * - Subtraction cannot overflow.
     */
    function sub(int256 a, int256 b) internal pure returns (int256) {
        int256 c = a - b;
        require((b >= 0 && c <= a) || (b < 0 && c > a), "SignedSafeMath: subtraction overflow");

        return c;
    }

    /**
     * @dev Returns the addition of two signed integers, reverting on
     * overflow.
     *
     * Counterpart to Solidity's `+` operator.
     *
     * Requirements:
     *
     * - Addition cannot overflow.
     */
    function add(int256 a, int256 b) internal pure returns (int256) {
        int256 c = a + b;
        require((b >= 0 && c >= a) || (b < 0 && c < a), "SignedSafeMath: addition overflow");

        return c;
    }
}

interface ITurntableKIP7Listeners {

    event Distribute(address indexed by, uint256 distributed);
    event Claim(uint256 indexed turntableId, address indexed to, uint256 claimed);
    
    event Listen(uint256 indexed turntableId, address indexed owner, uint256 amount);
    event Unlisten(uint256 indexed turntableId, address indexed owner, uint256 amount);
    
    event SetTurntableFee(uint256 fee);

    function totalShares() external view returns (uint256);
    function turntableFee() external view returns (uint256);
    function shares(uint256 turntableId, address owner) external view returns (uint256);
    function accumulativeOf(uint256 turntableId, address owner) external view returns (uint256);
    function claimedOf(uint256 turntableId, address owner) external view returns (uint256);
    function claimableOf(uint256 turntableId, address owner) external view returns (uint256);
    function claim(uint256[] calldata turntableIds) external;

    function listen(uint256 turntableId, uint256 amount) external;
    function unlisten(uint256 turntableId, uint256 amount) external;
}

/**
 * @dev Interface of the KIP-13 standard, as defined in the
 * [KIP-13](http://kips.klaytn.com/KIPs/kip-13-interface_query_standard).
 *
 * Implementers can declare support of contract interfaces, which can then be
 * queried by others.
 *
 * For an implementation, see `KIP13`.
 */
interface IKIP13 {
    /**
     * @dev Returns true if this contract implements the interface defined by
     * `interfaceId`. See the corresponding
     * [KIP-13 section](http://kips.klaytn.com/KIPs/kip-13-interface_query_standard#how-interface-identifiers-are-defined)
     * to learn more about how these ids are created.
     *
     * This function call must use less than 30 000 gas.
     */
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/**
 * @dev Interface of the KIP7 standard as defined in the KIP. Does not include
 * the optional functions; to access them see `KIP7Metadata`.
 * See http://kips.klaytn.com/KIPs/kip-7-fungible_token
 */
contract IKIP7 is IKIP13 {
    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `recipient`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a `Transfer` event.
     */
    function transfer(address recipient, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through `transferFrom`. This is
     * zero by default.
     *
     * This value changes when `approve` or `transferFrom` are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * > Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an `Approval` event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `sender` to `recipient` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a `Transfer` event.
     */
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    /**
    * @dev Moves `amount` tokens from the caller's account to `recipient`.
    */
    function safeTransfer(address recipient, uint256 amount, bytes memory data) public;

    /**
    * @dev  Moves `amount` tokens from the caller's account to `recipient`.
    */
    function safeTransfer(address recipient, uint256 amount) public;

    /**
    * @dev Moves `amount` tokens from `sender` to `recipient` using the allowance mechanism.
    * `amount` is then deducted from the caller's allowance.
    */
    function safeTransferFrom(address sender, address recipient, uint256 amount, bytes memory data) public;

    /**
    * @dev Moves `amount` tokens from `sender` to `recipient` using the allowance mechanism.
    * `amount` is then deducted from the caller's allowance.
    */
    function safeTransferFrom(address sender, address recipient, uint256 amount) public;

    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to `approve`. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

interface IMix {

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}

interface IMixEmitter {

    event Add(address to, uint256 allocPoint);
    event Set(uint256 indexed pid, uint256 allocPoint);
    event SetEmissionPerBlock(uint256 emissionPerBlock);

    function mix() external view returns (IMix);
    function emissionPerBlock() external view returns (uint256);
    function started() external view returns (bool);

    function poolCount() external view returns (uint256);
    function poolInfo(uint256 pid) external view returns (
        address to,
        uint256 allocPoint,
        uint256 lastEmitBlock
    );
    function totalAllocPoint() external view returns (uint256);

    function pendingMix(uint256 pid) external view returns (uint256);
    function updatePool(uint256 pid) external;
}

interface ITurntables {
    
    event AddType(
        uint256 price,
        uint256 destroyReturn,
        uint256 volume,
        uint256 lifetime
    );

    event AllowType(uint256 indexed typeId);
    event DenyType(uint256 indexed typeId);
    event ChangeChargingEfficiency(uint256 value);

    event Buy(address indexed owner, uint256 indexed turntableId);
    event Charge(address indexed owner, uint256 indexed turntableId, uint256 amount);
    event Destroy(address indexed owner, uint256 indexed turntableId);

    event Distribute(address indexed by, uint256 distributed);
    event Claim(uint256 indexed turntableId, uint256 claimed);

    function types(uint256 typeId) external view returns (
        uint256 price,
        uint256 destroyReturn,
        uint256 volume,
        uint256 lifetime
    );

    function addType(
        uint256 price,
        uint256 destroyReturn,
        uint256 volume,
        uint256 lifetime
    ) external returns (uint256 typeId);

    function totalVolume() external view returns (uint256);
    function typeCount() external view returns (uint256);
    function allowType(uint256 typeId) external;
    function denyType(uint256 typeId) external;

    function turntables(uint256 turntableId) external view returns (
        address owner,
        uint256 typeId,
        uint256 endBlock,
        uint256 lastClaimedBlock
    );

    function buy(uint256 typeId) external returns (uint256 turntableId);
    function turntableLength() external view returns (uint256);
    function ownerOf(uint256 turntableId) external view returns (address);
    function exists(uint256 turntableId) external view returns (bool);
    function charge(uint256 turntableId, uint256 amount) external;
    function destroy(uint256 turntableId) external;

    function pid() external view returns (uint256);
    function accumulativeOf(uint256 turntableId) external view returns (uint256);
    function claimedOf(uint256 turntableId) external view returns (uint256);
    function claimableOf(uint256 turntableId) external view returns (uint256);
    function claim(uint256[] calldata turntableIds) external returns (uint256);
}

contract TurntableKIP7Listeners is Ownable, ITurntableKIP7Listeners {
    using SafeMath for uint256;
    using SignedSafeMath for int256;

    IMixEmitter public mixEmitter;
    IMix public mix;
    uint256 public pid;
    ITurntables public turntables;
    IKIP7 public token;

    constructor(
        IMixEmitter _mixEmitter,
        uint256 _pid,
        ITurntables _turntables,
        IKIP7 _token
    ) public {
        mixEmitter = _mixEmitter;
        mix = _mixEmitter.mix();
        pid = _pid;
        turntables = _turntables;
        token = _token;
    }

    uint256 private currentBalance = 0;
    uint256 public totalShares = 0;
    mapping(uint256 => mapping(address => uint256)) public shares;

    uint256 public turntableFee = 3000;

    uint256 private constant pointsMultiplier = 2**128;
    uint256 private pointsPerShare = 0;
    mapping(uint256 => mapping(address => int256)) private pointsCorrection;
    mapping(uint256 => mapping(address => uint256)) private claimed;

    function setTurntableFee(uint256 fee) external onlyOwner {
        require(fee < 1e4);
        turntableFee = fee;
        emit SetTurntableFee(fee);
    }

    function updateBalance() private {
        if (totalShares > 0) {
            mixEmitter.updatePool(pid);
            uint256 balance = mix.balanceOf(address(this));
            uint256 value = balance.sub(currentBalance);
            if (value > 0) {
                pointsPerShare = pointsPerShare.add(value.mul(pointsMultiplier).div(totalShares));
                emit Distribute(msg.sender, value);
            }
            currentBalance = balance;
        } else {
            mixEmitter.updatePool(pid);
            uint256 balance = mix.balanceOf(address(this));
            uint256 value = balance.sub(currentBalance);
            if (value > 0) mix.burn(value);
        }
    }

    function claimedOf(uint256 turntableId, address owner) public view returns (uint256) {
        return claimed[turntableId][owner];
    }

    function accumulativeOf(uint256 turntableId, address owner) public view returns (uint256) {
        uint256 _pointsPerShare = pointsPerShare;
        if (totalShares > 0) {
            uint256 balance = mixEmitter.pendingMix(pid).add(mix.balanceOf(address(this)));
            uint256 value = balance.sub(currentBalance);
            if (value > 0) {
                _pointsPerShare = _pointsPerShare.add(value.mul(pointsMultiplier).div(totalShares));
            }
            return
                uint256(
                    int256(_pointsPerShare.mul(shares[turntableId][owner])).add(pointsCorrection[turntableId][owner])
                ).div(pointsMultiplier);
        }
        return 0;
    }

    function claimableOf(uint256 turntableId, address owner) external view returns (uint256) {
        return
            accumulativeOf(turntableId, owner).sub(claimed[turntableId][owner]).mul(uint256(1e4).sub(turntableFee)).div(
                1e4
            );
    }

    function _accumulativeOf(uint256 turntableId, address owner) private view returns (uint256) {
        return
            uint256(int256(pointsPerShare.mul(shares[turntableId][owner])).add(pointsCorrection[turntableId][owner]))
                .div(pointsMultiplier);
    }

    function _claimableOf(uint256 turntableId, address owner) private view returns (uint256) {
        return _accumulativeOf(turntableId, owner).sub(claimed[turntableId][owner]);
    }

    function claim(uint256[] calldata turntableIds) external {
        updateBalance();
        uint256 length = turntableIds.length;
        uint256 totalClaimable = 0;
        for (uint256 i = 0; i < length; i = i + 1) {
            uint256 turntableId = turntableIds[i];
            uint256 claimable = _claimableOf(turntableId, msg.sender);
            if (claimable > 0) {
                claimed[turntableId][msg.sender] = claimed[turntableId][msg.sender].add(claimable);
                emit Claim(turntableId, msg.sender, claimable);
                uint256 fee = claimable.mul(turntableFee).div(1e4);
                if (turntables.exists(turntableId)) {
                    mix.transfer(turntables.ownerOf(turntableId), fee);
                } else {
                    mix.burn(fee);
                }
                mix.transfer(msg.sender, claimable.sub(fee));
                totalClaimable = totalClaimable.add(claimable);
            }
        }
        currentBalance = currentBalance.sub(totalClaimable);
    }

    function listen(uint256 turntableId, uint256 amount) external {
        require(turntables.exists(turntableId));
        updateBalance();
        totalShares = totalShares.add(amount);
        shares[turntableId][msg.sender] = shares[turntableId][msg.sender].add(amount);
        pointsCorrection[turntableId][msg.sender] = pointsCorrection[turntableId][msg.sender].sub(
            int256(pointsPerShare.mul(amount))
        );

        token.transferFrom(msg.sender, address(this), amount);
        emit Listen(turntableId, msg.sender, amount);
    }

    function unlisten(uint256 turntableId, uint256 amount) external {
        updateBalance();
        totalShares = totalShares.sub(amount);
        shares[turntableId][msg.sender] = shares[turntableId][msg.sender].sub(amount);
        pointsCorrection[turntableId][msg.sender] = pointsCorrection[turntableId][msg.sender].add(
            int256(pointsPerShare.mul(amount))
        );

        token.transfer(msg.sender, amount);
        emit Unlisten(turntableId, msg.sender, amount);
    }
}