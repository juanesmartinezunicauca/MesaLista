import { IsBoolean, IsNotEmpty } from 'class-validator';

export class CambiarDisponibilidadDto {
  @IsNotEmpty({ message: 'El campo disponible es obligatorio.' })
  @IsBoolean({ message: 'La disponibilidad debe ser un valor booleano (true o false).' })
  disponible!: boolean;
}
