import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, Length } from 'class-validator';

/**
 * DTO para solicitar el despacho o reenvío efímero de un código de invitación
 */
export class EnviarCodigoDto {
  /**
   * Correo efímero de destino para recibir el código de registro.
   * Este correo no se almacena en la base de datos.
   */
  @ApiProperty({
    description: 'Correo de destino efímero (Garantía de privacidad: NO se almacena en la base de datos)',
    example: 'colaborador@correo.com',
  })
  @IsEmail({}, { message: 'El correo electrónico de destino no tiene un formato válido' })
  @IsNotEmpty({ message: 'El correo electrónico de destino es obligatorio' })
  @Length(5, 100, { message: 'El correo electrónico debe tener entre 5 y 100 caracteres' })
  correoDestino!: string;
}
