import { Mix, MixEmitter, Booth, KIP7StakingPool, TestLPToken } from "../typechain";
import { mine, mineTo, autoMining, getBlock } from "./utils/blockchain";

import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, BigNumberish, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { constants } = ethers;
const { MaxUint256, Zero } = constants;
const emissionPerBlock = BigNumber.from("1000000");

const setupTest = async () => {
    const signers = await ethers.getSigners();
    const [deployer, alice, bob, carol, dan, poolA] = signers;

    const Mix = await ethers.getContractFactory("Mix");
    const mix = (await Mix.deploy()) as Mix;

    const MixEmitter = await ethers.getContractFactory("MixEmitter");
    const emitter = (await MixEmitter.deploy(mix.address, emissionPerBlock)) as MixEmitter;

    const Booth = await ethers.getContractFactory("Booth");
    const booth = (await Booth.deploy(mix.address)) as Booth;

    await mix.setEmitter(emitter.address);
    await mix.setBooth(booth.address);

    const TestLPTokenFactory = await ethers.getContractFactory("TestLPToken");
    const lpToken = (await TestLPTokenFactory.deploy()) as TestLPToken;

    const KIP7StakingPool = await ethers.getContractFactory("KIP7StakingPool");
    const kip7sp = (await KIP7StakingPool.deploy(emitter.address, 1, lpToken.address)) as KIP7StakingPool;

    {
        await lpToken.approve(kip7sp.address, MaxUint256);
        await lpToken.connect(alice).approve(kip7sp.address, MaxUint256);
        await lpToken.connect(bob).approve(kip7sp.address, MaxUint256);
        await lpToken.connect(carol).approve(kip7sp.address, MaxUint256);
        await lpToken.connect(dan).approve(kip7sp.address, MaxUint256);

        await lpToken.mint(alice.address, 10000);
        await lpToken.mint(bob.address, 10000);
        await lpToken.mint(carol.address, 10000);
        await lpToken.mint(dan.address, 10000);
    }

    await emitter.add(poolA.address, 100);
    await emitter.add(kip7sp.address, 100);

    return {
        deployer,
        alice,
        bob,
        carol,
        dan,
        mix,
        emitter,
        lpToken,
        kip7sp,
        TestLPTokenFactory,
    };
};

