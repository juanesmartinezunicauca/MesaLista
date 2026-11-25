import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoPedido } from '@prisma/client';

export class UpdateDomicilioDto {
  @ApiPropertyOptional({
    description: 'Nombre del destinatario',
    example: 'Laura Gómez',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cliente_nombre?: string;

  @ApiPropertyOptional({
    description: 'Correo del cliente',
    example: 'laura@gmail.com',
  })
  @IsOptional()
  @IsEmail({}, { message: 'El correo del cliente no tiene un formato válido.' })
  @MaxLength(100)
  cliente_email?: string;

  @ApiPropertyOptional({
    description: 'Teléfono de contacto',
    example: '3124567890',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cliente_telefono?: string;

  @ApiPropertyOptional({
    description: 'Dirección de entrega',
    example: 'Carrera 6 # 4-22, Popayán',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  cliente_direccion?: string;

  @ApiPropertyOptional({
    description: 'Medio de pago acordado',
    example: 'Nequi',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  metodo_pago?: string;

  @ApiPropertyOptional({
    description: 'Notas adicionales',
    example: 'Entregar en portería',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacion?: string;

  @ApiPropertyOptional({
    description: 'Estado de la comanda de domicilio',
    enum: EstadoPedido,
  })
  @IsOptional()
  @IsEnum(EstadoPedido)
  estado?: EstadoPedido;
}
