import hardhat from "hardhat";

async function main() {
    console.log("deploy start")

    const DSCFungibleToken = await hardhat.ethers.getContractFactory("DSCFungibleToken")
    const token = await DSCFungibleToken.deploy()
    console.log(`DSCFungibleToken address: ${token.address}`)
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
