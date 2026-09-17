import { IsInt, IsPositive } from 'class-validator';

export class TransferirMesaDto {
  @IsInt({ message: 'El ID de la mesa origen debe ser un número entero.' })
  @IsPositive({ message: 'El ID de la mesa origen debe ser mayor a 0.' })
  id_origen!: number;

  @IsInt({ message: 'El ID de la mesa destino debe ser un número entero.' })
  @IsPositive({ message: 'El ID de la mesa destino debe ser mayor a 0.' })
  id_destino!: number;
}
