pragma solidity ^0.5.6;

import "./klaytn-contracts/ownership/Ownable.sol";
import "./klaytn-contracts/math/SafeMath.sol";
import "./interfaces/IMixEmitter.sol";

contract MixEmitter is Ownable, IMixEmitter {
    using SafeMath for uint256;

    uint256 private constant PRECISION = 1e20;

    struct PoolInfo {
        address to;
        uint256 allocPoint;
        uint256 lastEmitBlock;
    }

    IMix public mix;
    uint256 public emissionPerBlock;

    PoolInfo[] public poolInfo;
    uint256 public totalAllocPoint;

    bool public started = false;

    constructor(IMix _mix, uint256 _emissionPerBlock) public {
        mix = _mix;
        emissionPerBlock = _emissionPerBlock;
    }

    function setEmissionPerBlock(uint256 _emissionPerBlock) external onlyOwner {
        massUpdatePools();
        emissionPerBlock = _emissionPerBlock;
        emit SetEmissionPerBlock(_emissionPerBlock);
    }

    function poolCount() external view returns (uint256) {
        return poolInfo.length;
    }

    function pendingMix(uint256 pid) external view returns (uint256) {
        PoolInfo memory pool = poolInfo[pid];
        uint256 _lastEmitBlock = pool.lastEmitBlock;
        if (block.number > _lastEmitBlock && pool.allocPoint != 0) {
            return block.number.sub(_lastEmitBlock).mul(emissionPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        }
        return 0;
    }

    function updatePool(uint256 pid) public {
        PoolInfo storage pool = poolInfo[pid];
        uint256 _lastEmitBlock = pool.lastEmitBlock;
        if (block.number <= _lastEmitBlock) {
            return;
        }
        if (pool.allocPoint == 0) {
            pool.lastEmitBlock = block.number;
            return;
        }
        uint256 amount = block.number.sub(_lastEmitBlock).mul(emissionPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        mix.mint(pool.to, amount);
        pool.lastEmitBlock = block.number;
    }

    function massUpdatePools() internal {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; pid = pid + 1) {
            updatePool(pid);
        }
    }

    function add(address to, uint256 allocPoint) external onlyOwner {
        massUpdatePools();
        totalAllocPoint = totalAllocPoint.add(allocPoint);
        poolInfo.push(PoolInfo({to: to, allocPoint: allocPoint, lastEmitBlock: started ? block.number : uint256(-1)}));
        emit Add(to, allocPoint);
    }

    function set(uint256 pid, uint256 allocPoint) external onlyOwner {
        massUpdatePools();
        totalAllocPoint = totalAllocPoint.sub(poolInfo[pid].allocPoint).add(allocPoint);
        poolInfo[pid].allocPoint = allocPoint;
        emit Set(pid, allocPoint);
    }

    function start() external onlyOwner {
        require(!started);
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; pid = pid + 1) {
            poolInfo[pid].lastEmitBlock = block.number;
        }
        started = true;
    }
}
