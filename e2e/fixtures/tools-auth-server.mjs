// Disposable, loopback-only signing authority for browser tests. No production
// Supabase project, credentials, or auth users are involved.
import { createServer } from "node:http";
import { generateKeyPairSync, sign } from "node:crypto";
const { privateKey, publicKey } = generateKeyPairSync("ec", {
  namedCurve: "P-256",
});
const jwk = {
  ...publicKey.export({ format: "jwk" }),
  kid: "siteops-local-only",
  alg: "ES256",
  use: "sig",
};
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  const url = new URL(req.url, "http://127.0.0.1:55440");
  if (url.pathname === "/auth/v1/.well-known/jwks.json")
    return res.end(JSON.stringify({ keys: [jwk] }));
  if (url.pathname === "/__fixture/token") {
    const header = b64({ alg: "ES256", typ: "JWT", kid: jwk.kid });
    const now = Math.floor(Date.now() / 1000);
    const payload = b64({
      sub: url.searchParams.get("id"),
      email: "fixture@example.test",
      user_role: url.searchParams.get("role"),
      role: "authenticated",
      aud: "authenticated",
      iss: "http://127.0.0.1:55440/auth/v1",
      iat: now,
      exp: now + 3600,
    });
    const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
      key: privateKey,
      dsaEncoding: "ieee-p1363",
    }).toString("base64url");
    return res.end(
      JSON.stringify({ token: `${header}.${payload}.${signature}` }),
    );
  }
  if (url.pathname === "/health") return res.end('{"ok":true}');
  res.writeHead(404);
  res.end('{"error":"No fixture endpoint"}');
}).listen(55440, "127.0.0.1");
