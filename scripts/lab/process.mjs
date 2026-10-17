import { spawn } from "node:child_process";
import { cleanEnvironment, repo } from "./config.mjs";

// RTK is optional for classmates. Avoid shell interpolation, including Windows .cmd launchers.
export function run(
  program,
  args = [],
  {
    env = process.env,
    cwd = repo,
    capture = false,
    input,
    quiet = false,
    interactive = false,
  } = {},
) {
  if (!quiet)
    console.log(
      `> ${program} ${args.map((v) => (/\s/.test(v) ? "'" + v.replaceAll("'", "''") + "'" : v)).join(" ")}`,
    );
  let executable = program,
    argv = args;
  if (process.platform === "win32" && program === "gcloud") {
    const ps = (s) => "'" + s.replaceAll("'", "''") + "'";
    executable = "powershell.exe";
    argv = [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      `& gcloud ${args.map(ps).join(" ")}; exit $LASTEXITCODE`,
    ];
  }
  return new Promise((resolve, reject) => {
    const child = spawn(executable, argv, {
      cwd,
      env,
      windowsHide: true,
      stdio: [
        input ? "pipe" : interactive ? "inherit" : "ignore",
        capture ? "pipe" : "inherit",
        capture ? "pipe" : "inherit",
      ],
    });
    let out = "";
    child.stdout?.on("data", (d) => {
      out += d;
      if (out.length > 12_000_000) child.kill();
    });
    // Captured commands may include provider responses; do not print their stderr.
    child.stderr?.on("data", () => {});
    child.on("error", () =>
      reject(Error(`No se pudo iniciar ${program}. Revisa su instalación.`)),
    );
    child.on("close", (code) =>
      code === 0
        ? resolve(out.trim())
        : reject(
            Error(
              `${program} terminó con código ${code}. Revisa acceso, recurso y configuración.`,
            ),
          ),
    );
    if (input) child.stdin.end(input);
  });
}
export const awsArgs = (c, args) => [
  ...args,
  "--profile",
  c.awsProfile,
  ...(args.includes("--region") ? [] : ["--region", "us-east-2"]),
  "--no-cli-pager",
];
export const gcpArgs = (c, args) => [
  ...args,
  `--account=${c.gcpAccount}`,
  `--project=${c.gcpProjectId}`,
];
export const aws = (c, args, extra = {}) =>
  run("aws", awsArgs(c, args), { env: cleanEnvironment(), ...extra });
export const gcp = (c, args, extra = {}) =>
  run("gcloud", gcpArgs(c, args), { env: cleanEnvironment(), ...extra });
export async function identity(c) {
  const a = JSON.parse(
    await aws(c, ["sts", "get-caller-identity", "--output", "json"], {
      capture: true,
    }),
  );
  if (a.Account !== c.awsAccountId)
    throw Error(
      "La cuenta AWS autenticada no coincide con lab.json. Operación cancelada.",
    );
  const g = JSON.parse(
    await gcp(
      c,
      [
        "projects",
        "describe",
        c.gcpProjectId,
        "--format=json(projectId,lifecycleState)",
      ],
      { capture: true },
    ),
  );
  if (g.projectId !== c.gcpProjectId || g.lifecycleState !== "ACTIVE")
    throw Error("El proyecto GCP no coincide o no está activo.");
  return {
    awsAccountId: a.Account,
    awsArn: a.Arn,
    gcpProjectId: g.projectId,
    gcpAccount: c.gcpAccount,
  };
}
export async function freePlan(c) {
  const p = JSON.parse(
    await aws(
      c,
      [
        "freetier",
        "get-account-plan-state",
        "--region",
        "us-east-1",
        "--output",
        "json",
      ].filter(Boolean),
      { capture: true },
    ),
  );
  if (
    p.accountId !== c.awsAccountId ||
    p.accountPlanType !== "FREE" ||
    p.accountPlanStatus !== "ACTIVE" ||
    !Number.isFinite(Number(p.accountPlanRemainingCredits?.amount)) ||
    Number(p.accountPlanRemainingCredits?.amount) < 15 ||
    !(Date.parse(p.accountPlanExpirationDate) > Date.now())
  )
    throw Error(
      "Se requiere tu plan AWS FREE activo, vigente y crédito mínimo USD15. No se cambia facturación; esta ruta no admite un plan pagado.",
    );
  return {
    type: p.accountPlanType,
    remaining: p.accountPlanRemainingCredits,
    expires: p.accountPlanExpirationDate,
  };
}
