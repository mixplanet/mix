pragma solidity ^0.5.6;

import "./klaytn-contracts/ownership/Ownable.sol";
import "./interfaces/IMixEmitter.sol";
import "./Mix.sol";

contract MixEmitter is Ownable, IMixEmitter {
    uint256 private constant PRECISION = 1e20;
    
    struct PoolInfo {
        address to;
        uint256 allocPoint;
        uint256 lastEmitBlock;
    }

    IMix public mix;
    uint256 public emitPerBlock;
    uint256 public startBlock;

    PoolInfo[] public poolInfo;
    uint256 public totalAllocPoint;

    constructor(
        uint256 _emitPerBlock,
        uint256 _startBlock
    ) public {
        mix = new Mix();
        emitPerBlock = _emitPerBlock;
        startBlock = _startBlock;
    }

    function poolCount() external view returns (uint256) {
        return poolInfo.length;
    }
    
    function pendingMix(uint256 pid) external view returns (uint256) {
        PoolInfo memory pool = poolInfo[pid];
        uint256 _lastEmitBlock = pool.lastEmitBlock;
        if (block.number > _lastEmitBlock && pool.allocPoint != 0) {
            return (block.number - _lastEmitBlock) * emitPerBlock * pool.allocPoint / totalAllocPoint;
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
        uint256 amount = (block.number - _lastEmitBlock) * emitPerBlock * pool.allocPoint / totalAllocPoint;
        mix.mint(owner(), amount / 10);
        mix.mint(pool.to, amount);
        pool.lastEmitBlock = block.number;
    }

    function massUpdatePools() internal {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; pid += 1) {
            updatePool(pid);
        }
    }

    function add(address to, uint256 allocPoint) external onlyOwner {
        massUpdatePools();
        totalAllocPoint += allocPoint;
        poolInfo.push(PoolInfo({
            to: to,
            allocPoint: allocPoint,
            lastEmitBlock: block.number > startBlock ? block.number : startBlock
        }));
        emit Add(to, allocPoint);
    }

    function set(uint256 pid, uint256 allocPoint) external onlyOwner {
        massUpdatePools();
        totalAllocPoint = totalAllocPoint - poolInfo[pid].allocPoint + allocPoint;
        poolInfo[pid].allocPoint = allocPoint;
        emit Set(pid, allocPoint);
    }
}
