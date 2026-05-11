import "dotenv/config";
import { Queue, Worker } from "bullmq";
import { ethers } from "ethers";
import { Redis } from "ioredis";

const isProduction = process.env.NODE_ENV === "production";
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
if (isProduction && !process.env.REDIS_URL) {
  throw new Error("REDIS_URL is required in production");
}
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

export const bulkQueue = new Queue("bulk-certificate-import", { connection });
export const chainWriteQueue = new Queue("chain-write", { connection });

const API_BASE_URL = process.env.INTERNAL_API_BASE_URL || "http://localhost:4000";
const WORKER_TOKEN = process.env.CHAIN_WORKER_TOKEN;
if (isProduction && !process.env.INTERNAL_API_BASE_URL) {
  throw new Error("INTERNAL_API_BASE_URL is required in production");
}
if (!WORKER_TOKEN) {
  throw new Error("CHAIN_WORKER_TOKEN is required");
}
const workerToken = WORKER_TOKEN;
const BLOCKCHAIN_PROVIDER = (process.env.BLOCKCHAIN_PROVIDER || "evm").toLowerCase();
const allowSyntheticTx = process.env.ALLOW_SYNTHETIC_CHAIN_TX === "true";

const orgRegistryAbi = [
  "function registerOrg(string orgId, bytes32 orgNameHash, string sector, string orgType, address adminAddress)"
];
const certRegistryAbi = [
  "function issueCertificate(bytes32 certHash, string orgId, string branchId, string certType, bytes32 metadataHash)"
];

type TxExecution = {
  txHash: string;
  blockchainProvider: "evm" | "fabric";
  gasUsed?: string;
  gasPriceGwei?: string;
  totalFeeEth?: string;
  blockNumber?: number;
  confirmations?: number;
};

function syntheticTxHash(jobName: string, payload: Record<string, unknown>): string {
  if (isProduction || !allowSyntheticTx) {
    throw new Error("synthetic_tx_disabled");
  }
  return `0x${ethers.id(`${jobName}:${JSON.stringify(payload)}:${Date.now()}`).slice(2, 34)}`;
}

async function submitFabricTx(jobName: string, payload: Record<string, unknown>): Promise<string> {
  const fabricGatewayUrl = process.env.FABRIC_GATEWAY_URL;
  const fabricChannel = process.env.FABRIC_CHANNEL || "docverify";
  const fabricChaincode = process.env.FABRIC_CHAINCODE || "certificates";

  if (!fabricGatewayUrl) {
    throw new Error("fabric_gateway_missing");
  }

  const endpoint =
    jobName === "org-register"
      ? `${fabricGatewayUrl.replace(/\/$/, "")}/transactions/register-org`
      : `${fabricGatewayUrl.replace(/\/$/, "")}/transactions/issue-certificate`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      channel: fabricChannel,
      chaincode: fabricChaincode,
      payload
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`fabric_gateway_error:${response.status}:${message}`);
  }

  const body = (await response.json()) as { txHash?: string; transactionId?: string };
  const hash = body.txHash || body.transactionId;
  if (!hash) throw new Error("fabric_gateway_missing_tx_hash");
  return hash;
}

function formatGwei(value: bigint): string {
  return ethers.formatUnits(value, "gwei");
}

function formatEth(value: bigint): string {
  return ethers.formatEther(value);
}

function toBigIntValue(value: bigint | number | string | undefined): bigint | undefined {
  if (value === undefined) return undefined;
  return BigInt(value.toString());
}

/** Backend `stableCertHash` is 64 hex chars (SHA-256); Solidity expects bytes32 (32 bytes). */
function toBytes32CertHash(certHash: string): `0x${string}` {
  const normalized = certHash.startsWith("0x") ? certHash.slice(2) : certHash;
  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(`invalid_cert_hash_format expected_64_hex_got_len=${normalized.length}`);
  }
  return `0x${normalized.toLowerCase()}`;
}

