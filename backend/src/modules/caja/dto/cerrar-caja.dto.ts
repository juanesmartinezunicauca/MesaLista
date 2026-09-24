import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CerrarCajaDto {
  @IsNotEmpty({ message: 'El valor físico contado es obligatorio.' })
  @Type(() => Number)
  @IsNumber({}, { message: 'El valor físico debe ser un número válido.' })
  @Min(0, { message: 'El valor físico no puede ser negativo.' })
  valor_final_fisico!: number;

  @IsOptional()
  @IsString()
  observacion?: string;
}
