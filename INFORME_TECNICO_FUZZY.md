# 🔬 Informe Técnico: Pruebas Fuzzy, Resiliencia y Análisis Crítico de Límites del Sistema

**Proyecto:** MesaLista POS — Sistema de Gestión Gastronómica y Operación en Tiempo Real  
**Fecha de Actualización:** 25 de Noviembre de 2026  
**Entorno:** NestJS 12 · Angular 22 · Node.js v24 · Jest 30 · Vitest 4 · fast-check 4 · TypeScript 6 · Prisma ORM 6 · PostgreSQL 16  
**Resultado Suite Fuzzy:** **34/34 Pruebas Aprobadas (2 Test Suites: `fuzzy-testing.spec.ts` + `fast-check.fuzz.spec.ts`)**  
**Resultado Consolidado Backend:** **318/318 Pruebas Aprobadas (28 Test Suites · 71.24% cobertura de líneas)**  
**Evidencia HTML Regenerada:** [`reporte-pruebas-fuzzy.html`](./backend/reports/fuzzy-testing/reporte-pruebas-fuzzy.html)

---

## 1. La Crítica Clave: ¿Son "Idealistas" las Pruebas Unitarias con Mocks?

> [!IMPORTANT]
> **Diagnóstico Técnico Honesto:**  
> Las pruebas unitarias basadas exclusivamente en mocks son útiles para verificar reglas de negocio, pero un mock en memoria **no** reproduce por sí solo:
> - Desbordamientos de enteros de 32 bits (`int4` > 2,147,483,647) o columnas `Decimal(10,2)`.
> - Truncación/rechazo por longitud física de columnas `VARCHAR(n)`.
> - Fallos inesperados de red o pánicos del motor Prisma/PostgreSQL.
> - **Condiciones de carrera (TOCTOU)** cuando dos peticiones compiten en el mismo milisegundo por stock, consecutivos, caja o facturación.

Por esta razón, en MesaLista POS se combinaron **pruebas de mutación determinista** (`test/fuzzy-testing.spec.ts`), **fuzzing basado en propiedades con `fast-check`** (`test/fast-check.fuzz.spec.ts`) y **blindaje transaccional real a nivel de PostgreSQL y DTOs**.

---

## 2. Mock Fuzzing vs. Blindaje de Motor Real y Concurrencia

```mermaid
flowchart TD
    subgraph Nivel1["Nivel 1: Validación de Entrada y Property-Based Fuzzing"]
        M1["Payloads Hostiles / fast-check"] --> M2["Null-Byte Filter + ValidationPipe + DTO Bounds"]
        M2 -->|Rechazo Temprano| M3["HTTP 400 Bad Request"]
    end

    subgraph Nivel2["Nivel 2: Blindaje Transaccional PostgreSQL + PrismaExceptionFilter"]
        R1["Concurrencia Real & Fallos de Motor"] --> R2["PostgreSQL + Prisma Engine"]
        R2 -->|Entero > 2^31-1 / Decimal| F1["P2020 / P2033 → 400 Bad Request"]
        R2 -->|String > VarChar(n)| F2["P2000 → 400 Bad Request"]
        R2 -->|Conflicto transaccional| F3["P2028 / P2034 → 409 Conflict"]
        R2 -->|Pánico o fallo de conexión| F4["RustPanic / Unknown → 500 Sanitizado + Log"]
        R2 -->|2 solicitudes simultáneas| F5["pg_advisory_xact_lock + updateMany condicional"]
        F5 --> V2["🛡️ 0 Stock Negativo · 0 Doble Facturación · 0 Consecutivos Duplicados"]
    end
```

---

## 3. Vulnerabilidades y Puntos Ciegos Corregidos

### 🔴 1. Desbordamientos Numéricos y de Longitud (`P2020`, `P2033`, `P2000`)
- **Riesgo:** Enteros mayores a `int4`, precios/montos fuera de `Decimal(10,2)` o cadenas mayores a `VARCHAR(n)` causaban `500 Internal Server Error`.
- **Blindaje aplicado:**
  - Mapeo explícito en [`PrismaExceptionFilter`](./backend/src/common/filters/prisma-exception.filter.ts) de `P2000`, `P2006`, `P2011`, `P2020` y `P2033` a `400 Bad Request` semántico.
  - Cotas alineadas con el esquema PostgreSQL en todos los DTOs críticos: `@Max(99999999)` en precios/costos/montos, `@Max(1000)` en cantidades de ítems, `@ArrayMaxSize(100)` en pedidos/domicilios, `@ArrayMinSize(1)`/`@ArrayMaxSize(20)` en pagos, `@MaxLength(20)` en teléfonos, `@IsEmail()`/`@MaxLength(100)` en correos y truncado seguro de observaciones a 255 caracteres.

