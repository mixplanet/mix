import { Mix, MixEmitter, Booth, BurnPool } from "../typechain";
import { mineTo } from "./utils/blockchain";

import { ethers } from "hardhat";
import { expect } from "chai";

const setupTest = async () => {
    const signers = await ethers.getSigners();
    const [deployer, alice, bob, carol] = signers;

    const Mix = await ethers.getContractFactory("Mix");
    const mix = (await Mix.deploy()) as Mix;

    const MixEmitter = await ethers.getContractFactory("MixEmitter");
    const emitter = (await MixEmitter.deploy(mix.address, 10000)) as MixEmitter;

    const Booth = await ethers.getContractFactory("Booth");
    const booth = (await Booth.deploy(mix.address)) as Booth;

    await mix.setEmitter(emitter.address);
    await mix.setBooth(booth.address);

    const BurnPool = await ethers.getContractFactory("BurnPool");
    const burnPool = (await BurnPool.deploy(emitter.address, 0)) as BurnPool;

    await emitter.add(burnPool.address, 700);
    await emitter.add(bob.address, 200);
    await emitter.add(carol.address, 100);

    return {
        deployer,
        alice,
        bob,
        carol,
        mix,
        emitter,
        booth,
        burnPool,
    };
};

describe("BurnPool", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });

    it("should be that burn function works well", async () => {
        const { mix, emitter, booth, burnPool } = await setupTest();

        await mineTo(100);
        await emitter.start(); //100b

        await mineTo(110);
        const rewardP0 = 10000 * 10 * 0.7;
        await expect(() => burnPool.burn()).to.changeTokenBalances(
            mix,
            [emitter, burnPool, booth],
            [0, 0, rewardP0 * 0.003]
        );
    });
});
