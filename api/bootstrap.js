const { withTransaction } = require("./_lib/db");
const { allowMethods, sendJson, handleError } = require("./_lib/http");
const { fetchAllData } = require("./_lib/repository");

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ["GET"])) {
    return;
  }

  try {
    const data = await withTransaction((client) => fetchAllData(client));
    sendJson(res, 200, data);
  } catch (error) {
    handleError(res, error);
  }
};
