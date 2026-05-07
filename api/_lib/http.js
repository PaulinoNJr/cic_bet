function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

async function readJsonBody(req) {
  if (typeof req.body === "object" && req.body !== null) {
    return req.body;
  }

  const chunks = [];

  await new Promise((resolve, reject) => {
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", resolve);
    req.on("error", reject);
  });

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function allowMethods(req, res, methods) {
  if (!methods.includes(req.method)) {
    res.setHeader("Allow", methods.join(", "));
    sendJson(res, 405, { message: "Metodo nao permitido." });
    return false;
  }

  return true;
}

function handleError(res, error) {
  if (error && typeof error.status === "number") {
    sendJson(res, error.status, { message: error.message });
    return;
  }

  console.error(error);
  sendJson(res, 500, { message: "Falha interna ao processar a solicitacao." });
}

function appError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  sendJson,
  readJsonBody,
  allowMethods,
  handleError,
  appError
};
