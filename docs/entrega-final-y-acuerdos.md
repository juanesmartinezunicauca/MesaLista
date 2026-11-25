# 📄 Documento de Entrega Final y Acta de Acuerdos — MesaLista POS

> **Proyecto:** MesaLista POS — Sistema Integral de Gestión Restaurantera y Punto de Venta  
> **Cliente Piloto:** Luigie's Restaurante Nocturno — Representante: Luis Miguel (Popayán, Cauca, Colombia)  
> **Institución Académica:** Universidad del Cauca — Facultad de Ingeniería Electrónica y Telecomunicaciones (Programación II)  
> **Docente Director:** Ph.D. MSc. Siler Amador  
> **Autores / Equipo Responsable:** Equipo Trinity — Juan Esteban Martínez y Daniel Muñoz Piedrahita  
> **Versión Entregada:** `v1.1.0` (Release Final)  
> **Fecha de Entrega:** 25 de Noviembre de 2026

---

## 1. Propósito del Documento

Este documento formaliza la entrega final del software **MesaLista POS**, consolida el inventario de entregables técnicos y evidencias de verificación de calidad/seguridad, deja registro explícito de las condiciones de operación y limitaciones conocidas, y establece los acuerdos de traspaso, soporte y cierre entre el **Equipo Trinity**, el representante de **Luigie's Restaurante Nocturno** y el docente evaluador.

---

## 2. Ficha Técnica y Accesos de Producción

| Elemento | Detalle |
| :--- | :--- |
| **Aplicación Web (Frontend SPA)** | `https://mesa-lista-virid.vercel.app` (Portal cliente en `/cliente`, acceso operativo en `/login`) |
| **API REST (Backend Cloud)** | `https://mesalista-p0pf.onrender.com/api/v1` |
| **Documentación Interactiva API** | `https://mesalista-p0pf.onrender.com/api/docs` (OpenAPI 3.0 / Swagger UI) |
| **Base de Datos** | PostgreSQL 16 (Neon Serverless Cloud) administrada con Prisma ORM 6.19 |
| **Repositorio Fuente** | `https://github.com/juanesteban0907/MesaLista` |
| **Stack Final Verificado** | NestJS 12 · Angular 22 · TypeScript 6.0 · Prisma 6.19 · PostgreSQL 16 · Jest 30 · Vitest 4 |

---

## 3. Alcance Funcional Entregado

Se entrega el 100% de los módulos comprometidos en operación integrada:

1. **Autenticación Federada y Gestión de Usuarios (RBAC):**
   - Inicio de sesión exclusivo con **Google OAuth 2.0 (OIDC)** sin almacenamiento de contraseñas locales.
   - Alta de colaboradores (`administrador`, `cajero`, `mesero`, `cocina`) mediante códigos criptográficos efímeros `INV-XXXXXXXX` (vigencia 48 h, un solo uso, enviados vía Brevo REST API) sin persistir el correo personal de los empleados en BD (`email: null`, vinculación por `googleId`).
   - Conservación de `email` en cuentas `cliente` para trazabilidad de pedidos a domicilio.
   - Protección contra auto-desactivación administrativa y protección del último `administrador` activo.
2. **Salón, Mesas y Comandería (POS + KDS):**
   - Plano interactivo de mesas (`libre`/`ocupada`), toma de comandas con personalización de ingredientes y congelamiento histórico de precios.
   - Transferencia transaccional de mesas (validando mesa origen ocupada y destino libre) y bloqueo de liberación de mesas con pedidos sin facturar.
   - Pantalla de cocina (KDS) en tiempo real y control de estados de pedido.
3. **Domicilios y Portal Cliente (`/cliente` y `/cliente/carrito`):**
   - Carta pública con búsqueda y categorías (omitiendo el campo interno `costo`).
   - Acceso directo al portal cliente desde el logo de MesaLista en `/login`.
   - Soporte para que cualquier colaborador del restaurante pueda realizar pedidos personales desde `/cliente` sin mezclarlos con domicilios tomados en el POS (etiqueta interna `[PORTAL_CLIENTE]`).
   - Seguimiento por etapas (`Pendiente` → `En Preparación` → `En Reparto` → `Entregado`) y protección anti-IDOR para roles `cliente` y `cocina`.
4. **Facturación, Turnos de Caja y Contabilidad:**
   - Apertura de turno con fondo base, gastos menores por categoría/medio normalizado, pagos simples o mixtos (`Efectivo`, `Tarjeta`, `Transferencia`), propina voluntaria y arqueo físico ciego al cierre.
   - Anulación auditada de facturas con motivo obligatorio, restitución de balance en caja y liberación automática de mesa si no quedan pedidos activos.
   - Concurrencia blindada con `pg_advisory_xact_lock` y actualizaciones atómicas `updateMany` para prevenir stock negativo, consecutivos duplicados, doble facturación y doble apertura de caja.
