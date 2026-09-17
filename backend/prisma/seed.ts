import { PrismaClient, RolUsuario, EstadoUsuario, EstadoMesa } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de MesaLista...');

  // 1. Crear usuario Administrador inicial si no existe
  const adminExistente = await prisma.usuario.findUnique({
    where: { usuario: 'admin' },
  });

  if (!adminExistente) {
    const passwordHash = await argon2.hash('admin123', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await prisma.usuario.create({
      data: {
        nombre: 'Administrador del Sistema',
        usuario: 'admin',
        passwordHash,
        rol: RolUsuario.administrador,
        estado: EstadoUsuario.activo,
      },
    });
    console.log('Usuario administrador creado: admin / admin123');
  }

  // 2. Crear mesas iniciales si no existen
  const totalMesas = await prisma.mesa.count();
  if (totalMesas === 0) {
    for (let i = 1; i <= 6; i++) {
      await prisma.mesa.create({
        data: {
          numero: i,
          estado: EstadoMesa.libre,
        },
      });
    }
    console.log('6 mesas iniciales registradas en base de datos.');
  }

  // 3. Crear productos iniciales si no existen
  const totalProductos = await prisma.producto.count();
  if (totalProductos === 0) {
    await prisma.producto.createMany({
      data: [
        {
          nombre: 'Hamburguesa Clásica',
          categoria: 'Hamburguesas',
          precio_venta: 18000,
          costo: 7500,
          cantidad_inventario: 30,
          disponible: true,
          ingredientes_removibles: 'Cebolla, Tomate, Salsa Especial, Pepinillos',
        },
        {
          nombre: 'Hamburguesa Doble Queso',
          categoria: 'Hamburguesas',
          precio_venta: 25000,
          costo: 11000,
          cantidad_inventario: 25,
          disponible: true,
          ingredientes_removibles: 'Tocineta, Pepinillos, Cebolla Crispy',
        },
        {
          nombre: 'Salchipapa Luigie Especial',
          categoria: 'Comidas Rápidas',
          precio_venta: 22000,
          costo: 9000,
          cantidad_inventario: 20,
          disponible: true,
          ingredientes_removibles: 'Queso Costeño, Salsa Tártara, Ripios',
        },
        {
          nombre: 'Papas Rústicas',
          categoria: 'Entradas',
          precio_venta: 9000,
          costo: 3500,
          cantidad_inventario: 40,
          disponible: true,
          ingredientes_removibles: 'Sal de Ajo, Paprika',
        },
        {
          nombre: 'Cerveza Club Colombia Dorada',
          categoria: 'Bebidas',
          precio_venta: 7000,
          costo: 3800,
          cantidad_inventario: 50,
          disponible: true,
        },
        {
          nombre: 'Gaseosa Postobón 400ml',
          categoria: 'Bebidas',
          precio_venta: 4500,
          costo: 2200,
          cantidad_inventario: 60,
          disponible: true,
        },
      ],
    });
    console.log('Catálogo base de productos registrado en base de datos.');
  }

  console.log('Seed completado exitosamente.');
}

main()
  .catch((e) => {
    console.error('Error durante seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
