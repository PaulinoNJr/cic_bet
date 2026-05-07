const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

loadEnvFile(path.join(__dirname, ".env"));

const port = Number(process.env.PORT || 3000);

const apiRoutes = {
  "/api/config": require("./api/config"),
  "/api/bootstrap": require("./api/bootstrap"),
  "/api/auth-login": require("./api/auth-login"),
  "/api/auth-register": require("./api/auth-register"),
  "/api/bets-create": require("./api/bets-create"),
  "/api/bets-delete": require("./api/bets-delete"),
  "/api/predictions-create": require("./api/predictions-create"),
  "/api/combos-create": require("./api/combos-create"),
  "/api/bets-resolve": require("./api/bets-resolve")
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);

  enhanceResponse(res);

  try {
    if (pathname in apiRoutes) {
      await apiRoutes[pathname](req, res);
      return;
    }

    await serveStatic(pathname, res);
  } catch (error) {
    console.error(error);
    if (!res.writableEnded) {
      res.status(500).json({ message: "Falha ao processar a requisicao local." });
    }
  }
});

server.listen(port, () => {
  console.log(`CIC Bet Arena rodando em http://localhost:${port}`);
});

function enhanceResponse(res) {
  res.status = function status(code) {
    this.statusCode = code;
    return this;
  };

  res.json = function json(payload) {
    if (!this.headersSent) {
      this.setHeader("Content-Type", "application/json; charset=utf-8");
    }

    this.end(JSON.stringify(payload));
  };
}

async function serveStatic(pathname, res) {
  const filePath = resolveStaticPath(pathname);

  if (!filePath) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end("Nao encontrado.");
    return;
  }

  let content;

  try {
    content = await fs.promises.readFile(filePath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      res.statusCode = 404;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Arquivo nao encontrado.");
      return;
    }

    throw error;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", getContentType(filePath));
  res.end(content);
}

function resolveStaticPath(pathname) {
  if (pathname === "/") {
    return path.join(__dirname, "index.html");
  }

  if (pathname === "/index.html" || pathname === "/styles.css" || pathname === "/app.js") {
    return path.join(__dirname, pathname.slice(1));
  }

  if (pathname === "/cic-color-bet.png" || pathname.startsWith("/avatars/") || pathname.startsWith("/characters/")) {
    return path.join(__dirname, "public", pathname.replace(/^\/+/, ""));
  }

  return null;
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".html") {
    return "text/html; charset=utf-8";
  }

  if (extension === ".css") {
    return "text/css; charset=utf-8";
  }

  if (extension === ".js") {
    return "application/javascript; charset=utf-8";
  }

  if (extension === ".svg") {
    return "image/svg+xml";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".json") {
    return "application/json; charset=utf-8";
  }

  return "application/octet-stream";
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}
