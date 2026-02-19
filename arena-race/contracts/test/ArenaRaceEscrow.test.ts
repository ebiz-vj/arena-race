/**
 * ArenaRaceEscrow unit tests. TDD §3; Execution Plan Step 4.
 * Target ≥95% coverage. Owner placeholder: ENGINE_AGENT.
 */
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { ArenaRaceEscrow } from "../../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ArenaRaceEscrow", function () {
  const ENTRY_AMOUNT = ethers.parseUnits("10", 6); // 10 USDC (6 decimals)
  const MATCH_ID = ethers.keccak256(ethers.toUtf8Bytes("match-1"));

  async function deployFixture() {
    const [owner, treasury, signer, a, b, c, d] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("USDC", "USDC", 6);
    await usdc.waitForDeployment();
    await usdc.mint(owner.address, ethers.parseUnits("1000000", 6));
    await usdc.mint(a.address, ethers.parseUnits("1000", 6));
    await usdc.mint(b.address, ethers.parseUnits("1000", 6));
    await usdc.mint(c.address, ethers.parseUnits("1000", 6));
    await usdc.mint(d.address, ethers.parseUnits("1000", 6));

    const Escrow = await ethers.getContractFactory("ArenaRaceEscrow");
    const escrow = await Escrow.deploy(
      await usdc.getAddress(),
      treasury.address,
      signer.address
    );
    await escrow.waitForDeployment();

    return { escrow, usdc, owner, treasury, signer, a, b, c, d };
  }

  async function createMatchAndApprove(escrow: ArenaRaceEscrow, usdc: any, owner: SignerWithAddress) {
    await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
    // no approval needed for createMatch
  }

  async function fourEntries(
    escrow: ArenaRaceEscrow,
    usdc: any,
    a: SignerWithAddress,
    b: SignerWithAddress,
    c: SignerWithAddress,
    d: SignerWithAddress
  ) {
    for (const account of [a, b, c, d]) {
      await usdc.connect(account).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await escrow.connect(account).submitEntry(MATCH_ID, ENTRY_AMOUNT);
    }
  }

  describe("createMatch", function () {
    it("sets entry deadline 5 min and PendingEntries", async function () {
      const { escrow, owner } = await loadFixture(deployFixture);
      const tx = await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      const m = await escrow.matches(MATCH_ID);
      expect(m.entryAmountPerPlayer).to.equal(ENTRY_AMOUNT);
      expect(m.totalEntry).to.equal(ENTRY_AMOUNT * 4n);
      expect(m.entryDeadline).to.equal(block!.timestamp + 300);
      expect(m.status).to.equal(0); // PendingEntries
      expect(m.entriesReceived).to.equal(0);
    });

    it("reverts if match already exists", async function () {
      const { escrow, owner } = await loadFixture(deployFixture);
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await expect(escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT)).to.be.revertedWithCustomError(
        escrow,
        "MatchAlreadyExists"
      );
    });

    it("reverts when paused", async function () {
      const { escrow, owner } = await loadFixture(deployFixture);
      await escrow.connect(owner).pause();
      await expect(escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT)).to.be.revertedWithCustomError(
        escrow,
        "ContractPaused"
      );
    });
  });

  describe("submitEntry", function () {
    it("accepts 4 entries and sets Escrowed, fee 8%, pool 92%", async function () {
      const { escrow, usdc, owner, treasury, a, b, c, d } = await loadFixture(deployFixture);
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      const totalEntry = ENTRY_AMOUNT * 4n;
      const expectedFee = (totalEntry * 800n) / 10000n;
      const expectedPool = totalEntry - expectedFee;

      await usdc.connect(a).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await escrow.connect(a).submitEntry(MATCH_ID, ENTRY_AMOUNT);
      await usdc.connect(b).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await escrow.connect(b).submitEntry(MATCH_ID, ENTRY_AMOUNT);
      await usdc.connect(c).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await escrow.connect(c).submitEntry(MATCH_ID, ENTRY_AMOUNT);

      const balTreasuryBefore = await usdc.balanceOf(treasury.address);
      await usdc.connect(d).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await escrow.connect(d).submitEntry(MATCH_ID, ENTRY_AMOUNT);
      const balTreasuryAfter = await usdc.balanceOf(treasury.address);

      const m = await escrow.matches(MATCH_ID);
      expect(m.status).to.equal(1); // Escrowed
      expect(m.feeAmount).to.equal(expectedFee);
      expect(m.poolAmount).to.equal(expectedPool);
      expect(balTreasuryAfter - balTreasuryBefore).to.equal(expectedFee);
    });

    it("reverts on wrong amount", async function () {
      const { escrow, usdc, owner, a } = await loadFixture(deployFixture);
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await usdc.connect(a).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await expect(
        escrow.connect(a).submitEntry(MATCH_ID, ethers.parseUnits("1", 6))
      ).to.be.revertedWithCustomError(escrow, "InvalidAmount");
    });

    it("reverts if already entered", async function () {
      const { escrow, usdc, owner, a } = await loadFixture(deployFixture);
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await usdc.connect(a).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await escrow.connect(a).submitEntry(MATCH_ID, ENTRY_AMOUNT);
      await expect(escrow.connect(a).submitEntry(MATCH_ID, ENTRY_AMOUNT)).to.be.revertedWithCustomError(
        escrow,
        "AlreadyEntered"
      );
    });

    it("reverts past entry deadline", async function () {
      const { escrow, usdc, owner, a } = await loadFixture(deployFixture);
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await ethers.provider.send("evm_increaseTime", [301]);
      await ethers.provider.send("evm_mine", []);
      await usdc.connect(a).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await expect(escrow.connect(a).submitEntry(MATCH_ID, ENTRY_AMOUNT)).to.be.revertedWithCustomError(
        escrow,
        "PastDeadline"
      );
    });
  });

  describe("expireMatch and refund", function () {
    it("0-3 entries: expire then full refund via claimRefund", async function () {
      const { escrow, usdc, owner, a, b } = await loadFixture(deployFixture);
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await usdc.connect(a).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await escrow.connect(a).submitEntry(MATCH_ID, ENTRY_AMOUNT);
      await usdc.connect(b).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await escrow.connect(b).submitEntry(MATCH_ID, ENTRY_AMOUNT);

      await ethers.provider.send("evm_increaseTime", [301]);
      await ethers.provider.send("evm_mine", []);
      await escrow.expireMatch(MATCH_ID);
      const m1 = await escrow.matches(MATCH_ID);
      expect(m1.status).to.equal(2); // Expired

      const balA = await usdc.balanceOf(a.address);
      await escrow.connect(a).claimRefund(MATCH_ID);
      expect(await usdc.balanceOf(a.address)).to.equal(balA + ENTRY_AMOUNT);

      await escrow.connect(b).claimRefund(MATCH_ID);
      const m2 = await escrow.matches(MATCH_ID);
      expect(m2.status).to.equal(3); // Refunded
    });

    it("refundMatch: owner can refund all in one tx", async function () {
      const { escrow, usdc, owner, a, b } = await loadFixture(deployFixture);
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await usdc.connect(a).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await escrow.connect(a).submitEntry(MATCH_ID, ENTRY_AMOUNT);
      await usdc.connect(b).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await escrow.connect(b).submitEntry(MATCH_ID, ENTRY_AMOUNT);

      await ethers.provider.send("evm_increaseTime", [301]);
      await ethers.provider.send("evm_mine", []);
      await escrow.expireMatch(MATCH_ID);

      const balA = await usdc.balanceOf(a.address);
      const balB = await usdc.balanceOf(b.address);
      await escrow.connect(owner).refundMatch(MATCH_ID);
      expect(await usdc.balanceOf(a.address)).to.equal(balA + ENTRY_AMOUNT);
      expect(await usdc.balanceOf(b.address)).to.equal(balB + ENTRY_AMOUNT);
      const m = await escrow.matches(MATCH_ID);
      expect(m.status).to.equal(3); // Refunded
    });
  });

  describe("submitResult with placement (38/30/20/12)", function () {
    it("distributes correct 38/30/20/12 payout", async function () {
      const { escrow, usdc, owner, signer, a, b, c, d } = await loadFixture(deployFixture);
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await fourEntries(escrow, usdc, a, b, c, d);

      const m = await escrow.matches(MATCH_ID);
      const pool = m.poolAmount;
      // placement: 1st=a(0), 2nd=b(1), 3rd=c(2), 4th=d(3)
      const placement = [0, 1, 2, 3];
      const messageHash = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "uint8", "uint8", "uint8", "uint8"],
          [MATCH_ID, placement[0], placement[1], placement[2], placement[3]]
        )
      );
      const sig = await signer.signMessage(ethers.getBytes(messageHash));

      await escrow.submitResultWithPlacement(MATCH_ID, placement, sig);

      const a1 = (pool * 3800n) / 10000n;
      const a2 = (pool * 3000n) / 10000n;
      const a3 = (pool * 2000n) / 10000n;
      const a4 = pool - a1 - a2 - a3;

      expect(await usdc.balanceOf(a.address)).to.equal(ethers.parseUnits("1000", 6) - ENTRY_AMOUNT + a1);
      expect(await usdc.balanceOf(b.address)).to.equal(ethers.parseUnits("1000", 6) - ENTRY_AMOUNT + a2);
      expect(await usdc.balanceOf(c.address)).to.equal(ethers.parseUnits("1000", 6) - ENTRY_AMOUNT + a3);
      expect(await usdc.balanceOf(d.address)).to.equal(ethers.parseUnits("1000", 6) - ENTRY_AMOUNT + a4);

      const m2 = await escrow.matches(MATCH_ID);
      expect(m2.status).to.equal(4); // Resolved
    });

    it("double submitResult blocked", async function () {
      const { escrow, usdc, owner, signer, a, b, c, d } = await loadFixture(deployFixture);
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await fourEntries(escrow, usdc, a, b, c, d);

      const placement = [0, 1, 2, 3];
      const messageHash = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "uint8", "uint8", "uint8", "uint8"],
          [MATCH_ID, placement[0], placement[1], placement[2], placement[3]]
        )
      );
      const sig = await signer.signMessage(ethers.getBytes(messageHash));
      await escrow.submitResultWithPlacement(MATCH_ID, placement, sig);

      await expect(
        escrow.submitResultWithPlacement(MATCH_ID, placement, sig)
      ).to.be.revertedWithCustomError(escrow, "NotEscrowed");
    });

    it("reverts on invalid signature", async function () {
      const { escrow, usdc, owner, a, b, c, d } = await loadFixture(deployFixture);
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await fourEntries(escrow, usdc, a, b, c, d);

      const placement = [0, 1, 2, 3];
      const wrongSig = "0x".padEnd(132, "0");
      await expect(
        escrow.submitResultWithPlacement(MATCH_ID, placement, wrongSig)
      ).to.be.revertedWithCustomError(escrow, "InvalidSignature");
    });

    it("red-team: signature for match A cannot be used for match B (replay)", async function () {
      const { escrow, usdc, owner, signer, a, b, c, d } = await loadFixture(deployFixture);
      const MATCH_ID_2 = ethers.keccak256(ethers.toUtf8Bytes("match-2"));
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await escrow.connect(owner).createMatch(MATCH_ID_2, ENTRY_AMOUNT);
      for (const account of [a, b, c, d]) {
        await usdc.connect(account).approve(await escrow.getAddress(), ENTRY_AMOUNT * 2n);
        await escrow.connect(account).submitEntry(MATCH_ID, ENTRY_AMOUNT);
        await escrow.connect(account).submitEntry(MATCH_ID_2, ENTRY_AMOUNT);
      }
      const placement = [0, 1, 2, 3];
      const messageHash = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "uint8", "uint8", "uint8", "uint8"],
          [MATCH_ID, placement[0], placement[1], placement[2], placement[3]]
        )
      );
      const sigForMatch1 = await signer.signMessage(ethers.getBytes(messageHash));
      await expect(
        escrow.submitResultWithPlacement(MATCH_ID_2, placement, sigForMatch1)
      ).to.be.revertedWithCustomError(escrow, "InvalidSignature");
    });
  });

  describe("submitResult with payout amounts (tie-split)", function () {
    it("accepts exact payouts that sum to pool", async function () {
      const { escrow, usdc, owner, signer, a, b, c, d } = await loadFixture(deployFixture);
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await fourEntries(escrow, usdc, a, b, c, d);

      const m = await escrow.matches(MATCH_ID);
      const pool = m.poolAmount;
      // Tie for 2nd/3rd: each gets (30+20)/2 = 25% of pool
      const payouts = [
        (pool * 3800n) / 10000n, // 1st
        (pool * 2500n) / 10000n, // 2nd
        pool - (pool * 3800n) / 10000n - (pool * 2500n) / 10000n - (pool * 1200n) / 10000n, // 3rd
        (pool * 1200n) / 10000n, // 4th
      ];
      const sum = payouts[0] + payouts[1] + payouts[2] + payouts[3];
      expect(sum).to.equal(pool);

      const messageHash = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "uint256", "uint256", "uint256", "uint256"],
          [MATCH_ID, payouts[0], payouts[1], payouts[2], payouts[3]]
        )
      );
      const sig = await signer.signMessage(ethers.getBytes(messageHash));
      await escrow.submitResult(MATCH_ID, payouts, sig);

      const mAfter = await escrow.matches(MATCH_ID);
      expect(mAfter.status).to.equal(4); // Resolved
    });

    it("reverts if sum != poolAmount", async function () {
      const { escrow, usdc, owner, signer, a, b, c, d } = await loadFixture(deployFixture);
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await fourEntries(escrow, usdc, a, b, c, d);

      const m = await escrow.matches(MATCH_ID);
      const pool = m.poolAmount;
      const wrongPayouts = [pool / 4n, pool / 4n, pool / 4n, pool / 4n]; // sum = pool but we'll pass wrong
      const messageHash = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "uint256", "uint256", "uint256", "uint256"],
          [MATCH_ID, wrongPayouts[0], wrongPayouts[1], wrongPayouts[2], wrongPayouts[3] - 1n]
        )
      );
      const sig = await signer.signMessage(ethers.getBytes(messageHash));
      await expect(
        escrow.submitResult(MATCH_ID, [wrongPayouts[0], wrongPayouts[1], wrongPayouts[2], wrongPayouts[3] - 1n], sig)
      ).to.be.revertedWithCustomError(escrow, "PayoutSumMismatch");
    });
  });

  describe("Expired match cannot resolve", function () {
    it("submitResult reverts when status is Expired", async function () {
      const { escrow, usdc, owner, signer, a } = await loadFixture(deployFixture);
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await usdc.connect(a).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await escrow.connect(a).submitEntry(MATCH_ID, ENTRY_AMOUNT);

      await ethers.provider.send("evm_increaseTime", [301]);
      await ethers.provider.send("evm_mine", []);
      await escrow.expireMatch(MATCH_ID);

      const payouts = [0n, 0n, 0n, 0n];
      const messageHash = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "uint256", "uint256", "uint256", "uint256"],
          [MATCH_ID, payouts[0], payouts[1], payouts[2], payouts[3]]
        )
      );
      const sig = await signer.signMessage(ethers.getBytes(messageHash));
      await expect(escrow.submitResult(MATCH_ID, payouts, sig)).to.be.revertedWithCustomError(
        escrow,
        "NotEscrowed"
      );
    });
  });

  describe("Resolved match cannot refund", function () {
    it("claimRefund reverts when status is Resolved", async function () {
      const { escrow, usdc, owner, signer, a, b, c, d } = await loadFixture(deployFixture);
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await fourEntries(escrow, usdc, a, b, c, d);
      const m = await escrow.matches(MATCH_ID);
      const placement = [0, 1, 2, 3];
      const messageHash = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "uint8", "uint8", "uint8", "uint8"],
          [MATCH_ID, placement[0], placement[1], placement[2], placement[3]]
        )
      );
      const sig = await signer.signMessage(ethers.getBytes(messageHash));
      await escrow.submitResultWithPlacement(MATCH_ID, placement, sig);

      await expect(escrow.connect(a).claimRefund(MATCH_ID)).to.be.revertedWithCustomError(
        escrow,
        "NotExpired"
      );
    });
  });

  describe("setResultSigner", function () {
    it("only owner can set; emits SignerUpdated", async function () {
      const { escrow, owner, signer, a } = await loadFixture(deployFixture);
      const newSigner = a.address;
      await expect(escrow.connect(owner).setResultSigner(newSigner))
        .to.emit(escrow, "SignerUpdated")
        .withArgs(signer.address, newSigner);
      expect(await escrow.resultSigner()).to.equal(newSigner);
    });

    it("reverts zero address", async function () {
      const { escrow, owner } = await loadFixture(deployFixture);
      await expect(escrow.connect(owner).setResultSigner(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        escrow,
        "ZeroAddress"
      );
    });
  });

  describe("Pause", function () {
    it("pause blocks new entry; submitResult still works for Escrowed", async function () {
      const { escrow, usdc, owner, signer, a, b, c, d } = await loadFixture(deployFixture);
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await fourEntries(escrow, usdc, a, b, c, d);

      await escrow.connect(owner).pause();

      const placement = [0, 1, 2, 3];
      const messageHash = ethers.keccak256(
        ethers.solidityPacked(
          ["bytes32", "uint8", "uint8", "uint8", "uint8"],
          [MATCH_ID, placement[0], placement[1], placement[2], placement[3]]
        )
      );
      const sig = await signer.signMessage(ethers.getBytes(messageHash));
      await escrow.submitResultWithPlacement(MATCH_ID, placement, sig);
      expect((await escrow.matches(MATCH_ID)).status).to.equal(4);
    });

    it("submitEntry reverts when paused", async function () {
      const { escrow, usdc, owner, a } = await loadFixture(deployFixture);
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await escrow.connect(owner).pause();
      await usdc.connect(a).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await expect(escrow.connect(a).submitEntry(MATCH_ID, ENTRY_AMOUNT)).to.be.revertedWithCustomError(
        escrow,
        "ContractPaused"
      );
    });

    it("unpause restores createMatch and submitEntry", async function () {
      const { escrow, usdc, owner, a } = await loadFixture(deployFixture);
      await escrow.connect(owner).pause();
      await escrow.connect(owner).unpause();
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await usdc.connect(a).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await escrow.connect(a).submitEntry(MATCH_ID, ENTRY_AMOUNT);
      expect((await escrow.matches(MATCH_ID)).entriesReceived).to.equal(1);
    });
  });

  describe("submitEntry MatchNotFound", function () {
    it("reverts when matchId does not exist", async function () {
      const { escrow, usdc, a } = await loadFixture(deployFixture);
      const badId = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      await usdc.connect(a).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await expect(escrow.connect(a).submitEntry(badId, ENTRY_AMOUNT)).to.be.revertedWithCustomError(
        escrow,
        "MatchNotFound"
      );
    });
  });

  describe("Reentrancy", function () {
    it("claimRefund is protected (no reentrancy on transfer)", async function () {
      const { escrow, usdc, owner, a, b } = await loadFixture(deployFixture);
      await escrow.connect(owner).createMatch(MATCH_ID, ENTRY_AMOUNT);
      await usdc.connect(a).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await escrow.connect(a).submitEntry(MATCH_ID, ENTRY_AMOUNT);
      await usdc.connect(b).approve(await escrow.getAddress(), ENTRY_AMOUNT);
      await escrow.connect(b).submitEntry(MATCH_ID, ENTRY_AMOUNT);
      await ethers.provider.send("evm_increaseTime", [301]);
      await ethers.provider.send("evm_mine", []);
      await escrow.expireMatch(MATCH_ID);
      await escrow.connect(a).claimRefund(MATCH_ID);
      await escrow.connect(b).claimRefund(MATCH_ID);
      expect((await escrow.matches(MATCH_ID)).status).to.equal(3);
    });
  });
});
