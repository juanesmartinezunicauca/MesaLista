import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { EstadoUsuario } from './create-usuario.dto';

export class CambiarEstadoDto {
  @ApiProperty({
    description: 'Nuevo estado operativo del usuario',
    enum: EstadoUsuario,
    example: EstadoUsuario.activo,
  })
  @IsEnum(EstadoUsuario, {
    message: 'El estado debe ser: activo o inactivo',
  })
  @IsNotEmpty({ message: 'El estado es obligatorio' })
  estado!: EstadoUsuario;
}
