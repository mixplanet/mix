import { Mix, MixEmitter, Booth, KIP17Dividend, TestNFT } from "../typechain";
import { mine, mineTo, autoMining, getBlock } from "./utils/blockchain";

import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber, BigNumberish, Contract } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const { constants } = ethers;
const { MaxUint256, Zero } = constants;
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

    const TestNFT = await ethers.getContractFactory("TestNFT");
    const nft = (await TestNFT.deploy()) as TestNFT;

    const KIP17Dividend = await ethers.getContractFactory("KIP17Dividend");
    const kip17d = (await KIP17Dividend.deploy(emitter.address, 1, nft.address, 100)) as KIP17Dividend;

    {
        await mix.transfer(alice.address, initialBalance);
        await mix.transfer(bob.address, initialBalance);

        await mix.connect(alice).approve(kip17d.address, MaxUint256);
        await mix.connect(bob).approve(kip17d.address, MaxUint256);
        await mix.connect(carol).approve(kip17d.address, MaxUint256);
        await mix.connect(dan).approve(kip17d.address, MaxUint256);

        await nft.setApprovalForAll(kip17d.address, true);
        await nft.connect(alice).setApprovalForAll(kip17d.address, true);
        await nft.connect(bob).setApprovalForAll(kip17d.address, true);
        await nft.connect(carol).setApprovalForAll(kip17d.address, true);
        await nft.connect(dan).setApprovalForAll(kip17d.address, true);

        await nft.massMint(100);

        await nft.transferFrom(deployer.address, alice.address, 0);
        await nft.transferFrom(deployer.address, alice.address, 1);
        await nft.transferFrom(deployer.address, alice.address, 2);

        await nft.transferFrom(deployer.address, bob.address, 3);
        await nft.transferFrom(deployer.address, bob.address, 4);

        await nft.transferFrom(deployer.address, carol.address, 5);
    }

    await emitter.add(poolA.address, 100);
    await emitter.add(kip17d.address, 100);

    return {
        deployer,
        alice,
        bob,
        carol,
        dan,
        mix,
        emitter,
        nft,
        kip17d,
        booth,
    };
};

