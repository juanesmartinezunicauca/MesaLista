import { IsOptional, IsString } from 'class-validator';

export class GoogleLoginDto {
  @IsOptional()
  @IsString({ message: 'El idToken de Google debe ser una cadena de texto.' })
  idToken?: string;

  @IsOptional()
  @IsString({ message: 'El id_token de Google debe ser una cadena de texto.' })
  id_token?: string;

  @IsOptional()
  @IsString({ message: 'La credencial de Google debe ser una cadena de texto.' })
  credential?: string;

  @IsOptional()
  @IsString({ message: 'El código de invitación debe ser una cadena de texto' })
  codigoInvitacion?: string;
}
