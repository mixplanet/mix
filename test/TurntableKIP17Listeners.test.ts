import { Mix, MixEmitter, Booth, Turntables, TurntableKIP17Listeners, TestNFT } from "../typechain";
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
    const [deployer, alice, bob, carol, dan, erin, frank, poolA] = signers;

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

    const TestNFT = await ethers.getContractFactory("TestNFT");
    const nft = (await TestNFT.deploy()) as TestNFT;

    const TurntableKIP17Listeners = await ethers.getContractFactory("TurntableKIP17Listeners");
    const table17Listeners = (await TurntableKIP17Listeners.deploy(
        emitter.address,
        2,
        turntables.address,
        nft.address
    )) as TurntableKIP17Listeners;

    {
        await nft.massMint(100);
        await nft.transferFrom(deployer.address, alice.address, 0);
        await nft.transferFrom(deployer.address, alice.address, 1);
        await nft.transferFrom(deployer.address, alice.address, 2);

        await nft.transferFrom(deployer.address, bob.address, 3);
        await nft.transferFrom(deployer.address, bob.address, 4);

        await nft.transferFrom(deployer.address, carol.address, 5);

        await mix.transfer(erin.address, initialBalance);
        await mix.transfer(frank.address, initialBalance);
        await mix.connect(erin).approve(turntables.address, MaxUint256);
        await mix.connect(frank).approve(turntables.address, MaxUint256);
    }

    await emitter.add(poolA.address, 500);
    await emitter.add(turntables.address, 400);
    await emitter.add(table17Listeners.address, 100);

    return {
        deployer,
        alice,
        bob,
        carol,
        dan,
        erin,
        frank,
        mix,
        emitter,
        turntables,
        booth,
        nft,
        table17Listeners,
    };
};

