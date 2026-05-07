const { withTransaction } = require("./_lib/db");
const { allowMethods, sendJson, readJsonBody, handleError, appError } = require("./_lib/http");

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
    const betId = String(body.betId || "").trim();
    const winnerPredictionIds = Array.isArray(body.winnerPredictionIds)
      ? body.winnerPredictionIds.map((item) => String(item).trim()).filter(Boolean)
      : [];

    if (!userId || !betId) {
      throw appError("Dados insuficientes para encerrar a aposta.");
    }

    const updatedBet = await withTransaction(async (client) => {
      const userResult = await client.query("select * from users where id = ? limit 1", [userId]);
      const user = userResult.rows[0];

      if (!user) {
        throw appError("Usuario nao encontrado.", 404);
      }

      if (!user.is_admin && !isAdminEmail(user.email)) {
        throw appError("Apenas administradores podem definir resultados.", 403);
      }

      const betResult = await client.query("select * from bets where id = ? limit 1", [betId]);
      const bet = betResult.rows[0];

      if (!bet) {
        throw appError("Aposta nao encontrada.", 404);
      }

      if (bet.status !== "open") {
        throw appError("Esta aposta ja foi encerrada.");
      }

      const predictionsResult = await client.query("select id from predictions where bet_id = ?", [betId]);
      const validPredictionIds = new Set(predictionsResult.rows.map((row) => String(row.id)));

      for (const predictionId of winnerPredictionIds) {
        if (!validPredictionIds.has(predictionId)) {
          throw appError("Uma das apostas marcadas como vencedoras e invalida.");
        }
      }

      await client.query("update predictions set is_correct = 0 where bet_id = ?", [betId]);

      if (winnerPredictionIds.length) {
        const placeholders = winnerPredictionIds.map(() => "?").join(", ");
        await client.query(`update predictions set is_correct = 1 where id in (${placeholders})`, winnerPredictionIds);
      }

      await client.query(
        `
          update bets
          set status = 'settled', winning_option_id = null
          where id = ?
        `,
        [betId]
      );

      const updated = await client.query("select * from bets where id = ? limit 1", [betId]);
      return updated.rows[0];
    });

    sendJson(res, 200, { bet: updatedBet });
  } catch (error) {
    handleError(res, error);
  }
};
