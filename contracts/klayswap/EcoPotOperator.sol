pragma solidity 0.5.6;

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
