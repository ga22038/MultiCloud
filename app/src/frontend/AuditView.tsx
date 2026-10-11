import { useState } from "react";
import type { State } from "../domain";
import { dateLabel } from "../dates";
import { Empty, PageTitle, Pagination, SearchBox } from "./components";
import { usePagination } from "./pagination";

const labels = {
  customers: "Cliente",
  materials: "Material",
  warehouses: "Bodega",
  stocks: "Inventario",
  orders: "Pedido",
  movements: "Movimiento",
};
export function AuditView({ state }: { state: State }) {
  const [query, setQuery] = useState("");
  const [actor, setActor] = useState("");
  const actors = [...new Set(state.audit.map((entry) => entry.actor))].sort();
  const rows = state.audit.filter(
    (entry) =>
      (!actor || entry.actor === actor) &&
      `${entry.action} ${entry.detail} ${entry.actor} ${entry.operationId || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const pagination = usePagination(
    rows.length,
    `${query}|${actor}|${state.revision}`,
  );
  return (
    <>
      <PageTitle
        eyebrow="TRAZABILIDAD DEL EQUIPO"
        title="Auditoría"
        description="Historial compartido de operaciones: quién realizó cada acción, cuándo y sobre qué registro."
      />
      <section className="panel">
        <div className="table-toolbar filters">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="Buscar acción, detalle, usuario u operación…"
          />
          <select
            aria-label="Filtrar auditoría por usuario"
            value={actor}
            onChange={(event) => setActor(event.target.value)}
          >
            <option value="">Todos los usuarios</option>
            {actors.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario / Rol</th>
                <th>Acción / Detalle</th>
                <th>Registros afectados</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(pagination.start, pagination.end).map((entry) => (
                <tr key={entry.id}>
                  <td className="date-cell">{dateLabel(entry.at, true)}</td>
                  <td>
                    <strong>{entry.actor}</strong>
                    <small className="cell-subtitle">{entry.role}</small>
                  </td>
                  <td>
                    <strong>{entry.action}</strong>
                    <small className="cell-subtitle">{entry.detail}</small>
                    {entry.operationId && (
                      <details>
                        <summary>Identificador de operación</summary>
                        <code>{entry.operationId}</code>
                      </details>
                    )}
                    {entry.changes && (
                      <details>
                        <summary>Ver cambio anterior y posterior</summary>
                        <pre className="audit-change">
                          {JSON.stringify(entry.changes, null, 2)}
                        </pre>
                      </details>
                    )}
                  </td>
                  <td>
                    {entry.entities?.length
                      ? entry.entities.map((entity) => (
                          <small
                            className="cell-subtitle"
                            key={`${entity.kind}:${entity.id}`}
                          >
                            {labels[entity.kind]} · {entity.id}
                          </small>
                        ))
                      : "Sin vínculo histórico"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty />}
        </div>
        <Pagination pagination={pagination} />
      </section>
    </>
  );
}
