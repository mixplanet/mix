import { expect } from "chai";
import { ethers, network, waffle } from "hardhat";
import DogeSoundClubMateArtifact from "../artifacts/contracts/DogeSoundClubMate.sol/DogeSoundClubMate.json";
import DogeSoundClubSloganArtifact from "../artifacts/contracts/DogeSoundClubSlogan.sol/DogeSoundClubSlogan.json";
import { DogeSoundClubMate } from "../typechain/DogeSoundClubMate";
import { DogeSoundClubSlogan } from "../typechain/DogeSoundClubSlogan";

const { deployContract } = waffle;

async function mine(count = 1): Promise<void> {
    expect(count).to.be.gt(0);
    for (let i = 0; i < count; i += 1) {
        await ethers.provider.send("evm_mine", []);
    }
}

describe("DogeSoundClubSlogan", () => {
    let mate: DogeSoundClubMate;
    let slogan: DogeSoundClubSlogan;

    const provider = waffle.provider;
    const [admin, other] = provider.getWallets();

    beforeEach(async () => {
        mate = await deployContract(
            admin,
            DogeSoundClubMateArtifact,
            []
        ) as DogeSoundClubMate;
        slogan = await deployContract(
            admin,
            DogeSoundClubSloganArtifact,
            [mate.address]
        ) as DogeSoundClubSlogan;
    })

    context("new DogeSoundClubSlogan", async () => {
        it("has given data", async () => {
            expect(await slogan.HOLIDAY_PERIOD()).to.be.equal(0)
            expect(await slogan.REGISTER_CANDIDATE_PERIOD()).to.be.equal(1)
            expect(await slogan.VOTE_PERIOD()).to.be.equal(2)
        })

        it("set period", async () => {
            await slogan.setHolidayInterval(20);
            await slogan.setCandidateInterval(20);
            await slogan.setVoteInterval(20);

            expect(await slogan.round()).to.be.equal(0)

            await network.provider.send("evm_setAutomine", [false]);
            await mine(60);
            await network.provider.send("evm_setAutomine", [true]);

            expect(await slogan.round()).to.be.equal(1)

            await slogan.setHolidayInterval(20);
            await slogan.setCandidateInterval(20);
            await slogan.setVoteInterval(20);

            await network.provider.send("evm_setAutomine", [false]);
            await mine(60);
            await network.provider.send("evm_setAutomine", [true]);

            expect(await slogan.round()).to.be.equal(2)

            await network.provider.send("evm_setAutomine", [false]);
            for (let i = 3; i <= 10; i += 1) {
                await mine(60);
                expect(await slogan.round()).to.be.equal(i)
            }
            await network.provider.send("evm_setAutomine", [true]);

            await slogan.setHolidayInterval(60);
            await slogan.setCandidateInterval(60);
            await slogan.setVoteInterval(60);

            await network.provider.send("evm_setAutomine", [false]);
            await mine(180);
            await network.provider.send("evm_setAutomine", [true]);

            expect(await slogan.round()).to.be.equal(11)
        })

        it("register candidate", async () => {

            for (let i = 0; i < 40; i += 1) {
                await mate.mint(admin.address, i);
            }

            await slogan.setHolidayInterval(20);
            await slogan.setCandidateInterval(20);
            await slogan.setVoteInterval(20);

            await network.provider.send("evm_setAutomine", [false]);
            await mine(20);
            await network.provider.send("evm_setAutomine", [true]);

            await slogan.registerCandidate("도지사운드클럽", 20);
            expect(await slogan.candidateCount(0)).to.be.equal(1)
            expect(await slogan.candidate(0, 0)).to.be.equal("도지사운드클럽")

            await slogan.registerCandidate("최고야!", 20);
            expect(await slogan.candidateCount(0)).to.be.equal(2)
            expect(await slogan.candidate(0, 1)).to.be.equal("최고야!")
        })

        it("vote", async () => {

            await mate.addMinter(other.address);

            for (let i = 0; i < 50; i += 1) {
                await mate.mint(admin.address, i);
            }

            for (let i = 50; i < 80; i += 1) {
                await mate.mint(other.address, i);
            }

            await slogan.setHolidayInterval(20);
            await slogan.setCandidateInterval(20);
            await slogan.setVoteInterval(20);

            await network.provider.send("evm_setAutomine", [false]);
            await mine(20);
            await network.provider.send("evm_setAutomine", [true]);

            await slogan.registerCandidate("도지사운드클럽", 20);
            expect(await slogan.candidateCount(0)).to.be.equal(1)
            expect(await slogan.candidate(0, 0)).to.be.equal("도지사운드클럽")

            await slogan.registerCandidate("최고야!", 20);
            expect(await slogan.candidateCount(0)).to.be.equal(2)
            expect(await slogan.candidate(0, 1)).to.be.equal("최고야!")
            
            await slogan.connect(other).registerCandidate("오케이 땡큐!", 20);
            expect(await slogan.candidateCount(0)).to.be.equal(3)
            expect(await slogan.candidate(0, 2)).to.be.equal("오케이 땡큐!")
            expect(await slogan.candidateRegister(0, 2)).to.be.equal(other.address)

            await network.provider.send("evm_setAutomine", [false]);
            await mine(20);
            await network.provider.send("evm_setAutomine", [true]);

            await slogan.vote(2, 10);
            await slogan.connect(other).vote(1, 10);
            expect(await slogan.elected(0)).to.be.equal(1)
            expect(await slogan.totalVotes(0)).to.be.equal(80)
            expect(await slogan.userVotes(0, admin.address)).to.be.equal(50)

            await mine(200);
            expect(await slogan.elected(0)).to.be.equal(1)
        })
    })
})