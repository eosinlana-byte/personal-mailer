const nodemailer = require("nodemailer");

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

const hits = {};
function slot(login) {
  const now = Date.now();
  hits[login] = (hits[login] || []).filter((t) => now - t < 10 * 60 * 1000);
  if (hits[login].length >= 50) return false;
  hits[login].push(now);
  return true;
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, x-mailer-login, x-mailer-key" } };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "POST only" }) };
  }

  const login = event.headers["x-mailer-login"] || event.headers["X-Mailer-Login"] || "";
  const key = event.headers["x-mailer-key"] || event.headers["X-Mailer-Key"] || "";
  const user = findUser(login, key);
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: "Wrong login or key" }) };
  if (!slot(user.login)) {
    return { statusCode: 429, body: JSON.stringify({ error: "Max 50 sends every 10 minutes for this account." }) };
  }

  let data = {};
  try {
    data = JSON.parse(event.body || "{}");
  } catch (_) {
    return { statusCode: 400, body: JSON.stringify({ error: "Bad request" }) };
  }

  const to = String(data.to || "").trim().toLowerCase();
  const name = String(data.name || "").trim().slice(0, 80);
  const subject = String(data.subject || "").trim().slice(0, 180);
  const fromName = String(data.fromName || user.name || "").trim().slice(0, 60) || user.gmail;
  let body = String(data.body || "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || to.length > 120) {
    return { statusCode: 400, body: JSON.stringify({ error: "Bad email" }) };
  }
  if (!subject || !body.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: "Subject and message required" }) };
  }
  if (body.length > 8000) {
    return { statusCode: 400, body: JSON.stringify({ error: "Message too long" }) };
  }
  body = body.replace(/\{\{name\}\}/g, name || "there");

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: user.gmail, pass: user.pass },
    });
    await transporter.sendMail({
      from: `"${fromName.replace(/"/g, "")}" <${user.gmail}>`,
      to,
      replyTo: user.gmail,
      subject,
      text: body,
    });
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    console.error("mailer", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: "Gmail refused this send. That account's app password may be wrong." }) };
  }
};
