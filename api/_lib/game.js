function comboBonusMultiplier(legsCount) {
  if (legsCount <= 1) {
    return 1;
  }

  return Number((1 + (legsCount - 1) * 0.12).toFixed(2));
}

function calculatePredictionPotential(amount, baseMultiplier) {
  return Math.round(Number(amount || 0) * Number(baseMultiplier || 0));
}

function calculateComboLegOdd(baseMultiplier, optionOdds) {
  return Number(baseMultiplier) * Number(optionOdds) * 0.45;
}

function calculateComboFinalOdds(legs) {
  const baseOdds = legs.reduce((acc, leg) => acc * calculateComboLegOdd(leg.base_multiplier, leg.odds_multiplier), 1);
  return Number((baseOdds * comboBonusMultiplier(legs.length)).toFixed(2));
}

function calculateUserBalance(user, predictions, bets, options, combos, comboLegs) {
  const spentOnPredictions = predictions
    .filter((item) => item.user_id === user.id)
    .reduce((acc, item) => acc + Number(item.amount || 0), 0);

  const spentOnCombos = combos
    .filter((item) => item.user_id === user.id)
    .reduce((acc, item) => acc + Number(item.stake || 0), 0);

  const predictionWins = predictions
    .filter((item) => item.user_id === user.id)
    .reduce((acc, item) => {
      const bet = bets.find((candidate) => candidate.id === item.bet_id);

      if (!bet || bet.status !== "settled" || item.is_correct !== true) {
        return acc;
      }

      return acc + calculatePredictionPotential(item.amount, bet.base_multiplier);
    }, 0);

  const comboWins = combos
    .filter((combo) => combo.user_id === user.id)
    .reduce((acc, combo) => {
      const legs = comboLegs.filter((leg) => leg.combo_id === combo.id);
      const allWon =
        legs.length > 0 &&
        legs.every((leg) => {
          const bet = bets.find((candidate) => candidate.id === leg.bet_id);
          return bet && bet.status === "settled" && bet.winning_option_id === leg.bet_option_id;
        });

      if (!allWon) {
        return acc;
      }

      return acc + Number(combo.potential_payout || 0);
    }, 0);

  return Number(user.starting_balance || 0) - spentOnPredictions - spentOnCombos + predictionWins + comboWins;
}

module.exports = {
  comboBonusMultiplier,
  calculatePredictionPotential,
  calculateComboFinalOdds,
  calculateUserBalance
};
