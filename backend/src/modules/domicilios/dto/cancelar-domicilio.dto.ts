import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelarDomicilioDto {
  @IsOptional()
  @IsString({ message: 'El motivo de cancelación debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'El motivo no puede superar los 255 caracteres.' })
  motivo?: string;
}
