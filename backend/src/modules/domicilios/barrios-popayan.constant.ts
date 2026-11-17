export interface ZonaTarifaPopayanBackend {
  id:
    | 'zona-cercana-local'
    | 'zona-centro-comuneros'
    | 'zona-sur-esmeralda'
    | 'zona-norte-bellohorizonte';
  nombre: string;
  tarifa: number;
}

export interface BarrioPopayanBackend {
  nombre: string;
  zonaId: ZonaTarifaPopayanBackend['id'];
}

export const ZONAS_DOMICILIO_POPAYAN_BACKEND: ZonaTarifaPopayanBackend[] = [
  { id: 'zona-cercana-local', nombre: 'Zona Cercana', tarifa: 3000 },
  { id: 'zona-centro-comuneros', nombre: 'Zona Centro', tarifa: 4000 },
  { id: 'zona-sur-esmeralda', nombre: 'Zona Sur', tarifa: 6000 },
  { id: 'zona-norte-bellohorizonte', nombre: 'Zona Norte', tarifa: 7000 },
];

const BARRIOS_POR_ZONA_POPAYAN: Record<ZonaTarifaPopayanBackend['id'], string[]> = {
  'zona-cercana-local': [
    'Campamento',
    'Campanario',
    'Canterbury',
    'Catay',
    'Champagnat',
    'Ciudad Jardín',
    'El Recuerdo',
    'Fucha',
    'Guayacanes',
    'La Estancia',
    'La Ladera',
    'La Lotería',
    'Loma Linda',
    'Palacé',
    'Pinares',
    'Portales del Norte',
    'Prados del Norte',
    'Quintas de José Miguel',
    'Rincón de la Estancia',
    'San Ignacio',
    'Santa Clara',
    'Villa del Norte',
    'Villa Paula',
  ],
  'zona-centro-comuneros': [
    'Américas',
    'Avelino Ull',
    'Belalcázar',
    'Berlín',
    'Bolívar',
    'Caldas',
    'Centro Histórico',
    'El Cadillal',
    'El Empedrado',
    'El Lago',
    'El Liceo',
    'El Pajonal',
    'El Plateado',
    'El Prado',
    'Favidi',
    'La Alameda',
    'La Floresta',
    'La Pamba',
    'Las Palmas',
    'Las Tres Cruces',
    'Los Álamos',
    'Los Braceros',
    'Los Comuneros',
    'Los Hoyos',
    'María Oriente',
    'Modelo',
    'Moscopán',
    'Pomona',
    'Pueblillo',
    'Puerta de Hierro',
    'San Camilo',
    'San Rafael',
    'Santa Inés',
    'Siglo XXI',
    'Suizo',
    'Tequendama',
    'Ucrania',
    'Valencia',
    'Vásquez Cobo',
    'Yanaconas',
  ],
  'zona-sur-esmeralda': [
    '2 de Abril',
    '31 de Marzo',
    'Alfonso López',
    'Calicanto',
    'Camilo Torres',
    'Chapinero',
    'Chirimía',
    'Colgate Palmolive',
    'El Bolívar Sur',
    'El Deportista',
    'El Limonar',
    'El Mirador',
    'Jorge Eliécer Gaitán',
    'José María Obando',
    'Junín',
    'La Esmeralda',
    'La Independencia',
    'La María Occidente',
    'La Paz Sur',
    'Las Ferias',
    'Las Vegas',
    'Libertadores',
    'Lomas de Granada',
    'Los Campos',
    'Los Sauces',
    'Madres Solteras',
    'Mis Ranchitos',
    'Nazareth',
    'Nuevo Hogar',
    'Nuevo País',
    'Panamericano',
    'Pandiguando',
    'Perpetuo Socorro',
    'Primero de Mayo',
    'Retiro Alto',
    'Retiro Bajo',
    'San José',
    'Santa Librada',
    'Sindical',
    'Solidaridad',
    'Tomás Cipriano de Mosquera',
    'Valparaíso',
  ],
  'zona-norte-bellohorizonte': [
    'Antonio Nariño',
    'Asturias',
    'Balcón del Norte',
    'Bella Vista',
    'Bello Horizonte',
    'Bosques del Norte',
    'Cajete',
    'Canales de Brujas',
    'Chamizal',
    'Cruz Roja',
    'Destechados del Norte',
    'El Bambú',
    'El Ortigal',
    'El Placer',
    'El Tablazo',
    'El Uvo',
    'Entre Pinos',
    'González',
    'Gran Bretaña',
    'Julumito',
    'La Aldea',
    'La Arboleda',
    'La Paz Norte',
    'La Primavera',
    'La Sombrilla',
    'La Violeta',
    'Las Guacas',
    'Lomas de San Rafael',
    'Los Ángeles',
    'Los Cámbulos',
    'Luna Blanca',
    'María Paz',
    'Matamoros',
    'Minuto de Dios',
    'Monte Rosales',
    'Morinda',
    'Nueva Alianza',
    'Nuevo Popayán',
    'Pino Pardo',
    'Pisojé',
    'Pisojé Alto',
    'Pisojé Bajo',
    'Pontevedra',
    'Puelenje',
    'Rincón de Comfacauca',
    'Rincón del Río',
    'San Eduardo',
    'San Fernando',
    'Santa Rosa',
    'Torremolinos',
    'Valle del Ortigal',
    'Vereda González',
    'Villa Claudia',
    'Villa del Viento',
    'Villa Melisa',
    'Villa Occidente',
    'Zuldemaida',
  ],
};

function normalizarTexto(valor?: string | null): string {
  return (valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export const BARRIOS_POPAYAN_BACKEND: BarrioPopayanBackend[] = (
  Object.entries(BARRIOS_POR_ZONA_POPAYAN) as [ZonaTarifaPopayanBackend['id'], string[]][]
)
  .flatMap(([zonaId, nombres]) => nombres.map((nombre) => ({ nombre, zonaId })))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

const BARRIOS_ORDENADOS_POR_LONGITUD = [...BARRIOS_POPAYAN_BACKEND].sort(
  (a, b) => b.nombre.length - a.nombre.length,
);

export function resolverZonaPorBarrioODireccion(
  zonaOBarrio?: string | null,
  direccion?: string | null,
): { barrio?: string; zona: ZonaTarifaPopayanBackend } | null {
  for (const fuente of [zonaOBarrio, direccion]) {
    const norm = normalizarTexto(fuente);
    if (!norm) continue;

    const exacto = BARRIOS_POPAYAN_BACKEND.find((b) => normalizarTexto(b.nombre) === norm);
    if (exacto) {
      const zona = ZONAS_DOMICILIO_POPAYAN_BACKEND.find((z) => z.id === exacto.zonaId)!;
      return { barrio: exacto.nombre, zona };
    }

    for (const b of BARRIOS_ORDENADOS_POR_LONGITUD) {
      const bNorm = normalizarTexto(b.nombre);
      if (bNorm.length >= 4 && norm.includes(bNorm)) {
        const zona = ZONAS_DOMICILIO_POPAYAN_BACKEND.find((z) => z.id === b.zonaId)!;
        return { barrio: b.nombre, zona };
      }
    }

    const zonaMatch = ZONAS_DOMICILIO_POPAYAN_BACKEND.find(
      (z) => z.id === norm || normalizarTexto(z.nombre) === norm || norm.includes(normalizarTexto(z.nombre)),
    );
    if (zonaMatch) {
      return { zona: zonaMatch };
    }
  }

  return null;
}