async function submitEvmTx(jobName: string, payload: Record<string, unknown>): Promise<TxExecution> {
  const hasLiveConfig =
    process.env.RPC_URL &&
    process.env.ISSUER_PRIVATE_KEY &&
    process.env.ORG_REGISTRY_ADDRESS &&
    process.env.CERT_REGISTRY_ADDRESS &&
    process.env.ORG_REGISTRY_ADDRESS !== "0x0000000000000000000000000000000000000000" &&
    process.env.CERT_REGISTRY_ADDRESS !== "0x0000000000000000000000000000000000000000";

  if (!hasLiveConfig) {
    if (!allowSyntheticTx) throw new Error("evm_chain_config_missing");
    return { txHash: syntheticTxHash(jobName, payload), blockchainProvider: "evm" };
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.ISSUER_PRIVATE_KEY as string, provider);

  if (jobName === "org-register") {
    const orgId = String(payload.orgId);
    const orgRegistry = new ethers.Contract(process.env.ORG_REGISTRY_ADDRESS as string, orgRegistryAbi, wallet);
    const tx = await orgRegistry.registerOrg(orgId, ethers.id(orgId), "Other", "PVT", wallet.address);
    const receipt = await tx.wait();
    const gasUsed = toBigIntValue(receipt?.gasUsed);
    const gasPrice = toBigIntValue(receipt?.gasPrice);
    const totalFee = gasUsed && gasPrice ? gasUsed * gasPrice : undefined;
    return {
      txHash: tx.hash as string,
      blockchainProvider: "evm",
      gasUsed: gasUsed?.toString(),
      gasPriceGwei: gasPrice ? formatGwei(gasPrice) : undefined,
      totalFeeEth: totalFee ? formatEth(totalFee) : undefined,
      blockNumber: receipt?.blockNumber,
      confirmations: receipt?.confirmations
    };
  }

  const certRegistry = new ethers.Contract(process.env.CERT_REGISTRY_ADDRESS as string, certRegistryAbi, wallet);
  const digest = payload.manifestDigest ? String(payload.manifestDigest) : "";
  const metadataHash =
    digest.length === 64 && /^[0-9a-f]+$/i.test(digest) ? (`0x${digest}` as `0x${string}`) : ethers.id(String(payload.certUuid));
  const branchId = payload.branchId ? String(payload.branchId) : "main-branch";
  const tx = await certRegistry.issueCertificate(
    toBytes32CertHash(String(payload.certHash)),
    String(payload.orgId),
    branchId,
    String(payload.certType),
    metadataHash
  );
  const receipt = await tx.wait();
  const gasUsed = toBigIntValue(receipt?.gasUsed);
  const gasPrice = toBigIntValue(receipt?.gasPrice);
  const totalFee = gasUsed && gasPrice ? gasUsed * gasPrice : undefined;
  return {
    txHash: tx.hash as string,
    blockchainProvider: "evm",
    gasUsed: gasUsed?.toString(),
    gasPriceGwei: gasPrice ? formatGwei(gasPrice) : undefined,
    totalFeeEth: totalFee ? formatEth(totalFee) : undefined,
    blockNumber: receipt?.blockNumber,
    confirmations: receipt?.confirmations
  };
}

async function submitTx(jobName: string, payload: Record<string, unknown>): Promise<TxExecution> {
  if (BLOCKCHAIN_PROVIDER === "fabric") {
    const txHash = await submitFabricTx(jobName, payload);
    return { txHash, blockchainProvider: "fabric" };
  }
  return submitEvmTx(jobName, payload);
}

async function callback(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-chain-worker-token": workerToken
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`chain_callback_failed path=${path} status=${res.status} body=${text.slice(0, 500)}`);
  }
}

const worker = new Worker(
  "bulk-certificate-import",
  async (job) => {
    throw new Error(`bulk_certificate_import_not_supported job=${job.id}`);
  },
  { connection }
);

const chainWorker = new Worker(
  "chain-write",
  async (job) => {
    const startedAt = Date.now();
    console.log(`[workers] chain job start id=${job.id} name=${job.name}`, job.data);
    const tx = await submitTx(job.name, job.data as Record<string, unknown>);
    console.log(
      `[workers] chain job tx id=${job.id} name=${job.name} provider=${tx.blockchainProvider} txHash=${tx.txHash} gasUsed=${
        tx.gasUsed ?? "n/a"
      } gasPriceGwei=${tx.gasPriceGwei ?? "n/a"} totalFeeEth=${tx.totalFeeEth ?? "n/a"} block=${
        tx.blockNumber ?? "n/a"
      } confirmations=${tx.confirmations ?? "n/a"} elapsedMs=${Date.now() - startedAt}`
    );
    if (job.name === "org-register") {
      await callback("/internal/chain/org-registered", {
        orgId: job.data.orgId,
        txHash: tx.txHash,
        txMeta: {
          blockchainProvider: tx.blockchainProvider,
          gasUsed: tx.gasUsed,
          gasPriceGwei: tx.gasPriceGwei,
          totalFeeEth: tx.totalFeeEth,
          blockNumber: tx.blockNumber,
          confirmations: tx.confirmations
        }
      });
    }
    if (job.name === "certificate-issue") {
      await callback("/internal/chain/certificate-issued", {
        certUuid: job.data.certUuid,
        txHash: tx.txHash,
        txMeta: {
          blockchainProvider: tx.blockchainProvider,
          gasUsed: tx.gasUsed,
          gasPriceGwei: tx.gasPriceGwei,
          totalFeeEth: tx.totalFeeEth,
          blockNumber: tx.blockNumber,
          confirmations: tx.confirmations
        }
      });
    }
    return { ok: true, ...tx };
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`Job ${job?.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed`, err);
});

chainWorker.on("completed", (job) => {
  console.log(`Chain job ${job?.id} completed`);
});

chainWorker.on("failed", (job, err) => {
  console.error(`Chain job ${job?.id} failed`, err);
});

console.log("workers service started");
