const crypto = require("crypto");
const {
  utils,
  getPublicKey,
  sign,
  verify,
  aggregatePublicKeys,
  aggregateSignatures,
} = require("noble-bls12-381");

// 门限值和参与者数量
const threshold = 3;
const numParticipants = 5;

// 生成私钥
const privateKeys = Array.from({ length: numParticipants }, (_, i) => {
  const seed = `participant-${i}`;
  const hash = crypto.createHash("sha256").update(seed).digest();
  return BigInt("0x" + hash.toString("hex"));
});

// 生成公钥
const publicKeys = privateKeys.map((privateKey) => {
  return getPublicKey(privateKey);
});

async function thresholdSign() {
  // 生成消息和消息的哈希
  const message = "hello world";
  const messageHash = await utils.sha256(Buffer.from(message));

  // 每个参与者生成自己的签名
  const signatures = [];
  for (const privateKey of privateKeys) {
    const publicKey = getPublicKey(privateKey);
    const signature = await sign(messageHash, privateKey);
    signatures.push(signature);
  }

  // 聚合签名
  const aggregatedSignature = aggregateSignatures(signatures.slice(0, threshold));

  // 验证聚合签名
  const aggregatedPublicKeys = aggregatePublicKeys(publicKeys.slice(0, threshold));

  const isValid = await verify(aggregatedSignature, messageHash, aggregatedPublicKeys);
  console.log(`Signature is valid: ${isValid}`);
}

thresholdSign();
