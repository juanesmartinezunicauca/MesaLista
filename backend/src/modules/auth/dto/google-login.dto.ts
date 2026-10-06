import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsString({ message: 'El idToken de Google debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El token de autenticación de Google es obligatorio' })
  idToken!: string;
}
