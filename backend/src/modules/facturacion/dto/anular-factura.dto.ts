import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AnularFacturaDto {
  @IsNotEmpty({ message: 'El motivo de anulación es obligatorio.' })
  @IsString({ message: 'El motivo de anulación debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'El motivo de anulación no puede superar los 255 caracteres.' })
  motivo!: string;
}