5. **Catálogo, Inventario y Reportes BI:**
   - Gestión de productos, recetas de ingredientes removibles y bitácora de ajustes (`Entrada`, `Merma`, `Arqueo`).
   - Módulo de reportes por rangos de fecha (hasta 366 días): Dashboard ejecutivo con `balance_operativo`, ventas por canal/categoría, conciliación de caja, inventario valorizado, gastos, rentabilidad bruta y operación en cocina, con exportación a **CSV, Excel y PDF**.

---

## 4. Inventario de Entregables Verificables

| Entregable | Ubicación en Repositorio | Estado |
| :--- | :--- | :---: |
| **Guía General del Repositorio** | [`README.md`](../README.md) | ✅ Actualizado |
| **Arquitectura de Software (Arc42 v8.2)** | [`docs/arquitectura/arc42.md`](./arquitectura/arc42.md) | ✅ Actualizado |
| **Manual Técnico y de Usuario (IEEE 1063)** | [`docs/manual-tecnico-usuario.md`](./manual-tecnico-usuario.md) | ✅ Actualizado |
| **Guía de Despliegue Cloud (Neon/Render/Vercel)** | [`GUIA_DESPLIEGUE.md`](../GUIA_DESPLIEGUE.md) | ✅ Actualizado |
| **Matriz de Cumplimiento OWASP Top 10:2025** | [`OWASP_COMPLIANCE.md`](../OWASP_COMPLIANCE.md) | ✅ Actualizado |
| **Reporte HTML Pruebas OWASP** | [`backend/reports/owasp-compliance/reporte-owasp-top10.html`](../backend/reports/owasp-compliance/reporte-owasp-top10.html) | ✅ Regenerado (25/25) |
| **Informe Técnico de Pruebas Fuzzy** | [`INFORME_TECNICO_FUZZY.md`](../INFORME_TECNICO_FUZZY.md) | ✅ Actualizado |
| **Reporte HTML Pruebas Fuzzy** | [`backend/reports/fuzzy-testing/reporte-pruebas-fuzzy.html`](../backend/reports/fuzzy-testing/reporte-pruebas-fuzzy.html) | ✅ Regenerado (34/34) |
| **Informe DAST OWASP ZAP + CVSS v3.1** | [`reports/INFORME_CVSS_OWASP_ZAP.md`](../reports/INFORME_CVSS_OWASP_ZAP.md) | ✅ Incluido |
| **Reportes de Rendimiento (Artillery / Lighthouse)** | [`performance/reports/reporte-backend.html`](../performance/reports/reporte-backend.html) / [`reporte-frontend.html`](../performance/reports/reporte-frontend.html) | ✅ Incluido |
| **Despliegue Contenedorizado** | [`docker-compose.yml`](../docker-compose.yml) | ✅ Incluido |
| **Documento de Entrega y Acuerdos Finales** | [`docs/entrega-final-y-acuerdos.md`](./entrega-final-y-acuerdos.md) | ✅ Vigente |

---

## 5. Resumen Consolidado de Verificación y Calidad (25 de Noviembre de 2026)

| Verificación | Herramienta | Resultado |
| :--- | :--- | :---: |
| **Compilación y Tipado Backend** | `tsc --noEmit` (`tsconfig.json` y `tsconfig.build.json`) + `nest build` | ✅ 0 errores |
| **Linting Backend y Frontend** | `oxlint` (137 archivos backend + 89 archivos frontend) | ✅ 0 errores / 0 advertencias |
| **Pruebas Automatizadas Backend** | Jest 30 (unitarias, integración, BD, OWASP y fuzzing) | ✅ **28/28 suites · 318/318 tests** |
| **Cobertura de Código Backend** | `npm run test:cov` (Jest Coverage) | ✅ **70.40%** Stmts · **71.24%** Lines · **69.97%** Funcs |
| **Cumplimiento OWASP Top 10:2025** | `npm run test:owasp` | ✅ **25/25 pruebas (100%)** |
| **Pruebas Fuzzy / `fast-check`** | `npm run test:fuzz` | ✅ **34/34 pruebas (100%)** |
| **Compilación y Templates Frontend** | `ngc --noEmit` (`strictTemplates: true`) + `ng build` | ✅ 0 errores |
| **Pruebas Automatizadas Frontend** | Vitest 4 (`ng test --watch=false`) | ✅ **18/18 archivos · 114/114 tests** |
| **Total Pruebas Automatizadas** | Backend + Frontend | ✅ **46 suites · 432/432 tests (100%)** |

