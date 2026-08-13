import { expect } from "chai";
import { ethers } from "hardhat";
import {
  EXTENSION_ID,
  advance,
  deploySystem,
} from "./helpers/system";

describe("Deployment and configuration", function () {
  it("stores the stablecoin, decimals, minimum withdrawal, admin and relayer", async function () {
    const f = await deploySystem();
    expect(await f.vault.STABLECOIN()).to.equal(await f.token.getAddress());
    expect(await f.vault.STABLECOIN_DECIMALS()).to.equal(6);
    expect(await f.vault.defaultMinimumWithdrawalAmount()).to.equal(1_000_000n);
    expect(await f.vault.hasRole(await f.vault.DEFAULT_ADMIN_ROLE(), f.admin.address)).to.equal(true);
    expect(await f.gateway.hasRole(await f.gateway.DEFAULT_ADMIN_ROLE(), f.admin.address)).to.equal(true);
    expect(await f.gateway.hasRole(await f.gateway.RELAYER_ROLE(), f.relayer.address)).to.equal(true);
  });

  it("rejects a zero protocol admin for the vault", async function () {
    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy("Mock", "M", 6);
    const Vault = await ethers.getContractFactory("ZalaryPrivatePayrollVault");
    await expect(Vault.deploy(ethers.ZeroAddress, await token.getAddress(), 1n)).to.be.reverted;
  });

  it("rejects an EOA as stablecoin", async function () {
    const [admin, eoa] = await ethers.getSigners();
    const Vault = await ethers.getContractFactory("ZalaryPrivatePayrollVault");
    await expect(Vault.deploy(admin.address, eoa.address, 1n)).to.be.reverted;
  });

  it("rejects zero and greater-than-18 token decimals", async function () {
    const [admin] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockERC20");
    const zero = await Token.deploy("Zero", "ZERO", 0);
    const nineteen = await Token.deploy("Nineteen", "NIN", 19);
    const Vault = await ethers.getContractFactory("ZalaryPrivatePayrollVault");
    await expect(Vault.deploy(admin.address, await zero.getAddress(), 1n)).to.be.reverted;
    await expect(Vault.deploy(admin.address, await nineteen.getAddress(), 1n)).to.be.reverted;
  });

  it("rejects a zero minimum withdrawal", async function () {
    const [admin] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("MockERC20");
    const token = await Token.deploy("Mock", "M", 6);
    const Vault = await ethers.getContractFactory("ZalaryPrivatePayrollVault");
    await expect(Vault.deploy(admin.address, await token.getAddress(), 0n)).to.be.reverted;
  });

  it("rejects EOA registry or vault addresses in gateway constructor", async function () {
    const [admin, relayer, eoa] = await ethers.getSigners();
    const Gateway = await ethers.getContractFactory("ZalaryConfidentialGateway");
    await expect(
      Gateway.deploy(admin.address, relayer.address, eoa.address, eoa.address, eoa.address),
    ).to.be.reverted;
  });

  it("sets the confidential gateway exactly once", async function () {
    const f = await deploySystem({ connectGateway: false });
    await expect(f.vault.connect(f.attacker).setConfidentialGateway(await f.gateway.getAddress()))
      .to.be.reverted;
    await expect(f.vault.setConfidentialGateway(await f.gateway.getAddress()))
      .to.emit(f.vault, "ConfidentialGatewaySet")
      .withArgs(await f.gateway.getAddress());
    await expect(f.vault.setConfidentialGateway(await f.gateway.getAddress()))
      .to.be.revertedWithCustomError(f.vault, "ConfidentialGatewayAlreadySet");
  });

  it("sets the extension id only when the registry points to the gateway", async function () {
    const f = await deploySystem({ configureExtension: false, configureTee: false });
    await expect(f.gateway.setExtensionId(EXTENSION_ID))
      .to.be.revertedWithCustomError(f.gateway, "ExtensionSenderMismatch");
    await f.extensionRegistry.setInstructionSender(await f.gateway.getAddress());
    await expect(f.gateway.connect(f.attacker).setExtensionId(EXTENSION_ID)).to.be.reverted;
    await expect(f.gateway.setExtensionId(EXTENSION_ID))
      .to.emit(f.gateway, "ExtensionIdSet")
      .withArgs(EXTENSION_ID);
    expect(await f.gateway.extensionId()).to.equal(EXTENSION_ID);
  });

  it("rejects extension ids below the public extension range", async function () {
    const f = await deploySystem({ configureExtension: false, configureTee: false });
    await f.extensionRegistry.setInstructionSender(await f.gateway.getAddress());
    await expect(f.gateway.setExtensionId(0xffffn))
      .to.be.revertedWithCustomError(f.gateway, "ExtensionSenderMismatch");
  });

  it("does not allow the extension id to change", async function () {
    const f = await deploySystem();
    await expect(f.gateway.setExtensionId(EXTENSION_ID + 1n))
      .to.be.revertedWithCustomError(f.gateway, "ExtensionIdAlreadySet");
  });

  it("enforces the TEE signer activation delay", async function () {
    const f = await deploySystem({ configureTee: false });
    const signer = ethers.Wallet.createRandom();
    await f.gateway.proposeTeeSigner(f.teeId.address, signer.address);
    await expect(f.gateway.activateTeeSigner(f.teeId.address))
      .to.be.revertedWithCustomError(f.gateway, "TeeSignerProposalNotReady");
    await advance(3601);
    await f.gateway.activateTeeSigner(f.teeId.address);
    const binding = await f.gateway.teeBindings(f.teeId.address);
    expect(binding.signer).to.equal(signer.address);
    expect(binding.epoch).to.equal(1n);
    expect(binding.active).to.equal(true);
  });

  it("rotates a TEE signer and increments its epoch", async function () {
    const f = await deploySystem();
    const before = await f.gateway.teeBindings(f.teeId.address);
    const replacement = ethers.Wallet.createRandom();
    await f.gateway.proposeTeeSigner(f.teeId.address, replacement.address);
    await advance(3601);
    await f.gateway.activateTeeSigner(f.teeId.address);
    const after = await f.gateway.teeBindings(f.teeId.address);
    expect(after.signer).to.equal(replacement.address);
    expect(after.epoch).to.equal(before.epoch + 1n);
  });

  it("revokes a TEE signer immediately", async function () {
    const f = await deploySystem();
    const before = await f.gateway.teeBindings(f.teeId.address);
    await expect(f.gateway.revokeTeeSigner(f.teeId.address))
      .to.emit(f.gateway, "TeeSignerRevoked");
    const after = await f.gateway.teeBindings(f.teeId.address);
    expect(after.active).to.equal(false);
    expect(after.signer).to.equal(ethers.ZeroAddress);
    expect(after.epoch).to.equal(before.epoch + 1n);
  });

  it("allows admins to manage relayers through AccessControl", async function () {
    const f = await deploySystem();
    const role = await f.gateway.RELAYER_ROLE();
    await f.gateway.grantRole(role, f.extra.address);
    expect(await f.gateway.hasRole(role, f.extra.address)).to.equal(true);
    await f.gateway.revokeRole(role, f.extra.address);
    expect(await f.gateway.hasRole(role, f.extra.address)).to.equal(false);
    await expect(f.gateway.connect(f.attacker).grantRole(role, f.attacker.address)).to.be.reverted;
  });
});
