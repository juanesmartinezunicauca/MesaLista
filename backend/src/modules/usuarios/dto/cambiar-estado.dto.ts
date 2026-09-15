import { IsEnum, IsNotEmpty } from 'class-validator';
import { EstadoUsuario } from './create-usuario.dto';

export class CambiarEstadoDto {
  @IsEnum(EstadoUsuario, {
    message: 'El estado debe ser: activo o inactivo',
  })
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  estado!: EstadoUsuario;
}
