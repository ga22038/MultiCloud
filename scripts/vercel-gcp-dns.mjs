const token = process.env.VERCEL_TOKEN;
if (!token) throw new Error("Falta VERCEL_TOKEN en el archivo privado.");
const domain = "polarisenterprisesv.com";
const address = process.argv[2];
const site = process.argv[3] ?? "gcp";
if (!["gcp", "aws"].includes(site))
  throw new Error("Sitio inválido: usa gcp o aws.");
if (
  !address ||
  !/^\d{1,3}(\.\d{1,3}){3}$/.test(address) ||
  address.startsWith("127.")
)
  throw new Error("Proporciona la IP pública de la máquina del proyecto.");
async function api(path, teamId, body) {
  const url = new URL(path, "https://api.vercel.com");
  if (teamId) url.searchParams.set("teamId", teamId);
  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(`Vercel respondió HTTP ${response.status}.`);
  return response.json();
}
try {
  const teams = await api("/v2/teams?limit=100");
  let teamId;
  for (const team of teams.teams ?? []) {
    const result = await api("/v5/domains?limit=100", team.id);
    if (result.domains?.some((d) => d.name === domain)) {
      teamId = team.id;
      break;
    }
  }
  if (!teamId)
    throw new Error("No se encontró el dominio en los equipos accesibles.");
  const data = await api(`/v5/domains/${domain}/records?limit=100`, teamId);
  if (data.pagination?.next)
    throw new Error("La lista DNS requiere paginación antes de modificarla.");
  const records = data.records ?? [];
  if (records.some((r) => r.name === "multicloud" && r.type === "NS"))
    throw new Error(
      "La zona multicloud ya está delegada; revisar el proveedor autoritativo.",
    );
  const names =
    site === "aws" ? ["aws.multicloud"] : ["gcp.multicloud", "app.multicloud"];
  for (const name of names) {
    if (
      records.some(
        (r) =>
          r.name === name &&
          ["A", "AAAA", "CNAME"].includes(r.type) &&
          !(r.type === "A" && r.value === address),
      )
    )
      throw new Error(
        `Existe un destino diferente para ${name}; no se modificó.`,
      );
  }
  for (const name of names) {
    if (
      !records.some(
        (r) => r.name === name && r.type === "A" && r.value === address,
      )
    ) {
      await api(`/v2/domains/${domain}/records`, teamId, {
        name,
        type: "A",
        value: address,
        ttl: 60,
        comment: `Polaris UES ${site.toUpperCase()} academic deployment`,
      });
    }
    console.log(`${name}.${domain} -> ${address}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
