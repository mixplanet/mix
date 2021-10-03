import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "dotenv/config";
import "@typechain/hardhat";
import { HardhatUserConfig } from "hardhat/types";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.5.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    kovan: {
      url: `https://kovan.infura.io/v3/${process.env.INFURA_API_KEY}`,
      accounts: [process.env.ADMIN || '0x0000000000000000000000000000000000000000000000000000000000000000'],
      chainId: 42,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },
};

export default config;
