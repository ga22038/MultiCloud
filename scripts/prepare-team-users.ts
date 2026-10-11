/** Prepare a private, parameter-safe SQL batch. It never prints password material. */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { hashPassword } from "../app/src/server/crypto";
process.loadEnvFile(".secrets/gcp/user.env");
const usernames = [
  ...new Set(process.argv.slice(2).map((value) => value.toLowerCase())),
];
if (
  !usernames.length ||
  usernames.some((value) => !/^[a-z]{2}\d{5}$/.test(value))
)
  throw new Error("Indica los carnets autorizados, por ejemplo CA21062.");
const password = process.env.POLARIS_PASSWORD;
if (!password || process.env.POLARIS_USERNAME !== "ga22038")
  throw new Error("Falta la referencia privada de ga22038.");
const directory = ".secrets/aws/team-users";
fs.mkdirSync(directory, { recursive: true });
const master = JSON.parse(
  fs.readFileSync(".secrets/aws/rds-master.json", "utf8"),
);
const { host } = JSON.parse(
  fs.readFileSync(".secrets/aws/connection.json", "utf8"),
);
fs.writeFileSync(
  `${directory}/rds-client.cnf`,
  `[client]\nhost=${host}\nuser=${master.username}\npassword=${JSON.stringify(master.password)}\nssl-ca=/opt/polaris-ues/database-ca/ca.pem\nssl-verify-server-cert\n`,
  { mode: 0o600 },
);
const values = usernames
  .map(
    (username) =>
      `('${randomUUID()}','${username}','${username.toUpperCase()}','${hashPassword(password)}','Administrador',TRUE)`,
  )
  .join(",\n");
// Insert-only: rerunning never resets an existing account's credentials or permissions.
fs.writeFileSync(
  `${directory}/users.sql`,
  `START TRANSACTION;\nINSERT IGNORE INTO polaris_ues.app_users (id,username,name,password_hash,role,active) VALUES ${values};\nCOMMIT;\nSELECT username,role,active FROM polaris_ues.app_users WHERE username IN (${usernames.map((value) => `'${value}'`).join(",")}) ORDER BY username;\n`,
  { mode: 0o600 },
);
console.log(
  JSON.stringify({ preparedUsers: usernames, credentials: "private" }),
);
