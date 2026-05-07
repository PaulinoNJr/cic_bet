const { query, withTransaction } = require("./_lib/db");
const { allowMethods, sendJson, readJsonBody, handleError, appError } = require("./_lib/http");
const { PUBLIC_USER_COLUMNS, ensureUserPasswordColumn, verifyPassword } = require("./_lib/users");

module.exports = async function handler(req, res) {
  if (!allowMethods(req, res, ["POST"])) {
    return;
  }

  try {
    const body = await readJsonBody(req);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email) {
      throw appError("Informe um email valido.");
    }

    if (!password) {
      throw appError("Informe sua senha.");
    }

    await withTransaction(async (client) => {
      await ensureUserPasswordColumn(client);
    });

    const result = await query(
      `
        select ${PUBLIC_USER_COLUMNS}, password_hash
        from users
        where lower(email) = ?
        limit 1
      `,
      [email]
    );
    const user = result.rows[0];

    if (!user) {
      throw appError("Usuario nao encontrado. Faca o cadastro primeiro.", 404);
    }

    const passwordMatches = await verifyPassword(password, user.password_hash);
    if (!passwordMatches) {
      throw appError("Senha invalida.", 401);
    }

    delete user.password_hash;
    sendJson(res, 200, { user });
  } catch (error) {
    handleError(res, error);
  }
};
