const { withTransaction } = require("./_lib/db");
const { allowMethods, sendJson, readJsonBody, handleError, appError } = require("./_lib/http");
const { fetchAllData } = require("./_lib/repository");
const { calculateUserBalance, calculateComboFinalOdds, comboBonusMultiplier } = require("./_lib/game");
const crypto = require("crypto");

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const userId = String(body.userId || "").trim();
    const stake = Number(body.stake || 0);
    const legs = Array.isArray(body.legs) ? body.legs : [];

    if (!userId) {
      throw appError("Sessao invalida.");
    }

    if (!Number.isInteger(stake) || stake < 10) {
      throw appError("Stake invalida para o combo.");
    }

    if (legs.length < 2) {
      throw appError("Escolha pelo menos duas selecoes.");
    }

    const combo = await withTransaction(async (client) => {
      const data = await fetchAllData(client);
      const user = data.users.find((item) => item.id === userId);

      if (!user) {
        throw appError("Usuario nao encontrado.", 404);
      }

      const balance = calculateUserBalance(user, data.predictions, data.bets, data.betOptions, data.combos, data.comboLegs);
      if (balance < stake) {
        throw appError("Saldo insuficiente para registrar o combo.");
      }

      const uniqueBetIds = new Set(legs.map((leg) => String(leg.betId)));
      if (uniqueBetIds.size !== legs.length) {
        throw appError("Cada selecao do combo deve vir de uma aposta diferente.");
      }

      const resolvedLegs = legs.map((leg) => {
        const bet = data.bets.find((item) => item.id === String(leg.betId));
        const option = data.betOptions.find(
          (item) => item.id === String(leg.betOptionId) && item.bet_id === String(leg.betId)
        );

        if (!bet || !option) {
          throw appError("Uma das selecoes do combo e invalida.");
        }

        if (bet.status !== "open" || new Date(bet.closes_at) <= new Date()) {
          throw appError(`A aposta "${bet.title}" nao aceita mais combinacoes.`);
        }

        return {
          bet,
          option,
          base_multiplier: bet.base_multiplier,
          odds_multiplier: option.odds_multiplier
        };
      });

      const finalOdds = calculateComboFinalOdds(resolvedLegs);
      const potentialPayout = Math.round(stake * finalOdds);
      const comboId = crypto.randomUUID();
      await client.query(
        `
          insert into combos (id, user_id, stake, bonus_multiplier, final_odds, potential_payout)
          values (?, ?, ?, ?, ?, ?)
        `,
        [comboId, userId, stake, comboBonusMultiplier(resolvedLegs.length), finalOdds, potentialPayout]
      );

      for (const leg of resolvedLegs) {
        await client.query(
          `
            insert into combo_legs (id, combo_id, bet_id, bet_option_id)
            values (?, ?, ?, ?)
          `,
          [crypto.randomUUID(), comboId, leg.bet.id, leg.option.id]
        );
      }

      const insertedCombo = await client.query("select * from combos where id = ? limit 1", [comboId]);
      return insertedCombo.rows[0];
    });

    sendJson(res, 201, { combo });
  } catch (error) {
    handleError(res, error);
  }
};
