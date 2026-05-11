import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { Pool } from "pg";
import { Resend } from "resend";

const env = (name: string) => process.env[name]?.trim();

const pool = new Pool({
  connectionString: env("DATABASE_URL"),
  max: 1,
  ssl: { rejectUnauthorized: false },
});

const getResend = () => {
  const key = env("RESEND_API_KEY");
  if (!key) {
    throw new Error("RESEND_API_KEY is required to send auth emails");
  }
  return new Resend(key);
};

const FROM = "OLPDF <no-reply@olpdf.xyz>";
const BASE = env("BETTER_AUTH_URL") || "https://olpdf.xyz";

export const auth = betterAuth({
  baseURL: BASE,
  secret: env("BETTER_AUTH_SECRET")!,
  database: pool,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await getResend().emails.send({
        from: FROM,
        to: user.email,
        subject: "Reset your OLPDF password",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#f97316">Reset your password</h2>
            <p>Click the button below to reset your OLPDF password. This link expires in 1 hour.</p>
            <a href="${url}" style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">Reset Password</a>
            <p style="color:#6b7280;font-size:12px;margin-top:24px">If you didn't request this, ignore this email.</p>
          </div>`,
      });
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await getResend().emails.send({
        from: FROM,
        to: user.email,
        subject: "Verify your OLPDF email",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
            <h2 style="color:#f97316">Verify your email</h2>
            <p>Welcome to OLPDF! Click below to verify your email and access your workspace.</p>
            <a href="${url}" style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">Verify Email</a>
          </div>`,
      });
    },
    autoSignInAfterVerification: true,
  },

  socialProviders: {
    google: {
      clientId: env("GOOGLE_CLIENT_ID")!,
      clientSecret: env("GOOGLE_CLIENT_SECRET")!,
    },
    github: {
      clientId: env("GITHUB_CLIENT_ID")!,
      clientSecret: env("GITHUB_CLIENT_SECRET")!,
    },
  },

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await getResend().emails.send({
          from: FROM,
          to: email,
          subject: "Your OLPDF sign-in link",
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#f97316">Sign in to OLPDF</h2>
              <p>Click below to sign in. This link expires in 5 minutes and can only be used once.</p>
              <a href="${url}" style="display:inline-block;padding:12px 24px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">Sign In</a>
            </div>`,
        });
      },
    }),
  ],

  trustedOrigins: [
    "https://olpdf.xyz",
    "https://www.olpdf.xyz",
    "http://localhost:3000",
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
