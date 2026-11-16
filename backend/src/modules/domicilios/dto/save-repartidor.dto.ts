import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SaveRepartidorDto {
  @ApiPropertyOptional({
    description: 'Identificador del repartidor si se está actualizando',
    example: 'rep-1',
    maxLength: 64,
  })
  @IsOptional()
  @IsString({ message: 'El ID del repartidor debe ser una cadena de texto.' })
  @MaxLength(64, { message: 'El ID del repartidor no puede superar 64 caracteres.' })
  id?: string;

  @ApiProperty({
    description: 'Nombre completo del repartidor',
    example: 'Luis Repartidor',
    maxLength: 100,
  })
  @IsString({ message: 'El nombre del repartidor debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El nombre del repartidor es obligatorio.' })
  @MaxLength(100, { message: 'El nombre no puede superar 100 caracteres.' })
  nombre!: string;

  @ApiProperty({
    description: 'Teléfono de contacto del repartidor',
    example: '3001234567',
    maxLength: 30,
  })
  @IsString({ message: 'El teléfono debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El teléfono del repartidor es obligatorio.' })
  @MaxLength(30, { message: 'El teléfono no puede superar 30 caracteres.' })
  telefono!: string;

  @ApiPropertyOptional({
    description: 'Descripción o placa del vehículo',
    example: 'Moto ABC-123',
    maxLength: 80,
  })
  @IsOptional()
  @IsString({ message: 'El vehículo debe ser una cadena de texto.' })
  @MaxLength(80, { message: 'El vehículo no puede superar 80 caracteres.' })
  vehiculo?: string;

  @ApiPropertyOptional({
    description: 'Indica si el repartidor está activo para asignaciones',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'El estado activo debe ser verdadero o falso.' })
  activo?: boolean;
}

