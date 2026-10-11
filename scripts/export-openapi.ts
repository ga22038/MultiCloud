import { writeFileSync } from "node:fs";
import { z } from "zod";
import { operationSchema } from "../app/src/commands";
const success = {
  description: "Respuesta JSON",
  content: { "application/json": { schema: { type: "object" } } },
};
const secured = {
  security: [{ sessionCookie: [] }],
  responses: {
    "200": success,
    "401": { description: "Sesión requerida" },
    "403": { description: "Acceso no permitido" },
    "503": { description: "Servicio no disponible" },
  },
};
const listParameters = [
  {
    name: "page",
    in: "query",
    schema: { type: "integer", minimum: 1, default: 1 },
  },
  {
    name: "pageSize",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
  },
  { name: "q", in: "query", schema: { type: "string", maxLength: 180 } },
];
const paths = {
  "/api/v1/session": {
    get: { ...secured, summary: "Consultar sesión" },
    post: {
      summary: "Iniciar sesión",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["username", "password"],
              properties: {
                username: { type: "string", maxLength: 100 },
                password: { type: "string", maxLength: 256 },
              },
            },
          },
        },
      },
      responses: {
        "200": success,
        "401": { description: "Credenciales incorrectas" },
        "403": { description: "Origen no permitido" },
        "429": { description: "Límite de intentos" },
      },
    },
    delete: {
      summary: "Cerrar sesión del navegador",
      responses: {
        "200": success,
        "403": { description: "Origen no permitido" },
      },
    },
  },
  "/api/v1/state": {
    get: { ...secured, summary: "Consultar estado operativo completo" },
  },
  "/api/v1/orders": {
    get: {
      ...secured,
      summary: "Listar pedidos",
      parameters: [
        ...listParameters,
        {
          name: "status",
          in: "query",
          schema: {
            type: "string",
            enum: ["Nuevo", "Asignado", "Confirmado", "Facturado", "Cancelado"],
          },
        },
      ],
    },
  },
  "/api/v1/inventory": {
    get: {
      ...secured,
      summary: "Consultar inventario",
      parameters: [
        ...listParameters,
        { name: "warehouseId", in: "query", schema: { type: "string" } },
      ],
    },
  },
  "/api/v1/movements": {
    get: {
      ...secured,
      summary: "Consultar movimientos",
      parameters: listParameters,
    },
  },
  "/api/v1/catalogs/{kind}": {
    get: {
      ...secured,
      summary: "Consultar catálogo",
      parameters: [
        ...listParameters,
        {
          name: "kind",
          in: "path",
          required: true,
          schema: {
            type: "string",
            enum: ["customers", "materials", "warehouses"],
          },
        },
      ],
    },
  },
  "/api/v1/operations": {
    post: {
      ...secured,
      summary: "Ejecutar operación idempotente",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/Operation" },
          },
        },
      },
      responses: {
        ...secured.responses,
        "400": { description: "Contrato inválido" },
        "409": { description: "Conflicto de revisión o identificador" },
        "422": { description: "Regla de negocio" },
      },
    },
  },
  "/api/v1/operations/{id}": {
    get: {
      ...secured,
      summary: "Comprobar operación del usuario",
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string", format: "uuid" },
        },
      ],
      responses: {
        ...secured.responses,
        "404": { description: "Comprobante no encontrado" },
      },
    },
  },
  "/api/health/live": {
    get: { summary: "Comprobar proceso", responses: { "200": success } },
  },
  "/api/health/ready": {
    get: {
      summary: "Comprobar disponibilidad para escritura",
      responses: {
        "200": success,
        "503": { description: "Sitio no disponible para escritura" },
      },
    },
  },
};
const document = {
  openapi: "3.1.0",
  info: {
    title: "Polaris UES API",
    version: "1.0.0",
    description:
      "API para personal interno. Las mutaciones requieren Origin autorizado. Cantidades en gramos.",
  },
  servers: [{ url: "http://127.0.0.1:3000", description: "Desarrollo local" }],
  paths,
  components: {
    securitySchemes: {
      sessionCookie: { type: "apiKey", in: "cookie", name: "polaris_session" },
    },
    schemas: { Operation: z.toJSONSchema(operationSchema) },
  },
};
writeFileSync("docs/openapi.json", JSON.stringify(document, null, 2) + "\n");
console.log("Contrato OpenAPI generado desde los esquemas de operaciones.");
