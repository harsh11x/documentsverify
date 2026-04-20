import { expect } from "chai";
import { ethers } from "hardhat";

describe("Registry contracts", () => {
  it("registers, authorizes issuer, and deactivates org", async () => {
    const OrgRegistry = await ethers.getContractFactory("OrgRegistry");
    const [owner, issuer] = await ethers.getSigners();
    const contract = await OrgRegistry.deploy(owner.address);
    await contract.waitForDeployment();

    await contract.registerOrg("org-1", ethers.keccak256(ethers.toUtf8Bytes("Org 1")), "Education", "GOV", issuer.address);
    await contract.setOrgIssuer("org-1", issuer.address, true);
    expect(await contract.isOrgActive("org-1")).to.eq(true);
    expect(await contract.isOrgIssuer("org-1", issuer.address)).to.eq(true);

    await contract.deactivateOrg("org-1");
    expect(await contract.isOrgActive("org-1")).to.eq(false);
  });

  it("issues and revokes certificate with authorization checks", async () => {
    const [owner, issuer, attacker] = await ethers.getSigners();

    const OrgRegistry = await ethers.getContractFactory("OrgRegistry");
    const orgRegistry = await OrgRegistry.deploy(owner.address);
    await orgRegistry.waitForDeployment();

    await orgRegistry.registerOrg("org-1", ethers.keccak256(ethers.toUtf8Bytes("Org 1")), "Education", "GOV", issuer.address);
    await orgRegistry.setOrgIssuer("org-1", issuer.address, true);

    const CertRegistry = await ethers.getContractFactory("CertificateRegistry");
    const contract = await CertRegistry.deploy(owner.address, await orgRegistry.getAddress());
    await contract.waitForDeployment();

    const certHash = ethers.keccak256(ethers.toUtf8Bytes("CERT-001"));
    await expect(
      contract.connect(attacker).issueCertificate(certHash, "org-1", "branch-1", "Degree", ethers.keccak256(ethers.toUtf8Bytes("meta")))
    ).to.be.revertedWith("UNAUTHORIZED_ISSUER");

    await contract
      .connect(issuer)
      .issueCertificate(certHash, "org-1", "branch-1", "Degree", ethers.keccak256(ethers.toUtf8Bytes("meta")));

    const before = await contract.verifyCertificate(certHash);
    expect(before.isValid).to.eq(true);
    expect(before.isRevoked).to.eq(false);

    await expect(contract.connect(attacker).revokeCertificate(certHash, "Invalid")).to.be.revertedWith("UNAUTHORIZED_REVOKE");

    await contract.connect(issuer).revokeCertificate(certHash, "Incorrect entry");
    const after = await contract.verifyCertificate(certHash);
    expect(after.isValid).to.eq(false);
    expect(after.isRevoked).to.eq(true);
  });
});
