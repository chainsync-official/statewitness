const Web3 = require("web3");
const { ecsign, toRpcSig, hashPersonalMessage, toBuffer } = require("ethereumjs-util");
const { db, createTable } = require("./db");
const config = require("./config.json");

const chainId = process.argv[2];

if (!chainId || !config[chainId]) {
  console.error(
    "Invalid or missing chain_id. Please provide a valid chain_id as a command line argument."
  );
  process.exit(1);
}

const { PRIVATE_KEY, EOA_ADDRESS, RPC_URL, WS_RPC_URL } = config[chainId];
const web3 = new Web3(new Web3.providers.HttpProvider(RPC_URL));
const web3Ws = new Web3(new Web3.providers.WebsocketProvider(WS_RPC_URL));

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

const monitorStateRoot = async () => {
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

(async () => {
  monitorStateRoot();
})();
