import crypto from "crypto";

function parseInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { hash: null as string | null, dataCheckString: "", data: {} as Record<string, string> };

  params.delete("hash");

  const pairs: string[] = [];
  const data: Record<string, string> = {};
  params.forEach((value, key) => {
    data[key] = value;
    pairs.push(`${key}=${value}`);
  });

  pairs.sort();
  const dataCheckString = pairs.join("\n");

  return { hash, dataCheckString, data };
}

export function verifyTelegramWebAppInitData(initData: string, botToken: string) {
  const { hash, dataCheckString, data } = parseInitData(initData);
  if (!hash) return { ok: false as const, reason: "hash_missing" };

  // secret_key = HMAC_SHA256(bot_token, key="WebAppData")
const secretKey = crypto
  .createHmac("sha256", "WebAppData")
  .update(botToken)
  .digest();

const computed = crypto
  .createHmac("sha256", secretKey)
  .update(dataCheckString)
  .digest("hex");


  if (computed !== hash) return { ok: false as const, reason: "hash_mismatch" };

  const authDate = Number(data["auth_date"] ?? 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || now - authDate > 300) return { ok: false as const, reason: "auth_date_expired" };

  return { ok: true as const, data };
}