### 🔴 2. Condición de Carrera en Inventario (TOCTOU Race Condition)
- **Riesgo:** Leer el stock antes de la transacción y luego ejecutar `decrement` permitía dejar `cantidad_inventario` en valores negativos cuando llegaban dos pedidos simultáneos por la última unidad.
- **Blindaje aplicado:** En [`PedidosService`](./backend/src/modules/pedidos/pedidos.service.ts) y [`DomiciliosService`](./backend/src/modules/domicilios/domicilios.service.ts), la validación y el descuento ocurren dentro de `$transaction` usando actualización condicional atómica:
  ```typescript
  tx.producto.updateMany({
    where: { id_producto, cantidad_inventario: { gte: cantTotal } },
    data: { cantidad_inventario: { decrement: cantTotal } },
  });
  ```
  Si `count === 0`, se revierte toda la transacción con `400 Bad Request`.

### 🔴 3. Colisión de Consecutivos Diarios, Doble Facturación y Doble Turno de Caja
- **Riesgo:** Solicitudes concurrentes podían generar el mismo `numero_pedido`, facturar dos veces el mismo pedido/mesa o abrir dos turnos de caja activos simultáneamente.
- **Blindaje aplicado:**
  - Serialización transaccional con **`pg_advisory_xact_lock`** en pedidos/domicilios (`730101`, con rango acotado `gte: inicioDiaCol` y `lte: finDiaCol`), facturación (`730201`) y apertura/cierre de caja (`730301`).
  - En [`FacturacionService`](./backend/src/modules/facturacion/facturacion.service.ts), verificación atómica `tx.pedido.updateMany({ where: { id_pedido: { in }, id_factura: null, estado: 'enviada' } })` exigiendo `count === idsPedidos.length` (de lo contrario lanza `409 Conflict` y revierte la transacción).

### 🔴 4. Errores Desconocidos y Pánico del Motor Prisma
- **Riesgo:** Un `PrismaClientUnknownRequestError` por desconexión de base de datos podía clasificarse erróneamente como `400 Bad Request`, y un `PrismaClientRustPanicError` requería trazabilidad interna sin filtrar stack traces.
- **Blindaje aplicado:** [`PrismaExceptionFilter`](./backend/src/common/filters/prisma-exception.filter.ts) devuelve `400 Bad Request` únicamente para errores de codificación UTF-8 / byte nulo (`0x00`), y `500 Internal Server Error` sanitizado (con registro interno en `Logger.error`) para fallas de conexión o pánicos del motor.

---

## 4. Tabla Resumen de Mapeo Defensivo en `PrismaExceptionFilter`

| Excepción / Código Prisma | Origen PostgreSQL / Motor | Respuesta HTTP Blindada |
| :--- | :--- | :---: |
| `P2000` | *String length overflow* (`22001`) | `400 Bad Request` |
| `P2002` | *Unique constraint violation* (`23505`) | `409 Conflict` |
| `P2003` | *Foreign key constraint violation* (`23503`) | `400 Bad Request` |
| `P2006` / `P2011` | Formato inválido / restricción `NOT NULL` | `400 Bad Request` |
| `P2020` / `P2033` | *Integer / Decimal overflow* (`22003`) | `400 Bad Request` |
| `P2025` | Registro no encontrado | `404 Not Found` |
| `P2028` / `P2034` | Conflicto o timeout transaccional bajo concurrencia | `409 Conflict` |
| `PrismaClientUnknownRequestError` (UTF-8/`0x00`) | Secuencia de bytes inválida | `400 Bad Request` |
| `PrismaClientUnknownRequestError` (Otros) / `RustPanicError` | Fallo interno de conexión o motor | `500 Internal Server Error` (sanitizado + log) |

---

## 5. Resultados de Ejecución Verificados (25 de Noviembre de 2026)

### Batería Fuzzy Dedicada (`npm --prefix backend run test:fuzz`)
```text
PASS test/fast-check.fuzz.spec.ts
PASS test/fuzzy-testing.spec.ts
📦 report is created on: backend/reports/fuzzy-testing/reporte-pruebas-fuzzy.html

Test Suites: 2 passed, 2 total
Tests:       34 passed, 34 total
```

### Batería Completa del Backend (`npm --prefix backend run test:cov`)
```text
All files: 70.40% Stmts | 56.08% Branch | 69.97% Funcs | 71.24% Lines
Test Suites: 28 passed, 28 total
Tests:       318 passed, 318 total
```
