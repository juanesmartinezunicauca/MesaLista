const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reset() {
  console.log('Iniciando reinicio parcial de datos operativos...');

  await prisma.$transaction(async (tx) => {
    // 1. Borrar pagos
    const p = await tx.pago.deleteMany();
    console.log(`Pagos eliminados: ${p.count}`);

    // 2. Desvincular pedidos de facturas
    await tx.pedido.updateMany({ data: { id_factura: null } });

    // 3. Borrar items de pedidos
    const it = await tx.itemPedido.deleteMany();
    console.log(`Items de pedidos eliminados: ${it.count}`);

    // 4. Borrar pedidos (salón y domicilios)
    const ped = await tx.pedido.deleteMany();
    console.log(`Pedidos eliminados: ${ped.count}`);

    // 5. Borrar facturas
    const fac = await tx.factura.deleteMany();
    console.log(`Facturas eliminadas: ${fac.count}`);

    // 6. Borrar gastos de caja
    const g = await tx.gasto.deleteMany();
    console.log(`Gastos eliminados: ${g.count}`);

    // 7. Borrar turnos de caja
    const c = await tx.caja.deleteMany();
    console.log(`Turnos de caja eliminados: ${c.count}`);

    // 8. Liberar mesas
    await tx.mesa.updateMany({ data: { estado: 'libre' } });
    console.log('Mesas restablecidas a estado libre.');
  });

  // Reiniciar secuencias PostgreSQL si aplican
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
    } catch (err) {
      // Ignorar si la secuencia no existe con ese nombre exacto
    }
  }
  console.log('Secuencias autoincrementales reiniciadas exitosamente a 1.');

  console.log('Reinicio parcial completado con éxito. Catálogo de productos y usuarios preservados intactos.');
}

reset()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
