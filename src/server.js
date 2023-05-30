const express = require("express");
const { db, createTable } = require("./db");
const validator = require("validator");
const Web3 = require("web3");
const abi = require("ethereumjs-abi");
const { ecsign, toRpcSig, hashPersonalMessage, toBuffer } = require("ethereumjs-util");
const cors = require("cors");
const configs = require("../data/config.json");

createTable();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
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
    LIMIT 2,1;
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

const signStateRoot = async (web3Ws, chainId, number, stateRoot, timestamp, privateKey) => {
  const dataToSign = web3Ws.utils.keccak256(
    abi.solidityPack(
      ["uint256", "uint256", "bytes32", "uint256"],
      [chainId, number, stateRoot, timestamp]
    )
  );

  const messageHash = hashPersonalMessage(toBuffer(dataToSign));
  const { v, r, s } = ecsign(messageHash, toBuffer(privateKey));
  return toRpcSig(v, r, s);
};

const saveSignature = (chainId, blockNumber, stateRoot, timestamp, eoaAddress, signature) => {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO block_signatures (chain_id, block_number, state_root, timestamp, address, signature)
      VALUES (?, ?, ?, ?, ?, ?);
    `;

    db.run(query, [chainId, blockNumber, stateRoot, timestamp, eoaAddress, signature], (err) => {
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

const monitorStateRoot = async (web3Ws, config) => {
  const { chainId, PRIVATE_KEY, EOA_ADDRESS, RPC_URL, WS_RPC_URL } = config;

  web3Ws.eth
    .subscribe("newBlockHeaders")
    .on("connected", function (subscriptionId) {
      console.log("subscriptionId", subscriptionId);
    })
    .on("data", function (blockHeader) {
      const { number, stateRoot, timestamp } = blockHeader;
      signStateRoot(web3Ws, chainId, number, stateRoot, timestamp, PRIVATE_KEY).then(
        (signature) => {
          saveSignature(chainId, number, stateRoot, timestamp, EOA_ADDRESS, signature);
        }
      );
    })
    .on("error", console.error);
};

for (const config of configs) {
  (async () => {
    const { chainId, PRIVATE_KEY, EOA_ADDRESS, RPC_URL, WS_RPC_URL } = config;
    let web3Ws = new Web3(new Web3.providers.WebsocketProvider(WS_RPC_URL));
    web3Ws.currentProvider.on("close", () => {
      console.log("Websocket connection closed");
      // 尝试重新连接websocket provider
      web3Ws = new Web3(new Web3.providers.WebsocketProvider(WS_RPC_URL));
      monitorStateRoot(web3Ws, config);
    });
    monitorStateRoot(web3Ws, config);
  })();
}
