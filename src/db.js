const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("data/block_signature.db", (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log("Connected to the block_signature database.");
});

const createTable = () => {
  const query = `
  CREATE TABLE IF NOT EXISTS block_signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chain_id INTEGER,
    block_number INTEGER,
    state_root TEXT,
    address TEXT,
    signature TEXT,
    UNIQUE (chain_id, block_number)
  );`;

  return new Promise((resolve, reject) => {
    db.run(query, (err) => {
      if (err) {
        console.error(err.message);
        reject(err);
      } else {
        console.log("block_signatures table created");
        resolve();
      }
    });
  });
};

module.exports = {
  db,
  createTable,
};
