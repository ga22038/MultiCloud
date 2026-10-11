import type { Order, State, Status } from "./domain";
export type WorkflowModule = "orders" | "dispatch" | "billing";
export const workflowDefinition: Record<
  WorkflowModule,
  {
    title: string;
    eyebrow: string;
    description: string;
    statuses: Status[];
    action: string;
  }
> = {
  orders: {
    title: "Pedidos",
    eyebrow: "GESTIÓN COMERCIAL",
    description: "Registra solicitudes y consulta el avance de cada pedido.",
    statuses: ["Nuevo", "Asignado", "Confirmado", "Facturado", "Cancelado"],
    action: "Ver pedido",
  },
  dispatch: {
    title: "Despacho",
    eyebrow: "OPERACIÓN DE BODEGA",
    description:
      "Asigna lotes, prepara el alistamiento y confirma la salida física.",
    statuses: ["Nuevo", "Asignado"],
    action: "Preparar despacho",
  },
  billing: {
    title: "Facturación",
    eyebrow: "CIERRE COMERCIAL",
    description:
      "Registra la referencia de factura de los pedidos despachados.",
    statuses: ["Confirmado", "Facturado"],
    action: "Revisar facturación",
  },
};
export function workflowOrders(state: State, module: WorkflowModule): Order[] {
  return state.orders.filter((order) =>
    workflowDefinition[module].statuses.includes(order.status),
  );
}
