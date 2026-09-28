import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

import { emailVerificationTokens, plans, users } from "@/db/schema";
import { startTestDatabase, type TestDatabase } from "@/db/testing/container";
import {
  issueVerificationToken,
  signUp,
  verifyEmail,
} from "@/lib/auth/service";
import { consoleMailer, createResendMailer, type Mailer } from "./mailer";
import { verificationEmail } from "./templates";

let tdb: TestDatabase;

beforeAll(async () => {
  process.env.SESSION_SECRET = "test-secret-at-least-32-characters-long!!";
  tdb = await startTestDatabase();
}, 180_000);

afterAll(async () => {
  await tdb?.stop();
});

afterEach(async () => {
  await tdb.reset();
  vi.restoreAllMocks();
});

async function seedUser() {
  await tdb.db.insert(plans).values({
    code: "trial",
    name: "Trial",
    priceCents: 0,
    generationLimit: 2,
    period: "lifetime",
    dailyCap: 2,
  });
  return signUp(tdb.db, {
    email: "casey@example.com",
    password: "a-long-enough-password",
  });
}

describe("verificationEmail", () => {
  const message = verificationEmail({
    to: "casey@example.com",
    verifyUrl: "https://app.example.com/verify-email?token=abc123",
  });

  // Some clients render only the text part; a verification mail with no usable
  // link in it is a dead end.
  it("puts the link in the text part as well as the HTML", () => {
    expect(message.text).toContain(
      "https://app.example.com/verify-email?token=abc123",
    );
    expect(message.html).toContain(
      "https://app.example.com/verify-email?token=abc123",
    );
  });

  it("states the expiry", () => {
    expect(message.text).toMatch(/24 hours/);
  });

  it("escapes the URL into the HTML", () => {
    const hostile = verificationEmail({
      to: "casey@example.com",
      verifyUrl: 'https://x.test/?token=a"><script>alert(1)</script>',
    });
    expect(hostile.html).not.toContain("<script>");
  });
});

describe("createResendMailer", () => {
  // The SDK reports failures in the response body rather than throwing, so a
  // naive adapter reports success on every rejected message.
  it("throws when Resend returns an error instead of reporting success", async () => {
    vi.doMock("resend", () => ({
      Resend: class {
        emails = {
          send: async () => ({ error: { message: "domain not verified" } }),
        };
      },
    }));

    const mailer = createResendMailer("key", "noreply@example.com");
    await expect(
      mailer.send({ to: "a@b.test", subject: "s", text: "t", html: "<p>t</p>" }),
    ).rejects.toThrow(/domain not verified/);

    vi.doUnmock("resend");
  });
});

describe("consoleMailer", () => {
  it("logs rather than sending", async () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    await consoleMailer.send({
      to: "casey@example.com",
      subject: "Confirm your email",
      text: "link",
      html: "<p>link</p>",
    });
    expect(spy).toHaveBeenCalled();
  });
});

describe("issueVerificationToken", () => {
  it("issues a working token", async () => {
    const { user } = await seedUser();
    const token = await issueVerificationToken(tdb.db, user.id);
    expect(token).toBeTruthy();

    await verifyEmail(tdb.db, token!);
    const [row] = await tdb.db.select().from(users).where(eq(users.id, user.id));
    expect(row.emailVerifiedAt).not.toBeNull();
  });

  /**
   * Otherwise an old link — forwarded, or sitting in a mailbox the user no
   * longer controls — stays usable for its full 24 hours after they asked for
   * a replacement.
   */
  it("invalidates the previous token", async () => {
    const { user, verificationToken: original } = await seedUser();

    const replacement = await issueVerificationToken(tdb.db, user.id);
    expect(replacement).not.toBe(original);

    await expect(verifyEmail(tdb.db, original)).rejects.toMatchObject({
      code: "invalid_token",
    });
    await expect(verifyEmail(tdb.db, replacement!)).resolves.toBe(user.id);
  });

  it("returns null once the address is verified, so no pointless email is sent", async () => {
    const { user, verificationToken } = await seedUser();
    await verifyEmail(tdb.db, verificationToken);

    expect(await issueVerificationToken(tdb.db, user.id)).toBeNull();
  });

  it("returns null for an unknown user", async () => {
    expect(await issueVerificationToken(tdb.db, crypto.randomUUID())).toBeNull();
  });

  it("leaves exactly one live token behind", async () => {
    const { user } = await seedUser();
    await issueVerificationToken(tdb.db, user.id);
    await issueVerificationToken(tdb.db, user.id);

    const rows = await tdb.db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, user.id));

    expect(rows).toHaveLength(3); // signup + two resends
    expect(rows.filter((r) => r.consumedAt === null)).toHaveLength(1);
  });
});

describe("delivery failure", () => {
  /**
   * Signup has already committed by the time the mail is sent. If a provider
   * outage propagated, the user would see a failed signup, retry, and hit
   * "email already registered" on an account they cannot reach.
   */
  it("does not surface a provider outage as a signup failure", async () => {
    const failing: Mailer = {
      async send() {
        throw new Error("provider is down");
      },
    };
    const { setMailer } = await import("./mailer");
    const { sendVerificationEmail } = await import("./send-verification");
    setMailer(failing);
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendVerificationEmail({ to: "casey@example.com", token: "abc" }),
    ).resolves.toEqual({ delivered: false });

    setMailer(undefined);
  });
});
