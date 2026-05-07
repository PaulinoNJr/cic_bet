const { allowMethods, sendJson, handleError } = require("./_lib/http");
const { getDatabasePath } = require("./_lib/db");

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ["GET"])) {
    return;
  }

  try {
    sendJson(res, 200, {
      databaseMode: "sqlite",
      databasePath: getDatabasePath(),
      adminEmails: String(process.env.ADMIN_EMAILS || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    });
  } catch (error) {
    handleError(res, error);
  }
};
