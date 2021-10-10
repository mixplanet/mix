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

    async function checkClaimable(
        table17Listeners: TurntableKIP17Listeners,
        turntableIds: number[],
        ids: number[],
        amounts: BigNumberish[]
    ) {
        const length = turntableIds.length;
        for (let i = 0; i < length; i++) {
            expect(await table17Listeners.claimableOf(turntableIds[i], ids[i]), `fail with ${i}th id`).to.be.closeTo(
                BigNumber.from(amounts[i]),
                20 //due to solidity math
            );
        }
    }

    async function checkClaimed(
        table17Listeners: TurntableKIP17Listeners,
        turntableIds: number[],
        ids: number[],
        amounts: BigNumberish[]
    ) {
        const length = turntableIds.length;
        for (let i = 0; i < length; i++) {
            expect(await table17Listeners.claimedOf(turntableIds[i], ids[i]), `fail with ${i}th id`).to.be.closeTo(
                BigNumber.from(amounts[i]),
                20 //due to solidity math
            );
        }
    }

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

    it("should be that if a nft which is listening is transfered to another user, the new owner can claimed accumulated rewards but the previous owner can't", async () => {
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
    });

    it("should be that even if the turntable is destroyed during listening, listeners can claim their mix and fee is burned not goes to turntable's last owner", async () => {
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

    it("should be that fee goes to the turntable's owner even if it's life is over", async () => {
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

    // it("overall test", async () => {
    //     const { table17Listeners, turntables, mix, alice, bob, carol, erin, frank } = await setupTest();

    //     await turntables.addType(1000, 500, 10, 300);
    //     await turntables.addType(2000, 700, 15, 500);
    //     await turntables.allowType(0);
    //     await turntables.allowType(1);
    //     await turntables.connect(erin).buy(0);
    //     await turntables.connect(erin).buy(0);
    //     await turntables.connect(frank).buy(0);

    //     autoMining(false);
    //     await mineTo(100);
    //     await table17Listeners.connect(alice).listen(0, 10);
    //     await table17Listeners.connect(alice).listen(1, 10);
    //     await table17Listeners.connect(carol).listen(2, 10);
    //     await mine();

    //     async function checkC() {
    //         console.log(
    //             "alice",
    //             (await table17Listeners.shares(0, alice.address)).toString(),
    //             "",
    //             (await table17Listeners.claimableOf(0, alice.address)).toString()
    //         );
    //         console.log(
    //             "alice",
    //             (await table17Listeners.shares(1, alice.address)).toString(),
    //             "",
    //             (await table17Listeners.claimableOf(1, alice.address)).toString()
    //         );
    //         console.log(
    //             "alice",
    //             (await table17Listeners.shares(2, alice.address)).toString(),
    //             "",
    //             (await table17Listeners.claimableOf(2, alice.address)).toString()
    //         );
    //         console.log(
    //             "bob",
    //             (await table17Listeners.shares(0, bob.address)).toString(),
    //             "",
    //             (await table17Listeners.claimableOf(0, bob.address)).toString()
    //         );
    //         console.log(
    //             "bob",
    //             (await table17Listeners.shares(1, bob.address)).toString(),
    //             "",
    //             (await table17Listeners.claimableOf(1, bob.address)).toString()
    //         );
    //         console.log(
    //             "bob",
    //             (await table17Listeners.shares(2, bob.address)).toString(),
    //             "",
    //             (await table17Listeners.claimableOf(2, bob.address)).toString()
    //         );
    //         console.log(
    //             "carol",
    //             (await table17Listeners.shares(0, carol.address)).toString(),
    //             "",
    //             (await table17Listeners.claimableOf(0, carol.address)).toString()
    //         );
    //         console.log(
    //             "carol",
    //             (await table17Listeners.shares(1, carol.address)).toString(),
    //             "",
    //             (await table17Listeners.claimableOf(1, carol.address)).toString()
    //         );
    //         console.log(
    //             "carol",
    //             (await table17Listeners.shares(2, carol.address)).toString(),
    //             "",
    //             (await table17Listeners.claimableOf(2, carol.address)).toString()
    //         );
    //     }
    //     {
    //         console.log(`claimable At ${await getBlock()}th block`);
    //         await checkC();
    //         console.log("");
    //     }

    //     await mineTo(110);
    //     await table17Listeners.connect(bob).listen(0, 10);
    //     await mine();
    //     // {
    //     //     console.log(`claimable At ${await getBlock()}th block`);
    //     //     await checkC();
    //     //     console.log("");
    //     // }

    //     await mineTo(120);
    //     await table17Listeners.connect(alice).unlisten(0, 5);
    //     await table17Listeners.connect(bob).listen(0, 10);
    //     await table17Listeners.connect(carol).listen(0, 5);
    //     await mine();
    //     // {
    //     //     console.log(`claimable At ${await getBlock()}th block`);
    //     //     await checkC();
    //     //     console.log("");
    //     // }

    //     await mineTo(130);
    //     await table17Listeners.connect(bob).listen(0, 10);
    //     await table17Listeners.connect(bob).listen(1, 50);
    //     await mine();
    //     // {
    //     //     console.log(`claimable At ${await getBlock()}th block`);
    //     //     await checkC();
    //     //     console.log("");
    //     // }

    //     await mineTo(140);
    //     await mine();
    //     // {
    //     //     console.log(`claimable At ${await getBlock()}th block`);
    //     //     await checkC();
    //     //     console.log("");
    //     // }

    //     await mineTo(150);
    //     await table17Listeners.connect(alice).listen(1, 5);
    //     await table17Listeners.connect(bob).listen(2, 20);
    //     await table17Listeners.connect(carol).listen(2, 5);
    //     await mine();
    //     // {
    //     //     console.log(`claimable At ${await getBlock()}th block`);
    //     //     await checkC();
    //     //     console.log("");
    //     // }

    //     await mineTo(160);
    //     await mine();
    //     // {
    //     //     console.log(`claimable At ${await getBlock()}th block`);
    //     //     await checkC();
    //     //     console.log("");
    //     // }

    //     await mineTo(170);
    //     await table17Listeners.connect(bob).unlisten(0, 20);
    //     await table17Listeners.connect(bob).unlisten(1, 20);
    //     await mine();
    //     // {
    //     //     console.log(`claimable At ${await getBlock()}th block`);
    //     //     await checkC();
    //     //     console.log("");
    //     // }

    //     await mineTo(180);
    //     await table17Listeners.connect(alice).listen(0, 15);
    //     await table17Listeners.connect(alice).listen(1, 15);
    //     await table17Listeners.connect(carol).listen(1, 20);
    //     await mine();
    //     // {
    //     //     console.log(`claimable At ${await getBlock()}th block`);
    //     //     await checkC();
    //     //     console.log("");
    //     // }

    //     await mineTo(190);
    //     await mine();
    //     // {
    //     //     console.log(`claimable At ${await getBlock()}th block`);
    //     //     await checkC();
    //     //     console.log("");
    //     // }

    //     await mineTo(200);
    //     await table17Listeners.connect(alice).claim([0, 1, 2]);
    //     await table17Listeners.connect(bob).claim([0, 1, 2]);
    //     await table17Listeners.connect(carol).claim([0, 1, 2]);
    //     await mine();

    //     // console.log(
    //     //     "alice",
    //     //     (await mix.balanceOf(alice.address)).toString()
    //     // );
    //     // console.log(
    //     //     "bob",
    //     //     (await mix.balanceOf(bob.address)).toString()
    //     // );
    //     // console.log(
    //     //     "carol",
    //     //     (await mix.balanceOf(carol.address)).toString()
    //     // );
    // });
});
