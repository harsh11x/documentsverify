// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract OrgRegistry is Ownable {
    struct Org {
        bytes32 orgNameHash;
        string sector;
        string orgType;
        address adminAddress;
        bool isActive;
        uint256 registeredAt;
    }

    mapping(string => Org) private orgs;
    mapping(string => bool) private exists;
    mapping(string => mapping(address => bool)) private orgIssuers;

    event OrgRegistered(string orgId, uint256 timestamp);
    event OrgDeactivated(string orgId, uint256 timestamp);
    event OrgIssuerUpdated(string orgId, address issuer, bool isAuthorized);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function registerOrg(
        string calldata orgId,
        bytes32 orgNameHash,
        string calldata sector,
        string calldata orgType,
        address adminAddress
    ) external onlyOwner {
        require(!exists[orgId], "ORG_EXISTS");
        require(adminAddress != address(0), "INVALID_ADMIN");

        exists[orgId] = true;
        orgs[orgId] = Org({
            orgNameHash: orgNameHash,
            sector: sector,
            orgType: orgType,
            adminAddress: adminAddress,
            isActive: true,
            registeredAt: block.timestamp
        });

        emit OrgRegistered(orgId, block.timestamp);
    }

    function deactivateOrg(string calldata orgId) external onlyOwner {
        require(exists[orgId], "ORG_NOT_FOUND");
        require(orgs[orgId].isActive, "ORG_INACTIVE");
        orgs[orgId].isActive = false;
        emit OrgDeactivated(orgId, block.timestamp);
    }

    function setOrgIssuer(string calldata orgId, address issuer, bool isAuthorized) external onlyOwner {
        require(exists[orgId], "ORG_NOT_FOUND");
        require(issuer != address(0), "INVALID_ISSUER");
        orgIssuers[orgId][issuer] = isAuthorized;
        emit OrgIssuerUpdated(orgId, issuer, isAuthorized);
    }

    function getOrg(string calldata orgId) external view returns (Org memory) {
        require(exists[orgId], "ORG_NOT_FOUND");
        return orgs[orgId];
    }

    function isOrgActive(string calldata orgId) external view returns (bool) {
        if (!exists[orgId]) return false;
        return orgs[orgId].isActive;
    }

    function isOrgIssuer(string calldata orgId, address issuer) external view returns (bool) {
        if (!exists[orgId] || !orgs[orgId].isActive) return false;
        return orgIssuers[orgId][issuer];
    }
}
