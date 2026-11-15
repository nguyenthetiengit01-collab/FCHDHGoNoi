#!/usr/bin/env node
/**
 * Asymmetric public-key encryption utility for FC HĐH Gò Nổi backup artifacts.
 * Uses X25519 ECDH + HKDF-SHA256 + AES-256-GCM via Node.js built-in node:crypto.
 *
 * Usage:
 *   node scripts/backup-crypto.mjs keygen
 *   BACKUP_ENCRYPTION_PUBLIC_KEY="gonoi-pub-v1:..." node scripts/backup-crypto.mjs encrypt --in backup.json --out backup.json.enc
 *   BACKUP_DECRYPTION_PRIVATE_KEY="gonoi-priv-v1:..." node scripts/backup-crypto.mjs decrypt --in backup.json.enc --out backup.json
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PUB_PREFIX = "gonoi-pub-v1:";
const PRIV_PREFIX = "gonoi-priv-v1:";
const ENVELOPE_ALG = "X25519-HKDF-SHA256-AES-256-GCM";
const HKDF_INFO = Buffer.from("gonoi-backup-v1", "utf8");

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) {
    return process.argv[idx + 1];
  }
  return null;
}

export function generateBackupKeypair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("x25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });
  return {
    publicKey: `${PUB_PREFIX}${Buffer.from(publicKey).toString("base64")}`,
    privateKey: `${PRIV_PREFIX}${Buffer.from(privateKey).toString("base64")}`,
  };
}

function parsePublicKey(rawKey) {
  const clean = typeof rawKey === "string" ? rawKey.trim() : "";
  if (!clean.startsWith(PUB_PREFIX)) {
    throw new Error(`Invalid backup public key: expected "${PUB_PREFIX}..." prefix.`);
  }
  const der = Buffer.from(clean.slice(PUB_PREFIX.length), "base64");
  return crypto.createPublicKey({ key: der, format: "der", type: "spki" });
}

function parsePrivateKey(rawKey) {
  const clean = typeof rawKey === "string" ? rawKey.trim() : "";
  if (!clean.startsWith(PRIV_PREFIX)) {
    throw new Error(`Invalid backup private key: expected "${PRIV_PREFIX}..." prefix.`);
  }
  const der = Buffer.from(clean.slice(PRIV_PREFIX.length), "base64");
  return crypto.createPrivateKey({ key: der, format: "der", type: "pkcs8" });
}

export function encryptBufferWithPublicKey(plaintextBuf, publicKeyStr) {
  const recipientPub = parsePublicKey(publicKeyStr);
  const ephemeral = crypto.generateKeyPairSync("x25519");
  const sharedSecret = crypto.diffieHellman({
    privateKey: ephemeral.privateKey,
    publicKey: recipientPub,
  });

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const aesKey = Buffer.from(
    crypto.hkdfSync("sha256", sharedSecret, salt, HKDF_INFO, 32)
  );

  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintextBuf), cipher.final()]);
  const tag = cipher.getAuthTag();
  const epkDer = ephemeral.publicKey.export({ type: "spki", format: "der" });

  return JSON.stringify(
    {
      version: 1,
      alg: ENVELOPE_ALG,
      epk: Buffer.from(epkDer).toString("base64"),
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
      tag: tag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
    },
    null,
    2
  );
}

export function decryptEnvelopeWithPrivateKey(envelopeJsonStr, privateKeyStr) {
  const envelope = JSON.parse(envelopeJsonStr);
  if (
    !envelope ||
    typeof envelope !== "object" ||
    envelope.version !== 1 ||
    envelope.alg !== ENVELOPE_ALG
  ) {
    throw new Error("Unsupported or invalid encrypted backup envelope.");
  }

  const recipientPriv = parsePrivateKey(privateKeyStr);
  const epkDer = Buffer.from(String(envelope.epk || ""), "base64");
  const epkPub = crypto.createPublicKey({ key: epkDer, format: "der", type: "spki" });

  const sharedSecret = crypto.diffieHellman({
    privateKey: recipientPriv,
    publicKey: epkPub,
  });

  const salt = Buffer.from(String(envelope.salt || ""), "base64");
  const iv = Buffer.from(String(envelope.iv || ""), "base64");
  const tag = Buffer.from(String(envelope.tag || ""), "base64");
  const ciphertext = Buffer.from(String(envelope.ciphertext || ""), "base64");

  const aesKey = Buffer.from(
    crypto.hkdfSync("sha256", sharedSecret, salt, HKDF_INFO, 32)
  );

  const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function main() {
  const command = process.argv[2];
  if (command === "keygen") {
    const pair = generateBackupKeypair();
    console.log(JSON.stringify(pair, null, 2));
    return;
  }

  if (command === "encrypt") {
    const inPath = getArg("--in");
    const outPath = getArg("--out");
    const pubKey = process.env.BACKUP_ENCRYPTION_PUBLIC_KEY;
    if (!inPath || !outPath) {
      console.error("Usage: node scripts/backup-crypto.mjs encrypt --in <file.json> --out <file.json.enc>");
      process.exit(1);
    }
    if (!pubKey) {
      console.error("Missing BACKUP_ENCRYPTION_PUBLIC_KEY environment variable.");
      process.exit(1);
    }
    const resolvedIn = path.resolve(inPath);
    const resolvedOut = path.resolve(outPath);
    if (!fs.existsSync(resolvedIn)) {
      console.error(`Input file not found: ${resolvedIn}`);
      process.exit(1);
    }
    const plaintext = fs.readFileSync(resolvedIn);
    const encrypted = encryptBufferWithPublicKey(plaintext, pubKey);
    fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
    fs.writeFileSync(resolvedOut, encrypted, "utf8");
    console.log(JSON.stringify({ status: "ok", mode: "encrypt", alg: ENVELOPE_ALG, out: resolvedOut }));
    return;
  }

  if (command === "decrypt") {
    const inPath = getArg("--in");
    const outPath = getArg("--out");
    const privKeyFile = getArg("--private-key-file");
    const privKey = privKeyFile
      ? fs.readFileSync(path.resolve(privKeyFile), "utf8").trim()
      : process.env.BACKUP_DECRYPTION_PRIVATE_KEY;

    if (!inPath || !outPath) {
      console.error(
        "Usage: node scripts/backup-crypto.mjs decrypt --in <file.json.enc> --out <file.json> [--private-key-file <path>]"
      );
      process.exit(1);
    }
    if (!privKey) {
      console.error("Missing BACKUP_DECRYPTION_PRIVATE_KEY or --private-key-file.");
      process.exit(1);
    }
    const resolvedIn = path.resolve(inPath);
    const resolvedOut = path.resolve(outPath);
    if (!fs.existsSync(resolvedIn)) {
      console.error(`Encrypted file not found: ${resolvedIn}`);
      process.exit(1);
    }
    const envelopeStr = fs.readFileSync(resolvedIn, "utf8");
    const plaintext = decryptEnvelopeWithPrivateKey(envelopeStr, privKey);
    fs.mkdirSync(path.dirname(resolvedOut), { recursive: true });
    fs.writeFileSync(resolvedOut, plaintext);
    console.log(JSON.stringify({ status: "ok", mode: "decrypt", out: resolvedOut }));
    return;
  }

  console.error("Usage: node scripts/backup-crypto.mjs <keygen|encrypt|decrypt>");
  process.exit(1);
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
if (isDirectRun) {
  main();
}
