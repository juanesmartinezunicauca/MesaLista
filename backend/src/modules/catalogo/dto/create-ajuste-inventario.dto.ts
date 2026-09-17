import { TipoAjuste } from '@prisma/client';
import { IsEnum, IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class CreateAjusteInventarioDto {
  @IsEnum(TipoAjuste, {
    message: `El tipo de ajuste debe ser uno de los siguientes valores: ${Object.values(TipoAjuste).join(', ')}.`,
  })
  tipo_ajuste!: TipoAjuste;

  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(0, { message: 'La cantidad no puede ser negativa.' })
  cantidad!: number;

  @IsString({ message: 'El motivo debe ser una cadena de texto.' })
  @IsNotEmpty({ message: 'El motivo del ajuste de inventario es obligatorio.' })
  @MaxLength(255, { message: 'El motivo no puede exceder 255 caracteres.' })
  motivo!: string;
}
