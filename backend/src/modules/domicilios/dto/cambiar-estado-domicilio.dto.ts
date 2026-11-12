import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CambiarEstadoDomicilioDto {
  @ApiProperty({
    description: 'Etapa operativa del pedido (En Preparación, En Reparto, Entregado, Cancelado)',
    example: 'En Reparto',
  })
  @IsNotEmpty({ message: 'El estado o acción es requerido.' })
  @IsString({ message: 'El estado debe ser texto.' })
  estado!: string;

  @ApiPropertyOptional({
    description: 'Justificación ante cambio o cancelación',
    example: 'Despachado con repartidor asignado',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'El motivo debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'El motivo no puede superar los 255 caracteres.' })
  motivo?: string;

  @ApiPropertyOptional({
    description: 'Nombre del repartidor que transporta el pedido',
    example: 'Mateo Repartidor',
    maxLength: 100,
  })
  @IsOptional()
  @IsString({ message: 'El nombre del domiciliario debe ser una cadena de texto.' })
  @MaxLength(100, { message: 'El nombre del repartidor no puede superar los 100 caracteres.' })
  repartidor_nombre?: string;

  @ApiPropertyOptional({
    description: 'Teléfono o contacto directo del repartidor',
    example: '3159876543',
    maxLength: 30,
  })
  @IsOptional()
  @IsString({ message: 'El teléfono del domiciliario debe ser una cadena de texto.' })
  @MaxLength(30, { message: 'El teléfono del repartidor no puede superar los 30 caracteres.' })
  repartidor_telefono?: string;
}
