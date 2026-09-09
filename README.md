# MesaLista

Sistema POS y de gestión operativa para restaurantes y locales gastronómicos: control de mesas, pedidos, comandas a cocina, caja e inventario.

## Visión General
- **Cliente Piloto:** Restaurante nocturno Luigie's (Popayán, Cauca, Colombia)
- **Equipo de Desarrollo:** Trinity (Universidad del Cauca, 2026)
- **Enfoque Arquitectónico:** Local-First / Offline-First en red de área local (LAN).

## Estructura del Proyecto (Monorepo)
```text
MesaLista/
├── docker-compose.yml
├── README.md
├── .gitignore
├── backend/       # NestJS 10+, Prisma ORM, PostgreSQL
└── frontend/      # Angular 17+, SCSS, Standalone Components
```
