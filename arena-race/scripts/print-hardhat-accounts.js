/**
 * Print the same accounts and private keys that Hardhat node uses.
 * Mnemonic: "test test test test test test test test test test test junk"
 */
const { HDNodeWallet, Mnemonic } = require("ethers");
const mnemonic = Mnemonic.fromPhrase("test test test test test test test test test test test junk");
console.log("Hardhat default accounts (same as printed when you run: npx hardhat node)\n");
for (let i = 0; i < 20; i++) {
  const w = HDNodeWallet.fromPhrase(mnemonic.phrase, undefined, "m/44'/60'/0'/0/" + i);
  console.log("Account #" + i + ": " + w.address);
  console.log("Private Key: " + w.privateKey);
  console.log("");
}
