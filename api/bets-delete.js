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

    if (!userId || !betId) {
      throw appError("Dados insuficientes para excluir a aposta.");
    }

    const result = await withTransaction(async (client) => {
      const userResult = await client.query("select id, email, is_admin from users where id = ? limit 1", [userId]);
      const user = userResult.rows[0];

      if (!user) {
        throw appError("Usuario nao encontrado.", 404);
      }

      if (!user.is_admin && !isAdminEmail(user.email)) {
        throw appError("Apenas administradores podem excluir apostas.", 403);
      }

      const betResult = await client.query("select * from bets where id = ? limit 1", [betId]);
      const bet = betResult.rows[0];

      if (!bet) {
        throw appError("Aposta nao encontrada.", 404);
      }

      if (bet.status !== "open") {
        throw appError("Apenas apostas vigentes podem ser excluidas.");
      }

      const predictionsResult = await client.query("select count(*) as total from predictions where bet_id = ?", [betId]);
      const affectedPredictions = Number(predictionsResult.rows[0]?.total || 0);

      const combosResult = await client.query(
        `
          select distinct combo_id
          from combo_legs
          where bet_id = ?
        `,
        [betId]
      );
      const affectedComboIds = combosResult.rows.map((row) => row.combo_id).filter(Boolean);

      if (affectedComboIds.length) {
        const placeholders = affectedComboIds.map(() => "?").join(", ");
        await client.query(`delete from combos where id in (${placeholders})`, affectedComboIds);
      }

      await client.query("delete from bets where id = ?", [betId]);

      return {
        betId,
        title: bet.title,
        affectedPredictions,
        affectedCombos: affectedComboIds.length
      };
    });

    sendJson(res, 200, { deleted: result });
  } catch (error) {
    handleError(res, error);
  }
};
