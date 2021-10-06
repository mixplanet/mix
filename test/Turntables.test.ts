import { Mix, MixEmitter, Booth, Turntables } from "../typechain";
import { mine, mineTo, autoMining, getBlock } from "./utils/blockchain";

import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, BigNumberish, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { constants } = ethers;
const { MaxUint256, Zero, AddressZero } = constants;
const emissionPerBlock = BigNumber.from("1000000");
const initialBalance = BigNumber.from("1000000");

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

    await emitter.start();

    const Turntables = await ethers.getContractFactory("Turntables");
    const turntables = (await Turntables.deploy(emitter.address, 1)) as Turntables;

    {
        await mix.transfer(alice.address, initialBalance);
        await mix.transfer(bob.address, initialBalance);

        await mix.connect(alice).approve(turntables.address, MaxUint256);
        await mix.connect(bob).approve(turntables.address, MaxUint256);
        await mix.connect(carol).approve(turntables.address, MaxUint256);
        await mix.connect(dan).approve(turntables.address, MaxUint256);
    }

    await emitter.add(poolA.address, 100);
    await emitter.add(turntables.address, 100);

    return {
        deployer,
        alice,
        bob,
        carol,
        dan,
        mix,
        emitter,
        turntables,
        booth,
    };
};

describe("Turntables", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });

    async function checkClaimable(turntables: Turntables, ids: number[], amounts: BigNumberish[]) {
        const length = ids.length;
        for (let i = 0; i < length; i++) {
            expect(await turntables.claimableOf(ids[i]), `fail with ${i}th id`).to.be.closeTo(
                BigNumber.from(amounts[i]),
                10 //due to solidity math
            );
        }
    }

    async function checkMixBalance(mix: Mix, users: SignerWithAddress[], amounts: BigNumberish[]) {
        const length = users.length;
        for (let i = 0; i < length; i++) {
            expect(await mix.balanceOf(users[i].address), `fail with ${i}th user`).to.be.closeTo(
                BigNumber.from(amounts[i]),
                10 //due to solidity math
            );
        }
    }

    it("should be that functions related with a type work properly", async () => {
        const { turntables, alice } = await setupTest();

        await expect(turntables.connect(alice).addType(100, 50, 10, 300)).to.be.reverted;
        await expect(turntables.addType(100, 150, 10, 300)).to.be.reverted;
        expect(await turntables.typeCount()).to.be.equal(0);
        await expect(turntables.addType(100, 50, 10, 300)).to.emit(turntables, "AddType").withArgs(100, 50, 10, 300);
        expect(await turntables.typeCount()).to.be.equal(1);

        await expect(turntables.connect(alice).allowType(0)).to.be.reverted;
        await expect(turntables.connect(alice).denyType(0)).to.be.reverted;

        expect(await turntables.typeWhitelist(0)).to.be.false;
        await expect(turntables.allowType(0)).to.emit(turntables, "AllowType").withArgs(0);
        expect(await turntables.typeWhitelist(0)).to.be.true;
        await expect(turntables.denyType(0)).to.emit(turntables, "DenyType").withArgs(0);
        expect(await turntables.typeWhitelist(0)).to.be.false;

        await expect(turntables.connect(alice).buy(0)).to.be.reverted;
        await turntables.allowType(0);
        await expect(turntables.connect(alice).buy(0)).to.emit(turntables, "Buy").withArgs(alice.address, 0);
        expect(await turntables.turntableLength()).to.be.equal(1);
    });

    it("should be that buy, destroy, charge functions work properly", async () => {
        const { turntables, alice, bob } = await setupTest();

        await turntables.addType(1000, 500, 10, 300);
        await turntables.addType(2000, 1000, 20, 600);
        await turntables.allowType(0);
        await turntables.allowType(1);

        expect(await turntables.turntableLength()).to.be.equal(0);
        await expect(turntables.connect(alice).buy(0)).to.emit(turntables, "Buy").withArgs(alice.address, 0);
        let end0 = (await getBlock()) + 300;
        expect(await turntables.turntableLength()).to.be.equal(1);
        await turntables.connect(alice).buy(0);
        let end1 = (await getBlock()) + 300;

        await turntables.connect(bob).buy(0);
        let end2 = (await getBlock()) + 300;
        await turntables.connect(bob).buy(1);
        let end3 = (await getBlock()) + 600;
        expect(await turntables.turntableLength()).to.be.equal(4);

        /**
         * 0-0-alice
         * 1-0-alice
         * 2-0-bob
         * 3-1-bob
         */

        {
            expect(await turntables.ownerOf(0)).to.be.equal(alice.address);
            expect(await turntables.ownerOf(1)).to.be.equal(alice.address);
            expect(await turntables.ownerOf(2)).to.be.equal(bob.address);
            expect(await turntables.ownerOf(3)).to.be.equal(bob.address);
        }
        {
            expect(await turntables.exists(0)).to.be.true;
            expect(await turntables.exists(1)).to.be.true;
            expect(await turntables.exists(2)).to.be.true;
            expect(await turntables.exists(3)).to.be.true;
        }
        {
            expect((await turntables.turntables(0)).endBlock).to.be.equal(end0);
            expect((await turntables.turntables(1)).endBlock).to.be.equal(end1);
            expect((await turntables.turntables(2)).endBlock).to.be.equal(end2);
            expect((await turntables.turntables(3)).endBlock).to.be.equal(end3);
        }

        await expect(turntables.connect(alice).destroy(2)).to.be.reverted;
        await expect(turntables.connect(alice).destroy(0)).to.emit(turntables, "Destroy").withArgs(alice.address, 0);

        expect(await turntables.ownerOf(0)).to.be.equal(AddressZero);
        expect(await turntables.exists(0)).to.be.false;
        expect((await turntables.turntables(0)).endBlock).to.be.equal(Zero);
        expect(await turntables.turntableLength()).to.be.equal(4);

        await expect(turntables.connect(alice).charge(0, 3000)).to.be.reverted;
        await expect(turntables.connect(alice).charge(2, 3000)).to.be.reverted;

        expect((await turntables.turntables(1)).endBlock).to.be.equal(end1);
        let amount = 3000;
        await expect(turntables.connect(alice).charge(1, amount))
            .to.emit(turntables, "Charge")
            .withArgs(alice.address, 1, amount);
        const price0 = 1000;
        const lifetime0 = 300;
        end1 += Math.floor(((amount * lifetime0) / price0) * 2);
        expect((await turntables.turntables(1)).endBlock).to.be.equal(end1);

        amount = 7890;
        await expect(turntables.connect(alice).charge(1, amount))
            .to.emit(turntables, "Charge")
            .withArgs(alice.address, 1, amount);
        end1 += Math.floor(((amount * lifetime0) / price0) * 2);
        expect((await turntables.turntables(1)).endBlock).to.be.equal(end1);

        amount = 23050;
        await expect(turntables.connect(bob).charge(3, amount))
            .to.emit(turntables, "Charge")
            .withArgs(bob.address, 3, amount);
        const price1 = 2000;
        const lifetime1 = 600;
        end3 += Math.floor(((amount * lifetime1) / price1) * 2);
        expect((await turntables.turntables(3)).endBlock).to.be.equal(end3);

        // console.log(end1, end2, end3);   //   end1 : 6855, end2 : 322, end3 : 14453
        await mineTo(500);
        expect((await turntables.turntables(2)).endBlock).to.be.lt(await getBlock());
        amount = 2340;
        await expect(turntables.connect(bob).charge(2, amount))
            .to.emit(turntables, "Charge")
            .withArgs(bob.address, 2, amount);
        let end2_wrong = end2 + ((amount * lifetime0) / price0) * 2;
        expect((await turntables.turntables(2)).endBlock).to.be.not.equal(end2_wrong);
        end2 = 500 + ((amount * lifetime0) / price0) * 2;
        expect((await turntables.turntables(2)).endBlock).to.be.equal(end2);

        // console.log(end1, end2, end3);   //   end1 : 6855, end2 : 1904, end3 : 14453
        await mineTo(2000);
        expect((await turntables.turntables(2)).endBlock).to.be.lt(await getBlock());
        await turntables.connect(bob).destroy(2);

        expect(await turntables.ownerOf(2)).to.be.equal(AddressZero);
        expect(await turntables.exists(2)).to.be.false;
        expect((await turntables.turntables(2)).endBlock).to.be.equal(Zero);
        expect(await turntables.claimableOf(2)).to.be.equal(Zero);
    });

    it.only("should be that functions related with a claim work properly", async () => {
        const { mix, emitter, turntables, booth, alice, bob } = await setupTest();

        await turntables.addType(1000, 500, 10, 300);
        await turntables.addType(2000, 1000, 20, 600);
        await turntables.allowType(0);
        await turntables.allowType(1);

        await turntables.connect(alice).buy(0);
        let end0 = (await getBlock()) + 300;
        await turntables.connect(alice).buy(0);
        let end1 = (await getBlock()) + 300;

        await turntables.connect(bob).buy(0);
        let end2 = (await getBlock()) + 300;
        await turntables.connect(bob).buy(1);
        let end3 = (await getBlock()) + 600;

        // 0-0-alice
        // 1-0-alice
        // 2-0-bob
        // 3-1-bob

        let blockReward0 = emissionPerBlock.div(2).mul(10);
        let blockReward1 = emissionPerBlock.div(2).mul(10);
        let blockReward2 = emissionPerBlock.div(2).mul(10);
        let blockReward3 = emissionPerBlock.div(2).mul(20);
        let totalVolume = 50;

        autoMining(false);
        await mineTo(100);
        await turntables.connect(alice).claim([0, 1]);
        await turntables.connect(bob).claim([2, 3]);
        await mine();

        await mineTo(200);
        await turntables.connect(alice).claim([0, 1]);
        let rewardA = blockReward0.add(blockReward1).mul(100).div(totalVolume);
        await expect(() => mine()).to.changeTokenBalances(mix, [alice], [rewardA]);

        await mineTo(210);
        await turntables.connect(alice).claim([0]);
        await turntables.connect(alice).claim([1]);
        rewardA = blockReward0.add(blockReward1).mul(10).div(totalVolume);
        await expect(() => mine()).to.changeTokenBalances(mix, [alice], [rewardA]);

        await mineTo(220);
        await turntables.connect(alice).claim([0]);
        rewardA = blockReward0.mul(10).div(totalVolume);
        await expect(() => mine()).to.changeTokenBalances(mix, [alice], [rewardA]);

        await mineTo(230);
        await turntables.connect(alice).claim([0]);
        await turntables.connect(bob).claim([3]);
        rewardA = blockReward0.mul(10).div(totalVolume);
        let rewardB = blockReward3.mul(230 - 100).div(totalVolume);
        await expect(() => mine()).to.changeTokenBalances(mix, [alice, bob], [rewardA, rewardB]);

        await mineTo(240);
        await turntables.connect(bob).claim([3]);
        await turntables.connect(alice).claim([1]);
        await turntables.connect(bob).claim([2]);
        await turntables.connect(alice).claim([0]);
        rewardA = blockReward0.mul(10).add(blockReward1.mul(30)).div(totalVolume);
        rewardB = blockReward3
            .mul(10)
            .add(blockReward2.mul(240 - 100))
            .div(totalVolume);
        await expect(() => mine()).to.changeTokenBalances(mix, [alice, bob], [rewardA, rewardB]);

        await mineTo(250);
        await turntables.connect(bob).buy(1);
        let end4 = 250 + 600;
        await turntables.connect(alice).claim([0]);
        rewardA = blockReward0.mul(10).div(totalVolume);
        await expect(() => mine()).to.changeTokenBalances(mix, [alice], [rewardA]);

        let oldTotalVolume = totalVolume;

        let blockReward4 = emissionPerBlock.div(2).mul(20);
        totalVolume = 70;

        await mineTo(260);
        await turntables.connect(alice).claim([1]);
        await turntables.connect(bob).claim([3]);
        rewardA = blockReward1.mul(10).div(oldTotalVolume).add(blockReward1.mul(10).div(totalVolume));
        rewardB = blockReward3.mul(10).div(oldTotalVolume).add(blockReward3.mul(10).div(totalVolume));
        await expect(() => mine()).to.changeTokenBalances(mix, [alice, bob], [rewardA.add(1), rewardB]); //solidity math

        await mineTo(270);
        // console.log(end0, end1, end2, end3, end4);  //320,321,322,623,849
        await turntables.connect(alice).charge(1, 1234);
        end1 += Math.floor(((1234 * 300) / 1000) * 2);
        rewardA = blockReward1.mul(10).div(totalVolume);
        await expect(() => mine()).to.changeTokenBalances(mix, [alice], [rewardA.sub(1234).add(1)]); //solidity math
        let boothBal = BigNumber.from(1234).mul(3).div(1000);
        expect(await mix.balanceOf(booth.address)).to.be.closeTo(boothBal, 10);

        await mineTo(280);
        await turntables.connect(alice).charge(0, 70);
        await turntables.connect(alice).charge(1, 80);
        await turntables.connect(bob).charge(2, 90);
        rewardA = blockReward0.mul(30).add(blockReward1.mul(10)).div(totalVolume);
        rewardB = blockReward2.mul(10).div(oldTotalVolume).add(blockReward2.mul(30).div(totalVolume));
        let diffA = rewardA.sub(70 + 80);
        let diffB = rewardB.sub(90);
        end0 += Math.floor(((70 * 300) / 1000) * 2);
        end1 += Math.floor(((80 * 300) / 1000) * 2);
        end2 += Math.floor(((90 * 300) / 1000) * 2);

        await expect(() => mine()).to.changeTokenBalances(mix, [alice, bob], [diffA, diffB]);
        boothBal = boothBal.add(0);
        expect(await mix.balanceOf(booth.address)).to.be.closeTo(boothBal, 10);
        // console.log(end0, end1, end2, end3, end4); //362,1109,376,623,849

        await mineTo(360);
        await turntables.connect(alice).destroy(1);
        await turntables.connect(bob).destroy(4);
        rewardA = blockReward1.mul(80).div(totalVolume);
        rewardB = blockReward4.mul(110).div(totalVolume);
        diffA = rewardA.add(500).add(1); //smath
        diffB = rewardB.add(1000);
        await expect(() => mine()).to.changeTokenBalances(mix, [alice, bob], [diffA, diffB]);
        boothBal = boothBal.add(BigNumber.from(500+1000).mul(3).div(1000));
        expect(await mix.balanceOf(booth.address)).to.be.closeTo(boothBal, 10);
        // console.log(end0, end1, end2, end3, end4); //362,-,376,623,-

        oldTotalVolume = totalVolume;
        totalVolume = 40;
        //lastClaimed 280

        await mineTo(365);
        await turntables.connect(alice).claim([0]);
        await turntables.connect(bob).destroy(2);
        rewardA = blockReward0.mul(80).div(oldTotalVolume).add(blockReward0.mul(5).div(totalVolume));
        rewardB = blockReward2.mul(80).div(oldTotalVolume).add(blockReward2.mul(5).div(totalVolume));
        let realA = rewardA.mul(82).div(85);
        let burnA = rewardA.sub(realA);

        diffA = realA.add(1);
        diffB = rewardB.add(500).add(1);
        await expect(() => mine()).to.changeTokenBalances(mix, [alice, bob], [diffA, diffB]);
        boothBal = boothBal.add(burnA.mul(3).div(1000)).add(BigNumber.from(500).mul(3).div(1000));
        expect(await mix.balanceOf(booth.address)).to.be.closeTo(boothBal, 10);
        // console.log(end0, end1, end2, end3, end4); //362,-,-,623,-
        oldTotalVolume = totalVolume;
        totalVolume = 30;

        await mineTo(370);
        await turntables.connect(alice).claim([0]);
        rewardA = blockReward0.mul(5).div(totalVolume);
        realA = Zero;
        burnA = rewardA.sub(realA);
        diffA = realA;
        await expect(() => mine()).to.changeTokenBalances(mix, [alice], [diffA]);
        boothBal = boothBal.add(burnA.mul(3).div(1000));
        expect(await mix.balanceOf(booth.address)).to.be.closeTo(boothBal, 10);

    });

    // it("overall test", async () => {
    //     const { turntables, mix, emitter, alice, bob, carol, dan, deployer, booth } = await setupTest();

    //     const blockRewardPerNFT = emissionPerBlock.div(2).div(100);

    //     await mineTo(30);
    //     await nft.mint(dan.address, 100);
    //     expect(await nft.totalSupply()).to.be.equal(101);

    //     await mineTo(70);
    //     await checkClaimable(kip17d, [0, 1, 2, 3, 4, 5], [0, 0, 0, 0, 0, 0]);
    //     await checkMixBalance(mix, [alice, bob, carol, dan], [initialBalance, initialBalance, 0, 0]);

    //     await mineTo(100);
    //     await emitter.start(); //100b
    //     await checkClaimable(kip17d, [0, 1, 2, 3, 4, 5], [0, 0, 0, 0, 0, 0]);
    //     await checkMixBalance(mix, [alice, bob, carol, dan], [initialBalance, initialBalance, 0, 0]);

    //     await mine(10);
    //     const rewardEach = async () => {
    //         return blockRewardPerNFT.mul((await getBlock()) - 100);
    //     };

    //     let reward = await rewardEach();
    //     await checkClaimable(kip17d, [0, 1, 2, 3, 4, 5], [reward, reward, reward, reward, reward, reward]);
    //     await checkMixBalance(mix, [alice, bob, carol, dan], [initialBalance, initialBalance, 0, 0]);

    //     await mix.transfer(dan.address, initialBalance);
    //     await expect(kip17d.claimableOf(100)).to.be.reverted;
    //     await expect(kip17d.connect(dan).claim([100])).to.be.reverted;
    //     await expect(kip17d.connect(alice).claim([3])).to.be.reverted;
    //     await expect(kip17d.connect(alice).claim([2, 3])).to.be.reverted;
    //     await expect(kip17d.connect(carol).claim([3])).to.be.reverted;
    //     await mix.connect(dan).transfer(deployer.address, initialBalance);

    //     let claimed0 = Zero;
    //     let claimed1 = Zero;
    //     let claimed2 = Zero;
    //     let claimed3 = Zero;
    //     let claimed4 = Zero;
    //     let claimed5 = Zero;
    //     const getTotalClaim = async () => {
    //         return claimed0.add(claimed1).add(claimed2).add(claimed3).add(claimed4).add(claimed5);
    //     };
    //     const getAliceClaim = async () => {
    //         return claimed0.add(claimed1).add(claimed2);
    //     };
    //     const getBobClaim = async () => {
    //         return claimed3.add(claimed4);
    //     };
    //     const getCarolClaim = async () => {
    //         return claimed5;
    //     };

    //     await mineTo(120);
    //     await kip17d.connect(alice).claim([0]);
    //     reward = await rewardEach();
    //     claimed0 = reward;
    //     let totalClaimed = await getTotalClaim();
    //     let claimA = initialBalance.add((await getAliceClaim()).mul(9).div(10));
    //     await checkClaimable(
    //         kip17d,
    //         [0, 1, 2, 3, 4, 5],
    //         [
    //             reward.sub(claimed0),
    //             reward.sub(claimed1),
    //             reward.sub(claimed2),
    //             reward.sub(claimed3),
    //             reward.sub(claimed4),
    //             reward.sub(claimed5),
    //         ]
    //     );
    //     await checkMixBalance(mix, [alice, bob, carol, dan], [claimA, initialBalance, 0, 0]);
    //     expect(await mix.balanceOf(booth.address)).to.be.equal(totalClaimed.div(10).mul(3).div(1000));

    //     await mineTo(150);
    //     await kip17d.connect(alice).claim([0, 1]);
    //     reward = await rewardEach();
    //     claimed0 = reward;
    //     claimed1 = reward;
    //     totalClaimed = claimed0.add(claimed1);
    //     claimA = initialBalance.add((await getAliceClaim()).mul(9).div(10));
    //     await checkClaimable(
    //         kip17d,
    //         [0, 1, 2, 3, 4, 5],
    //         [
    //             reward.sub(claimed0),
    //             reward.sub(claimed1),
    //             reward.sub(claimed2),
    //             reward.sub(claimed3),
    //             reward.sub(claimed4),
    //             reward.sub(claimed5),
    //         ]
    //     );
    //     await checkMixBalance(mix, [alice, bob, carol, dan], [claimA, initialBalance, 0, 0]);
    //     expect(await mix.balanceOf(booth.address)).to.be.equal(totalClaimed.div(10).mul(3).div(1000));

    //     await mineTo(170);
    //     await kip17d.connect(bob).claim([3]);
    //     reward = await rewardEach();
    //     claimed3 = reward;
    //     totalClaimed = await getTotalClaim();
    //     let claimB = initialBalance.add((await getBobClaim()).mul(9).div(10));
    //     await checkClaimable(
    //         kip17d,
    //         [0, 1, 2, 3, 4, 5],
    //         [
    //             reward.sub(claimed0),
    //             reward.sub(claimed1),
    //             reward.sub(claimed2),
    //             reward.sub(claimed3),
    //             reward.sub(claimed4),
    //             reward.sub(claimed5),
    //         ]
    //     );
    //     await checkMixBalance(mix, [alice, bob, carol, dan], [claimA, claimB, 0, 0]);
    //     expect(await mix.balanceOf(booth.address)).to.be.equal(totalClaimed.div(10).mul(3).div(1000));

    //     autoMining(false);
    //     await mineTo(200);
    //     await kip17d.connect(alice).claim([0]);
    //     await kip17d.connect(alice).claim([0]);
    //     await kip17d.connect(alice).claim([0]);
    //     await mine();
    //     reward = await rewardEach();
    //     claimed0 = reward;
    //     totalClaimed = await getTotalClaim();
    //     claimA = initialBalance.add((await getAliceClaim()).mul(9).div(10));
    //     await checkClaimable(
    //         kip17d,
    //         [0, 1, 2, 3, 4, 5],
    //         [
    //             reward.sub(claimed0),
    //             reward.sub(claimed1),
    //             reward.sub(claimed2),
    //             reward.sub(claimed3),
    //             reward.sub(claimed4),
    //             reward.sub(claimed5),
    //         ]
    //     );
    //     await checkMixBalance(mix, [alice, bob, carol, dan], [claimA, claimB, 0, 0]);
    //     expect(await mix.balanceOf(booth.address)).to.be.equal(totalClaimed.div(10).mul(3).div(1000));

    //     await mineTo(230);
    //     await kip17d.connect(alice).claim([0, 1]);
    //     await kip17d.connect(alice).claim([2]);
    //     await kip17d.connect(bob).claim([4]);
    //     await mine();
    //     reward = await rewardEach();
    //     claimed0 = reward;
    //     claimed1 = reward;
    //     claimed2 = reward;
    //     claimed4 = reward;
    //     totalClaimed = await getTotalClaim();
    //     claimA = initialBalance.add((await getAliceClaim()).mul(9).div(10));
    //     claimB = initialBalance.add((await getBobClaim()).mul(9).div(10));
    //     await checkClaimable(
    //         kip17d,
    //         [0, 1, 2, 3, 4, 5],
    //         [
    //             reward.sub(claimed0),
    //             reward.sub(claimed1),
    //             reward.sub(claimed2),
    //             reward.sub(claimed3),
    //             reward.sub(claimed4),
    //             reward.sub(claimed5),
    //         ]
    //     );
    //     await checkMixBalance(mix, [alice, bob, carol, dan], [claimA, claimB, 0, 0]);
    //     expect(await mix.balanceOf(booth.address)).to.be.equal(totalClaimed.div(10).mul(3).div(1000));

    //     autoMining(true);
    //     expect(await nft.ownerOf(0)).to.be.equal(alice.address);
    //     await nft.connect(alice).burn(0);
    //     await expect(nft.ownerOf(0)).to.be.reverted;

    //     await expect(kip17d.connect(alice).claim([0])).to.be.reverted;
    //     await expect(kip17d.connect(alice).claim([0, 1])).to.be.reverted;
    //     autoMining(false);

    //     await mine(15);
    //     await kip17d.connect(alice).claim([1, 2]);
    //     await kip17d.connect(bob).claim([3, 4]);
    //     await mine();
    //     reward = await rewardEach();
    //     claimed1 = reward;
    //     claimed2 = reward;
    //     claimed3 = reward;
    //     claimed4 = reward;
    //     totalClaimed = await getTotalClaim();
    //     claimA = initialBalance.add((await getAliceClaim()).mul(9).div(10));
    //     claimB = initialBalance.add((await getBobClaim()).mul(9).div(10));
    //     await checkClaimable(
    //         kip17d,
    //         [0, 1, 2, 3, 4, 5],
    //         [
    //             reward.sub(claimed0),
    //             reward.sub(claimed1),
    //             reward.sub(claimed2),
    //             reward.sub(claimed3),
    //             reward.sub(claimed4),
    //             reward.sub(claimed5),
    //         ]
    //     );
    //     await checkMixBalance(mix, [alice, bob, carol, dan], [claimA, claimB, 0, 0]);
    //     expect(await mix.balanceOf(booth.address)).to.be.equal(totalClaimed.div(10).mul(3).div(1000));

    //     await emitter.set(1, 0);
    //     await expect(() => mine()).to.changeTokenBalance(mix, kip17d, blockRewardPerNFT.mul(100));
    //     reward = await rewardEach();
    //     await checkClaimable(
    //         kip17d,
    //         [0, 1, 2, 3, 4, 5],
    //         [
    //             reward.sub(claimed0),
    //             reward.sub(claimed1),
    //             reward.sub(claimed2),
    //             reward.sub(claimed3),
    //             reward.sub(claimed4),
    //             reward.sub(claimed5),
    //         ]
    //     );
    //     await checkMixBalance(mix, [alice, bob, carol, dan], [claimA, claimB, 0, 0]);
    //     expect(await mix.balanceOf(booth.address)).to.be.equal(totalClaimed.div(10).mul(3).div(1000));
    //     const fixedReward = reward;

    //     await mine(10);
    //     expect((await emitter.poolInfo(1)).allocPoint).to.be.equal(0);
    //     await expect(() => mine()).to.changeTokenBalance(mix, kip17d, 0);
    //     reward = await rewardEach();
    //     expect(reward).to.be.not.equal(fixedReward);
    //     await checkClaimable(
    //         kip17d,
    //         [0, 1, 2, 3, 4, 5],
    //         [
    //             fixedReward.sub(claimed0),
    //             fixedReward.sub(claimed1),
    //             fixedReward.sub(claimed2),
    //             fixedReward.sub(claimed3),
    //             fixedReward.sub(claimed4),
    //             fixedReward.sub(claimed5),
    //         ]
    //     );
    //     await checkMixBalance(mix, [alice, bob, carol, dan], [claimA, claimB, 0, 0]);
    //     expect(await mix.balanceOf(booth.address)).to.be.equal(totalClaimed.div(10).mul(3).div(1000));
    // });
});
