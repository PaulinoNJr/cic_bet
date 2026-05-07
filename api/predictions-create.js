const { withTransaction } = require("./_lib/db");
const { allowMethods, sendJson, readJsonBody, handleError, appError } = require("./_lib/http");
const { fetchAllData } = require("./_lib/repository");
const { calculateUserBalance } = require("./_lib/game");
const crypto = require("crypto");

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const userId = String(body.userId || "").trim();
    const betId = String(body.betId || "").trim();
    const predictedValue = String(body.predictedValue || "").trim();
    const amount = Number(body.amount || 0);

    if (!userId || !betId) {
      throw appError("Dados da aposta incompletos.");
    }

    if (!predictedValue) {
      throw appError("Informe o valor do seu palpite antes de apostar.");
    }

    if (!Number.isInteger(amount) || amount < 10) {
      throw appError("A entrada minima e de 10 CICPoints.");
    }

    const prediction = await withTransaction(async (client) => {
      const data = await fetchAllData(client);
      const user = data.users.find((item) => item.id === userId);
      const bet = data.bets.find((item) => item.id === betId);
      const option = data.betOptions.find((item) => item.bet_id === betId);

      if (!user) {
        throw appError("Usuario nao encontrado.", 404);
      }

      if (!bet || !option) {
        throw appError("Aposta nao encontrada.", 404);
      }

      if (bet.status !== "open" || new Date(bet.closes_at) <= new Date()) {
        throw appError("Nao e mais possivel apostar neste evento.");
      }

      const existingPrediction = data.predictions.find((item) => item.user_id === userId && item.bet_id === betId);
      if (existingPrediction) {
        throw appError("Cada apostador pode registrar apenas uma aposta por evento.");
      }

      const balance = calculateUserBalance(user, data.predictions, data.bets, data.betOptions, data.combos, data.comboLegs);
      if (balance < amount) {
        throw appError("Saldo insuficiente para concluir a aposta.");
      }

      const predictionId = crypto.randomUUID();
      await client.query(
        `
          insert into predictions (id, user_id, bet_id, bet_option_id, predicted_value, amount, is_correct)
          values (?, ?, ?, ?, ?, ?, null)
        `,
        [predictionId, userId, betId, option.id, predictedValue, amount]
      );

      const inserted = await client.query("select * from predictions where id = ? limit 1", [predictionId]);
      return inserted.rows[0];
    });

    sendJson(res, 201, { prediction });
  } catch (error) {
    if (error && error.code === "23505") {
      handleError(res, appError("Cada apostador pode registrar apenas uma aposta por evento."));
      return;
    }

    handleError(res, error);
  }
};
