import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CerrarCajaDto {
  @ApiProperty({
    description: 'Arqueo físico ciego: dinero en efectivo contado en caja física (COP)',
    example: 840000.0,
    minimum: 0,
  })
  @IsNotEmpty({ message: 'El valor físico contado es obligatorio.' })
  @Type(() => Number)
  @IsNumber({}, { message: 'El valor físico debe ser un número válido.' })
  @Min(0, { message: 'El valor físico no puede ser negativo.' })
  valor_final_fisico!: number;

  @ApiPropertyOptional({
    description: 'Total reportado en transferencias / medios electrónicos',
    example: 320000.0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El valor de transferencias debe ser un número válido.' })
  @Min(0, { message: 'El valor de transferencias no puede ser negativo.' })
  valor_transferencias_reportado?: number;

  @ApiPropertyOptional({
    description: 'Observaciones de cierre o justificación de descuadre',
    example: 'Cierre de turno nocturno sin novedades',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'La observación debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'La observación no puede superar los 255 caracteres.' })
  observacion?: string;
}
