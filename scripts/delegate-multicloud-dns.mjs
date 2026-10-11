import fs from "node:fs";
import { Resolver } from "node:dns/promises";
const token = process.env.VERCEL_TOKEN;
if (!token) throw new Error("Falta VERCEL_TOKEN en el entorno privado.");
const domain = "polarisenterprisesv.com";
const dns = JSON.parse(fs.readFileSync(".secrets/aws/dns.json", "utf8"));
const nameservers = dns.nameservers;
if (
  nameservers.length !== 4 ||
  nameservers.some(
    (x) => !/^ns-\d+\.awsdns-\d+\.(com|net|org|co\.uk)\.?$/.test(x),
  )
)
  throw new Error("Nameservers AWS inválidos.");
const resolver = new Resolver();
resolver.setServers(["1.1.1.1"]);
const nsAddresses = await resolver.resolve4(nameservers[0]);
const authoritative = new Resolver();
authoritative.setServers([nsAddresses[0]]);
for (const [host, address] of Object.entries({
  aws: "18.227.139.179",
  gcp: "34.122.222.237",
  app: "18.227.139.179",
})) {
  if (
    !(await authoritative.resolve4(`${host}.multicloud.${domain}`)).includes(
      address,
    )
  )
    throw new Error(
      `La zona preparada no responde correctamente para ${host}.`,
    );
}
async function api(path, teamId, body, method) {
  const url = new URL(path, "https://api.vercel.com");
  if (teamId) url.searchParams.set("teamId", teamId);
  const response = await fetch(url, {
    method: method ?? (body ? "POST" : "GET"),
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Vercel respondió HTTP ${response.status}: ${error.error?.code ?? ""} ${error.error?.message ?? ""}`,
    );
  }
  return response.status === 204 ? {} : response.json();
}
const teams = await api("/v2/teams?limit=100");
let teamId;
for (const team of teams.teams ?? []) {
  const data = await api("/v5/domains?limit=100", team.id);
  if (data.domains?.some((x) => x.name === domain)) {
    teamId = team.id;
    break;
  }
}
if (!teamId) throw new Error("No se encontró el dominio autorizado.");
const data = await api(`/v5/domains/${domain}/records?limit=100`, teamId);
if (data.pagination?.next)
  throw new Error("Revisar paginación antes de modificar DNS.");
const records = data.records ?? [];
const existing = records.filter((x) => x.name === "multicloud");
if (
  existing.some(
    (x) => x.type !== "NS" || !nameservers.includes(x.value.replace(/\.$/, "")),
  )
)
  throw new Error(
    "Ya existe una configuración diferente para multicloud. No sobrescribir.",
  );
const expectedChildren = {
  "aws.multicloud": "18.227.139.179",
  "gcp.multicloud": "34.122.222.237",
  "app.multicloud": "34.122.222.237",
};
const children = records.filter((x) => x.name.endsWith(".multicloud"));
if (
  children.some((x) => x.type !== "A" || expectedChildren[x.name] !== x.value)
)
  throw new Error(
    "La subzona contiene registros inesperados; no migrar automáticamente.",
  );
if (!existing.length && children.length !== 3)
  throw new Error("Faltan registros esperados antes de la migración.");
if (!fs.existsSync(".secrets/aws/vercel-dns-before.json"))
  fs.writeFileSync(
    ".secrets/aws/vercel-dns-before.json",
    JSON.stringify({ existing, children }, null, 2),
    { mode: 0o600 },
  );
try {
  // Vercel requires removing the three child A records before adding delegation.
  // Their equivalents are already live and verified in the Route 53 child zone.
  for (const record of children)
    await api(
      `/v2/domains/${domain}/records/${record.id ?? record.uid}`,
      teamId,
      undefined,
      "DELETE",
    );
  for (const value of nameservers) {
    if (
      !existing.some(
        (x) => x.type === "NS" && x.value.replace(/\.$/, "") === value,
      )
    ) {
      await api(`/v2/domains/${domain}/records`, teamId, {
        name: "multicloud",
        type: "NS",
        value,
        ttl: 60,
        comment: "Polaris UES Route 53 AWS/GCP failover",
      });
    }
  }
} catch (error) {
  if (!existing.length) {
    const current = await api(
      `/v5/domains/${domain}/records?limit=100`,
      teamId,
    );
    for (const record of current.records ?? []) {
      if (
        record.name === "multicloud" &&
        record.type === "NS" &&
        nameservers.includes(record.value.replace(/\.$/, ""))
      )
        await api(
          `/v2/domains/${domain}/records/${record.id ?? record.uid}`,
          teamId,
          undefined,
          "DELETE",
        );
    }
    const after = await api(`/v5/domains/${domain}/records?limit=100`, teamId);
    for (const record of children) {
      if (
        !after.records?.some(
          (x) =>
            x.name === record.name &&
            x.type === record.type &&
            x.value === record.value,
        )
      )
        await api(`/v2/domains/${domain}/records`, teamId, {
          name: record.name,
          type: record.type,
          value: record.value,
          ttl: record.ttl ?? 60,
        });
    }
  }
  throw error;
}
console.log(
  JSON.stringify({
    zone: `multicloud.${domain}`,
    delegatedTo: "Route 53",
    nameservers,
  }),
);
