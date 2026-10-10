import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { EstadoPedido } from '@prisma/client';

export class UpdateDomicilioDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  cliente_nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cliente_email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  cliente_telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  cliente_direccion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  metodo_pago?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  observacion?: string;

  @IsOptional()
  @IsEnum(EstadoPedido)
  estado?: EstadoPedido;
}
