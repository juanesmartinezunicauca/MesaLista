import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO para autenticación con credenciales locales de contingencia
 */
export class LoginDto {
  @ApiProperty({
    description: 'Nombre de usuario único registrado en el sistema',
    example: 'admin',
  })
  @IsString({ message: 'El usuario debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El usuario es obligatorio' })
  usuario!: string;

  @ApiProperty({
    description: 'Contraseña en texto plano para verificación contra hash Argon2id',
    example: 'admin123',
  })
  @IsString({ message: 'La contraseña debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria' })
  password!: string;
}
