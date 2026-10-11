import assert from "node:assert/strict";
import { createHash } from "node:crypto";
process.loadEnvFile(".secrets/gcp/user.env");
const usernames = ["ca21062", "lp21019", "se21003", "sl21010", "jm21008"];
const origins = [
  "https://aws.multicloud.polarisenterprisesv.com",
  "https://gcp.multicloud.polarisenterprisesv.com",
];
const results = [];
let documentHash;
// NGINX limits session requests by IP, including logout. Respect the shared quota.
async function session(origin, options) {
  for (let attempt = 0; attempt < 7; attempt++) {
    const response = await fetch(`${origin}/api/v1/session`, options);
    if (response.status !== 429 || attempt === 6) return response;
    await new Promise((resolve) => setTimeout(resolve, 13000));
  }
}
for (const origin of origins)
  for (const username of usernames) {
    const response = await session(origin, {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.toUpperCase(),
        password: process.env.POLARIS_PASSWORD,
      }),
    });
    assert.equal(response.status, 200, `Login failed for ${username}`);
    const Cookie = response.headers.get("set-cookie").split(";")[0];
    try {
      const response = await fetch(`${origin}/api/v1/state`, {
        headers: { Cookie },
      });
      assert.equal(response.status, 200);
      const { state, user, site } = await response.json();
      assert.equal(user.name, username.toUpperCase());
      assert.equal(user.role, "Administrador");
      const fingerprint = createHash("sha256")
        .update(JSON.stringify(state))
        .digest("hex");
      documentHash ??= fingerprint;
      assert.equal(fingerprint, documentHash);
      results.push({
        site,
        username,
        role: user.role,
        revision: state.revision,
        sharedData: true,
      });
    } finally {
      await session(origin, {
        method: "DELETE",
        headers: { Cookie, Origin: origin },
      });
    }
  }
console.log(JSON.stringify({ result: "TEAM_USERS_OK", results }));
