function users() {
  const list = [];
  for (let i = 1; i <= 3; i++) {
    const login = String(process.env["LOGIN" + i] || "").trim().toLowerCase();
    const key = String(process.env["KEY" + i] || "").trim();
    const gmail = String(process.env["GMAIL" + i] || "").trim();
    const pass = String(process.env["PASS" + i] || "").trim();
    const name = String(process.env["NAME" + i] || login || "").trim();
    if (login && key && gmail && pass) list.push({ login, key, gmail, pass, name });
  }
  return list;
}
function findUser(login, key) {
  const who = String(login || "").trim().toLowerCase();
  const k = String(key || "").trim();
  if (!who || !k) return null;
  return users().find((u) => u.login === who && u.key === k) || null;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, x-mailer-login, x-mailer-key" } };
  }
  const login = event.headers["x-mailer-login"] || event.headers["X-Mailer-Login"] || "";
  const key = event.headers["x-mailer-key"] || event.headers["X-Mailer-Key"] || "";
  const user = findUser(login, key);
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: "Wrong login or key" }) };
  const from = String(user.gmail).replace(/^(.).+(@.*)$/, "$1***$2");
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ready: true, name: user.name, from }),
  };
};