describe("KIP17Dividend", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });

    async function checkClaimable(kip17d: KIP17Dividend, ids: number[], amounts: BigNumberish[]) {
        const length = ids.length;
        for (let i = 0; i < length; i++) {
            expect(await kip17d.claimableOf(ids[i]), `fail with ${i}th id`).to.be.closeTo(
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

    it("overall test", async () => {
        const { kip17d, mix, emitter, alice, bob, carol, dan, nft, deployer, booth } = await setupTest();

        const blockRewardPerNFT = emissionPerBlock.div(2).div(100);

        await mineTo(30);
        await nft.mint(dan.address, 100);
        expect(await nft.totalSupply()).to.be.equal(101);
        //alice has 3 nfts : 0,1,2
        //bob has 2 nfts : 3,4
        //carol has 1 nfts : 5
        //dan has 1 nfts : 100 -> doesn't work in KIP17Dividend because it is over maxNFTSupply

        await mineTo(70);
        await checkClaimable(kip17d, [0, 1, 2, 3, 4, 5], [0, 0, 0, 0, 0, 0]);
        await checkMixBalance(mix, [alice, bob, carol, dan], [initialBalance, initialBalance, 0, 0]);

        await mineTo(100);
        await emitter.start(); //100b
        await checkClaimable(kip17d, [0, 1, 2, 3, 4, 5], [0, 0, 0, 0, 0, 0]);
        await checkMixBalance(mix, [alice, bob, carol, dan], [initialBalance, initialBalance, 0, 0]);

        await mine(10);
        const rewardEach = async () => {
            return blockRewardPerNFT.mul((await getBlock()) - 100);
        };

        let reward = await rewardEach();
        await checkClaimable(kip17d, [0, 1, 2, 3, 4, 5], [reward, reward, reward, reward, reward, reward]);
        await checkMixBalance(mix, [alice, bob, carol, dan], [initialBalance, initialBalance, 0, 0]);

        await mix.transfer(dan.address, initialBalance);
        await expect(kip17d.claimableOf(100)).to.be.reverted;
        await expect(kip17d.connect(dan).claim([100])).to.be.reverted;
        await expect(kip17d.connect(alice).claim([3])).to.be.reverted;
        await expect(kip17d.connect(alice).claim([2, 3])).to.be.reverted;
        await expect(kip17d.connect(carol).claim([3])).to.be.reverted;
        await mix.connect(dan).transfer(deployer.address, initialBalance);

        let claimed0 = Zero;
        let claimed1 = Zero;
        let claimed2 = Zero;
        let claimed3 = Zero;
        let claimed4 = Zero;
        let claimed5 = Zero;
        const getTotalClaim = async () => {
            return claimed0.add(claimed1).add(claimed2).add(claimed3).add(claimed4).add(claimed5);
        };
        const getAliceClaim = async () => {
            return claimed0.add(claimed1).add(claimed2);
        };
        const getBobClaim = async () => {
            return claimed3.add(claimed4);
        };
        const getCarolClaim = async () => {
            return claimed5;
        };

        await mineTo(120);
        await kip17d.connect(alice).claim([0]);
        reward = await rewardEach();
        claimed0 = reward;
        let totalClaimed = await getTotalClaim();
        let claimA = initialBalance.add((await getAliceClaim()).mul(9).div(10));
        await checkClaimable(
            kip17d,
            [0, 1, 2, 3, 4, 5],
            [
                reward.sub(claimed0),
                reward.sub(claimed1),
                reward.sub(claimed2),
                reward.sub(claimed3),
                reward.sub(claimed4),
                reward.sub(claimed5),
            ]
        );
        await checkMixBalance(mix, [alice, bob, carol, dan], [claimA, initialBalance, 0, 0]);
        expect(await mix.balanceOf(booth.address)).to.be.equal(totalClaimed.div(10).mul(3).div(1000));

        await mineTo(150);
        await kip17d.connect(alice).claim([0, 1]);
        reward = await rewardEach();
        claimed0 = reward;
        claimed1 = reward;
        totalClaimed = claimed0.add(claimed1);
        claimA = initialBalance.add((await getAliceClaim()).mul(9).div(10));
        await checkClaimable(
            kip17d,
            [0, 1, 2, 3, 4, 5],
            [
                reward.sub(claimed0),
                reward.sub(claimed1),
                reward.sub(claimed2),
                reward.sub(claimed3),
                reward.sub(claimed4),
                reward.sub(claimed5),
            ]
        );
        await checkMixBalance(mix, [alice, bob, carol, dan], [claimA, initialBalance, 0, 0]);
        expect(await mix.balanceOf(booth.address)).to.be.equal(totalClaimed.div(10).mul(3).div(1000));

        await mineTo(170);
        await kip17d.connect(bob).claim([3]);
        reward = await rewardEach();
        claimed3 = reward;
        totalClaimed = await getTotalClaim();
        let claimB = initialBalance.add((await getBobClaim()).mul(9).div(10));
        await checkClaimable(
            kip17d,
            [0, 1, 2, 3, 4, 5],
            [
                reward.sub(claimed0),
                reward.sub(claimed1),
                reward.sub(claimed2),
                reward.sub(claimed3),
                reward.sub(claimed4),
                reward.sub(claimed5),
            ]
        );
        await checkMixBalance(mix, [alice, bob, carol, dan], [claimA, claimB, 0, 0]);
        expect(await mix.balanceOf(booth.address)).to.be.equal(totalClaimed.div(10).mul(3).div(1000));

        autoMining(false);
        await mineTo(200);
        await kip17d.connect(alice).claim([0]);
        await kip17d.connect(alice).claim([0]);
        await kip17d.connect(alice).claim([0]);
        await mine();
        reward = await rewardEach();
        claimed0 = reward;
        totalClaimed = await getTotalClaim();
        claimA = initialBalance.add((await getAliceClaim()).mul(9).div(10));
        await checkClaimable(
            kip17d,
            [0, 1, 2, 3, 4, 5],
            [
                reward.sub(claimed0),
                reward.sub(claimed1),
                reward.sub(claimed2),
                reward.sub(claimed3),
                reward.sub(claimed4),
                reward.sub(claimed5),
            ]
        );
        await checkMixBalance(mix, [alice, bob, carol, dan], [claimA, claimB, 0, 0]);
        expect(await mix.balanceOf(booth.address)).to.be.equal(totalClaimed.div(10).mul(3).div(1000));

        await mineTo(230);
        await kip17d.connect(alice).claim([0,1]);
        await kip17d.connect(alice).claim([2]);
        await kip17d.connect(bob).claim([4]);
        await mine();
        reward = await rewardEach();
        claimed0 = reward;
        claimed1 = reward;
        claimed2 = reward;
        claimed4 = reward;
        totalClaimed = await getTotalClaim();
        claimA = initialBalance.add((await getAliceClaim()).mul(9).div(10));
        claimB = initialBalance.add((await getBobClaim()).mul(9).div(10));
        await checkClaimable(
            kip17d,
            [0, 1, 2, 3, 4, 5],
            [
                reward.sub(claimed0),
                reward.sub(claimed1),
                reward.sub(claimed2),
                reward.sub(claimed3),
                reward.sub(claimed4),
                reward.sub(claimed5),
            ]
        );
        await checkMixBalance(mix, [alice, bob, carol, dan], [claimA, claimB, 0, 0]);
        expect(await mix.balanceOf(booth.address)).to.be.equal(totalClaimed.div(10).mul(3).div(1000));

        autoMining(true);
        expect(await nft.ownerOf(0)).to.be.equal(alice.address);
        await nft.connect(alice).burn(0);
        await expect(nft.ownerOf(0)).to.be.reverted;
        
        await expect(kip17d.connect(alice).claim([0])).to.be.reverted;
        await expect(kip17d.connect(alice).claim([0,1])).to.be.reverted;
        autoMining(false);

        await mine(15);
        await kip17d.connect(alice).claim([1,2]);
        await kip17d.connect(bob).claim([3,4]);
        await mine();
        reward = await rewardEach();
        claimed1 = reward;
        claimed2 = reward;
        claimed3 = reward;
        claimed4 = reward;
        totalClaimed = await getTotalClaim();
        claimA = initialBalance.add((await getAliceClaim()).mul(9).div(10));
        claimB = initialBalance.add((await getBobClaim()).mul(9).div(10));
        await checkClaimable(
            kip17d,
            [0, 1, 2, 3, 4, 5],
            [
                reward.sub(claimed0),
                reward.sub(claimed1),
                reward.sub(claimed2),
                reward.sub(claimed3),
                reward.sub(claimed4),
                reward.sub(claimed5),
            ]
        );
        await checkMixBalance(mix, [alice, bob, carol, dan], [claimA, claimB, 0, 0]);
        expect(await mix.balanceOf(booth.address)).to.be.equal(totalClaimed.div(10).mul(3).div(1000));

        await emitter.set(1, 0);
        await expect(() => mine()).to.changeTokenBalance(mix, kip17d, blockRewardPerNFT.mul(100));
        reward = await rewardEach();
        await checkClaimable(
            kip17d,
            [0, 1, 2, 3, 4, 5],
            [
                reward.sub(claimed0),
                reward.sub(claimed1),
                reward.sub(claimed2),
                reward.sub(claimed3),
                reward.sub(claimed4),
                reward.sub(claimed5),
            ]
        );
        await checkMixBalance(mix, [alice, bob, carol, dan], [claimA, claimB, 0, 0]);
        expect(await mix.balanceOf(booth.address)).to.be.equal(totalClaimed.div(10).mul(3).div(1000));
        const fixedReward = reward;
        
        await mine(10);
        expect((await emitter.poolInfo(1)).allocPoint).to.be.equal(0);
        await expect(() => mine()).to.changeTokenBalance(mix, kip17d, 0);
        reward = await rewardEach();
        expect(reward).to.be.not.equal(fixedReward);
        await checkClaimable(
            kip17d,
            [0, 1, 2, 3, 4, 5],
            [
                fixedReward.sub(claimed0),
                fixedReward.sub(claimed1),
                fixedReward.sub(claimed2),
                fixedReward.sub(claimed3),
                fixedReward.sub(claimed4),
                fixedReward.sub(claimed5),
            ]
        );
        await checkMixBalance(mix, [alice, bob, carol, dan], [claimA, claimB, 0, 0]);
        expect(await mix.balanceOf(booth.address)).to.be.equal(totalClaimed.div(10).mul(3).div(1000));
    });
});