describe("TurntableKIP17Listeners", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });

    async function checkMixBalance(mix: Mix, users: SignerWithAddress[], amounts: BigNumberish[]) {
        const length = users.length;
        for (let i = 0; i < length; i++) {
            expect(await mix.balanceOf(users[i].address), `fail with ${i}th user`).to.be.closeTo(
                BigNumber.from(amounts[i]),
                20 //due to solidity math
            );
        }
    }

    it("should be that setTurntableFee function works properly", async () => {
        const { table17Listeners, alice } = await setupTest();

        expect(await table17Listeners.turntableFee()).to.be.equal(300);
        await expect(table17Listeners.connect(alice).setTurntableFee(100)).to.be.reverted;

        await expect(table17Listeners.setTurntableFee(100)).to.emit(table17Listeners, "SetTurntableFee").withArgs(100);
        expect(await table17Listeners.turntableFee()).to.be.equal(100);

        await expect(table17Listeners.setTurntableFee(10000)).to.be.reverted;
    });

    it("should be that unwantedly minted mix token before the first listening should be burned", async () => {
        const { table17Listeners, turntables, mix, emitter, booth, alice, bob, erin } = await setupTest();

        await turntables.addType(1000, 500, 10, 300);
        await turntables.allowType(0);
        await turntables.connect(erin).buy(0);

        const startBlock = (await emitter.poolInfo(2)).lastEmitBlock.toNumber();

        await mineTo(50);
        const rewardToBeBurned = emissionPerBlock.div(10).mul(50 - startBlock);

        await expect(() => table17Listeners.connect(alice).listen(0, [0])).to.changeTokenBalances(
            mix,
            [erin, alice, booth],
            [0, 0, rewardToBeBurned.mul(3).div(1000)]
        );

        const reward = emissionPerBlock.div(10);
        await expect(() => table17Listeners.connect(alice).claim(0, [0])).to.changeTokenBalances(
            mix,
            [erin, alice, booth],
            [reward.mul(3).div(100), reward.mul(97).div(100), 0]
        );
    });

    it("should be that if the turntable is not exist, listen is failed", async () => {
        const { table17Listeners, turntables, alice, bob, erin } = await setupTest();

        await turntables.addType(1000, 500, 10, 300);
        await turntables.allowType(0);
        await turntables.connect(erin).buy(0);
        await turntables.connect(erin).buy(0);

        await table17Listeners.connect(alice).listen(0, [0, 1]);
        await table17Listeners.connect(bob).listen(1, [3]);

        await expect(table17Listeners.connect(bob).listen(2, [4])).to.be.reverted;

        await turntables.connect(erin).destroy(0);
        await table17Listeners.connect(alice).unlisten(0, [1]);
        await expect(table17Listeners.connect(bob).listen(0, [4])).to.be.reverted;
        await table17Listeners.connect(bob).listen(1, [4]);
    });

    it("should be that only an owner of a nft token can listen / unlisten turntables with the nft", async () => {
        const { table17Listeners, turntables, nft, alice, bob, erin } = await setupTest();

        await turntables.addType(1000, 500, 10, 300);
        await turntables.allowType(0);
        await turntables.connect(erin).buy(0);

        expect(await nft.ownerOf(0)).to.be.equal(alice.address);
        expect(await nft.ownerOf(1)).to.be.equal(alice.address);
        expect(await nft.ownerOf(2)).to.be.equal(alice.address);
        expect(await nft.ownerOf(3)).to.be.equal(bob.address);
        expect(await nft.ownerOf(4)).to.be.equal(bob.address);

        await expect(table17Listeners.connect(alice).listen(0, [3])).to.be.reverted;
        await expect(table17Listeners.connect(alice).listen(0, [1, 3])).to.be.reverted;
        await table17Listeners.connect(alice).listen(0, [1, 2]);

        await table17Listeners.connect(alice).unlisten(0, [1, 2]);
        await nft.connect(alice).transferFrom(alice.address, bob.address, 2);
        expect(await nft.ownerOf(2)).to.be.equal(bob.address);
        await expect(table17Listeners.connect(alice).listen(0, [1, 2])).to.be.reverted;
    });

    it("should be that users can't claim with a nft token not listening to any turntables", async () => {
        const { table17Listeners, turntables, nft, alice, bob, erin } = await setupTest();

        await turntables.addType(1000, 500, 10, 300);
        await turntables.allowType(0);
        await turntables.connect(erin).buy(0);

        await table17Listeners.connect(alice).listen(0, [0, 1]);

        expect(await table17Listeners.listening(0)).to.be.true;
        expect(await table17Listeners.listening(1)).to.be.true;

        expect(await table17Listeners.listening(2)).to.be.false;
        expect(await table17Listeners.listening(3)).to.be.false;

        await expect(table17Listeners.connect(alice).unlisten(0, [2])).to.be.reverted;
        await expect(table17Listeners.connect(bob).unlisten(0, [3])).to.be.reverted;
    });

    it("should be that re-listening to the same turntable is reverted but to another turntable is not", async () => {
        const { table17Listeners, turntables, nft, alice, bob, erin } = await setupTest();

        await turntables.addType(1000, 500, 10, 300);
        await turntables.allowType(0);
        await turntables.connect(erin).buy(0);
        await turntables.connect(erin).buy(0);

        await table17Listeners.connect(alice).listen(0, [0]);
        await table17Listeners.connect(alice).listen(1, [0]);
        await table17Listeners.connect(alice).listen(0, [0]);
        await expect(table17Listeners.connect(alice).listen(0, [0])).to.be.reverted;
    });

    it("should be that in cases of unlistening and re-listening to another turntable, rewards are claimed automatically", async () => {
        const { table17Listeners, turntables, mix, nft, alice, bob, erin } = await setupTest();

        await turntables.addType(1000, 500, 10, 300);
        await turntables.allowType(0);
        await turntables.connect(erin).buy(0);
        await turntables.connect(erin).buy(0);

        await mineTo(100);
        await table17Listeners.connect(alice).listen(0, [0]);
        await expect(() => table17Listeners.connect(alice).unlisten(0, [0])).to.changeTokenBalance(
            mix,
            alice,
            emissionPerBlock.div(10).mul(97).div(100)
        );

        await mineTo(110);
        await table17Listeners.connect(alice).listen(0, [1]);
        await expect(() => table17Listeners.connect(alice).listen(1, [1])).to.changeTokenBalance(
            mix,
            alice,
            emissionPerBlock.div(10).mul(97).div(100)
        );
    });

    it("should be that if a nft which is listening is transferred to another user, the new owner can claim accumulated rewards but the previous owner can't", async () => {
        const { table17Listeners, turntables, mix, nft, alice, bob, erin } = await setupTest();

        await turntables.addType(1000, 500, 10, 300);
        await turntables.allowType(0);
        await turntables.connect(erin).buy(0);

        await mineTo(100);
        await table17Listeners.connect(alice).listen(0, [0]); //100b

        await nft.connect(alice).transferFrom(alice.address, bob.address, 0); //101b
        expect(await table17Listeners.listening(0)).to.be.true; //still listening
        expect(await nft.ownerOf(0)).to.be.equal(bob.address); //bob is new owner

        await expect(table17Listeners.connect(alice).claim(0, [0])).to.be.reverted; //102b
        await expect(() => table17Listeners.connect(bob).claim(0, [0])).to.changeTokenBalance(
            mix,
            bob,
            emissionPerBlock.div(10).mul(97).div(100).mul(3)
        ); //103b

        await mine(10); //113b
        await expect(() => table17Listeners.connect(bob).claim(0, [0])).to.changeTokenBalance(
            mix,
            bob,
            emissionPerBlock.div(10).mul(97).div(100).mul(11)
        ); //114b
        await nft.connect(bob).transferFrom(bob.address, alice.address, 0); //115b
        await expect(() => table17Listeners.connect(alice).claim(0, [0])).to.changeTokenBalance(
            mix,
            alice,
            emissionPerBlock.div(10).mul(97).div(100).mul(2)
        ); //116b
    });

    it("should be that even if the turntable is destroyed during listening, listeners can claim their mix and fee doesn't go to turntable's last owner but is burned", async () => {
        const { table17Listeners, turntables, emitter, mix, booth, alice, bob, carol, erin } = await setupTest();

        await turntables.addType(1000, 500, 10, 300);
        await turntables.allowType(0);
        await turntables.connect(erin).buy(0);

        let claimableB = Zero;
        let claimableC = Zero;
        let claimedB = Zero;
        let claimedC = Zero;
        const rewardPerBlock = emissionPerBlock.div(10);

        await mineTo(100);
        await table17Listeners.connect(bob).listen(0, [3]);
        claimableB = claimableB.add(rewardPerBlock);

        await table17Listeners.connect(carol).listen(0, [5]);
        claimableB = claimableB.add(rewardPerBlock.div(2));
        claimableC = claimableC.add(rewardPerBlock.div(2));

        await turntables.connect(erin).destroy(0);
        const erinBalance = await mix.balanceOf(erin.address);

        claimableB = claimableB.add(rewardPerBlock.div(2));
        claimableC = claimableC.add(rewardPerBlock.div(2));
        const boothMixBalance = await mix.balanceOf(booth.address);

        await expect(() => table17Listeners.connect(bob).claim(0, [3])).to.changeTokenBalances(
            mix,
            [erin, bob, booth],
            [0, claimableB.mul(97).div(100), claimableB.mul(3).div(100).mul(3).div(1000)]
        );
        let burned = claimableB.mul(3).div(100);
        claimedB = claimableB.mul(97).div(100);
        claimableB = Zero;
        claimableC = claimableC.add(rewardPerBlock.div(2));

        await table17Listeners.connect(carol).claim(0, [5]);
        burned = burned.add(claimableC.mul(3).div(100));
        claimableB = claimableB.add(rewardPerBlock.div(2));
        claimedC = claimableC.mul(97).div(100);
        claimableC = Zero;

        await checkMixBalance(mix, [erin, bob, carol], [erinBalance, claimedB, claimedC]);
        expect(await mix.balanceOf(booth.address)).to.be.equal(boothMixBalance.add(burned.mul(3).div(1000)));

        await table17Listeners.connect(bob).claim(0, [3]);
        await expect(table17Listeners.connect(bob).listen(0, [4])).to.be.reverted;
        await table17Listeners.connect(bob).unlisten(0, [3]);
        await expect(table17Listeners.connect(bob).listen(0, [3])).to.be.reverted;
    });

    it("should be that fee goes correctly when listeners claim their mix", async () => {
        const { table17Listeners, turntables, emitter, mix, alice, bob, carol, erin } = await setupTest();

        await turntables.addType(1000, 500, 10, 300);
        await turntables.allowType(0);
        await turntables.connect(erin).buy(0);
        const erinBalance = await mix.balanceOf(erin.address);

        let claimableB = Zero;
        let claimableC = Zero;
        let claimedB = Zero;
        let claimedC = Zero;
        const rewardPerBlock = emissionPerBlock.div(10);

        await mineTo(100);
        await table17Listeners.connect(bob).listen(0, [3]);
        claimableB = claimableB.add(rewardPerBlock);

        await table17Listeners.connect(carol).listen(0, [5]);
        claimableB = claimableB.add(rewardPerBlock.div(2));
        claimableC = claimableC.add(rewardPerBlock.div(2));

        await mine();
        claimableB = claimableB.add(rewardPerBlock.div(2));
        claimableC = claimableC.add(rewardPerBlock.div(2));

        await expect(() => table17Listeners.connect(bob).claim(0, [3])).to.changeTokenBalances(
            mix,
            [erin, bob],
            [claimableB.mul(3).div(100), claimableB.mul(97).div(100)]
        );
        let fee = claimableB.mul(3).div(100);
        claimedB = claimableB.mul(97).div(100);
        claimableB = Zero;
        claimableC = claimableC.add(rewardPerBlock.div(2));

        await table17Listeners.connect(carol).claim(0, [5]);
        fee = fee.add(claimableC.mul(3).div(100));
        claimableB = claimableB.add(rewardPerBlock.div(2));
        claimedC = claimableC.mul(97).div(100);
        claimableC = Zero;

        await checkMixBalance(mix, [erin, bob, carol], [erinBalance.add(fee), claimedB, claimedC]);
    });

    it("should be that fee goes to the turntable's owner even if its life is over", async () => {
        const { table17Listeners, turntables, mix, bob, erin } = await setupTest();

        await turntables.addType(1000, 500, 10, 50);
        await turntables.allowType(0);
        await turntables.connect(erin).buy(0);

        const rewardPerBlock = emissionPerBlock.div(10);

        await mineTo(100);
        expect((await turntables.turntables(0)).endBlock).to.be.lt(await getBlock());
        await table17Listeners.connect(bob).listen(0, [3]);
        let claimableB = rewardPerBlock;

        await expect(() => table17Listeners.connect(bob).claim(0, [3])).to.changeTokenBalances(
            mix,
            [erin, bob],
            [claimableB.mul(3).div(100), claimableB.mul(97).div(100)]
        );
    });

    it("should be that if a turntable's owner is listening one's turntable, the owner can get all reward including fee", async () => {
        const { table17Listeners, turntables, nft, mix, deployer, erin } = await setupTest();

        await turntables.addType(1000, 500, 10, 50);
        await turntables.allowType(0);
        await turntables.connect(erin).buy(0);
        await nft.connect(deployer).transferFrom(deployer.address, erin.address, 10);

        const rewardPerBlock = emissionPerBlock.div(10);

        await mineTo(100);
        expect((await turntables.turntables(0)).endBlock).to.be.lt(await getBlock());
        await table17Listeners.connect(erin).listen(0, [10]);
        let claimableB = rewardPerBlock;

        await expect(() => table17Listeners.connect(erin).claim(0, [10])).to.changeTokenBalance(mix, erin, claimableB);
    });

    it("should be that listeners indexing works properly", async () => {
        const { table17Listeners, turntables, mix, alice, bob, erin } = await setupTest();

        await turntables.addType(1000, 500, 10, 50);
        await turntables.allowType(0);
        await turntables.connect(erin).buy(0);
        await turntables.connect(erin).buy(0);
        await turntables.connect(erin).buy(0);

        expect(await table17Listeners.callStatic.listenerCount(0)).to.be.equal(0);
        await table17Listeners.connect(alice).listen(0, [0, 2, 1]);

        expect(await table17Listeners.callStatic.listenerCount(0)).to.be.equal(3);
        expect(await table17Listeners.callStatic.listeners(0, 0)).to.be.equal(0);
        expect(await table17Listeners.callStatic.listeners(0, 1)).to.be.equal(2);
        expect(await table17Listeners.callStatic.listeners(0, 2)).to.be.equal(1);

        await table17Listeners.connect(bob).listen(0, [4]);
        expect(await table17Listeners.callStatic.listenerCount(0)).to.be.equal(4);
        expect(await table17Listeners.callStatic.listeners(0, 3)).to.be.equal(4);

        await table17Listeners.connect(alice).unlisten(0, [0, 1]);
        expect(await table17Listeners.callStatic.listenerCount(0)).to.be.equal(2);
        expect(await table17Listeners.callStatic.listeners(0, 0)).to.be.equal(4);
        expect(await table17Listeners.callStatic.listeners(0, 1)).to.be.equal(2);

        expect(await table17Listeners.callStatic.listenerCount(1)).to.be.equal(0);
        await table17Listeners.connect(alice).listen(1, [1, 2]);

        expect(await table17Listeners.callStatic.listenerCount(0)).to.be.equal(1);
        expect(await table17Listeners.callStatic.listenerCount(1)).to.be.equal(2);

        await table17Listeners.connect(alice).listen(2, [0, 1, 2]);
        expect(await table17Listeners.callStatic.listenerCount(0)).to.be.equal(1);
        expect(await table17Listeners.callStatic.listenerCount(1)).to.be.equal(0);
        expect(await table17Listeners.callStatic.listenerCount(2)).to.be.equal(3);
    });

    /**
     * ./etc/TurntableKIP17Listeners_overall_test.png
     */
    it("overall test", async () => {
        const { table17Listeners, turntables, mix, nft, booth, emitter, deployer, alice, bob, carol, erin, frank } =
            await setupTest();

        await turntables.addType(1000, 500, 10, 300);
        await turntables.addType(2000, 700, 15, 500);
        await turntables.allowType(0);
        await turntables.allowType(1);
        await turntables.connect(erin).buy(0); //t0-erin
        await turntables.connect(frank).buy(0); //t1-frank
        {
            await nft.connect(bob).transferFrom(bob.address, alice.address, 3);
            await nft.connect(bob).transferFrom(bob.address, alice.address, 4);

            await nft.connect(carol).transferFrom(carol.address, bob.address, 5);
            await nft.transferFrom(deployer.address, bob.address, 6);
            await nft.transferFrom(deployer.address, bob.address, 7);
            await nft.transferFrom(deployer.address, bob.address, 8);
            await nft.transferFrom(deployer.address, bob.address, 9);

            await nft.transferFrom(deployer.address, carol.address, 10);
            await nft.transferFrom(deployer.address, carol.address, 11);
            await nft.transferFrom(deployer.address, carol.address, 12);
            await nft.transferFrom(deployer.address, carol.address, 13);
            await nft.transferFrom(deployer.address, carol.address, 14);

            await nft.transferFrom(deployer.address, alice.address, 15);
            await nft.transferFrom(deployer.address, alice.address, 16);
            await nft.transferFrom(deployer.address, alice.address, 17);
            await nft.transferFrom(deployer.address, alice.address, 18);
            await nft.transferFrom(deployer.address, alice.address, 19);
            //alice : 0-4, 15-19; bob : 5-9; carol : 10-14;
        }

        let aliceBalance = Zero;
        let bobBalance = Zero;
        let carolBalance = Zero;

        autoMining(false);
        await mineTo(100);
        await table17Listeners.connect(alice).listen(0, [0, 1, 2, 3, 4]);
        await table17Listeners.connect(bob).listen(0, [5, 6, 7, 8, 9]);
        await mine();
        autoMining(true);

        await mineTo(110);
        await table17Listeners.connect(carol).listen(1, [10, 11, 12, 13, 14]);

        await mineTo(120);
        await table17Listeners.connect(carol).unlisten(1, [10, 11, 12, 13, 14]);
        await expect(table17Listeners.connect(carol).unlisten(1, [10])).to.be.reverted;
        await expect(table17Listeners.connect(carol).unlisten(1, [10, 11, 12])).to.be.reverted;
        await expect(table17Listeners.connect(carol).unlisten(0, [10, 11, 12])).to.be.reverted;
        {
            expect(await table17Listeners.realClaimedOf(1, 10)).to.closeTo(BigNumber.from(64667), 20);
            expect(await table17Listeners.realClaimedOf(1, 11)).to.closeTo(BigNumber.from(64667), 20);
            expect(await table17Listeners.realClaimedOf(1, 12)).to.closeTo(BigNumber.from(64667), 20);
            expect(await table17Listeners.realClaimedOf(1, 13)).to.closeTo(BigNumber.from(64667), 20);
            expect(await table17Listeners.realClaimedOf(1, 14)).to.closeTo(BigNumber.from(64667), 20);
            carolBalance = BigNumber.from(64667).mul(5);
            expect(await mix.balanceOf(carol.address)).to.closeTo(carolBalance, 20);

            expect(await table17Listeners.claimableOf(0, 10)).to.closeTo(Zero, 20);
            expect(await table17Listeners.claimableOf(0, 11)).to.closeTo(Zero, 20);
            expect(await table17Listeners.claimableOf(0, 12)).to.closeTo(Zero, 20);
            expect(await table17Listeners.claimableOf(0, 13)).to.closeTo(Zero, 20);
            expect(await table17Listeners.claimableOf(0, 14)).to.closeTo(Zero, 20);
        }

        await mineTo(130);
        await table17Listeners.connect(alice).listen(1, [3, 4]);
        {
            expect(await table17Listeners.realClaimedOf(0, 3)).to.closeTo(BigNumber.from(258667), 20);
            expect(await table17Listeners.realClaimedOf(0, 4)).to.closeTo(BigNumber.from(258667), 20);
            aliceBalance = BigNumber.from(258667).mul(2);
            expect(await mix.balanceOf(alice.address)).to.closeTo(aliceBalance, 20);

            expect(await table17Listeners.realClaimedOf(1, 3)).to.closeTo(Zero, 20);
            expect(await table17Listeners.realClaimedOf(1, 4)).to.closeTo(Zero, 20);
            expect(await table17Listeners.claimableOf(0, 3)).to.closeTo(Zero, 20);
            expect(await table17Listeners.claimableOf(0, 4)).to.closeTo(Zero, 20);
        }

        await mineTo(140);
        autoMining(false);
        await nft.connect(bob).transferFrom(bob.address, carol.address, 7);
        await nft.connect(bob).transferFrom(bob.address, carol.address, 8);
        await nft.connect(bob).transferFrom(bob.address, carol.address, 9);
        await mine();
        autoMining(true);

        await mineTo(150);
        await turntables.connect(erin).buy(1); //t2-erin

        await expect(table17Listeners.connect(alice).listen(3, [15])).to.be.reverted;
        await expect(table17Listeners.connect(alice).listen(3, [15, 16, 17, 18, 19])).to.be.reverted;

        await mineTo(160);
        await table17Listeners.connect(alice).listen(2, [15, 16, 17, 18, 19]);

        await mineTo(170);
        await table17Listeners.connect(carol).claim(0, [8, 9]);
        {
            expect(await table17Listeners.claimableOf(0, 0)).to.closeTo(BigNumber.from(614333), 20);
            expect(await table17Listeners.realClaimedOf(0, 8)).to.closeTo(BigNumber.from(614333), 20);
            expect(await mix.balanceOf(alice.address)).to.closeTo(aliceBalance, 20);
            carolBalance = carolBalance.add(BigNumber.from(614333).mul(2));
            expect(await mix.balanceOf(carol.address)).to.closeTo(carolBalance, 20);
        }

        await expect(table17Listeners.connect(bob).listen(0, [5])).to.be.reverted;
        await expect(table17Listeners.connect(alice).listen(2, [5])).to.be.reverted;

        await mineTo(180);
        await table17Listeners.connect(bob).listen(2, [5, 6]);
        {
            expect(await table17Listeners.realClaimedOf(0, 5)).to.closeTo(BigNumber.from(679000), 20);
            expect(await table17Listeners.realClaimedOf(0, 6)).to.closeTo(BigNumber.from(679000), 20);
            bobBalance = BigNumber.from(679000).mul(2);
            expect(await mix.balanceOf(bob.address)).to.closeTo(bobBalance, 20);

            expect(await table17Listeners.realClaimedOf(2, 5)).to.closeTo(Zero, 20);
            expect(await table17Listeners.realClaimedOf(2, 6)).to.closeTo(Zero, 20);
            expect(await table17Listeners.claimableOf(0, 5)).to.closeTo(Zero, 20);
            expect(await table17Listeners.claimableOf(0, 6)).to.closeTo(Zero, 20);
        }

        await mineTo(190);
        autoMining(false);
        await table17Listeners.connect(alice).claim(2, [15, 16, 17, 18, 19]);
        await table17Listeners.connect(alice).unlisten(2, [17, 18, 19]);
        await mine();
        autoMining(true);
        await nft.connect(alice).transferFrom(alice.address, bob.address, 15);
        await nft.connect(alice).transferFrom(alice.address, bob.address, 16);
        {
            expect(await table17Listeners.realClaimedOf(2, 15)).to.closeTo(BigNumber.from(194000), 20);
            expect(await table17Listeners.realClaimedOf(2, 16)).to.closeTo(BigNumber.from(194000), 20);
            expect(await table17Listeners.realClaimedOf(2, 17)).to.closeTo(BigNumber.from(194000), 20);
            expect(await table17Listeners.realClaimedOf(2, 18)).to.closeTo(BigNumber.from(194000), 20);
            expect(await table17Listeners.realClaimedOf(2, 19)).to.closeTo(BigNumber.from(194000), 20);
            aliceBalance = aliceBalance.add(BigNumber.from(194000).mul(5));
            expect(await mix.balanceOf(alice.address)).to.closeTo(aliceBalance, 20);
        }

        await mineTo(200);
        autoMining(false);
        await emitter.set(1, 300);
        await emitter.set(2, 200);
        await mine();
        autoMining(true);

        await mineTo(210);
        autoMining(false);
        await table17Listeners.connect(bob).listen(0, [5, 6]);
        await table17Listeners.connect(bob).listen(1, [15, 16]);
        await mine();
        autoMining(true);
        {
            expect(await table17Listeners.realClaimedOf(2, 5)).to.closeTo(BigNumber.from(307167), 20);
            expect(await table17Listeners.realClaimedOf(2, 6)).to.closeTo(BigNumber.from(307167), 20);

            expect(await table17Listeners.realClaimedOf(2, 15)).to.closeTo(BigNumber.from(194000+242500), 20);
            expect(await table17Listeners.realClaimedOf(2, 16)).to.closeTo(BigNumber.from(194000+242500), 20);
            bobBalance = bobBalance.add(BigNumber.from(307167).mul(2).add(BigNumber.from(242500).mul(2)));
            expect(await mix.balanceOf(bob.address)).to.closeTo(bobBalance, 20);
        }

        await mine(3);
        await emitter.updatePool(2);

        await mineTo(220);
        {
            expect(await table17Listeners.callStatic.listenerCount(0)).to.equal(8);
            expect(await table17Listeners.callStatic.listenerCount(1)).to.equal(4);
            expect(await table17Listeners.callStatic.listenerCount(2)).to.equal(0);

            expect(await mix.balanceOf(alice.address)).to.closeTo(aliceBalance, 20);
            expect(await mix.balanceOf(bob.address)).to.closeTo(bobBalance, 20);
            expect(await mix.balanceOf(carol.address)).to.closeTo(carolBalance, 20);
        }

        await mineTo(230);
        await table17Listeners.connect(alice).listen(2, [0,1,2,3,4]);
        {
            expect(await table17Listeners.realClaimedOf(0, 0)).to.closeTo(BigNumber.from(1309500), 20);
            expect(await table17Listeners.realClaimedOf(0, 1)).to.closeTo(BigNumber.from(1309500), 20);
            expect(await table17Listeners.realClaimedOf(0, 2)).to.closeTo(BigNumber.from(1309500), 20);
            expect(await table17Listeners.realClaimedOf(1, 3)).to.closeTo(BigNumber.from(1309500-258667), 20);
            expect(await table17Listeners.realClaimedOf(1, 4)).to.closeTo(BigNumber.from(1309500-258667), 20);
            aliceBalance = aliceBalance.add(BigNumber.from(1309500).mul(3).add(BigNumber.from(1309500-258667).mul(2)));
            expect(await mix.balanceOf(alice.address)).to.closeTo(aliceBalance, 20);
        }

        await mineTo(240);
        await table17Listeners.connect(carol).listen(2, [10, 11, 12]);

        await mineTo(250);
        await table17Listeners.connect(bob).listen(2, [5,6,15,16]);
        {
            expect(await table17Listeners.realClaimedOf(0, 5)).to.closeTo(BigNumber.from(614333+679000), 20);
            expect(await table17Listeners.realClaimedOf(0, 6)).to.closeTo(BigNumber.from(614333+679000), 20);
            expect(await table17Listeners.realClaimedOf(1, 15)).to.closeTo(BigNumber.from(614333), 20);
            expect(await table17Listeners.realClaimedOf(1, 16)).to.closeTo(BigNumber.from(614333), 20);

            bobBalance = bobBalance.add(BigNumber.from(614333).mul(4));
            expect(await mix.balanceOf(bob.address)).to.closeTo(bobBalance, 20);
        }

        await turntables.connect(erin).destroy(2);
        await mineTo(260);
        autoMining(false);
        await table17Listeners.connect(carol).claim(0, [7,8,9]);
        await table17Listeners.connect(carol).claim(2, [10,11,12]);
        await mine();
        autoMining(true);
        {
            expect(await table17Listeners.realClaimedOf(0, 7)).to.closeTo(BigNumber.from(1729833), 20);
            expect(await table17Listeners.realClaimedOf(0, 8)).to.closeTo(BigNumber.from(1115500+614333), 20);
            expect(await table17Listeners.realClaimedOf(0, 9)).to.closeTo(BigNumber.from(1115500+614333), 20);
            expect(await table17Listeners.realClaimedOf(2, 10)).to.closeTo(BigNumber.from(258667), 20);
            expect(await table17Listeners.realClaimedOf(2, 11)).to.closeTo(BigNumber.from(258667), 20);
            expect(await table17Listeners.realClaimedOf(2, 12)).to.closeTo(BigNumber.from(258667), 20);

            carolBalance = carolBalance.add(BigNumber.from(258667).mul(3).add(BigNumber.from(1729833)).add(BigNumber.from(1115500).mul(2)));
            expect(await mix.balanceOf(carol.address)).to.closeTo(carolBalance, 20);
        }
    });
});
