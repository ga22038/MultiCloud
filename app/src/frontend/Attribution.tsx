import type { Registered } from "../domain";
import { dateLabel } from "../dates";

export function AttributionCells({ record }: { record: Registered }) {
  return (
    <>
      <td>
        <span>{record.createdBy || "Sin registro histórico"}</span>
      </td>
      <td>
        <span>{record.updatedBy || "Sin cambios registrados"}</span>
        {record.updatedAt && (
          <small className="cell-subtitle">
            {dateLabel(record.updatedAt, true)}
          </small>
        )}
      </td>
    </>
  );
}

export function CreatorFilter({
  value,
  onChange,
  records,
}: {
  value: string;
  onChange: (value: string) => void;
  records: Registered[];
}) {
  const creators = [
    ...new Set(
      records
        .map((row) => row.createdBy)
        .filter((name): name is string => !!name),
    ),
  ].sort();
  return (
    <select
      aria-label="Filtrar por creador"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Todos los creadores</option>
      <option value="__unknown__">Sin registro histórico</option>
      {creators.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}
export const matchesCreator = (record: Registered, value: string) =>
  !value ||
  (value === "__unknown__" ? !record.createdBy : record.createdBy === value);
