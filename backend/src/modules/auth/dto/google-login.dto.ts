import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * DTO para autenticación federada con Google OAuth 2.0 (Google Identity Services)
 */
export class GoogleLoginDto {
  @ApiPropertyOptional({
    description: 'ID Token (JWT) emitido y firmado criptográficamente por Google Identity Services',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFk... (Google JWT)',
  })
  @IsOptional()
  @IsString({ message: 'El idToken de Google debe ser una cadena de texto.' })
  idToken?: string;

  @ApiPropertyOptional({
    description: 'Alias alternativo de idToken para compatibilidad con librerías cliente',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFk...',
  })
  @IsOptional()
  @IsString({ message: 'El id_token de Google debe ser una cadena de texto.' })
  id_token?: string;

  @ApiPropertyOptional({
    description: 'Credencial JWT devuelta por el callback de Google One Tap o botón oficial',
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjFk...',
  })
  @IsOptional()
  @IsString({ message: 'La credencial de Google debe ser una cadena de texto.' })
  credential?: string;

  @ApiPropertyOptional({
    description: 'Código de invitación unívoco para enrolamiento delegado de colaboradores (ej. INV-821943)',
    example: 'INV-821943',
  })
  @IsOptional()
  @IsString({ message: 'El código de invitación debe ser una cadena de texto' })
  codigoInvitacion?: string;
}
