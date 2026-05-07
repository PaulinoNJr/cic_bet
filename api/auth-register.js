const { allowMethods, sendJson, readJsonBody, handleError, appError } = require("./_lib/http");
const { withTransaction } = require("./_lib/db");
const { ensureDefaultCharacters } = require("./_lib/characters");
const { PUBLIC_USER_COLUMNS, ensureUserPasswordColumn, hashPassword } = require("./_lib/users");
const crypto = require("crypto");

function isAdminEmail(email) {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(String(email || "").toLowerCase());
}

function isAllowedAvatarValue(avatarUrl) {
  return !avatarUrl || avatarUrl.startsWith("/avatars/") || avatarUrl.startsWith("data:image/");
}

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const avatarUrl = String(body.avatarUrl || "").trim();
    const characterId = String(body.characterId || "").trim();
    const startingBalance = 1000;

    if (!name || name.length < 2) {
      throw appError("Informe um nome valido.");
    }

    if (!email) {
      throw appError("Informe um email valido.");
    }

    if (password.length < 4) {
      throw appError("A senha deve ter pelo menos 4 caracteres.");
    }

    if (!isAllowedAvatarValue(avatarUrl)) {
      throw appError("Avatar invalido. Escolha um avatar da arena ou envie uma imagem.");
    }

    if (avatarUrl.startsWith("data:image/") && avatarUrl.length > 320000) {
      throw appError("A imagem do avatar ficou muito grande. Tente uma foto menor.");
    }

    if (!characterId) {
      throw appError("Escolha um personagem.");
    }

    const insertedUser = await withTransaction(async (client) => {
      await ensureDefaultCharacters(client);
      await ensureUserPasswordColumn(client);

      const existingUser = await client.query("select id from users where lower(email) = ? limit 1", [email]);
      if (existingUser.rows.length) {
        throw appError("Ja existe um usuario com este email.", 409);
      }

      const character = await client.query("select id from characters where id = ? limit 1", [characterId]);
      if (!character.rows.length) {
        throw appError("Personagem nao encontrado.", 404);
      }

      const passwordHash = await hashPassword(password);
      const userId = crypto.randomUUID();

      await client.query(
        `
          insert into users (id, name, email, password_hash, avatar_url, character_id, starting_balance, is_admin)
          values (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [userId, name, email, passwordHash, avatarUrl || null, characterId, startingBalance, isAdminEmail(email) ? 1 : 0]
      );

      const inserted = await client.query(`select ${PUBLIC_USER_COLUMNS} from users where id = ? limit 1`, [userId]);
      return inserted.rows[0];
    });

    sendJson(res, 201, { user: insertedUser });
  } catch (error) {
    handleError(res, error);
  }
};
