import nodemailer from "nodemailer";

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
};

function requireEnvironmentVariable(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Falta configurar ${name} para enviar correos de recompra.`);
  }
  return value;
}

export async function sendBrevoEmail({ to, subject, html }: SendEmailOptions) {
  const port = Number(process.env.BREVO_SMTP_PORT ?? "587");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("BREVO_SMTP_PORT no es un puerto valido.");
  }

  const transporter = nodemailer.createTransport({
    host: requireEnvironmentVariable("BREVO_SMTP_HOST"),
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: {
      user: requireEnvironmentVariable("BREVO_SMTP_USER"),
      pass: requireEnvironmentVariable("BREVO_SMTP_PASSWORD"),
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  const result = await transporter.sendMail({
    from: {
      name: requireEnvironmentVariable("BREVO_FROM_NAME"),
      address: requireEnvironmentVariable("BREVO_FROM_EMAIL"),
    },
    to,
    subject,
    html,
  });

  if (!result.accepted.includes(to)) {
    throw new Error("Brevo no acepto el destinatario del correo de recompra.");
  }
}
