import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { EstadoMesa, EstadoPedido } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
    CambiarEstadoMesaDto,
    CreateMesaDto,
    QueryMesaDto,
    TransferirMesaDto,
    UpdateMesaDto,
} from './dto';

@Injectable()
export class MesasService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Crea una nueva mesa en el restaurante asegurando número único.
     */
    async crear(createMesaDto: CreateMesaDto) {
        const mesaExistente = await this.prisma.mesa.findUnique({
            where: { numero: createMesaDto.numero },
        });

        if (mesaExistente) {
            throw new ConflictException(
                `La mesa #${createMesaDto.numero} ya se encuentra registrada.`,
            );
        }

        return this.prisma.mesa.create({
            data: {
                numero: createMesaDto.numero,
                estado: createMesaDto.estado ?? EstadoMesa.libre,
            },
        });
    }

    /**
     * Lista todas las mesas registradas con filtros opcionales de estado.
     * Incluye los pedidos con estado 'enviada' para consultar el consumo activo de la mesa.
     */
    async obtenerTodas(filtros?: QueryMesaDto) {
        const where: { estado?: EstadoMesa } = {};

        if (filtros?.estado) {
            where.estado = filtros.estado;
        }

        return this.prisma.mesa.findMany({
            where,
            orderBy: { numero: 'asc' },
            include: {
                pedidos: {
                    where: { estado: EstadoPedido.enviada },
                    include: {
                        items: {
                            include: {
                                producto: true,
                            },
                        },
                    },
                },
            },
        });
    }

    /**
     * Obtiene el detalle de una mesa por su ID incluyendo pedidos activos y mesero a cargo.
     */
    async obtenerPorId(id: number) {
        const mesa = await this.prisma.mesa.findUnique({
            where: { id_mesa: id },
            include: {
                pedidos: {
                    where: { estado: EstadoPedido.enviada },
                    include: {
                        items: {
                            include: {
                                producto: true,
                            },
                        },
                        usuario: {
                            select: {
                                id_usuario: true,
                                nombre: true,
                            },
                        },
                    },
                },
            },
        });

        if (!mesa) {
            throw new NotFoundException(`La mesa con ID #${id} no fue encontrada.`);
        }

        return mesa;
    }

    /**
     * Actualiza el número y/o estado de una mesa existente.
     */
    async actualizar(id: number, updateDto: UpdateMesaDto) {
        await this.obtenerPorId(id);

        if (updateDto.numero !== undefined) {
            const mesaConMismoNumero = await this.prisma.mesa.findUnique({
                where: { numero: updateDto.numero },
            });

            if (mesaConMismoNumero && mesaConMismoNumero.id_mesa !== id) {
                throw new ConflictException(
                    `El número de mesa #${updateDto.numero} ya está asignado a otra mesa.`,
                );
            }
        }

        return this.prisma.mesa.update({
            where: { id_mesa: id },
            data: {
                ...(updateDto.numero !== undefined && { numero: updateDto.numero }),
                ...(updateDto.estado !== undefined && { estado: updateDto.estado }),
            },
        });
    }

    /**
     * Cambia el estado operativo de la mesa (libre u ocupada).
     */
    async cambiarEstado(id: number, cambiarEstadoDto: CambiarEstadoMesaDto) {
        await this.obtenerPorId(id);

        return this.prisma.mesa.update({
            where: { id_mesa: id },
            data: {
                estado: cambiarEstadoDto.estado,
            },
        });
    }

    /**
     * Transfiere las comandas activas de una mesa origen a una mesa destino.
     * Actualiza el estado de la mesa origen a libre y la mesa destino a ocupada de manera transaccional.
     */
    async transferirMesa(dto: TransferirMesaDto) {
        if (dto.id_origen === dto.id_destino) {
            throw new BadRequestException('La mesa origen y destino no pueden ser la misma.');
        }

        return this.prisma.$transaction(async (tx) => {
            const origen = await tx.mesa.findUnique({ where: { id_mesa: dto.id_origen } });
            const destino = await tx.mesa.findUnique({ where: { id_mesa: dto.id_destino } });

            if (!origen) {
                throw new NotFoundException(`La mesa origen con ID #${dto.id_origen} no fue encontrada.`);
            }
            if (!destino) {
                throw new NotFoundException(`La mesa destino con ID #${dto.id_destino} no fue encontrada.`);
            }

            const pedidosActivos = await tx.pedido.count({
                where: {
                    id_mesa: dto.id_origen,
                    estado: EstadoPedido.enviada,
                },
            });

            if (pedidosActivos > 0) {
                // Mover pedidos activos a la mesa destino
                await tx.pedido.updateMany({
                    where: {
                        id_mesa: dto.id_origen,
                        estado: EstadoPedido.enviada,
                    },
                    data: {
                        id_mesa: dto.id_destino,
                    },
                });
            }

            // Liberar mesa de origen
            await tx.mesa.update({
                where: { id_mesa: dto.id_origen },
                data: { estado: EstadoMesa.libre },
            });

            // Marcar mesa de destino como ocupada
            await tx.mesa.update({
                where: { id_mesa: dto.id_destino },
                data: { estado: EstadoMesa.ocupada },
            });

            return {
                mensaje: `Comandas transferidas de Mesa #${origen.numero} a Mesa #${destino.numero} exitosamente.`,
                id_origen: dto.id_origen,
                id_destino: dto.id_destino,
                pedidos_transferidos: pedidosActivos,
            };
        });
    }

    /**
     * Elimina una mesa físicamente sólo si no cuenta con pedidos ni facturación histórica.
     * Evita desajustes contables e inconsistencias referenciales.
     */
    async eliminar(id: number) {
        const mesa = await this.obtenerPorId(id);

        // Verificar si tiene comandas activas pendientes de cobro
        const comandasActivas = mesa.pedidos.length;
        if (comandasActivas > 0) {
            throw new BadRequestException(
                `No se puede eliminar la mesa #${mesa.numero} porque tiene comandas activas pendientes de cobro.`,
            );
        }

        // Verificar si tiene historial transaccional
        const [totalPedidos, totalFacturas] = await Promise.all([
            this.prisma.pedido.count({ where: { id_mesa: id } }),
            this.prisma.factura.count({ where: { id_mesa: id } }),
        ]);

        if (totalPedidos > 0 || totalFacturas > 0) {
            throw new ConflictException(
                `No se puede eliminar la mesa #${mesa.numero} porque tiene un historial operativo registrado (${totalPedidos} pedidos y ${totalFacturas} facturas).`,
            );
        }

        await this.prisma.mesa.delete({
            where: { id_mesa: id },
        });

        return {
            mensaje: `La mesa #${mesa.numero} ha sido eliminada exitosamente.`,
            id_mesa: id,
        };
    }
}
