import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class CreateClienteDomicilioDto {
  @IsNotEmpty({ message: 'El nombre del cliente es requerido.' })
  @IsString({ message: 'El nombre debe ser una cadena de texto.' })
  @Length(2, 100, { message: 'El nombre debe tener entre 2 y 100 caracteres.' })
  nombre!: string;

  @IsNotEmpty({ message: 'El teléfono del cliente es requerido.' })
  @IsString({ message: 'El teléfono debe ser una cadena de texto.' })
  @Length(7, 20, { message: 'El teléfono debe tener entre 7 y 20 caracteres.' })
  telefono!: string;

  @IsNotEmpty({ message: 'La dirección de entrega es requerida.' })
  @IsString({ message: 'La dirección debe ser una cadena de texto.' })
  @Length(5, 255, { message: 'La dirección debe tener entre 5 y 255 caracteres.' })
  direccion!: string;

  @IsOptional()
  @IsString({ message: 'El correo electrónico debe ser una cadena de texto.' })
  email?: string;
}
