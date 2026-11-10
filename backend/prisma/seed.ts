import { PrismaClient, RolUsuario, EstadoUsuario, EstadoMesa } from '@prisma/client';
import * as argon2 from 'argon2';
import process from 'node:process';

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
        nombre: 'Juan Esteban Martinez',
        usuario: 'admin',
        email: 'jesmartinez@unicauca.edu.co',
        passwordHash,
        rol: RolUsuario.administrador,
        estado: EstadoUsuario.activo,
      },
    });
    console.log('Usuario administrador creado: admin / jesmartinez@unicauca.edu.co');
  } else {
    await prisma.usuario.update({
      where: { usuario: 'admin' },
      data: {
        nombre: 'Juan Esteban Martinez',
        email: 'jesmartinez@unicauca.edu.co',
        rol: RolUsuario.administrador,
        estado: EstadoUsuario.activo,
      },
    });
    console.log('Usuario administrador sincronizado: admin / jesmartinez@unicauca.edu.co');
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

  // 3. Catálogo de productos: Se deja completamente limpio (0 productos) para registro manual
  console.log('Mesas y usuario administrador configurados. Catálogo listo y limpio.');
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
