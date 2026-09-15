import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EstadoUsuario, RolUsuario } from './create-usuario.dto';

export class QueryUsuarioDto {
  @IsOptional()
  @IsEnum(RolUsuario, {
    message: 'El rol debe ser: administrador, cajero, mesero o cocina',
  })
  rol?: RolUsuario;

  @IsOptional()
  @IsEnum(EstadoUsuario, {
    message: 'El estado debe ser: activo o inactivo',
  })
  estado?: EstadoUsuario;

  @IsOptional()
  @IsString({ message: 'El término de búsqueda debe ser una cadena de texto' })
  buscar?: string;
}
