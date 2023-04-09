const express = require("express");
const { db } = require("./db");
const validator = require("validator");

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
