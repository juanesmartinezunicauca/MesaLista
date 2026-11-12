import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EstadoUsuario, RolUsuario } from './create-usuario.dto';

export class QueryUsuarioDto {
  @ApiPropertyOptional({
    description: 'Filtro por rol de usuario',
    enum: RolUsuario,
  })
  @IsOptional()
  @IsEnum(RolUsuario, {
    message: 'El rol debe ser: administrador, cajero, mesero o cocina',
  })
  rol?: RolUsuario;

  @ApiPropertyOptional({
    description: 'Filtro por estado',
    enum: EstadoUsuario,
  })
  @IsOptional()
  @IsEnum(EstadoUsuario, {
    message: 'El estado debe ser: activo o inactivo',
  })
  estado?: EstadoUsuario;

  @ApiPropertyOptional({
    description: 'Término de búsqueda por nombre, alias o correo',
    example: 'Carlos',
  })
  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto' })
  buscar?: string;
}
