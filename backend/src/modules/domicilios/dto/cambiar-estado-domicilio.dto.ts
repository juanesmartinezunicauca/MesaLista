import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CambiarEstadoDomicilioDto {
  @IsNotEmpty({ message: 'El estado o acción es requerido.' })
  @IsString({ message: 'El estado debe ser texto.' })
  estado!: string;

  @IsOptional()
  @IsString({ message: 'El motivo debe ser una cadena de texto.' })
  motivo?: string;
}
