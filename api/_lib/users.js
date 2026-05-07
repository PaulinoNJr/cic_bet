const crypto = require("crypto");

const PUBLIC_USER_COLUMNS = `
  id,
  name,
  email,
  avatar_url,
  character_id,
  starting_balance,
  is_admin,
  created_at
`;

async function ensureUserPasswordColumn(client) {
  const columns = await client.query("PRAGMA table_info(users)");
  const hasPasswordHash = columns.rows.some((column) => column.name === "password_hash");

  if (!hasPasswordHash) {
    await client.query("ALTER TABLE users ADD COLUMN password_hash TEXT");
  }
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt);
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password, passwordHash) {
  if (!passwordHash || !passwordHash.includes(":")) {
    return false;
  }

  const [salt, storedHash] = passwordHash.split(":");
  const derivedKey = await scryptAsync(password, salt);
  const storedBuffer = Buffer.from(storedHash, "hex");

  if (storedBuffer.length !== derivedKey.length) {
    return false;
  }

  return crypto.timingSafeEqual(storedBuffer, derivedKey);
}

function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

module.exports = {
  PUBLIC_USER_COLUMNS,
  ensureUserPasswordColumn,
  hashPassword,
  verifyPassword
};
