import { Mix, MixEmitter, Booth } from "../typechain";

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

    return {
        deployer,
        alice,
        bob,
        carol,
        mix,
        emitter,
        booth
    };
};

describe("Mix", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });

    it("has given data", async () => {
        const { mix } = await setupTest();

        expect(await mix.totalSupply()).to.be.equal(ethers.utils.parseEther("641920"))
        expect(await mix.name()).to.be.equal("DSC Mix")
        expect(await mix.symbol()).to.be.equal("MIX")
        expect(await mix.decimals()).to.be.equal(18)
    })

    it("check the deployer balance", async () => {
        const { deployer, mix } = await setupTest();

        expect(await mix.balanceOf(deployer.address)).to.be.equal(ethers.utils.parseEther("641920"))
    })

    it("should be that only owner can set emitter and booth", async () => {
        const { alice, mix, emitter, booth } = await setupTest();

        await expect(mix.connect(alice).setEmitter(emitter.address)).to.be.reverted;
        await expect(mix.connect(alice).setBooth(booth.address)).to.be.reverted;

        await mix.setEmitter(emitter.address);
        expect(await mix.emitter()).to.be.equal(emitter.address);
        await mix.setBooth(booth.address);
        expect(await mix.booth()).to.be.equal(booth.address);
    });

    it("should be that only emitter can mint mix token", async () => {
        const { alice, mix } = await setupTest();

        await expect(mix.connect(alice).mint(alice.address, 10000)).to.be.reverted;

        await mix.setEmitter(alice.address);
        expect(await mix.emitter()).to.be.equal(alice.address);
        await mix.connect(alice).mint(alice.address, 10000);
    });

    it("should be that 0.3% of the amount of burning token goes to the booth", async () => {
        const { deployer, alice, mix, booth } = await setupTest();

        await mix.setBooth(booth.address);
        await expect(() => mix.burn(10000)).to.changeTokenBalances(mix, [deployer, booth], [-10000, 30]);

        await mix.approve(alice.address, 10000);
        await expect(() => mix.connect(alice).burnFrom(deployer.address, 1000)).to.changeTokenBalances(mix, [deployer, alice, booth], [-1000, 0, 3]);
    });


});
