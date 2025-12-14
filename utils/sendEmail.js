const sgMail = require("@sendgrid/mail");

async function sendContactEmail({ name, email, phone, message, vehicle }) {
  const apiKey = process.env.SENDGRID_API_KEY;
  const to = process.env.CONTACT_TO;      // uses your existing env var
  const from = process.env.FROM_EMAIL;

  if (!apiKey || !to || !from) {
    console.error("[SendGrid] Missing env vars:", {
      hasKey: Boolean(apiKey),
      to: to || null,
      from: from || null,
    });
    throw new Error("Missing SENDGRID_API_KEY / CONTACT_TO / FROM_EMAIL");
  }

  sgMail.setApiKey(apiKey);

  const subject = vehicle ? `New Lead: ${name} — ${vehicle}` : `New Lead: ${name}`;

  const text = [
    `Name: ${name || ""}`,
    `Email: ${email || ""}`,
    `Phone: ${phone || ""}`,
    `Vehicle: ${vehicle || ""}`,
    "",
    "Message:",
    message || "",
  ].join("\n");

  try {
    const [resp] = await sgMail.send({
      to,
      from,
      subject,
      text,
      replyTo: email || undefined,
    });

    console.log("[SendGrid] Sent OK:", { statusCode: resp.statusCode });
    return resp.statusCode;
  } catch (err) {
    console.error("[SendGrid] Send FAILED:", {
      message: err.message,
      statusCode: err?.response?.statusCode,
      body: err?.response?.body || null,
    });
    throw err;
  }
}

module.exports = { sendContactEmail };
