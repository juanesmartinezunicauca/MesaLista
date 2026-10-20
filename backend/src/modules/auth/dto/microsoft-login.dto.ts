import { IsOptional, IsString } from 'class-validator';

export class MicrosoftLoginDto {
  @IsOptional()
  @IsString({ message: 'El idToken de Microsoft debe ser una cadena de texto.' })
  idToken?: string;

  @IsOptional()
  @IsString({ message: 'El id_token de Microsoft debe ser una cadena de texto.' })
  id_token?: string;

  @IsOptional()
  @IsString({ message: 'El token de Microsoft debe ser una cadena de texto.' })
  token?: string;
}
