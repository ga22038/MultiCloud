import { describe, expect, it } from "vitest";
import { createDemo } from "../src/seed";
import {
  addMaterial,
  allocateOrder,
  balance,
  correctMovement,
  createOrder,
  deleteCatalog,
  kg,
  newestFirst,
  parseKg,
  receive,
  registrationDate,
  reserved,
  transact,
  updateCatalog,
  updateStock,
  writeOff,
} from "../src/domain";
import { dateLabel } from "../src/dates";
import type { Actor } from "../src/domain";
const actor: Actor = { name: "Administrador de prueba", role: "Administrador" };
function fixture() {
  let state = createDemo();
  state = transact(state, (d) =>
    receive(
      d,
      actor,
      {
        materialId: "m1",
        warehouseId: "w1",
        lot: "TEST-EDIT",
        expiry: "2099-12-01",
        grams: 10_000_000,
        document: "REC-TEST",
        reason: "Prueba",
      },
      "receipt-test",
    ),
  );
  return {
    state,
    stock: state.stocks.at(-1)!,
    original: state.movements.at(-1)!,
  };
}
describe("formatos y registro", () => {
  it("usa separadores de miles y dos decimales sin perder gramos", () => {
    expect(kg(10_000_000)).toBe("10,000.00");
    expect(kg(1)).toBe("0.001");
    expect(kg(0)).toBe("0.00");
    expect(parseKg("10,000.00")).toBe(10_000_000);
    expect(parseKg("1,234,567.125")).toBe(1_234_567_125);
    expect(parseKg(kg(12345))).toBe(12345);
    expect(() => parseKg("1,23,456.00")).toThrow();
  });
  it("muestra fecha y hora de El Salvador cuando se solicita", () => {
    expect(dateLabel("2026-10-09T03:00:00Z", true)).toBe("08/10/2026, 21:00");
    expect(dateLabel("2026-10-09")).toBe("09/10/2026");
    expect(dateLabel("")).toBe("Sin registro");
  });
  it("ordena por fecha descendente sin mutar y recupera registros antiguos", () => {
    const { state, stock, original } = fixture();
    delete stock.createdAt;
    expect(registrationDate(state, "stocks", stock.id)).toBe(original.at);
    const source = [{ at: "2026-01-01" }, { at: "2026-02-01" }];
    expect(newestFirst(source, (r) => r.at)[0]).toBe(source[1]);
    expect(source[0].at).toBe("2026-01-01");
  });
});
describe("corrección de inventario", () => {
  it("agrega solo la diferencia y conserva saldos y snapshots originales", () => {
    const { state, stock, original } = fixture();
    const before = structuredClone(original);
    const next = transact(state, (d) =>
      updateStock(
        d,
        actor,
        stock.id,
        {
          lot: "TEST-CORREGIDO",
          warehouseId: "w2",
          expiry: "2099-11-01",
          grams: 9_500_000,
          document: "AJ-1",
          reason: "Conteo físico",
        },
        "adjust-test",
        state.revision,
      ),
    );
    expect(balance(next, stock.id)).toBe(9_500_000);
    expect(next.movements.at(-1)?.grams).toBe(-500_000);
    expect(next.movements.find((m) => m.id === original.id)).toEqual(before);
    expect(next.stocks.at(-1)?.createdAt).toBe(stock.createdAt);
    expect(next.audit[0].detail).toContain("Conteo físico");
  });
  it("no reduce existencias por debajo de las reservas ni renombra lotes usados", () => {
    const { state, stock } = fixture();
    const id = createOrder(state, actor, {
      number: "EDIT-ORDER",
      customerId: "c1",
      lines: [{ materialId: "m1", grams: 2_000_000 }],
      notes: "",
    });
    const line = state.orders.find((o) => o.id === id)!.lines[0];
    allocateOrder(state, actor, id, {
      [line.id]: [{ stockId: stock.id, grams: line.grams }],
    });
    const input = {
      lot: stock.lot,
      warehouseId: stock.warehouseId,
      expiry: stock.expiry,
      grams: reserved(state, stock.id) - 1,
      document: "AJ",
      reason: "Conteo",
    };
    expect(() =>
      transact(state, (d) =>
        updateStock(d, actor, stock.id, input, "bad", state.revision),
      ),
    ).toThrow(/reservados/);
    expect(() =>
      transact(state, (d) =>
        updateStock(
          d,
          actor,
          stock.id,
          { ...input, grams: 10_000_000, lot: "OTRO" },
          "bad2",
          state.revision,
        ),
      ),
    ).toThrow(/pedidos/);
    expect(balance(state, stock.id)).toBe(10_000_000);
  });
  it("rechaza formularios obsoletos, duplicados, lotes duplicados y permisos ajenos", () => {
    const { state, stock } = fixture();
    const input = {
      lot: stock.lot,
      warehouseId: stock.warehouseId,
      expiry: stock.expiry,
      grams: 9_000_000,
      document: "AJ",
      reason: "Error",
    };
    expect(() => updateStock(state, actor, stock.id, input, "bad", -1)).toThrow(
      /cambiaron/,
    );
    expect(() =>
      updateStock(
        state,
        { name: "Customer", role: "Customer" },
        stock.id,
        input,
        "bad",
        state.revision,
      ),
    ).toThrow(/rol/);
    const next = transact(state, (d) =>
      updateStock(d, actor, stock.id, input, "adjust-test", state.revision),
    );
    expect(() =>
      updateStock(next, actor, stock.id, input, "adjust-test", next.revision),
    ).toThrow(/registrada/);
    const existing = state.stocks.find((s) => s.materialId === "m1")!;
    expect(() =>
      transact(state, (d) =>
        updateStock(
          d,
          actor,
          stock.id,
          {
            ...input,
            lot: existing.lot,
            warehouseId: existing.warehouseId,
            expiry: existing.expiry,
          },
          "bad",
          state.revision,
        ),
      ),
    ).toThrow(/existe/);
  });
});
describe("corrección y anulación de movimientos", () => {
  it("corrige una entrada sin borrar su historial e impide repetirla", () => {
    const { state, stock, original } = fixture();
    const next = transact(state, (d) =>
      correctMovement(
        d,
        actor,
        original.id,
        { grams: 8_000_000, document: "REC-C", reason: "Error de digitación" },
        "correction-test",
        state.revision,
      ),
    );
    expect(balance(next, stock.id)).toBe(8_000_000);
    expect(next.movements.at(-1)?.correctsId).toBe(original.id);
    expect(next.movements.at(-1)?.grams).toBe(-2_000_000);
    expect(next.movements.find((m) => m.id === original.id)).toEqual(original);
    expect(() =>
      correctMovement(
        next,
        actor,
        original.id,
        { grams: 0, document: "AN", reason: "Error" },
        "again",
        next.revision,
      ),
    ).toThrow(/ya fue/);
  });
  it("anula una baja devolviendo kilos y una entrada retirándolos", () => {
    const { state, stock } = fixture();
    writeOff(state, actor, stock.id, 500_000, "BAJA", "Error", "writeoff-test");
    const id = state.movements.at(-1)!.id;
    const next = transact(state, (d) =>
      correctMovement(
        d,
        actor,
        id,
        { grams: 0, document: "AN", reason: "Anulación" },
        "reverse-test",
        state.revision,
      ),
    );
    expect(balance(next, stock.id)).toBe(10_000_000);
    expect(next.movements.at(-1)?.type).toBe("Reversión");
    const fresh = fixture();
    correctMovement(
      fresh.state,
      actor,
      fresh.original.id,
      { grams: 0, document: "AN", reason: "Registro duplicado" },
      "reverse-entry",
      fresh.state.revision,
    );
    expect(balance(fresh.state, fresh.stock.id)).toBe(0);
  });
  it("registra correcciones de documento aunque no cambie la cantidad", () => {
    const { state, original } = fixture();
    correctMovement(
      state,
      actor,
      original.id,
      { grams: 10_000_000, document: "REC-C", reason: "Documento incorrecto" },
      "doc-test",
      state.revision,
    );
    expect(state.movements.at(-1)?.grams).toBe(0);
    expect(state.movements.at(-1)?.document).toBe("REC-C");
  });
  it("rechaza anulación si ya se consumió la entrada y protege salidas por pedido", () => {
    const { state, stock, original } = fixture();
    writeOff(state, actor, stock.id, 500_000, "BAJA", "Daño", "writeoff-test");
    expect(() =>
      transact(state, (d) =>
        correctMovement(
          d,
          actor,
          original.id,
          { grams: 0, document: "AN", reason: "Error" },
          "bad",
          state.revision,
        ),
      ),
    ).toThrow(/negativas/);
    const outgoing = state.movements.find(
      (m) => m.type === "Salida por pedido",
    )!;
    expect(() =>
      correctMovement(
        state,
        actor,
        outgoing.id,
        { grams: 0, document: "AN", reason: "Error" },
        "bad2",
        state.revision,
      ),
    ).toThrow(/manuales/);
  });
});
describe("CRUD del catálogo", () => {
  it("crea, edita sin cambiar fecha y elimina registros sin relaciones", () => {
    const { state } = fixture();
    addMaterial(state, actor, {
      code: "EDIT-M",
      name: "Material nuevo",
      category: "Prueba",
    });
    const material = state.materials.at(-1)!;
    expect(material.createdAt).toBeTruthy();
    updateCatalog(state, actor, "materials", material.id, {
      name: "Material corregido",
      second: "EDIT-M2",
      third: "Industrial",
    });
    expect(material.name).toBe("Material corregido");
    expect(material.createdAt).toBeTruthy();
    deleteCatalog(state, actor, "materials", material.id);
    expect(state.materials.some((m) => m.id === material.id)).toBe(false);
  });
  it("bloquea códigos duplicados y eliminación con inventario o pedidos relacionados", () => {
    const { state } = fixture();
    expect(() =>
      updateCatalog(state, actor, "materials", "m1", {
        name: "Duplicado",
        second: "100356",
        third: "Prueba",
      }),
    ).toThrow(/existe/);
    expect(() => deleteCatalog(state, actor, "materials", "m1")).toThrow(
      /historial/,
    );
    expect(() => deleteCatalog(state, actor, "warehouses", "w1")).toThrow(
      /historial/,
    );
    expect(() => deleteCatalog(state, actor, "customers", "c1")).toThrow(
      /historial/,
    );
  });
});
