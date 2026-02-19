/**
 * Step 5 — Deploy to Testnet.
 * Deploys MockERC20 (optional) + ArenaRaceEscrow to Sepolia.
 *
 * Usage:
 *   With mock USDC (for self-contained testnet testing):
 *     npx hardhat run contracts/scripts/deploy.ts --network sepolia
 *
 *   With existing USDC (set USDC_ADDRESS env):
 *     USDC_ADDRESS=0x... npx hardhat run contracts/scripts/deploy.ts --network sepolia
 *
 * Env: DEPLOYER_PRIVATE_KEY, SEPOLIA_RPC_URL, (optional) USDC_ADDRESS, ETHERSCAN_API_KEY for verify
 */
import { ethers } from "hardhat";

const ENTRY_AMOUNT = ethers.parseUnits("10", 6); // 10 USDC (6 decimals)

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  let usdcAddress = process.env.USDC_ADDRESS;
  if (!usdcAddress) {
    console.log("USDC_ADDRESS not set — deploying MockERC20 as test USDC...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const usdc = await MockERC20.deploy("Test USDC", "USDC", 6);
    await usdc.waitForDeployment();
    usdcAddress = await usdc.getAddress();
    console.log("MockERC20 (test USDC) deployed at:", usdcAddress);
    // Mint to deployer for testing
    await usdc.mint(deployer.address, ethers.parseUnits("1000000", 6));
    console.log("Minted 1M test USDC to deployer.");
  } else {
    console.log("Using existing USDC at:", usdcAddress);
  }

  const treasury = process.env.TREASURY_ADDRESS || deployer.address;
  const resultSigner = process.env.RESULT_SIGNER_ADDRESS || deployer.address;

  // Bump gas slightly to avoid "replacement transaction underpriced" on some RPCs
  const feeData = await ethers.provider.getFeeData();
  const overrides: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint; gasLimit?: bigint } = {
    gasLimit: 4_000_000n,
  };
  if (feeData.maxFeePerGas) overrides.maxFeePerGas = (feeData.maxFeePerGas * 120n) / 100n;
  if (feeData.maxPriorityFeePerGas) overrides.maxPriorityFeePerGas = (feeData.maxPriorityFeePerGas * 120n) / 100n;

  const ArenaRaceEscrow = await ethers.getContractFactory("ArenaRaceEscrow");
  const escrow = await ArenaRaceEscrow.deploy(usdcAddress, treasury, resultSigner, overrides);
  await escrow.waitForDeployment();
  const escrowAddress = await escrow.getAddress();
  console.log("ArenaRaceEscrow deployed at:", escrowAddress);

  console.log("\n--- Deployment summary ---");
  console.log("Network:", (await ethers.provider.getNetwork()).name, (await ethers.provider.getNetwork()).chainId);
  console.log("USDC:", usdcAddress);
  console.log("Treasury:", treasury);
  console.log("Result signer:", resultSigner);
  console.log("ArenaRaceEscrow:", escrowAddress);
  console.log("\nVerify (after block confirmations):");
  console.log(
    `npx hardhat verify --network sepolia ${escrowAddress} ${usdcAddress} ${treasury} ${resultSigner}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
