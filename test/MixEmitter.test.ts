import { Mix, MixEmitter, BurnPool } from "../typechain";

import { ethers } from "hardhat";
import { expect } from "chai";

const { BigNumber, constants } = ethers;
const { MaxUint256 } = constants;

import { mine, mineTo, autoMining, getBlock } from "./utils/blockchain";
const emissionPerBlock = BigNumber.from("10000");

const setupTest = async () => {
    const signers = await ethers.getSigners();
    const [deployer, alice, bob, carol, poolA, poolB, poolC] = signers;

    const Mix = await ethers.getContractFactory("Mix");
    const mix = (await Mix.deploy()) as Mix;

    const MixEmitter = await ethers.getContractFactory("MixEmitter");
    const emitter = (await MixEmitter.deploy(mix.address, emissionPerBlock)) as MixEmitter;

    await mix.setEmitter(emitter.address);

    return {
        deployer,
        alice,
        bob,
        carol,
        poolA,
        poolB,
        poolC,
        mix,
        emitter,
    };
};

describe("MixEmitter", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });

    it("should be that add / set functions work well", async () => {
        const { alice, poolA, poolB, poolC, emitter } = await setupTest();

        expect(await emitter.poolCount()).to.be.equal(0);
        expect(await emitter.totalAllocPoint()).to.be.equal(0);

        await expect(emitter.add(poolA.address, 500)).to.be.emit(emitter, "Add").withArgs(poolA.address, 500);
        await expect(emitter.add(poolB.address, 300)).to.be.emit(emitter, "Add").withArgs(poolB.address, 300);
        await expect(emitter.add(poolC.address, 200)).to.be.emit(emitter, "Add").withArgs(poolC.address, 200);

        expect(await emitter.poolCount()).to.be.equal(3);
        expect(await emitter.totalAllocPoint()).to.be.equal(1000);

        await expect(emitter.set(0, 1500)).to.be.emit(emitter, "Set").withArgs(0, 1500);
        expect(await emitter.poolCount()).to.be.equal(3);
        expect(await emitter.totalAllocPoint()).to.be.equal(2000);

        await expect(emitter.connect(alice).add(poolA.address, 500)).to.be.revertedWith(
            "Ownable: caller is not the owner"
        );
        await expect(emitter.connect(alice).set(0, 500)).to.be.revertedWith("Ownable: caller is not the owner");

        const pool0 = await emitter.poolInfo(0);
        expect(pool0.to).to.be.equal(poolA.address);
        expect(pool0.allocPoint).to.be.equal(1500);
        expect(pool0.lastEmitBlock).to.be.equal(MaxUint256);

        const pool1 = await emitter.poolInfo(1);
        expect(pool1.to).to.be.equal(poolB.address);
        expect(pool1.allocPoint).to.be.equal(300);
        expect(pool1.lastEmitBlock).to.be.equal(MaxUint256);

        const pool2 = await emitter.poolInfo(2);
        expect(pool2.to).to.be.equal(poolC.address);
        expect(pool2.allocPoint).to.be.equal(200);
        expect(pool2.lastEmitBlock).to.be.equal(MaxUint256);
    });

    it("should be that when starting all pids' lastEmitBlock is changed to current block number", async () => {
        const { alice, poolA, poolB, poolC, emitter } = await setupTest();

        await emitter.add(poolA.address, 500);
        await emitter.add(poolB.address, 300);

        expect((await emitter.poolInfo(0)).lastEmitBlock).to.be.equal(MaxUint256);
        expect((await emitter.poolInfo(1)).lastEmitBlock).to.be.equal(MaxUint256);

        expect(await emitter.started()).to.be.false;

        await expect(emitter.connect(alice).start()).to.be.reverted;
        await emitter.start();

        const blockNumber = await getBlock();
        expect((await emitter.poolInfo(0)).lastEmitBlock).to.be.equal(blockNumber);
        expect((await emitter.poolInfo(1)).lastEmitBlock).to.be.equal(blockNumber);

        expect(await emitter.started()).to.be.true;
        await expect(emitter.start()).to.be.reverted;

        await emitter.add(poolC.address, 200);
        expect((await emitter.poolInfo(2)).lastEmitBlock).to.be.equal(await getBlock());
    });

    it("should be that pendingMix function returns value as correctly as possible", async () => {
        const { alice, poolA, poolB, poolC, mix, emitter } = await setupTest();

        await emitter.add(poolA.address, 500);
        await emitter.add(poolB.address, 300);

        await mineTo(100);
        expect(await emitter.pendingMix(0)).to.be.equal(0);
        expect(await emitter.pendingMix(1)).to.be.equal(0);

        await emitter.start(); //100

        await mine(10); //110
        let reward0 = emissionPerBlock.mul(10).mul(500).div(800);
        let reward1 = emissionPerBlock.mul(10).mul(300).div(800);
        expect(await emitter.pendingMix(0)).to.be.equal(reward0);
        expect(await emitter.pendingMix(1)).to.be.equal(reward1);

        await emitter.add(poolC.address, 200); //111
        await mine(9); //120
        let reward2 = emissionPerBlock.mul(9).mul(200).div(1000);
        expect(await emitter.pendingMix(2)).to.be.equal(reward2);

        const BurnPool = await ethers.getContractFactory("BurnPool");
        const burnPool = (await BurnPool.deploy(emitter.address, 3)) as BurnPool;
        await mix.setBooth(alice.address);

        await emitter.add(burnPool.address, 500); //121
        await mine(9); //130
        let reward3 = emissionPerBlock.mul(9).mul(500).div(1500);
        expect(await emitter.pendingMix(3)).to.be.equal(reward3);

        await burnPool.burn(); //131
        expect(await emitter.pendingMix(3)).to.be.equal(0);
        await mine(10); //141
        reward3 = emissionPerBlock.mul(10).mul(500).div(1500);
        expect(await emitter.pendingMix(3)).to.be.equal(reward3);
    });

    it("should be that update function works well", async () => {
        const { alice, poolA, poolB, poolC, mix, emitter } = await setupTest();

        await emitter.add(poolA.address, 500);
        await emitter.add(poolB.address, 300);

        await mineTo(90);
        await expect(() => emitter.updatePool(0)).to.changeTokenBalance(mix, poolA, 0);
        await expect(() => emitter.updatePool(1)).to.changeTokenBalance(mix, poolB, 0);
        
        await mineTo(100);
        await emitter.start(); //100

        await autoMining(false);
        await mineTo(110);
        await emitter.updatePool(0);
        await emitter.updatePool(1);
        let reward0 = emissionPerBlock.mul(10).mul(500).div(800);
        let reward1 = emissionPerBlock.mul(10).mul(300).div(800);
        await expect(() => mine()).to.changeTokenBalances(mix, [poolA, poolB], [reward0, reward1]); //110

        expect((await emitter.poolInfo(0)).lastEmitBlock).to.be.equal(110);
        expect((await emitter.poolInfo(1)).lastEmitBlock).to.be.equal(110);

        await emitter.updatePool(0);
        await emitter.updatePool(0);
        await expect(() => mine()).to.changeTokenBalances(mix, [poolA], [emissionPerBlock.mul(500).div(800)]); //111
        expect((await emitter.poolInfo(0)).lastEmitBlock).to.be.equal(111);

        await emitter.set(1, 0);
        await mine(10); //121

        await emitter.updatePool(1);
        await expect(() => mine()).to.changeTokenBalances(mix, [poolB], [0]);   //122
        expect((await emitter.poolInfo(1)).lastEmitBlock).to.be.equal(122);
    });

    it("should be that setEmissionPerBlock function work properly", async () => {
        const { alice, poolA, poolB, mix, emitter } = await setupTest();

        await emitter.add(poolA.address, 500);
        await emitter.add(poolB.address, 300);

        await mineTo(90);
        await expect(() => emitter.updatePool(0)).to.changeTokenBalance(mix, poolA, 0);
        await expect(() => emitter.updatePool(1)).to.changeTokenBalance(mix, poolB, 0);
        
        await expect(emitter.connect(alice).setEmissionPerBlock(emissionPerBlock.mul(2))).to.be.reverted;

        await mineTo(100);
        await emitter.start(); //100

        await autoMining(false);
        await mineTo(110);
        await emitter.updatePool(0);
        await emitter.updatePool(1);
        let reward0 = emissionPerBlock.mul(10).mul(500).div(800);
        let reward1 = emissionPerBlock.mul(10).mul(300).div(800);
        await expect(() => mine()).to.changeTokenBalances(mix, [poolA, poolB], [reward0, reward1]); //110

        expect((await emitter.poolInfo(0)).lastEmitBlock).to.be.equal(110);
        expect((await emitter.poolInfo(1)).lastEmitBlock).to.be.equal(110);
        
        expect(await mix.balanceOf(poolA.address)).to.be.equal(reward0);
        expect(await mix.balanceOf(poolB.address)).to.be.equal(reward1);

        await mineTo(115);
        await emitter.setEmissionPerBlock(emissionPerBlock.mul(2));
        await mine();
        
        expect((await emitter.poolInfo(0)).lastEmitBlock).to.be.equal(115);
        expect((await emitter.poolInfo(1)).lastEmitBlock).to.be.equal(115);

        reward0 = reward0.add(reward0.div(2));
        reward1 = reward1.add(reward1.div(2));

        expect(await mix.balanceOf(poolA.address)).to.be.equal(reward0);
        expect(await mix.balanceOf(poolB.address)).to.be.equal(reward1);

        autoMining(true);
        await mineTo(120);
        await emitter.updatePool(0);

        expect((await emitter.poolInfo(0)).lastEmitBlock).to.be.equal(120);
        expect((await emitter.poolInfo(1)).lastEmitBlock).to.be.equal(115);

        reward0 = reward0.add(emissionPerBlock.mul(2).mul(5).mul(500).div(800));

        expect(await mix.balanceOf(poolA.address)).to.be.equal(reward0);
        expect(await mix.balanceOf(poolB.address)).to.be.equal(reward1);

        await mineTo(130);
        await emitter.updatePool(1);
        await mine();

        expect((await emitter.poolInfo(0)).lastEmitBlock).to.be.equal(120);
        expect((await emitter.poolInfo(1)).lastEmitBlock).to.be.equal(130);

        reward1 = reward1.add(emissionPerBlock.mul(2).mul(15).mul(300).div(800));

        expect(await mix.balanceOf(poolA.address)).to.be.equal(reward0);
        expect(await mix.balanceOf(poolB.address)).to.be.equal(reward1);
    });
});
