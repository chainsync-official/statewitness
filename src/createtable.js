const { createTable } = require("./db");

(async () => {
  await createTable();
})();
