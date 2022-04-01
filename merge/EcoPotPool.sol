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

interface IKIP7E {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

interface EcoPotLike {
    function totalAmount() external view returns (uint);
    function amountPerBlock() external view returns (uint);
    function distributableBlock() external view returns (uint);
    function estimateEndBlock() external view returns (uint);
    function operator() external view returns (address);
    function getDistributedCurrent() external view returns (uint);
    function isInitialized() external view returns (bool);
    function isAvailable() external view returns (bool);

    function initialize(uint, uint, uint) external payable;
    function depositKlay() external payable;
    function depositToken(uint) external;
    function refixAmountPerBlock(uint) external;
}

interface EcoPotVotingLike {
    function ecoPotExist(address) external view returns (bool);
}

contract EcoPotOperator {
    address constant public ecoPotVoting = 0x2ce59e21364DcA92c90970AD15442146D638997f;
    address constant public ksp = 0xC6a2Ad8cC6e4A7E08FC37cC5954be07d499E7654;

    address public owner;
    address public nextOwner;

    address public ecoPot;
    address public token;
    string public name;

    constructor(address _token, string memory _name) public {
        owner = msg.sender;

        token = _token;
        if(token != address(0)) require(IKIP7E(token).decimals() != 0);
        name = _name;
    }

    function version() external pure returns (string memory) {
        return "EcoPotOperator20220221A";
    }

    // valid fallback
    function () payable external { }

    // ======================= owner method ===========================

    modifier onlyOwner {
        require(msg.sender == owner);
        _;
    }

    function changeNextOwner(address _nextOwner) public onlyOwner {
        nextOwner = _nextOwner;
    }

    function changeOwner() public {
        require(msg.sender == nextOwner);

        owner = nextOwner;
        nextOwner = address(0);
    }

    //withdraw tokens remaining in the operator contract
    function withdraw(address tokenAddr) public onlyOwner {
        uint balance = 0;
        if(tokenAddr == address(0)){
            balance = (address(this)).balance;
            if(balance > 0){
                (bool res, ) = owner.call.value(balance)("");
                require(res);
            }
        }
        else{
            balance = IKIP7E(tokenAddr).balanceOf(address(this));
            if(balance > 0){
                require(IKIP7E(tokenAddr).transfer(owner, balance));
            }
        }
    }

    modifier onlyEcoPotVoting {
        require(msg.sender == ecoPotVoting);
        _;
    }

    function setEcoPot(address _ecoPot) public onlyEcoPotVoting {
        require(ecoPot == address(0));
        ecoPot = _ecoPot;
    }

    // ====================== Stat ====================================

    function getEcoPotStat() public view returns (
        address ecoPotContract, // airdrop distribution contract address
        uint totalAmount, // Total amount of tokens to be distributed
        uint blockAmount, // Amount of tokens to be distributed per block
        uint distributableBlock, // Block number to airdrop start
        uint endBlock, // Block number to airdrop end
        uint distributed,  // Amount of tokens distributed
        uint remain // amount remaining in the contract
    ){
        ecoPotContract = ecoPot;

        EcoPotLike pot = EcoPotLike(ecoPot);

        totalAmount = pot.totalAmount();
        blockAmount = pot.amountPerBlock();
        distributableBlock = pot.distributableBlock();
        endBlock = pot.estimateEndBlock();
        distributed = pot.getDistributedCurrent();
        if(token == address(0)){
            remain = (ecoPot).balance;
        }
        else{
            remain = IKIP7E(token).balanceOf(ecoPot);
        }
    }

    // For Drops AirdropPool
    function getAirdropStat() public view returns (
        address ecoPotContract, // airdrop distribution contract address
        uint totalAmount, // Total amount of tokens to be distributed
        uint blockAmount, // Amount of tokens to be distributed per block
        uint distributableBlock, // Block number to airdrop start
        uint endBlock, // Block number to airdrop end
        uint distributed,  // Amount of tokens distributed
        uint remain, // amount remaining in the contract
        uint emptyUint, // return for airdropPool
        address[] memory emptyAddressArr, // return for airdropPool
        uint[] memory emptyUintArr // return for airdropPool
    ){
        ecoPotContract = ecoPot;

        EcoPotLike pot = EcoPotLike(ecoPot);

        totalAmount = pot.totalAmount();
        blockAmount = pot.amountPerBlock();
        distributableBlock = pot.distributableBlock();
        endBlock = pot.estimateEndBlock();
        distributed = pot.getDistributedCurrent();
        if(token == address(0)){
            remain = (ecoPot).balance;
        }
        else{
            remain = IKIP7E(token).balanceOf(ecoPot);
        }

        emptyUint = 0;
        emptyAddressArr = new address[](0);
        emptyUintArr = new uint[](0);
    }

    // ===================== Airdrop method ===========================
    ///@param totalAmount : Total amount of tokens to be distributed
    ///@param blockAmount : Amount of tokens to be distributed per block
    ///@param startBlock  : Block number to airdrop start
    function initialize(uint totalAmount, uint blockAmount, uint startBlock) public payable onlyOwner {
        require(totalAmount != 0);
        require(blockAmount != 0);
        require(startBlock >= block.number);

        EcoPotLike pot = EcoPotLike(ecoPot);
        require(pot.operator() == address(this));
        require(!pot.isInitialized());

        if(token == address(0)){
            require((address(this)).balance >= totalAmount);
            pot.initialize.value(totalAmount)(totalAmount, blockAmount, startBlock);
        }
        else {
            require(IKIP7E(token).transferFrom(owner, address(this), totalAmount));
            require(IKIP7E(token).approve(ecoPot, totalAmount));
            pot.initialize(totalAmount, blockAmount, startBlock);
        }
    }

    // Airdrop token deposit
    ///@param amount : Amount of airdrop token to deposit
    function deposit(uint amount) public onlyOwner {
        EcoPotLike pot = EcoPotLike(ecoPot);

        require(pot.operator() == address(this));
        require(pot.isAvailable());
        require(amount != 0);

        if(token == address(0)){
            require((address(this)).balance >= amount);
            pot.depositKlay.value(amount)();
        }
        else{
            require(IKIP7E(token).balanceOf(address(this)) >= amount);
            require(IKIP7E(token).approve(ecoPot, amount));
            pot.depositToken(amount);
        }
    }

    // Airdrop amount per block modification function
    // The function is applied immediately from the called block
    ///@param blockAmount : airdrop block amount to change
    function refixBlockAmount(uint blockAmount) public onlyOwner {
        EcoPotLike pot = EcoPotLike(ecoPot);

        require(pot.operator() == address(this));
        require(pot.isAvailable());
        require(blockAmount != 0);

        pot.refixAmountPerBlock(blockAmount);
    }
}

contract EcoPotPool is Ownable {

    event SetOperator(EcoPotOperator indexed operator);
    event SetKeeper(address indexed keeper);

    IMixEmitter public mixEmitter;
    IMix public mix;
    uint256 public pid;
    EcoPotOperator public operator;
    address public keeper;

    constructor(
        IMixEmitter _mixEmitter,
        uint256 _pid,
        EcoPotOperator _operator
    ) public {
        mixEmitter = _mixEmitter;
        mix = _mixEmitter.mix();
        pid = _pid;
        operator = _operator;
        keeper = msg.sender;
    }
    
    function setOperator(EcoPotOperator _operator) external onlyOwner {
        operator = _operator;
        emit SetOperator(_operator);
    }
    
    function setKeeper(address _keeper) external onlyOwner {
        keeper = _keeper;
        emit SetKeeper(_keeper);
    }

    modifier onlyKeeper() {
        require(isOwner() || msg.sender == keeper);
        _;
    }

    function forward() external onlyKeeper {
        mixEmitter.updatePool(pid);
        uint256 amount = mix.balanceOf(address(this));
        mix.transfer(address(operator), amount);
        operator.deposit(amount);
    }

    function changeNextOwner(address nextOwner) external onlyOwner {
        operator.changeNextOwner(nextOwner);
    }

    function changeOwner() external {
        operator.changeOwner();
    }

    function withdraw(address tokenAddr) external onlyOwner {
        operator.withdraw(tokenAddr);
        uint256 balance = IKIP7(tokenAddr).balanceOf(address(this));
        if (balance > 0) {
            IKIP7(tokenAddr).transfer(msg.sender, balance);
        }
    }

    function getEcoPotStat() external view returns (
        address ecoPotContract, // airdrop distribution contract address
        uint totalAmount, // Total amount of tokens to be distributed
        uint blockAmount, // Amount of tokens to be distributed per block
        uint distributableBlock, // Block number to airdrop start
        uint endBlock, // Block number to airdrop end
        uint distributed,  // Amount of tokens distributed
        uint remain // amount remaining in the contract
    ) {
        return operator.getEcoPotStat();
    }

    function getAirdropStat() external view returns (
        address distributionContract, // airdrop distribution contract address
        uint totalAmount, // Total amount of tokens to be distributed
        uint blockAmount, // Amount of tokens to be distributed per block
        uint distributableBlock, // Block number to airdrop start
        uint endBlock, // Block number to airdrop end
        uint distributed,  // Amount of tokens distributed
        uint remain, // amount remaining in the contract 
        uint targetCount, // airdrop target LP count
        address[] memory targets, // airdrop target LP list
        uint[] memory rates // airdrop target lp rate list
    ) {
        return operator.getAirdropStat();
    }

    function initialize(
        uint totalAmount,
        uint blockAmount,
        uint startBlock
    ) external onlyOwner {
        operator.initialize(totalAmount, blockAmount, startBlock);
    }

    function deposit(uint amount) external onlyOwner {
        operator.deposit(amount);
    }

    function refixBlockAmount(uint blockAmount) external onlyOwner {
        operator.refixBlockAmount(blockAmount);
    }
}