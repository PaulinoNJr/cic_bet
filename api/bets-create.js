const { withTransaction } = require("./_lib/db");
const { allowMethods, sendJson, readJsonBody, handleError, appError } = require("./_lib/http");
const crypto = require("crypto");

function isAdminEmail(email) {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(String(email || "").toLowerCase());
}

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const userId = String(body.userId || "").trim();
    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const closesAt = new Date(body.closesAt);
    const baseMultiplier = Number(body.baseMultiplier || 1.6);
    const riskLevel = "medium";
    const options = [
      { label: "Sim", oddsMultiplier: 1.5 },
      { label: "Nao", oddsMultiplier: 1.5 }
    ];

    if (!userId) {
      throw appError("Sessao invalida.");
    }

    if (!title || title.length < 4) {
      throw appError("Informe um titulo valido.");
    }

    if (Number.isNaN(closesAt.getTime()) || closesAt <= new Date()) {
      throw appError("Informe uma data futura para encerramento.");
    }

    const result = await withTransaction(async (client) => {
      const userResult = await client.query("select id, email, is_admin from users where id = ? limit 1", [userId]);
      const user = userResult.rows[0];

      if (!user) {
        throw appError("Usuario nao encontrado.", 404);
      }

      if (!user.is_admin && !isAdminEmail(user.email)) {
        throw appError("Apenas administradores podem cadastrar apostas.", 403);
      }

      const betId = crypto.randomUUID();
      await client.query(
        `
          insert into bets (id, title, description, closes_at, created_by, base_multiplier, risk_level, status)
          values (?, ?, ?, ?, ?, ?, ?, 'open')
        `,
        [betId, title, description || null, closesAt.toISOString(), userId, baseMultiplier, riskLevel]
      );

      for (let index = 0; index < options.length; index += 1) {
        const option = options[index];
        const label = String(option.label || "").trim();
        const oddsMultiplier = Number(option.oddsMultiplier || 1.5);

        if (!label) {
          throw appError("Uma das opcoes esta vazia.");
        }

        await client.query(
          `
            insert into bet_options (id, bet_id, label, odds_multiplier, sort_order)
            values (?, ?, ?, ?, ?)
          `,
          [crypto.randomUUID(), betId, label, oddsMultiplier, index + 1]
        );
      }

      const insertedBet = await client.query("select * from bets where id = ? limit 1", [betId]);
      return insertedBet.rows[0];
    });

    sendJson(res, 201, { bet: result });
  } catch (error) {
    handleError(res, error);
  }
};
