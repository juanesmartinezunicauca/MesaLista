const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const cajas = await prisma.caja.count();
  const facturas = await prisma.factura.count();
  const pagos = await prisma.pago.count();
  const pedidos = await prisma.pedido.count();
  const items = await prisma.itemPedido.count();
  const gastos = await prisma.gasto.count();
  const clientes = await prisma.cliente.count();
  const productos = await prisma.producto.count();
  const usuarios = await prisma.usuario.count();
  const mesas = await prisma.mesa.count();

  console.log('--- RECUENTO ACTUAL ---');
  console.log({
    cajas,
    facturas,
    pagos,
    pedidos,
    items,
    gastos,
    clientes,
    mesas,
    productos, // Catalogo (conservar)
    usuarios,  // Empleados/Admin (conservar)
  });
}

check()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
