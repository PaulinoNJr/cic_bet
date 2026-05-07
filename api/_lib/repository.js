const { ensureDefaultCharacters } = require("./characters");
const { PUBLIC_USER_COLUMNS } = require("./users");

async function fetchAllData(client) {
  await ensureDefaultCharacters(client);

  const characters = await client.query("select * from characters order by sort_order asc, created_at asc");
  const users = await client.query(`select ${PUBLIC_USER_COLUMNS} from users order by created_at asc`);
  const bets = await client.query("select * from bets order by created_at desc");
  const betOptions = await client.query("select * from bet_options order by sort_order asc, created_at asc");
  const predictions = await client.query("select * from predictions order by created_at desc");
  const combos = await client.query("select * from combos order by created_at desc");
  const comboLegs = await client.query("select * from combo_legs order by created_at asc");

  return {
    characters: characters.rows,
    users: users.rows,
    bets: bets.rows,
    betOptions: betOptions.rows,
    predictions: predictions.rows,
    combos: combos.rows,
    comboLegs: comboLegs.rows
  };
}

module.exports = {
  fetchAllData
};
