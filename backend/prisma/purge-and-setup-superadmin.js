/**
 * ============================================================================
 * PURGA DE BASE DE DATOS Y CONFIGURACIÓN DEL SUPER ADMINISTRADOR
 * ============================================================================
 * - Limpia todos los datos transaccionales y operativos (pedidos, pagos, facturas, caja).
 * - Elimina todos los usuarios de prueba / clientes previos para liberar identidades.
 * - Configura el usuario Super Administrador:
 *     Nombre:  Juan Esteban Martinez
 *     Usuario: admin
 *     Email:   jesmartinez@unicauca.edu.co
 *     Rol:     administrador
 *     Estado:  activo
 *     GoogleId: null (listo para vincular en el primer inicio con Google)
 * ============================================================================
 */
const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');

const prisma = new PrismaClient();

async function purgeAndSetupSuperAdmin() {
  console.log('🚀 Iniciando purga completa de datos operativos y usuarios...');

  const SUPER_ADMIN_EMAIL = 'jesmartinez@unicauca.edu.co';
  const SUPER_ADMIN_NOMBRE = 'Juan Esteban Martinez';
  const SUPER_ADMIN_USER = 'admin';

  await prisma.$transaction(async (tx) => {
    // 1. Desvincular pedidos de facturas
    await tx.pedido.updateMany({ data: { id_factura: null } });

    // 2. Eliminar detalles transaccionales
    const items = await tx.itemPedido.deleteMany({});
    console.log(`- Items de pedidos eliminados: ${items.count}`);

    const pagos = await tx.pago.deleteMany({});
    console.log(`- Pagos eliminados: ${pagos.count}`);

    const pedidos = await tx.pedido.deleteMany({});
    console.log(`- Pedidos eliminados: ${pedidos.count}`);

    const facturas = await tx.factura.deleteMany({});
    console.log(`- Facturas eliminadas: ${facturas.count}`);

    const gastos = await tx.gasto.deleteMany({});
    console.log(`- Gastos de caja eliminados: ${gastos.count}`);

    const cajas = await tx.caja.deleteMany({});
    console.log(`- Turnos de caja eliminados: ${cajas.count}`);

    const ajustes = await tx.ajusteInventario.deleteMany({});
    console.log(`- Ajustes de inventario eliminados: ${ajustes.count}`);

    // 3. Restablecer mesas
    await tx.mesa.updateMany({ data: { estado: 'libre' } });
    console.log('- Todas las mesas restablecidas a estado libre.');

    // 4. Si existen mesas, verificar que hayan al menos 6
    const totalMesas = await tx.mesa.count();
    if (totalMesas === 0) {
      for (let i = 1; i <= 6; i++) {
        await tx.mesa.create({ data: { numero: i, estado: 'libre' } });
      }
      console.log('- 6 mesas iniciales recreadas.');
    }

    // 5. Eliminar cualquier usuario previo que choque con el email o que no sea admin
    const prevUsersWithEmail = await tx.usuario.deleteMany({
      where: {
        OR: [
          { email: { equals: SUPER_ADMIN_EMAIL, mode: 'insensitive' } },
          { usuario: { not: SUPER_ADMIN_USER } },
        ],
      },
    });
    console.log(`- Usuarios secundarios y cuentas previas eliminadas: ${prevUsersWithEmail.count}`);

    // 6. Configurar o crear el Super Administrador
    const passwordHash = await argon2.hash('admin123', {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const adminExistente = await tx.usuario.findUnique({
      where: { usuario: SUPER_ADMIN_USER },
    });

    if (adminExistente) {
      await tx.usuario.update({
        where: { id_usuario: adminExistente.id_usuario },
        data: {
          nombre: SUPER_ADMIN_NOMBRE,
          email: SUPER_ADMIN_EMAIL,
          passwordHash,
          rol: 'administrador',
          estado: 'activo',
          googleId: null,
          codigoInvitacion: null,
          codigoInvitacionExpira: null,
        },
      });
      console.log(`✅ Super Administrador actualizado con éxito (ID #${adminExistente.id_usuario}):`);
    } else {
      const nuevoAdmin = await tx.usuario.create({
        data: {
          nombre: SUPER_ADMIN_NOMBRE,
          usuario: SUPER_ADMIN_USER,
          email: SUPER_ADMIN_EMAIL,
          passwordHash,
          rol: 'administrador',
          estado: 'activo',
          googleId: null,
          codigoInvitacion: null,
          codigoInvitacionExpira: null,
        },
      });
      console.log(`✅ Super Administrador creado con éxito (ID #${nuevoAdmin.id_usuario}):`);
    }
  });

  // 7. Reiniciar secuencias PostgreSQL
  const seqs = [
    'pago_id_pago_seq',
    'item_pedido_id_item_seq',
    'pedido_id_pedido_seq',
    'factura_id_venta_seq',
    'gasto_id_gasto_seq',
    'caja_id_caja_seq',
  ];

  for (const s of seqs) {
    try {
      await prisma.$executeRawUnsafe(`ALTER SEQUENCE IF EXISTS ${s} RESTART WITH 1;`);
    } catch {
      // Ignorar si la secuencia difiere en nombre
    }
  }

  // 8. Resumen final de la base de datos
  const totalUsuarios = await prisma.usuario.count();
  const superAdmin = await prisma.usuario.findFirst({
    where: { email: SUPER_ADMIN_EMAIL },
    select: { id_usuario: true, nombre: true, usuario: true, email: true, rol: true, googleId: true },
  });

  console.log('\n======================================================');
  console.log('🎉 PURGA Y CONFIGURACIÓN COMPLETADA CON ÉXITO');
  console.log('======================================================');
  console.log(`Total usuarios en BD: ${totalUsuarios}`);
  console.log('Super Administrador configurado:', superAdmin);
  console.log('======================================================\n');
}

purgeAndSetupSuperAdmin()
  .catch((err) => {
    console.error('❌ Error durante la purga y configuración:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
