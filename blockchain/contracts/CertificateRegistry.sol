// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IOrgRegistry {
    function isOrgActive(string calldata orgId) external view returns (bool);
    function isOrgIssuer(string calldata orgId, address issuer) external view returns (bool);
}

contract CertificateRegistry is Ownable {
    struct Certificate {
        string orgId;
        string branchId;
        uint256 issueTimestamp;
        string certType;
        bytes32 metadataHash;
        bool isRevoked;
        bool exists;
        address issuedBy;
    }

    mapping(bytes32 => Certificate) private certs;
    IOrgRegistry public orgRegistry;

    event CertificateIssued(bytes32 certHash, string orgId, string branchId, uint256 timestamp);
    event CertificateRevoked(bytes32 certHash, string orgId, string reason, uint256 timestamp);

    constructor(address initialOwner, address orgRegistryAddress) Ownable(initialOwner) {
        require(orgRegistryAddress != address(0), "INVALID_ORG_REGISTRY");
        orgRegistry = IOrgRegistry(orgRegistryAddress);
    }

    function setOrgRegistry(address orgRegistryAddress) external onlyOwner {
        require(orgRegistryAddress != address(0), "INVALID_ORG_REGISTRY");
        orgRegistry = IOrgRegistry(orgRegistryAddress);
    }

    function issueCertificate(
        bytes32 certHash,
        string calldata orgId,
        string calldata branchId,
        string calldata certType,
        bytes32 metadataHash
    ) external {
        require(!certs[certHash].exists, "CERT_EXISTS");
        require(orgRegistry.isOrgActive(orgId), "ORG_INACTIVE");
        require(orgRegistry.isOrgIssuer(orgId, msg.sender), "UNAUTHORIZED_ISSUER");
        certs[certHash] = Certificate({
            orgId: orgId,
            branchId: branchId,
            issueTimestamp: block.timestamp,
            certType: certType,
            metadataHash: metadataHash,
            isRevoked: false,
            exists: true,
            issuedBy: msg.sender
        });
        emit CertificateIssued(certHash, orgId, branchId, block.timestamp);
    }

    function revokeCertificate(bytes32 certHash, string calldata reason) external {
        require(certs[certHash].exists, "CERT_NOT_FOUND");
        require(!certs[certHash].isRevoked, "CERT_ALREADY_REVOKED");
        require(
            certs[certHash].issuedBy == msg.sender || owner() == msg.sender,
            "UNAUTHORIZED_REVOKE"
        );
        certs[certHash].isRevoked = true;
        emit CertificateRevoked(certHash, certs[certHash].orgId, reason, block.timestamp);
    }

    function verifyCertificate(bytes32 certHash)
        external
        view
        returns (bool isValid, bool isRevoked, uint256 issueTimestamp, string memory orgId)
    {
        if (!certs[certHash].exists) {
            return (false, false, 0, "");
        }
        Certificate memory cert = certs[certHash];
        return (!cert.isRevoked, cert.isRevoked, cert.issueTimestamp, cert.orgId);
    }
}
