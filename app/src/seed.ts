import {
  allocateOrder,
  confirmOrder,
  createOrder,
  invoiceOrder,
  now,
  receive,
  today,
} from "./domain";
import type { Actor, State } from "./domain";

export function createDemo(): State {
  const actor: Actor = {
    name: "Equipo de demostración",
    role: "Administrador",
  };
  const state: State = {
    version: 1,
    revision: 0,
    customers: [
      {
        id: "c1",
        name: "Industrias del Valle S.A.S.",
        nit: "900.123.001-1",
        city: "Cali",
      },
      {
        id: "c2",
        name: "Química Andina S.A.S.",
        nit: "900.123.002-2",
        city: "Bogotá",
      },
      {
        id: "c3",
        name: "Alimentos del Norte S.A.S.",
        nit: "900.123.003-3",
        city: "Barranquilla",
      },
      {
        id: "c4",
        name: "Soluciones Industriales S.A.S.",
        nit: "900.123.004-4",
        city: "Medellín",
      },
    ],
    materials: [
      {
        id: "m1",
        code: "100284",
        name: "Ácido cítrico anhidro",
        category: "Alimentos",
      },
      {
        id: "m2",
        code: "100356",
        name: "Propilenglicol USP",
        category: "Cuidado personal",
      },
      {
        id: "m3",
        code: "100418",
        name: "Soda cáustica en escamas",
        category: "Industrial",
      },
      {
        id: "m4",
        code: "100592",
        name: "Glicerina vegetal USP",
        category: "Cuidado personal",
      },
      {
        id: "m5",
        code: "100681",
        name: "Benzoato de sodio",
        category: "Alimentos",
      },
    ],
    warehouses: [
      { id: "w1", name: "Bogotá · Principal", city: "Bogotá" },
      { id: "w2", name: "Cali · Distribución", city: "Cali" },
      { id: "w3", name: "Barranquilla · Norte", city: "Barranquilla" },
    ],
    stocks: [],
    orders: [],
    movements: [],
    audit: [],
  };
  function day(offset: number) {
    const d = new Date(`${today()}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  }
  const stockInputs: [string, string, string, number, number][] = [
    ["m1", "AC-260901", "w1", 120, 6250],
    ["m1", "AC-260815", "w2", 24, 3500],
    ["m2", "PG-260922", "w1", 270, 4800],
    ["m3", "SC-260910", "w2", 180, 8200],
    ["m4", "GL-260820", "w1", 16, 2250],
    ["m5", "BS-260918", "w3", 210, 3750],
    ["m2", "PG-260730", "w3", 5, 1200],
  ];
  stockInputs.forEach(
    ([materialId, lot, warehouseId, expiryOffset, amount], i) => {
      receive(
        state,
        actor,
        {
          materialId,
          lot,
          warehouseId,
          expiry: day(expiryOffset),
          grams: amount * 1000,
          document: `REC-2026-${101 + i}`,
          reason: "Recepción de demostración",
        },
        `seed:${i}`,
      );
      state.movements.at(-1)!.at = `${day(i - 6)}T15:30:00.000Z`;
    },
  );
  // Include an expired sample without falsifying its original receipt date.
  receive(
    state,
    actor,
    {
      materialId: "m5",
      lot: "BS-250610",
      warehouseId: "w1",
      expiry: day(1),
      grams: 250000,
      document: "REC-2025-082",
      reason: "Saldo de demostración",
    },
    "seed:expired",
  );
  state.stocks.at(-1)!.expiry = day(-8);
  state.movements.at(-1)!.at = `${day(-90)}T15:30:00.000Z`;
  const inputs: [string, string, string, number, number][] = [
    ["PED-2026-001", "c1", "m1", 1250, 0],
    ["PED-2026-002", "c2", "m2", 800, 1],
    ["PED-2026-003", "c3", "m5", 500, 2],
    ["PED-2026-004", "c4", "m3", 2200, 3],
    ["PED-2026-005", "c1", "m4", 600, 0],
    ["PED-2026-006", "c2", "m1", 750, 1],
  ];
  inputs.forEach(([number, customerId, materialId, amount, step], i) => {
    const id = createOrder(state, actor, {
      number,
      customerId,
      lines: [{ materialId, grams: amount * 1000 }],
      notes:
        i === 0
          ? "Entregar en horario de recepción. Validar lote antes de confirmar."
          : "",
    });
    const order = state.orders.find((o) => o.id === id)!;
    order.createdAt = `${day(-Math.floor(i / 2))}T14:${String(10 + i * 5).padStart(2, "0")}:00.000Z`;
    if (step) {
      const stock = state.stocks.find(
        (s) => s.materialId === materialId && s.expiry > today(),
      )!;
      allocateOrder(state, actor, id, {
        [order.lines[0].id]: [{ stockId: stock.id, grams: amount * 1000 }],
      });
      if (step >= 2) confirmOrder(state, actor, id);
      if (step === 3) invoiceOrder(state, actor, id, "FV-2026-1048");
    }
  });
  state.audit.unshift({
    id: crypto.randomUUID(),
    at: now(),
    actor: actor.name,
    role: actor.role,
    action: "Vista previa lista",
    detail: "Todos los clientes, pedidos y movimientos son ficticios.",
  });
  for (const kind of ["customers", "materials", "warehouses"] as const)
    state[kind].forEach((item, i) => {
      item.createdAt = `${day(-14 + i)}T15:00:00.000Z`;
    });
  state.stocks.forEach((s) => {
    s.createdAt = state.movements.find((m) => m.stockId === s.id)?.at;
  });
  return state;
}
