const express = require("express");
const { db } = require("./db");
const validator = require("validator");
const Web3 = require("web3");
const { ecsign, toRpcSig, hashPersonalMessage, toBuffer } = require("ethereumjs-util");
const configs = require("../data/config.json");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/api/latest-signature/:chain_id", async (req, res) => {
  const { chain_id } = req.params;

  // 验证chain_id是否为有效的整数
  if (!validator.isInt(chain_id)) {
    return res.status(400).json({ error: "Invalid chain_id" });
  }

  try {
    const query = `
    SELECT * FROM block_signatures
    WHERE chain_id = ?
    ORDER BY block_number DESC
    LIMIT 1;
    `;

    db.get(query, [chain_id], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
      } else {
        if (row) {
          res.status(200).json(row);
        } else {
          res.status(404).json({ error: `No data found for chain_id ${chain_id}` });
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

const signStateRoot = async (stateRoot, privateKey) => {
  const messageHash = hashPersonalMessage(toBuffer(stateRoot));
  const { v, r, s } = ecsign(messageHash, toBuffer(privateKey));
  return toRpcSig(v, r, s);
};

const saveSignature = (chainId, blockNumber, stateRoot, eoaAddress, signature) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO block_signatures (chain_id, block_number, state_root, address, signature)
      VALUES (?, ?, ?, ?, ?);
    `;

    db.run(query, [chainId, blockNumber, stateRoot, eoaAddress, signature], (err) => {
      if (err) {
        console.error("Error saving signature:", err);
        reject(err);
      } else {
        console.log(`Signature saved for block number ${blockNumber}`);
        resolve();
      }
    });
  });
};

const monitorStateRoot = async (config) => {
  const { chainId, PRIVATE_KEY, EOA_ADDRESS, RPC_URL, WS_RPC_URL } = config;
  const web3Ws = new Web3(new Web3.providers.WebsocketProvider(WS_RPC_URL));
  web3Ws.eth.subscribe("newBlockHeaders", async (err, blockHeader) => {
    if (err) {
      console.error("Error subscribing to new block headers:", err);
      return;
    }

    const { number, stateRoot } = blockHeader;
    const signature = await signStateRoot(stateRoot, PRIVATE_KEY);
    await saveSignature(chainId, number, stateRoot, EOA_ADDRESS, signature);
  });
};

for (const config of configs) {
  (async () => {
    monitorStateRoot(config);
  })();
}
