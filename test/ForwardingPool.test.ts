import { ForwardingPool, MixEmitter, Mix, Booth } from "../typechain";

import { ethers } from "hardhat";
import { expect } from "chai";
import { BigNumber } from "ethers";
import { mine } from "./utils/blockchain";

const emissionPerBlock = BigNumber.from("1000000");
const setupTest = async () => {
    const signers = await ethers.getSigners();
    const [deployer, alice, bob, carol, receiver] = signers;

    const Mix = await ethers.getContractFactory("Mix");
    const mix = (await Mix.deploy()) as Mix;

    const MixEmitter = await ethers.getContractFactory("MixEmitter");
    const emitter = (await MixEmitter.deploy(mix.address, emissionPerBlock)) as MixEmitter;

    const Booth = await ethers.getContractFactory("Booth");
    const booth = (await Booth.deploy(mix.address)) as Booth;

    await mix.setEmitter(emitter.address);
    await mix.setBooth(booth.address);

    const ForwardingPool = await ethers.getContractFactory("ForwardingPool");
    const forwarding = (await ForwardingPool.deploy(emitter.address, 0, receiver.address)) as ForwardingPool;

    await emitter.add(forwarding.address, 100);

    return {
        deployer,
        alice,
        bob,
        carol,
        mix,
        booth,
        emitter,
        forwarding,
        receiver
    };
};

describe("ForwardingPool", () => {
    beforeEach(async () => {
        await ethers.provider.send("hardhat_reset", []);
    });

    it("overall test", async () => {
        const { alice, mix, receiver, emitter, forwarding } = await setupTest();

        await expect(forwarding.connect(alice).setTo(alice.address)).to.be.reverted;
        await expect(forwarding.connect(alice).forward()).to.be.reverted;

        await forwarding.setTo(alice.address);
        expect(await forwarding.to()).to.be.equal(alice.address);

        await forwarding.setTo(receiver.address);
        expect(await forwarding.to()).to.be.equal(receiver.address);

        await emitter.start();
        expect(await mix.balanceOf(receiver.address)).to.be.equal(0);
        await forwarding.forward();
        expect(await mix.balanceOf(receiver.address)).to.be.equal(emissionPerBlock);

        await mine(9);
        await forwarding.forward();
        expect(await mix.balanceOf(receiver.address)).to.be.equal(emissionPerBlock.mul(11));

        await forwarding.setTo(alice.address);
        await forwarding.forward();
        expect(await mix.balanceOf(alice.address)).to.be.equal(emissionPerBlock.mul(2));
    });
});
