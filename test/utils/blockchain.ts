import { expect } from "chai";
import { ethers, network } from "hardhat";

export const getBlock = async (): Promise<number> => {
    return await ethers.provider.getBlockNumber();
};

export const mine = async (count = 1): Promise<void> => {
    expect(count).to.be.gt(0);
    for (let i = 0; i < count; i++) {
        await ethers.provider.send("evm_mine", []);
    }
};

export const autoMining = async (setting: boolean) => {
    await network.provider.send("evm_setAutomine", [setting]);
};

export const mineTo = async (block: number) => {
    await mine(block - (await ethers.provider.getBlockNumber()) - 1);
};