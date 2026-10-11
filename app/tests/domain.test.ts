import { beforeEach, describe, expect, it } from "vitest";
import {
  addCustomer,
  addMaterial,
  addWarehouse,
  allocateOrder,
  available,
  balance,
  cancelOrder,
  confirmOrder,
  createOrder,
  invoiceOrder,
  parseKg,
  receive,
  reserved,
  suggestFefo,
  transact,
  writeOff,
} from "../src/domain";
import type { Actor, State } from "../src/domain";
const admin: Actor = { name: "Admin", role: "Administrador" };
const customer: Actor = { name: "Customer", role: "Customer" };
let state: State;
const receipt = (
  grams = 100000,
  lot = "L1",
  warehouseId = "w1",
  expiry = "2099-12-01",
) =>
  receive(
    state,
    admin,
    {
      materialId: "m1",
      warehouseId,
      lot,
      expiry,
      grams,
      document: "REC-1",
      reason: "Recepción",
    },
    crypto.randomUUID(),
  );
const order = (grams = 25000, number = "P1") =>
  createOrder(state, customer, {
    number,
    customerId: "c1",
    notes: "",
    lines: [{ materialId: "m1", grams }],
  });
const assign = (id: string, grams = 25000, stockId = state.stocks[0].id) => {
  const o = state.orders.find((o) => o.id === id)!;
  allocateOrder(state, admin, id, { [o.lines[0].id]: [{ stockId, grams }] });
};
beforeEach(() => {
  state = {
    version: 1,
    revision: 0,
    customers: [{ id: "c1", name: "Cliente", nit: "123", city: "Bogotá" }],
    materials: [
      { id: "m1", code: "MAT1", name: "Material", category: "Industrial" },
    ],
    warehouses: [
      { id: "w1", name: "Principal", city: "Bogotá" },
      { id: "w2", name: "Norte", city: "Cali" },
    ],
    stocks: [],
    orders: [],
    movements: [],
    audit: [],
  };
  receipt();
});
describe("cantidades exactas en kilos", () => {
  it("convierte sin errores de coma flotante", () => {
    expect(parseKg("0,001")).toBe(1);
    expect(parseKg("12.345")).toBe(12345);
    expect(parseKg("0.1") + parseKg("0.2")).toBe(300);
  });
  it.each(["0", "-1", "1.0000", "NaN", "", "1e3", "0.0001"])(
    "rechaza %s",
    (value) => expect(() => parseKg(value)).toThrow(),
  );
});
describe("flujo pedido, reserva, confirmación y factura", () => {
  it("crear pedido no cambia existencias", () => {
    order();
    expect(balance(state, state.stocks[0].id)).toBe(100000);
    expect(state.movements).toHaveLength(1);
  });
  it("asignar reserva sin descontar el saldo físico", () => {
    const id = order();
    assign(id);
    expect(balance(state, state.stocks[0].id)).toBe(100000);
    expect(reserved(state, state.stocks[0].id)).toBe(25000);
    expect(available(state, state.stocks[0].id)).toBe(75000);
  });
  it("confirmar descuenta una vez y libera la reserva", () => {
    const id = order();
    assign(id);
    confirmOrder(state, admin, id);
    expect(balance(state, state.stocks[0].id)).toBe(75000);
    expect(reserved(state, state.stocks[0].id)).toBe(0);
    expect(state.movements.at(-1)?.orderId).toBe(id);
    expect(state.movements.at(-1)?.balance).toBe(75000);
    expect(() => confirmOrder(state, admin, id)).toThrow();
    expect(state.movements).toHaveLength(2);
  });
  it("facturar no genera una segunda salida", () => {
    const id = order();
    assign(id);
    confirmOrder(state, admin, id);
    invoiceOrder(state, admin, id, "FV-1");
    expect(balance(state, state.stocks[0].id)).toBe(75000);
    expect(state.movements).toHaveLength(2);
    expect(() => invoiceOrder(state, admin, id, "FV-1")).toThrow();
  });
  it("rechaza facturar antes de confirmar", () => {
    const id = order();
    expect(() => invoiceOrder(state, admin, id, "FV-1")).toThrow();
  });
  it("no permite duplicar número de pedido", () => {
    order();
    expect(() => order(1000, "p1")).toThrow();
  });
  it("no permite duplicar referencia de factura", () => {
    const first = order();
    assign(first);
    confirmOrder(state, admin, first);
    invoiceOrder(state, admin, first, "FV-1");
    const second = order(25000, "P2");
    assign(second);
    confirmOrder(state, admin, second);
    expect(() => invoiceOrder(state, admin, second, "fv-1")).toThrow();
  });
  it("cancelar libera reservas y conserva el kardex", () => {
    const id = order();
    assign(id);
    cancelOrder(state, admin, id, "Solicitud del cliente");
    expect(available(state, state.stocks[0].id)).toBe(100000);
    expect(state.movements).toHaveLength(1);
  });
  it("no cancela un pedido que ya registró salida", () => {
    const id = order();
    assign(id);
    confirmOrder(state, admin, id);
    expect(() => cancelOrder(state, admin, id, "Cancelar")).toThrow();
  });
});
describe("lotes, bodegas y reservas", () => {
  it("impide sobreasignar a dos pedidos", () => {
    const first = order(80000);
    assign(first, 80000);
    const second = order(30000, "P2");
    expect(() => assign(second, 30000)).toThrow(/insuficientes/);
  });
  it("reemplaza una reserva propia sin acumularla", () => {
    const id = order();
    assign(id);
    assign(id);
    expect(reserved(state, state.stocks[0].id)).toBe(25000);
  });
  it("la suma asignada coincide con lo solicitado", () => {
    const id = order();
    expect(() => assign(id, 24000)).toThrow(/coincidir/);
  });
  it("revalida vencimiento al confirmar", () => {
    const id = order();
    assign(id);
    expect(() => confirmOrder(state, admin, id, "2100-01-01")).toThrow(
      /vencido/,
    );
    expect(state.movements).toHaveLength(1);
  });
  it("rechaza lotes vencidos al asignar", () => {
    const id = order();
    state.stocks[0].expiry = "2000-01-01";
    expect(() => assign(id)).toThrow(/vencido/);
  });
  it("sugiere FEFO y divide entre lotes", () => {
    receipt(30000, "L2", "w2", "2098-01-01");
    const id = order(50000);
    const o = state.orders.find((o) => o.id === id)!;
    const suggestion = suggestFefo(state, o);
    expect(suggestion[o.lines[0].id]).toEqual([
      { stockId: state.stocks[1].id, grams: 30000 },
      { stockId: state.stocks[0].id, grams: 20000 },
    ]);
    allocateOrder(state, admin, id, suggestion);
    confirmOrder(state, admin, id);
    expect(state.movements.filter((m) => m.orderId === id)).toHaveLength(2);
  });
  it("no mezcla existencias de dos bodegas", () => {
    receipt(50000, "L1", "w2");
    const id = order();
    assign(id);
    confirmOrder(state, admin, id);
    expect(balance(state, state.stocks[1].id)).toBe(50000);
  });
  it("rechaza lote de otro material", () => {
    state.materials.push({
      id: "m2",
      name: "Otro",
      code: "MAT2",
      category: "Industrial",
    });
    const id = order();
    state.orders.find((o) => o.id === id)!.lines[0].materialId = "m2";
    expect(() => assign(id)).toThrow(/no corresponde/);
  });
  it("agrega cantidades del mismo stock en líneas diferentes", () => {
    const id = createOrder(state, customer, {
      number: "MULTI",
      customerId: "c1",
      notes: "",
      lines: [
        { materialId: "m1", grams: 60000 },
        { materialId: "m1", grams: 60000 },
      ],
    });
    const o = state.orders.find((o) => o.id === id)!;
    expect(() =>
      allocateOrder(
        state,
        admin,
        id,
        Object.fromEntries(
          o.lines.map((l) => [
            l.id,
            [{ stockId: state.stocks[0].id, grams: 60000 }],
          ]),
        ),
      ),
    ).toThrow(/insuficientes/);
  });
});
describe("entradas, bajas y consistencia", () => {
  it("agrega entradas al lote existente", () => {
    receipt(1000);
    expect(state.stocks).toHaveLength(1);
    expect(balance(state, state.stocks[0].id)).toBe(101000);
  });
  it("no duplica una recepción reintentada", () => {
    const input = {
      materialId: "m1",
      warehouseId: "w1",
      lot: "L1",
      expiry: "2099-12-01",
      grams: 1000,
      document: "REC-2",
      reason: "Entrada",
    };
    receive(state, admin, input, "unique");
    expect(() => receive(state, admin, input, "unique")).toThrow();
    expect(balance(state, state.stocks[0].id)).toBe(101000);
  });
  it("rechaza cambiar el vencimiento del mismo lote", () =>
    expect(() => receipt(1000, "L1", "w2", "2099-11-01")).toThrow(
      /otra fecha/,
    ));
  it("una baja no consume kilos reservados", () => {
    const id = order(80000);
    assign(id, 80000);
    expect(() =>
      writeOff(state, admin, state.stocks[0].id, 25000, "B-1", "Daño", "off1"),
    ).toThrow(/reservados/);
    writeOff(state, admin, state.stocks[0].id, 20000, "B-1", "Daño", "off1");
    expect(balance(state, state.stocks[0].id)).toBe(80000);
    expect(state.movements.at(-1)?.reason).toBe("Daño");
  });
  it("bajas requieren motivo y documento", () => {
    expect(() =>
      writeOff(state, admin, state.stocks[0].id, 1000, "", "Daño", "off"),
    ).toThrow();
    expect(() =>
      writeOff(state, admin, state.stocks[0].id, 1000, "B-1", "", "off"),
    ).toThrow();
  });
  it("permite baja de un lote vencido con motivo", () => {
    state.stocks[0].expiry = "2000-01-01";
    writeOff(
      state,
      admin,
      state.stocks[0].id,
      1000,
      "B-1",
      "Vencimiento",
      "off",
    );
    expect(balance(state, state.stocks[0].id)).toBe(99000);
  });
  it("transacción fallida no modifica el estado original", () => {
    const before = structuredClone(state);
    expect(() =>
      transact(state, (d) => {
        d.orders.push({} as never);
        throw new Error("fallo");
      }),
    ).toThrow();
    expect(state).toEqual(before);
  });
  it("verifica roles en lógica y no solo en botones", () => {
    expect(() =>
      receive(
        state,
        customer,
        {
          materialId: "m1",
          warehouseId: "w1",
          lot: "x",
          expiry: "2099-01-01",
          grams: 1,
          document: "R",
          reason: "R",
        },
        "x",
      ),
    ).toThrow(/rol/);
    const id = order();
    expect(() => confirmOrder(state, customer, id)).toThrow(/rol/);
  });
  it("catálogos evitan duplicados", () => {
    expect(() =>
      addCustomer(state, admin, { name: "Otro", city: "Cali", nit: "123" }),
    ).toThrow();
    expect(() =>
      addMaterial(state, admin, { name: "Otro", code: "mat1", category: "X" }),
    ).toThrow();
    expect(() =>
      addWarehouse(state, admin, { name: "principal", city: "Cali" }),
    ).toThrow();
  });
});
