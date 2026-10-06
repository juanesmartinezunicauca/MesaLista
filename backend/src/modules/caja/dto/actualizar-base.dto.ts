import { IsNumber, Min } from 'class-validator';

export class ActualizarBaseDto {
  @IsNumber({}, { message: 'El valor base debe ser un número válido' })
  @Min(0, { message: 'El valor base no puede ser negativo' })
  valor_inicial!: number;
}
