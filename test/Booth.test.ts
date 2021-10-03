import { Booth, Mix } from "../typechain";

import { ethers } from "hardhat";
import { expect } from "chai";

const setupTest = async () => {
    const signers = await ethers.getSigners();
    const [deployer, alice, bob, carol] = signers;

    const Mix = await ethers.getContractFactory("Mix");
    const mix = (await Mix.deploy()) as Mix;

    const Booth = await ethers.getContractFactory("Booth");
    const booth = (await Booth.deploy(mix.address)) as Booth;

    return {
        deployer,
        alice,
        bob,
        carol,
        mix,
        booth,
    };
};

describe("Booth", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });

    it("should be that stake function works well", async () => {
        const { alice, mix, booth } = await setupTest();

        const value0 = 15000;
        const value1 = 6000;

        await mix.transfer(alice.address, value0);

        expect(await mix.balanceOf(alice.address)).to.be.equal(value0);
        expect(await booth.balanceOf(alice.address)).to.be.equal(0);

        await mix.connect(alice).approve(booth.address, 1000000);
        await expect(() => booth.connect(alice).stake(value1)).to.changeTokenBalances(
            mix,
            [alice, booth],
            [-value1, value1]
        );

        expect(await mix.balanceOf(alice.address)).to.be.equal(value0 - value1);
        expect(await booth.balanceOf(alice.address)).to.be.equal(value1);

        await mix.transfer(booth.address, value1); //2 MIX = 1 MIXSET
        expect(await mix.balanceOf(booth.address)).to.be.equal(value1 * 2);

        await expect(() => booth.connect(alice).stake(value1)).to.changeTokenBalance(booth, alice, value1 / 2);
        expect(await booth.balanceOf(alice.address)).to.be.equal((value1 * 3) / 2);
    });

    it("should be that unstake function works well", async () => {
        const { alice, mix, booth } = await setupTest();

        const value0 = 15000;
        const value1 = 6000;

        await mix.transfer(alice.address, value0);
        await mix.connect(alice).approve(booth.address, 1000000);
        await booth.connect(alice).stake(value0);

        expect(await mix.balanceOf(alice.address)).to.be.equal(0);
        expect(await booth.balanceOf(alice.address)).to.be.equal(value0);

        await expect(() => booth.connect(alice).unstake(value1)).to.changeTokenBalances(
            mix,
            [alice, booth],
            [value1, -value1]
        );

        expect(await mix.balanceOf(alice.address)).to.be.equal(value1);
        expect(await mix.balanceOf(booth.address)).to.be.equal(value0 - value1);
        expect(await booth.balanceOf(alice.address)).to.be.equal(value0 - value1);

        await mix.transfer(booth.address, value0 - value1); //2 MIX = 1 MIXSET
        await expect(() => booth.connect(alice).unstake(value1)).to.changeTokenBalance(mix, alice, value1 * 2);
    });
});
