import { expect } from "chai";
import { ethers } from "hardhat";
import { advance, createDraft, deploySystem, latestTimestamp } from "./helpers/system";

describe("Institution registration and roles", function () {
  it("lets an account self-register an institution", async function () {
    const f = await deploySystem({ registerInstitution: false });
    await expect(f.vault.connect(f.institution).registerMyInstitution(f.treasury.address, f.taxVault.address))
      .to.emit(f.vault, "InstitutionRegistered");
    const item = await f.vault.institutions(f.institution.address);
    expect(item.registered).to.equal(true);
    expect(item.active).to.equal(true);
    expect(await f.vault.institutionAdmins(f.institution.address, f.institution.address)).to.equal(true);
  });

  it("blocks self-registration while paused", async function () {
    const f = await deploySystem({ registerInstitution: false });
    await f.vault.pause();
    await expect(
      f.vault.connect(f.institution).registerMyInstitution(f.treasury.address, f.taxVault.address),
    ).to.be.reverted;
  });

  it("rejects duplicate institution registration", async function () {
    const f = await deploySystem();
    await expect(
      f.vault.adminRegisterInstitution(
        f.institution.address,
        f.institution.address,
        f.treasury.address,
        f.taxVault.address,
      ),
    ).to.be.revertedWithCustomError(f.vault, "InstitutionExists");
  });

  it("restricts protocol registration to the protocol admin", async function () {
    const f = await deploySystem({ registerInstitution: false });
    await expect(
      f.vault.connect(f.attacker).adminRegisterInstitution(
        f.institution.address,
        f.institution.address,
        f.treasury.address,
        f.taxVault.address,
      ),
    ).to.be.reverted;
  });

  it("lets institution admins assign and revoke HR and Finance", async function () {
    const f = await deploySystem();
    await f.vault.connect(f.institution).setInstitutionHR(f.institution.address, f.extra.address, true);
    await f.vault.connect(f.institution).setInstitutionFinance(f.institution.address, f.extra.address, true);
    expect(await f.vault.institutionHR(f.institution.address, f.extra.address)).to.equal(true);
    expect(await f.vault.institutionFinance(f.institution.address, f.extra.address)).to.equal(true);
    await f.vault.connect(f.institution).setInstitutionHR(f.institution.address, f.extra.address, false);
    await f.vault.connect(f.institution).setInstitutionFinance(f.institution.address, f.extra.address, false);
    expect(await f.vault.institutionHR(f.institution.address, f.extra.address)).to.equal(false);
    expect(await f.vault.institutionFinance(f.institution.address, f.extra.address)).to.equal(false);
  });

  it("rejects role management by non-admins", async function () {
    const f = await deploySystem();
    await expect(
      f.vault.connect(f.hr).setInstitutionFinance(f.institution.address, f.extra.address, true),
    ).to.be.revertedWithCustomError(f.vault, "NotAuthorized");
  });

  it("recognizes both institution admins and assigned HR in canHR", async function () {
    const f = await deploySystem();
    expect(await f.vault.canHR(f.institution.address, f.institution.address)).to.equal(true);
    expect(await f.vault.canHR(f.institution.address, f.hr.address)).to.equal(true);
    expect(await f.vault.canHR(f.institution.address, f.finance.address)).to.equal(false);
  });

  it("deactivation disables HR and Finance activity", async function () {
    const f = await deploySystem();
    await f.vault.connect(f.institution).setInstitutionActive(f.institution.address, false);
    expect(await f.vault.canHR(f.institution.address, f.hr.address)).to.equal(false);
    const timestamp = await latestTimestamp();
    await expect(
      f.vault.connect(f.hr).createPayrollDraft(
        1,
        f.institution.address,
        ethers.keccak256(ethers.toUtf8Bytes("inactive")),
        timestamp,
        timestamp + 7200,
        3600,
        900,
      ),
    ).to.be.revertedWithCustomError(f.vault, "InstitutionInactive");
  });

  it("prevents removal of the final institution admin", async function () {
    const f = await deploySystem();
    await expect(
      f.vault.connect(f.institution).setInstitutionAdmin(
        f.institution.address,
        f.institution.address,
        false,
      ),
    ).to.be.revertedWithCustomError(f.vault, "LastInstitutionAdmin");
  });

  it("supports adding and removing an additional institution admin", async function () {
    const f = await deploySystem();
    await f.vault.connect(f.institution).setInstitutionAdmin(
      f.institution.address,
      f.secondAdmin.address,
      true,
    );
    expect(await f.vault.institutionAdminCount(f.institution.address)).to.equal(2n);
    await f.vault.connect(f.institution).setInstitutionAdmin(
      f.institution.address,
      f.secondAdmin.address,
      false,
    );
    expect(await f.vault.institutionAdminCount(f.institution.address)).to.equal(1n);
  });

  it("supports a two-step institution admin transfer", async function () {
    const f = await deploySystem();
    await f.vault.connect(f.institution).proposeInstitutionAdminTransfer(
      f.institution.address,
      f.secondAdmin.address,
    );
    await expect(f.vault.connect(f.secondAdmin).acceptInstitutionAdminTransfer(f.institution.address))
      .to.emit(f.vault, "InstitutionAdminTransferred")
      .withArgs(f.institution.address, f.institution.address, f.secondAdmin.address);
    expect(await f.vault.institutionAdmins(f.institution.address, f.institution.address)).to.equal(false);
    expect(await f.vault.institutionAdmins(f.institution.address, f.secondAdmin.address)).to.equal(true);
    expect(await f.vault.institutionAdminCount(f.institution.address)).to.equal(1n);
  });

  it("rejects an expired admin transfer", async function () {
    const f = await deploySystem();
    await f.vault.connect(f.institution).proposeInstitutionAdminTransfer(
      f.institution.address,
      f.secondAdmin.address,
    );
    await advance(7 * 24 * 3600 + 1);
    await expect(f.vault.connect(f.secondAdmin).acceptInstitutionAdminTransfer(f.institution.address))
      .to.be.revertedWithCustomError(f.vault, "AdminTransferExpired");
  });

  it("supports delayed protocol-admin recovery", async function () {
    const f = await deploySystem();
    await f.vault.proposeInstitutionAdminRecovery(f.institution.address, f.recoveryAdmin.address);
    await expect(f.vault.executeInstitutionAdminRecovery(f.institution.address))
      .to.be.revertedWithCustomError(f.vault, "AdminRecoveryNotReady");
    await advance(2 * 24 * 3600 + 1);
    await f.vault.executeInstitutionAdminRecovery(f.institution.address);
    expect(await f.vault.institutionAdmins(f.institution.address, f.recoveryAdmin.address)).to.equal(true);
  });

  it("allows treasury and tax vault updates for future payrolls", async function () {
    const f = await deploySystem();
    await f.vault.connect(f.institution).setInstitutionTreasury(f.institution.address, f.extra.address);
    await f.vault.connect(f.institution).setInstitutionTaxVault(f.institution.address, f.recoveryAdmin.address);
    const item = await f.vault.institutions(f.institution.address);
    expect(item.treasury).to.equal(f.extra.address);
    expect(item.taxVault).to.equal(f.recoveryAdmin.address);
  });

  it("snapshots treasury and tax vault into each payroll", async function () {
    const f = await deploySystem();
    await createDraft(f, 1n);
    await f.vault.connect(f.institution).setInstitutionTreasury(f.institution.address, f.extra.address);
    await f.vault.connect(f.institution).setInstitutionTaxVault(f.institution.address, f.recoveryAdmin.address);
    const payroll = await f.vault.getPayroll(1);
    expect(payroll.treasury).to.equal(f.treasury.address);
    expect(payroll.taxVault).to.equal(f.taxVault.address);
  });

  it("snapshots the default minimum withdrawal into each payroll", async function () {
    const f = await deploySystem();
    await createDraft(f, 1n);
    await f.vault.setDefaultMinimumWithdrawalAmount(5_000_000n);
    await createDraft(f, 2n);
    expect((await f.vault.getPayroll(1)).minimumWithdrawalAmount).to.equal(1_000_000n);
    expect((await f.vault.getPayroll(2)).minimumWithdrawalAmount).to.equal(5_000_000n);
  });
});
