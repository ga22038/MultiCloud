import { z } from "zod";
import * as domain from "./domain";
import type { Actor, State } from "./domain";

const text = z.string().trim().min(1).max(180);
const grams = z.number().int().positive().max(999999999999);
const revision = z.number().int().nonnegative();
const catalog = z.enum(["customers", "materials", "warehouses"]);
const correction = z
  .object({ grams: grams.or(z.literal(0)), document: text, reason: text })
  .strict();
const stock = correction.extend({ lot: text, warehouseId: text, expiry: text });
const allocation = z.object({ stockId: text, grams }).strict();
const command = <T extends string, A extends z.ZodTuple>(type: T, args: A) =>
  z.object({ type: z.literal(type), args }).strict();
export const commandSchema = z.discriminatedUnion("type", [
  command(
    "createOrder",
    z.tuple([
      z
        .object({
          number: text,
          customerId: text,
          notes: z.string().max(2000),
          lines: z
            .array(z.object({ materialId: text, grams }).strict())
            .min(1)
            .max(100),
        })
        .strict(),
    ]),
  ),
  command(
    "allocateOrder",
    z.tuple([text, z.record(text, z.array(allocation).max(100))]),
  ),
  command("confirmOrder", z.tuple([text])),
  command("invoiceOrder", z.tuple([text, text])),
  command("cancelOrder", z.tuple([text, text])),
  command(
    "receive",
    z.tuple([stock.extend({ materialId: text, grams }), text]),
  ),
  command("writeOff", z.tuple([text, grams, text, text, text])),
  command(
    "addCustomer",
    z.tuple([z.object({ name: text, nit: text, city: text }).strict()]),
  ),
  command(
    "addMaterial",
    z.tuple([z.object({ name: text, code: text, category: text }).strict()]),
  ),
  command(
    "addWarehouse",
    z.tuple([z.object({ name: text, city: text }).strict()]),
  ),
  command(
    "updateCatalog",
    z.tuple([
      catalog,
      text,
      z
        .object({ name: text, second: text, third: z.string().max(180) })
        .strict(),
    ]),
  ),
  command("deleteCatalog", z.tuple([catalog, text])),
  command("updateStock", z.tuple([text, stock, text, revision])),
  command("correctMovement", z.tuple([text, correction, text, revision])),
]);
export const operationSchema = z
  .object({ id: z.uuid(), expectedRevision: revision, command: commandSchema })
  .strict();
export type Command = z.infer<typeof commandSchema>;
export type Operation = z.infer<typeof operationSchema>;

/** Runs only after validation against the current database revision and trusted actor. */
export function applyCommand(
  state: State,
  actor: Actor,
  command: Command,
): State {
  return domain.transact(state, (draft) => {
    switch (command.type) {
      case "createOrder":
        return domain.createOrder(draft, actor, ...command.args);
      case "allocateOrder":
        return domain.allocateOrder(draft, actor, ...command.args);
      case "confirmOrder":
        return domain.confirmOrder(draft, actor, ...command.args);
      case "invoiceOrder":
        return domain.invoiceOrder(draft, actor, ...command.args);
      case "cancelOrder":
        return domain.cancelOrder(draft, actor, ...command.args);
      case "receive":
        return domain.receive(draft, actor, ...command.args);
      case "writeOff":
        return domain.writeOff(draft, actor, ...command.args);
      case "addCustomer":
        return domain.addCustomer(draft, actor, ...command.args);
      case "addMaterial":
        return domain.addMaterial(draft, actor, ...command.args);
      case "addWarehouse":
        return domain.addWarehouse(draft, actor, ...command.args);
      case "updateCatalog":
        return domain.updateCatalog(draft, actor, ...command.args);
      case "deleteCatalog":
        return domain.deleteCatalog(draft, actor, ...command.args);
      case "updateStock":
        return domain.updateStock(draft, actor, ...command.args);
      case "correctMovement":
        return domain.correctMovement(draft, actor, ...command.args);
    }
  });
}
