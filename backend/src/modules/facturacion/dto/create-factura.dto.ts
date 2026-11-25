import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PagoItemDto {
  @ApiProperty({
    description: 'Medio de pago utilizado (Efectivo, Tarjeta, Transferencia/Nequi)',
    example: 'Efectivo',
  })
  @IsNotEmpty({ message: 'El medio de pago es obligatorio.' })
  @IsString()
  @MaxLength(50, { message: 'El medio de pago no puede superar los 50 caracteres.' })
  medio_pago!: string;

  @ApiProperty({
    description: 'Monto pagado con este medio',
    example: 45000.0,
    minimum: 0,
  })
  @IsNotEmpty({ message: 'El monto del pago es obligatorio.' })
  @Type(() => Number)
  @IsNumber({}, { message: 'El monto debe ser un número válido.' })
  @Min(0, { message: 'El monto no puede ser negativo.' })
  @Max(99999999, { message: 'El monto del pago excede el máximo permitido.' })
  monto!: number;
}

export class CreateFacturaDto {
  @ApiPropertyOptional({
    description: 'ID de la mesa a facturar (para cobro de salón)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  id_mesa?: number;

  @ApiPropertyOptional({
    description: 'Nombre del cliente para el comprobante',
    example: 'Carlos Restrepo',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'El nombre del cliente no puede superar los 100 caracteres.' })
  cliente_nombre?: string;

  @ApiPropertyOptional({
    description: 'Correo electrónico del cliente',
    example: 'carlos.restrepo@gmail.com',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'El correo del cliente no puede superar los 100 caracteres.' })
  cliente_email?: string;

  @ApiPropertyOptional({
    description: 'ID del pedido a cobrar (para domicilio o comanda individual)',
    example: 14,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  id_pedido?: number;

  @ApiPropertyOptional({
    description: 'Propina voluntaria sugerida (COP)',
    example: 4500.0,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(99999999, { message: 'La propina excede el máximo permitido.' })
  propina?: number;

  @ApiPropertyOptional({
    description: 'Notas u observaciones contables',
    example: 'Pago con billete de $50.000, cambio entregado',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La observación no puede superar los 255 caracteres.' })
  observacion?: string;

  @ApiPropertyOptional({
    description: 'Si se debe cerrar la comanda y liberar la mesa automáticamente',
    example: true,
    default: true,
  })
  @IsOptional()
  cerrar_pedido?: boolean;

  @ApiProperty({
    description: 'Desglose de pagos realizados (soporta pagos mixtos efectivo + tarjeta)',
    type: [PagoItemDto],
  })
  @IsNotEmpty({ message: 'Debe especificar al menos un pago.' })
  @IsArray()
  @ArrayMinSize(1, { message: 'Debe especificar al menos un pago.' })
  @ArrayMaxSize(20, { message: 'No se admiten más de 20 pagos en una sola factura.' })
  @ValidateNested({ each: true })
  @Type(() => PagoItemDto)
  pagos!: PagoItemDto[];
}