---

## 6. Limitaciones Conocidas y Acuerdos Técnicos de Operación

Las partes reconocen y aceptan las siguientes condiciones técnicas del entorno entregado:

1. **Infraestructura Free Tier (Costo \$0/mes):**
   - El backend en **Render Free** entra en suspensión automática tras periodos de inactividad, lo que puede provocar un tiempo de arranque inicial (*cold start*) de ~30 a 50 segundos en la primera solicitud del día. Si el cliente desea disponibilidad instantánea 24/7, podrá migrar en cualquier momento a un plan pago de Render o a un VPS/servidor local usando el archivo `docker-compose.yml` entregado.
   - **Neon Free** ofrece 0.5 GB de almacenamiento gratuito y respaldos automáticos según su plan vigente; se recomienda al administrador exportar respaldos periódicos de reportes contables.
2. **Impresión Térmica ESC/POS:**
   - La impresión directa a impresoras térmicas de 80 mm/58 mm (`PRINTER_INTERFACE`) opera cuando el backend se ejecuta en la misma red local (LAN) de la impresora o mediante túnel seguro hacia el punto físico; desde la nube pura de Render se utiliza impresión del navegador.
3. **Estado en Memoria del Módulo Domicilios (Evolución Futura):**
   - El directorio dinámico de repartidores y el interruptor manual de pausa de domicilios se mantienen en memoria del proceso del servidor para preservar compatibilidad sin migraciones destructivas en esta entrega. En caso de reinicio del contenedor en Render, el servicio inicia en estado activo y con la lista base de repartidores. Su persistencia en tablas dedicadas de PostgreSQL queda documentada como mejora de la fase 2.
4. **Privacidad y Manejo de Cuentas Google:**
   - Todo acceso al sistema depende de cuentas de Google válidas y del correcto mantenimiento de `GOOGLE_CLIENT_ID`, `CORS_ORIGIN`, `FRONTEND_URL` y `BREVO_API_KEY` en las variables de entorno del servidor.

---

## 7. Acuerdos Finales de Traspaso, Capacitación y Soporte

1. **Propiedad y Traspaso de Credenciales:**
   - El equipo de desarrollo hace entrega formal del código fuente (bajo licencia **MIT**), documentación y control administrativo de las cuentas/variables de despliegue (Google Cloud OAuth, Neon PostgreSQL, Render, Vercel y Brevo), comprometiéndose el cliente a rotar secretos (`JWT_SECRET`, `BREVO_API_KEY`, credenciales de BD) tras la recepción definitiva.
2. **Capacitación Operativa:**
   - Se acuerda realizar una sesión de inducción práctica por rol (`administrador`, `cajero`, `mesero` y `cocina`) apoyada en el [Manual Técnico y de Usuario](./manual-tecnico-usuario.md), cubriendo: apertura y cierre ciego de caja, enrolamiento con códigos `INV-XXXXXXXX`, comandería, cobro mixto/anulaciones y gestión de domicilios.
3. **Periodo de Garantía y Soporte Post-Entrega:**
   - Se acuerda un periodo de acompañamiento y corrección de defectos críticos (*bug fixes* sobre el alcance entregado) de **30 días calendario** a partir de la fecha de firma de esta acta, sin costo adicional.
   - Nuevas funcionalidades fuera del alcance actual (p. ej., facturación electrónica DIAN, integración con pasarelas de pago en línea, persistencia de repartidores con migración Prisma o aplicación móvil nativa) se tratarán como fases evolutivas independientes sujetas a nuevo acuerdo.
4. **Responsabilidad Operativa:**
   - El restaurante es responsable de mantener al menos una cuenta activa de `administrador`, ejecutar diariamente la apertura y cierre de caja, y validar periódicamente el cuadre físico contra los reportes exportados.

---

## 8. Acta de Entrega y Aceptación Final

En constancia de lo anterior, las partes declaran haber revisado el sistema en funcionamiento, las evidencias de pruebas y la documentación técnica asociada, recibiendo a satisfacción los entregables descritos en el presente documento.

**Lugar y Fecha:** Popayán, Cauca — ____ de ______________ de 2026

| Rol | Nombre Completo | Firma |
| :--- | :--- | :--- |
| **Representante Cliente (Luigie's Restaurante Nocturno)** | Luis Miguel | _______________________ |
| **Autor — Equipo Trinity** | Juan Esteban Martínez | _______________________ |
| **Autor — Equipo Trinity** | Daniel Muñoz Piedrahita | _______________________ |
| **Docente Director — Proyecto II (Universidad del Cauca)** | Ph.D. MSc. Siler Amador | _______________________ |
