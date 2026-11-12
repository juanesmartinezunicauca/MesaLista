import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CambiarRecepcionDomiciliosDto {
  @ApiProperty({
    description: 'Habilita o pausa la recepción pública de domicilios en el portal',
    example: true,
  })
  @IsBoolean({ message: 'El estado debe ser verdadero o falso.' })
  recibiendo!: boolean;

  @ApiPropertyOptional({
    description: 'Motivo del cierre o pausa del servicio',
    example: 'Cocina en máxima capacidad de producción',
    maxLength: 255,
  })
  @IsOptional()
  @IsString({ message: 'El motivo debe ser una cadena de texto.' })
  @MaxLength(255, { message: 'El motivo no puede superar los 255 caracteres.' })
  motivo?: string;
}
