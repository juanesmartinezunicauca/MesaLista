import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CambiarRecepcionDomiciliosDto {
  @IsBoolean({ message: 'El estado debe ser verdadero o falso.' })
  recibiendo!: boolean;

  @IsOptional()
  @IsString({ message: 'El motivo debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'El motivo no puede superar los 255 caracteres.' })
  motivo?: string;
}
