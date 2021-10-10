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
        await mix.transfer(carol.address, initialBalance);

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
            expect(await turntables.claimableOf(ids[i]), `fail with table${ids[i]}`).to.be.closeTo(
                BigNumber.from(amounts[i]),
                20 //due to solidity math
            );
        }
    }

    async function checkClaimed(turntables: Turntables, ids: number[], amounts: BigNumberish[]) {
        const length = ids.length;
        for (let i = 0; i < length; i++) {
            expect(await turntables.claimedOf(ids[i]), `fail with ${i}th id`).to.be.closeTo(
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

        await turntables.setChargingEfficiency(500);
        amount = 330;
        await expect(turntables.connect(alice).charge(1, amount))
            .to.emit(turntables, "Charge")
            .withArgs(alice.address, 1, amount);
        end1 += Math.floor(((amount * lifetime0) / price0) * 5);
        expect((await turntables.turntables(1)).endBlock).to.be.equal(end1);

        await turntables.setChargingEfficiency(0);
        amount = 500;
        await expect(turntables.connect(alice).charge(1, amount))
            .to.emit(turntables, "Charge")
            .withArgs(alice.address, 1, amount);
        end1 += 0;
        expect((await turntables.turntables(1)).endBlock).to.be.equal(end1);
    });

    it("should be that functions related with a claim work properly", async () => {
        const { mix, turntables, booth, alice, bob } = await setupTest();

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
        // console.log(end0, end1, end2, end3, end4);  //321,322,323,624,850
        await turntables.connect(alice).charge(1, 1234);
        end1 += Math.floor(((1234 * 300) / 1000) * 2);
        rewardA = blockReward1.mul(10).div(totalVolume);
        let boothInc = BigNumber.from(1234).mul(3).div(1000);
        await expect(() => mine()).to.changeTokenBalances(mix, [alice, booth], [rewardA.sub(1234).add(1), boothInc]); //solidity math

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
        await expect(() => mine()).to.changeTokenBalances(mix, [alice, bob, booth], [diffA, diffB, 0]);
        // console.log(end0, end1, end2, end3, end4); //363,1110,377,624,850

        await mineTo(360);
        await turntables.connect(alice).destroy(1);
        await turntables.connect(bob).destroy(4);
        rewardA = blockReward1.mul(80).div(totalVolume);
        rewardB = blockReward4.mul(110).div(totalVolume);
        diffA = rewardA.add(500).add(1); //smath
        diffB = rewardB.add(1000);
        boothInc = BigNumber.from(1500).mul(3).div(1000);
        await expect(() => mine()).to.changeTokenBalances(mix, [alice, bob, booth], [diffA, diffB, boothInc]);
        // console.log(end0, end1, end2, end3, end4); //363,-,377,624,-

        oldTotalVolume = totalVolume;
        totalVolume = 40;
        //lastClaimed 280

        await mineTo(365);
        await turntables.connect(alice).claim([0]);
        await turntables.connect(bob).destroy(2);
        rewardA = blockReward0.mul(80).div(oldTotalVolume).add(blockReward0.mul(5).div(totalVolume));
        rewardB = blockReward2.mul(80).div(oldTotalVolume).add(blockReward2.mul(5).div(totalVolume));
        let realA = rewardA.mul(83).div(85);
        let burnA = rewardA.sub(realA);

        diffA = realA.add(1);
        diffB = rewardB.add(500).add(1);
        boothInc = burnA.mul(3).div(1000).add(BigNumber.from(500).mul(3).div(1000));
        await expect(() => mine()).to.changeTokenBalances(mix, [alice, bob, booth], [diffA, diffB, boothInc]);
        // console.log(end0, end1, end2, end3, end4); //363,-,-,624,-
        oldTotalVolume = totalVolume;
        totalVolume = 30;

        await mineTo(370);
        await turntables.connect(alice).claim([0]);
        rewardA = blockReward0.mul(5).div(totalVolume);
        realA = Zero;
        burnA = rewardA.sub(realA);
        diffA = realA;
        boothInc = burnA.mul(3).div(1000);
        await expect(() => mine()).to.changeTokenBalances(mix, [alice, booth], [diffA, boothInc]);

        await mineTo(375);
        await turntables.connect(alice).destroy(0);
        rewardA = blockReward0.mul(5).div(totalVolume);
        realA = Zero;
        burnA = rewardA.sub(realA);
        diffA = realA;
        boothInc = burnA.add(500).mul(3).div(1000);
        await expect(() => mine()).to.changeTokenBalances(mix, [alice, booth], [diffA.add(500), boothInc]);

        autoMining(true);
        await expect(turntables.connect(alice).claim([0])).to.be.reverted;
        await expect(turntables.connect(alice).claim([3])).to.be.reverted;
    });

    it("overall test", async () => {
        const { turntables, mix, emitter, alice, bob, carol, deployer, booth } = await setupTest();

        const startBlock = (await emitter.poolInfo(1)).lastEmitBlock;

        class Type {
            readonly price: number;
            readonly destroyReturn: number;
            readonly volume: number;
            readonly lifetime: number;
            constructor(price: number, destroyReturn: number, volume: number, lifetime: number) {
                this.price = price;
                this.destroyReturn = destroyReturn;
                this.volume = volume;
                this.lifetime = lifetime;
            }
        }

        let types: Type[] = [];
        types[0] = new Type(1000, 500, 10, 300);
        types[1] = new Type(1500, 1100, 30, 200);
        types[2] = new Type(600, 440, 60, 500);

        types[100] = new Type(0, 0, 0, 0); //for destroy.

        await turntables.addType(types[0].price, types[0].destroyReturn, types[0].volume, types[0].lifetime);
        await turntables.addType(types[1].price, types[1].destroyReturn, types[1].volume, types[1].lifetime);
        await turntables.addType(types[2].price, types[2].destroyReturn, types[2].volume, types[2].lifetime);
        await turntables.allowType(0);
        await turntables.allowType(1);
        await turntables.allowType(2);

        let claimed = Array.from(Array(10), () => Zero);
        let claimable = Array.from(Array(10), () => Zero);
        let tempClaimable = Array.from(Array(10), () => Zero);
        let lastUpdateBlock = startBlock.toNumber();

        class Table {
            user: SignerWithAddress;
            type: number;
            endBlock: number;
            lastClaimedBlock: number;

            constructor(user: SignerWithAddress, type: number, currentBlock: number) {
                this.user = user;
                this.type = type;
                this.endBlock = currentBlock + types[type].lifetime;
                this.lastClaimedBlock = currentBlock;
            }

            updateEndblock(newEndBlock: number) {
                this.endBlock = newEndBlock;
            }

            updateLastClaimedBlock(newLastClaimedBlock: number) {
                this.lastClaimedBlock = newLastClaimedBlock;
            }

            destroy() {
                this.user = 0 as any;
                this.type = 100;
                this.endBlock = 0;
            }
        }
        let table: Table[] = [];
        let totalBurned = Zero;
        let boothBalIni = Zero;

        let totalVolume = 0;
        let totalLength = 0;

        let chargingEfficiency = 2;

        async function checkClaim() {
            const length = table.length;
            const arr: number[] = [];
            for (let i = 0; i < length; i++) {
                arr[i] = i;
            }
            await checkClaimed(turntables, arr, [...claimed]);

            const arrClaimable: number[] = [];
            const liveClaimable: BigNumber[] = [];
            arr.forEach(i => {
                if (table[i].type !== 100) {
                    arrClaimable.push(i);
                    liveClaimable.push(claimable[i]);
                }
            });
            await checkClaimable(turntables, arrClaimable, liveClaimable);
        }

        async function updateClaim(indexes: number[]) {
            const lastBlock = await getBlock();
            const blocks = lastBlock - lastUpdateBlock;
            const reward = emissionPerBlock.div(2).mul(blocks);
            const length = totalLength;
            let burning = Zero;

            for (let i = 0; i < length; i++) {
                let increacement = reward.mul(types[table[i].type].volume).div(totalVolume);
                claimable[i] = tempClaimable[i].add(increacement);
                tempClaimable[i] = claimable[i];
                if (table[i].endBlock <= table[i].lastClaimedBlock) {
                    if (indexes.includes(i)) burning = burning.add(claimable[i]);
                    claimable[i] = Zero;
                } else if (table[i].endBlock < lastBlock) {
                    let realReward = claimable[i]
                        .mul(table[i].endBlock - table[i].lastClaimedBlock)
                        .div(lastBlock - table[i].lastClaimedBlock);
                    if (indexes.includes(i)) burning = burning.add(claimable[i].sub(realReward));
                    claimable[i] = realReward;
                }

                if (indexes.includes(i)) {
                    claimed[i] = claimed[i].add(claimable[i]);
                    claimable[i] = Zero;
                    tempClaimable[i] = Zero;
                    table[i].updateLastClaimedBlock(lastBlock);
                }
            }
            lastUpdateBlock = lastBlock;
            totalBurned = totalBurned.add(burning);
        }

        let aliceBaseBalance = initialBalance;
        let bobBaseBalance = initialBalance;
        let carolBaseBalance = initialBalance;

        function buy(user: SignerWithAddress, type: number, currentBlock: number) {
            totalVolume += types[type].volume;
            totalLength += 1;
            return new Table(user, type, currentBlock);
        }

        function destroy(ids: number[]) {
            for (let i = 0; i < ids.length; i++) {
                totalVolume -= types[table[ids[i]].type].volume;
                totalBurned = totalBurned.add(
                    types[table[ids[i]].type].price - types[table[ids[i]].type].destroyReturn
                );
                table[ids[i]].destroy();
            }
        }

        function updateEndBlock(ids: number[], amounts: number[]) {
            for (let i = 0; i < ids.length; i++) {
                if (table[ids[i]].endBlock <= lastUpdateBlock) {
                    const newEndBlock =
                        lastUpdateBlock +
                        Math.floor(
                            (types[table[ids[i]].type].lifetime * amounts[i] * chargingEfficiency) /
                                types[table[ids[i]].type].price
                        );
                    table[ids[i]].updateEndblock(newEndBlock);
                } else {
                    const newEndBlock =
                        table[ids[i]].endBlock +
                        Math.floor(
                            (types[table[ids[i]].type].lifetime * amounts[i] * chargingEfficiency) /
                                types[table[ids[i]].type].price
                        );

                    table[ids[i]].updateEndblock(newEndBlock);
                }
                totalBurned = totalBurned.add(amounts[i]);
            }
        }

        async function checkBurned() {
            expect(await mix.balanceOf(booth.address)).to.be.closeTo(boothBalIni.add(totalBurned.mul(3).div(1000)), 10);
        }

        lastUpdateBlock = 100;
        await mineTo(100);
        await turntables.connect(alice).buy(0);
        await updateClaim([]);
        table[0] = buy(alice, 0, await getBlock());
        aliceBaseBalance = aliceBaseBalance.sub(types[0].price);
        boothBalIni = await mix.balanceOf(booth.address);

        await turntables.connect(alice).buy(1);
        await updateClaim([]);
        table[1] = buy(alice, 1, await getBlock());
        aliceBaseBalance = aliceBaseBalance.sub(types[1].price);

        await turntables.connect(alice).buy(1);
        await updateClaim([]);
        table[2] = buy(alice, 1, await getBlock());
        aliceBaseBalance = aliceBaseBalance.sub(types[1].price);

        await turntables.connect(bob).buy(0);
        await updateClaim([]);
        table[3] = buy(bob, 0, await getBlock());
        bobBaseBalance = bobBaseBalance.sub(types[0].price);

        await turntables.connect(bob).buy(0);
        await updateClaim([]);
        table[4] = buy(bob, 0, await getBlock());
        bobBaseBalance = bobBaseBalance.sub(types[0].price);

        await turntables.connect(carol).buy(1);
        await updateClaim([]);
        table[5] = buy(carol, 1, await getBlock());
        carolBaseBalance = carolBaseBalance.sub(types[1].price);

        await turntables.connect(carol).buy(1);
        await updateClaim([]);
        table[6] = buy(carol, 1, await getBlock());
        carolBaseBalance = carolBaseBalance.sub(types[1].price);

        {
            expect((await turntables.turntables(0)).owner).to.be.equal(alice.address);
            expect((await turntables.turntables(1)).owner).to.be.equal(alice.address);
            expect((await turntables.turntables(2)).owner).to.be.equal(alice.address);
            expect((await turntables.turntables(3)).owner).to.be.equal(bob.address);
            expect((await turntables.turntables(4)).owner).to.be.equal(bob.address);
            expect((await turntables.turntables(5)).owner).to.be.equal(carol.address);
            expect((await turntables.turntables(6)).owner).to.be.equal(carol.address);

            expect((await turntables.turntables(0)).endBlock).to.be.equal(table[0].endBlock);
            expect((await turntables.turntables(1)).endBlock).to.be.equal(table[1].endBlock);
            expect((await turntables.turntables(2)).endBlock).to.be.equal(table[2].endBlock);
            expect((await turntables.turntables(3)).endBlock).to.be.equal(table[3].endBlock);
            expect((await turntables.turntables(4)).endBlock).to.be.equal(table[4].endBlock);
            expect((await turntables.turntables(5)).endBlock).to.be.equal(table[5].endBlock);
            expect((await turntables.turntables(6)).endBlock).to.be.equal(table[6].endBlock);
        }

        autoMining(false);
        await turntables.connect(alice).claim([0, 1, 2]);
        await turntables.connect(bob).claim([3, 4]);
        await turntables.connect(carol).claim([5, 6]);
        await mine();
        await updateClaim([0, 1, 2, 3, 4, 5, 6]);

        let aliceClaimed = () => {
            return claimed[0].add(claimed[1]).add(claimed[2]);
        };
        let bobClaimed = () => {
            return claimed[3].add(claimed[4]);
        };
        let carolClaimed = () => {
            return claimed[5].add(claimed[6]);
        };

        {
            await checkMixBalance(
                mix,
                [alice, bob, carol],
                [
                    aliceBaseBalance.add(aliceClaimed()),
                    bobBaseBalance.add(bobClaimed()),
                    carolBaseBalance.add(carolClaimed()),
                ]
            );
            await checkClaim();
        }

        await mine(10);

        await turntables.connect(alice).claim([0, 1]);
        await turntables.connect(bob).claim([3]);
        await mine();
        await updateClaim([0, 1, 3]);

        {
            await checkMixBalance(
                mix,
                [alice, bob, carol],
                [
                    aliceBaseBalance.add(aliceClaimed()),
                    bobBaseBalance.add(bobClaimed()),
                    carolBaseBalance.add(carolClaimed()),
                ]
            );
            await checkClaim();
        }

        await mine(15);
        await turntables.connect(bob).claim([3]);
        await turntables.connect(bob).claim([4]);
        await mine();
        await updateClaim([3, 4]);

        {
            await checkMixBalance(
                mix,
                [alice, bob, carol],
                [
                    aliceBaseBalance.add(aliceClaimed()),
                    bobBaseBalance.add(bobClaimed()),
                    carolBaseBalance.add(carolClaimed()),
                ]
            );
            await checkClaim();
        }

        await mine(3);
        await turntables.connect(carol).buy(2);
        await turntables.connect(alice).claim([0]);
        await mine();

        await updateClaim([0]);
        table[7] = buy(carol, 2, await getBlock());
        carolBaseBalance = carolBaseBalance.sub(types[2].price);
        carolClaimed = () => {
            return claimed[5].add(claimed[6]).add(claimed[7]);
        };

        {
            await checkMixBalance(
                mix,
                [alice, bob, carol],
                [
                    aliceBaseBalance.add(aliceClaimed()),
                    bobBaseBalance.add(bobClaimed()),
                    carolBaseBalance.add(carolClaimed()),
                ]
            );
            await checkClaim();
        }

        await mine(5);
        await turntables.connect(alice).buy(2);
        await turntables.connect(alice).claim([0, 1]);
        await mine();

        await updateClaim([0, 1]);
        table[8] = buy(alice, 2, await getBlock());
        aliceBaseBalance = aliceBaseBalance.sub(types[2].price);
        aliceClaimed = () => {
            return claimed[0].add(claimed[1]).add(claimed[2]).add(claimed[8]);
        };

        {
            await checkMixBalance(
                mix,
                [alice, bob, carol],
                [
                    aliceBaseBalance.add(aliceClaimed()),
                    bobBaseBalance.add(bobClaimed()),
                    carolBaseBalance.add(carolClaimed()),
                ]
            );
            await checkClaim();
        }

        await mine(5);
        await emitter.updatePool(1);
        await mine();
        expect((await turntables.turntables(5)).endBlock).to.be.equal(table[5].endBlock);

        await mine(3);
        await turntables.connect(alice).claim([0, 2, 8]);
        await turntables.connect(bob).claim([4]);
        await turntables.connect(carol).charge(5, 1000);
        await mine();

        await updateClaim([0, 2, 4, 5, 8]);
        updateEndBlock([5], [1000]);
        carolBaseBalance = carolBaseBalance.sub(1000);
        expect((await turntables.turntables(5)).endBlock).to.be.equal(table[5].endBlock);

        {
            await checkMixBalance(
                mix,
                [alice, bob, carol],
                [
                    aliceBaseBalance.add(aliceClaimed()),
                    bobBaseBalance.add(bobClaimed()),
                    carolBaseBalance.add(carolClaimed()),
                ]
            );
            await checkClaim();
        }

        await mine(13);
        await turntables.connect(alice).destroy(0);
        await turntables.connect(bob).charge(4, 300);
        await mine();

        await updateClaim([0, 4]);
        aliceBaseBalance = aliceBaseBalance.add(types[table[0].type].destroyReturn);
        destroy([0]);
        updateEndBlock([4], [300]);
        bobBaseBalance = bobBaseBalance.sub(300);
        expect((await turntables.turntables(4)).endBlock).to.be.equal(table[4].endBlock);

        {
            await checkMixBalance(
                mix,
                [alice, bob, carol],
                [
                    aliceBaseBalance.add(aliceClaimed()),
                    bobBaseBalance.add(bobClaimed()),
                    carolBaseBalance.add(carolClaimed()),
                ]
            );
            await checkClaim();
            await checkBurned();
        }

        await mine(13);
        await turntables.connect(alice).destroy(8);
        await turntables.connect(carol).charge(7, 1300);
        await mine();

        await updateClaim([7, 8]);
        aliceBaseBalance = aliceBaseBalance.add(types[table[8].type].destroyReturn);
        destroy([8]);
        updateEndBlock([7], [1300]);
        carolBaseBalance = carolBaseBalance.sub(1300);
        expect((await turntables.turntables(7)).endBlock).to.be.equal(table[7].endBlock);

        {
            await checkMixBalance(
                mix,
                [alice, bob, carol],
                [
                    aliceBaseBalance.add(aliceClaimed()),
                    bobBaseBalance.add(bobClaimed()),
                    carolBaseBalance.add(carolClaimed()),
                ]
            );
            await checkClaim();
            await checkBurned();
        }

        // console.log(await getBlock());
        // table.forEach((table,index) => {
        //     console.log(`${index} is `, table.endBlock)
        // })
        /**
            182

            0 is  0
            1 is  301
            2 is  302
            3 is  403
            4 is  584
            5 is  571
            6 is  306
            7 is  2804
            8 is  0
         */
        await mineTo(350);

        expect((await turntables.turntables(1)).endBlock).to.be.equal(table[1].endBlock);
        expect((await turntables.turntables(1)).endBlock).to.be.lt(await getBlock());
        await turntables.connect(alice).claim([1]);
        await turntables.connect(carol).destroy(7);
        await mine();

        await updateClaim([1, 7]);
        carolBaseBalance = carolBaseBalance.add(types[table[7].type].destroyReturn);
        destroy([7]);

        {
            await checkMixBalance(
                mix,
                [alice, bob, carol],
                [
                    aliceBaseBalance.add(aliceClaimed()),
                    bobBaseBalance.add(bobClaimed()),
                    carolBaseBalance.add(carolClaimed()),
                ]
            );
            await checkClaim();
            await checkBurned();
        }

        autoMining(true);
        await expect(() => turntables.connect(alice).claim([1])).to.changeTokenBalances(
            mix,
            [alice, booth],
            [0, emissionPerBlock.div(2).mul(types[table[1].type].volume).div(totalVolume).mul(3).div(1000)]
        );

        await updateClaim([1]);
        {
            await checkMixBalance(
                mix,
                [alice, bob, carol],
                [
                    aliceBaseBalance.add(aliceClaimed()),
                    bobBaseBalance.add(bobClaimed()),
                    carolBaseBalance.add(carolClaimed()),
                ]
            );
            await checkClaim();
            await checkBurned();
        }

        autoMining(false);
        await turntables.connect(alice).destroy(1);
        await turntables.connect(alice).destroy(2);
        await turntables.connect(carol).destroy(6);
        await mine();

        await updateClaim([1, 2, 6]);
        aliceBaseBalance = aliceBaseBalance
            .add(types[table[1].type].destroyReturn)
            .add(types[table[2].type].destroyReturn);
        carolBaseBalance = carolBaseBalance.add(types[table[6].type].destroyReturn);
        destroy([1, 2, 6]);

        {
            await checkMixBalance(
                mix,
                [alice, bob, carol],
                [
                    aliceBaseBalance.add(aliceClaimed()),
                    bobBaseBalance.add(bobClaimed()),
                    carolBaseBalance.add(carolClaimed()),
                ]
            );
            await checkClaim();
            await checkBurned();
        }
    });
});