describe("KIP7StakingPool", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });

    async function checkShares(kip7sp: KIP7StakingPool, users: SignerWithAddress[], shares: BigNumberish[]) {
        const length = users.length;
        for (let i = 0; i < length; i++) {
            expect(await kip7sp.shares(users[i].address), `fail with ${i}th user`).to.be.equal(shares[i]);
        }
    }

    async function checkClaimable(kip7sp: KIP7StakingPool, users: SignerWithAddress[], amounts: BigNumberish[]) {
        const length = users.length;
        for (let i = 0; i < length; i++) {
            expect(await kip7sp.claimableOf(users[i].address), `fail with ${i}th user`).to.be.closeTo(
                BigNumber.from(amounts[i]),
                10  //due to solidity math
            );
        }
    }

    async function checkMixBalance(mix: Mix, users: SignerWithAddress[], amounts: BigNumberish[]) {
        const length = users.length;
        for (let i = 0; i < length; i++) {
            expect(await mix.balanceOf(users[i].address), `fail with ${i}th user`).to.be.closeTo(
                BigNumber.from(amounts[i]),
                10  //due to solidity math
            );
        }
    }

    it("overall test", async () => {
        const { kip7sp, mix, emitter, alice, bob, carol, dan, lpToken } = await setupTest();

        await mineTo(30);
        await expect(kip7sp.connect(alice).stake(100)).to.emit(kip7sp, "Stake").withArgs(alice.address, 100);

        await mineTo(50);
        await expect(() => kip7sp.connect(bob).stake(100)).to.changeTokenBalance(lpToken, bob, -100);

        await mineTo(70);
        await checkShares(kip7sp, [alice, bob], [100, 100]);
        await checkClaimable(kip7sp, [alice, bob], [0, 0]);
        await checkMixBalance(mix, [alice, bob], [0, 0]);

        await mineTo(100);
        await emitter.start(); //100b
        await checkShares(kip7sp, [alice, bob], [100, 100]);
        await checkClaimable(kip7sp, [alice, bob], [0, 0]);
        await checkMixBalance(mix, [alice, bob], [0, 0]);

        await mine(10);
        let reward = emissionPerBlock.div(2).mul(10).mul(100).div(200);
        await checkShares(kip7sp, [alice, bob], [100, 100]);
        await checkClaimable(kip7sp, [alice, bob], [reward, reward]);
        await checkMixBalance(mix, [alice, bob], [0, 0]);

        await mineTo(120);
        await kip7sp.connect(carol).stake(300);
        let rewardA = emissionPerBlock.div(2).mul(20).mul(100).div(200);
        let rewardB = emissionPerBlock.div(2).mul(20).mul(100).div(200);
        let rewardC = Zero;

        await checkShares(kip7sp, [alice, bob, carol], [100, 100, 300]);
        await checkClaimable(kip7sp, [alice, bob, carol], [rewardA, rewardB, rewardC]);
        await checkMixBalance(mix, [alice, bob, carol], [0, 0, 0]);

        await mineTo(150);
        await kip7sp.connect(alice).stake(1000);
        rewardA = rewardA.add(emissionPerBlock.div(2).mul(30).mul(100).div(500));
        rewardB = rewardB.add(emissionPerBlock.div(2).mul(30).mul(100).div(500));
        rewardC = rewardC.add(emissionPerBlock.div(2).mul(30).mul(300).div(500));

        await checkShares(kip7sp, [alice, bob, carol], [1100, 100, 300]);
        await checkClaimable(kip7sp, [alice, bob, carol], [rewardA, rewardB, rewardC]);
        await checkMixBalance(mix, [alice, bob, carol], [0, 0, 0]);

        await mineTo(170);
        await kip7sp.connect(dan).claim();
        rewardA = rewardA.add(emissionPerBlock.div(2).mul(20).mul(1100).div(1500));
        rewardB = rewardB.add(emissionPerBlock.div(2).mul(20).mul(100).div(1500));
        rewardC = rewardC.add(emissionPerBlock.div(2).mul(20).mul(300).div(1500));

        await checkShares(kip7sp, [alice, bob, carol], [1100, 100, 300]);
        await checkClaimable(kip7sp, [alice, bob, carol], [rewardA, rewardB, rewardC]);
        await checkMixBalance(mix, [alice, bob, carol], [0, 0, 0]);

        await mineTo(199);
        await expect(kip7sp.connect(carol).unstake(1300)).to.be.reverted;
        await expect(() => kip7sp.connect(carol).unstake(300)).to.changeTokenBalance(lpToken, carol, 300);

        rewardA = rewardA.add(emissionPerBlock.div(2).mul(30).mul(1100).div(1500));
        rewardB = rewardB.add(emissionPerBlock.div(2).mul(30).mul(100).div(1500));
        rewardC = rewardC.add(emissionPerBlock.div(2).mul(30).mul(300).div(1500));

        await checkShares(kip7sp, [alice, bob, carol], [1100, 100, 0]);
        await checkClaimable(kip7sp, [alice, bob, carol], [rewardA, rewardB, rewardC]);
        await checkMixBalance(mix, [alice, bob, carol], [0, 0, 0]);

        await mineTo(210);
        rewardA = rewardA.add(emissionPerBlock.div(2).mul(10).mul(1100).div(1200));
        rewardB = rewardB.add(emissionPerBlock.div(2).mul(10).mul(100).div(1200));
        await expect(() => kip7sp.connect(alice).claim()).to.changeTokenBalance(mix, alice, rewardA);

        let claimA = rewardA;
        rewardA = Zero;

        await checkShares(kip7sp, [alice, bob, carol], [1100, 100, 0]);
        await checkClaimable(kip7sp, [alice, bob, carol], [rewardA, rewardB, rewardC]);
        await checkMixBalance(mix, [alice, bob, carol], [claimA, 0, 0]);

        autoMining(false);

        await mineTo(220);
        rewardA = rewardA.add(emissionPerBlock.div(2).mul(10).mul(1100).div(1200));
        rewardB = rewardB.add(emissionPerBlock.div(2).mul(10).mul(100).div(1200));
        await mine();
        await checkShares(kip7sp, [alice, bob, carol], [1100, 100, 0]);
        await checkClaimable(kip7sp, [alice, bob, carol], [rewardA, rewardB, rewardC]);
        await checkMixBalance(mix, [alice, bob, carol], [claimA, 0, 0]);

        await mineTo(230);
        rewardA = rewardA.add(emissionPerBlock.div(2).mul(10).mul(1100).div(1200));
        rewardB = rewardB.add(emissionPerBlock.div(2).mul(10).mul(100).div(1200));
        await kip7sp.connect(alice).claim();
        await kip7sp.connect(carol).claim();
        await mine();

        claimA = claimA.add(rewardA);
        rewardA = Zero;
        let claimC = rewardC;
        rewardC = Zero;
        await checkShares(kip7sp, [alice, bob, carol], [1100, 100, 0]);
        await checkClaimable(kip7sp, [alice, bob, carol], [rewardA, rewardB, rewardC]);
        await checkMixBalance(mix, [alice, bob, carol], [claimA, 0, claimC]);

        rewardA = rewardA.add(emissionPerBlock.div(2).mul(1).mul(1100).div(1200));
        rewardB = rewardB.add(emissionPerBlock.div(2).mul(1).mul(100).div(1200));
        await kip7sp.connect(alice).stake(100);
        await kip7sp.connect(alice).unstake(100);
        await mine();
        await checkShares(kip7sp, [alice, bob, carol], [1100, 100, 0]);
        await checkClaimable(kip7sp, [alice, bob, carol], [rewardA, rewardB, rewardC]);
        await checkMixBalance(mix, [alice, bob, carol], [claimA, 0, claimC]);

        rewardA = rewardA.add(emissionPerBlock.div(2).mul(1).mul(1100).div(1200));
        rewardB = rewardB.add(emissionPerBlock.div(2).mul(1).mul(100).div(1200));
        await kip7sp.connect(carol).claim();
        await mine();
        await checkShares(kip7sp, [alice, bob, carol], [1100, 100, 0]);
        await checkClaimable(kip7sp, [alice, bob, carol], [rewardA, rewardB, rewardC]);
        await checkMixBalance(mix, [alice, bob, carol], [claimA, 0, claimC]);

        rewardA = rewardA.add(emissionPerBlock.div(2).mul(1).mul(1100).div(1200));
        rewardB = rewardB.add(emissionPerBlock.div(2).mul(1).mul(100).div(1200));
        await kip7sp.connect(alice).stake(100);
        await kip7sp.connect(bob).unstake(100);
        await mine();
        await checkShares(kip7sp, [alice, bob, carol], [1200, 0, 0]);
        await checkClaimable(kip7sp, [alice, bob, carol], [rewardA, rewardB, rewardC]);
        await checkMixBalance(mix, [alice, bob, carol], [claimA, 0, claimC]);

        rewardA = rewardA.add(emissionPerBlock.div(2).mul(1).mul(1200).div(1200));
        await kip7sp.connect(alice).unstake(400);
        await kip7sp.connect(bob).stake(100);
        await kip7sp.connect(carol).stake(100);
        await mine();
        await checkShares(kip7sp, [alice, bob, carol], [800, 100, 100]);
        await checkClaimable(kip7sp, [alice, bob, carol], [rewardA, rewardB, rewardC]);
        await checkMixBalance(mix, [alice, bob, carol], [claimA, 0, claimC]);

        rewardA = rewardA.add(emissionPerBlock.div(2).mul(1).mul(800).div(1000));
        rewardB = rewardB.add(emissionPerBlock.div(2).mul(1).mul(100).div(1000));
        rewardC = rewardC.add(emissionPerBlock.div(2).mul(1).mul(100).div(1000));
        await kip7sp.connect(alice).claim();
        await kip7sp.connect(bob).claim();
        await kip7sp.connect(carol).claim();
        await mine();
        claimA = claimA.add(rewardA);
        let claimB = rewardB;
        claimC = claimC.add(rewardC);

        rewardA = Zero;
        rewardB = Zero;
        rewardC = Zero;
        await checkShares(kip7sp, [alice, bob, carol], [800, 100, 100]);
        await checkClaimable(kip7sp, [alice, bob, carol], [rewardA, rewardB, rewardC]);
        await checkMixBalance(mix, [alice, bob, carol], [claimA, claimB, claimC]);

        rewardA = rewardA.add(emissionPerBlock.div(2).mul(1).mul(800).div(1000));
        rewardB = rewardB.add(emissionPerBlock.div(2).mul(1).mul(100).div(1000));
        rewardC = rewardC.add(emissionPerBlock.div(2).mul(1).mul(100).div(1000));
        await emitter.set(1, 0);
        await expect(() => mine()).to.changeTokenBalance(mix, kip7sp, emissionPerBlock.div(2));
        await checkShares(kip7sp, [alice, bob, carol], [800, 100, 100]);
        await checkClaimable(kip7sp, [alice, bob, carol], [rewardA, rewardB, rewardC]);
        await checkMixBalance(mix, [alice, bob, carol], [claimA, claimB, claimC]);

        expect((await emitter.poolInfo(1)).allocPoint).to.be.equal(0);
        await expect(() => mine()).to.changeTokenBalance(mix, kip7sp, 0);
        await checkShares(kip7sp, [alice, bob, carol], [800, 100, 100]);
        await checkClaimable(kip7sp, [alice, bob, carol], [rewardA, rewardB, rewardC]);
        await checkMixBalance(mix, [alice, bob, carol], [claimA, claimB, claimC]);
    });
});
