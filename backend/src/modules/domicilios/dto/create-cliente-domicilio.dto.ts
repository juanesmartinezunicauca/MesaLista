import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateClienteDomicilioDto {
  @ApiProperty({
    description: 'Nombre completo del cliente receptor',
    example: 'Laura Gómez',
    minLength: 2,
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'El nombre del cliente es requerido.' })
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @Length(2, 100, { message: 'El nombre debe tener entre 2 y 100 caracteres.' })
  nombre!: string;

  @ApiProperty({
    description: 'Teléfono o WhatsApp de contacto para el repartidor',
    example: '3124567890',
    minLength: 7,
    maxLength: 20,
  })
  @IsNotEmpty({ message: 'El teléfono del cliente es requerido.' })
  @IsString({ message: 'El teléfono debe ser una cadena de texto.' })
  @Length(7, 20, { message: 'El teléfono debe tener entre 7 y 20 caracteres.' })
  telefono!: string;

  @ApiProperty({
    description: 'Dirección completa y clara de entrega (incluyendo torre/apto)',
    example: 'Carrera 6 # 4-22 Barrio Centro, Apto 301',
    minLength: 5,
    maxLength: 255,
  })
  @IsNotEmpty({ message: 'La dirección de entrega es requerida.' })
  @IsString({ message: 'La dirección debe ser una cadena de texto.' })
  @Length(5, 255, { message: 'La dirección debe tener entre 5 y 255 caracteres.' })
  direccion!: string;

  @ApiPropertyOptional({
    description: 'Correo electrónico del cliente para envío de comprobante',
    example: 'laura.gomez@gmail.com',
  })
  @IsOptional()
  @IsString({ message: 'El correo electrónico debe ser una cadena de texto.' })
  email?: string;
}
