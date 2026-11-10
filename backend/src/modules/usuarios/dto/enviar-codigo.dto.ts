import { IsEmail, IsNotEmpty, Length } from 'class-validator';

export class EnviarCodigoDto {
  /**
   * Correo efímero de destino para recibir el código de registro.
   * Este correo no se almacena en la base de datos.
   */
  @IsEmail({}, { message: 'El correo electrónico de destino no tiene un formato válido' })
  @IsNotEmpty({ message: 'El correo electrónico de destino es obligatorio' })
  @Length(5, 100, { message: 'El correo electrónico debe tener entre 5 y 100 caracteres' })
  correoDestino!: string;
}

