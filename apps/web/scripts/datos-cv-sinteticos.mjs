/**
 * Datos de las hojas de vida sinteticas del banco de escaneos.
 *
 * Perfil deliberadamente colombiano y orientado a los cargos que contrata
 * Rosimar S.A.S. (administrativos y operativos), no a perfiles de tecnologia:
 * el banco anterior de imagenes eran CV bancarios en ingles, que no representan
 * lo que el sistema va a leer de verdad.
 */

export const HOJAS_DE_VIDA = [
  { id: 1, nombres: 'MARTHA LUCÍA', apellidos: 'CAICEDO BERMÚDEZ', cedula: '1098234567', telefono: '318 456 7821',
    correo: 'martha.caicedo@correo.com', ciudad: 'Pamplona, Norte de Santander', titular: 'Auxiliar Administrativa',
    resumen: 'Auxiliar administrativa con 6 años de experiencia en gestión documental, archivo y atención al usuario en entidades del sector servicios.',
    experiencia: [ { empresa: 'Servicios Integrales del Norte SAS', cargo: 'Auxiliar Administrativa', fechas: 'Marzo 2019 a Presente' },
                   { empresa: 'Comercializadora Andina Ltda.', cargo: 'Recepcionista', fechas: 'Enero 2017 a Febrero 2019' } ],
    educacion: [ { nivel: 'Técnico', titulo: 'Asistencia Administrativa', institucion: 'SENA Regional Norte de Santander', anio: '2016' } ],
    habilidades: ['Gestión Documental', 'Archivo', 'Atención al Cliente'], idiomas: [['Español','Nativo']],
    certificaciones: [{ nombre: 'Manejo de Excel Intermedio', institucion: 'SENA', anio: '2021' }],
    referencias: [{ nombre: 'Ing. Pedro Salazar', tipo: 'Laboral', telefono: '317 890 1234' }] },

  { id: 2, nombres: 'JHON FREDY', apellidos: 'OSPINA CARDONA', cedula: '1045678901', telefono: '312 334 5566',
    correo: 'jhon.ospina@gmail.com', ciudad: 'Medellín, Antioquia', titular: 'Operario de Producción',
    resumen: 'Operario de producción con 8 años en líneas de empaque y manejo de maquinaria industrial. Certificado en trabajo seguro en alturas.',
    experiencia: [ { empresa: 'Alimentos del Valle SAS', cargo: 'Operario de Producción', fechas: 'Junio 2018 a Presente' },
                   { empresa: 'Empaques Plásticos Nacionales', cargo: 'Auxiliar de Empaque', fechas: 'Marzo 2015 a Mayo 2018' } ],
    educacion: [ { nivel: 'Bachiller', titulo: 'Bachiller Académico', institucion: 'Colegio Marco Fidel Suárez', anio: '2013' } ],
    habilidades: ['Manejo de Montacargas', 'Control de Calidad', 'Trabajo en Equipo'], idiomas: [['Español','Nativo']],
    certificaciones: [{ nombre: 'Trabajo Seguro en Alturas', institucion: 'SENA', anio: '2022' }],
    referencias: [{ nombre: 'Luz Marina Cardona', tipo: 'Familiar', telefono: '310 445 6677' }] },

  { id: 3, nombres: 'DIANA CAROLINA', apellidos: 'MURILLO ESCOBAR', cedula: '52987654', telefono: '301 223 4455',
    correo: 'dcmurillo@hotmail.com', ciudad: 'Bogotá D.C.', titular: 'Coordinadora de Talento Humano',
    resumen: 'Psicóloga con especialización en gestión humana y 9 años liderando procesos de selección, nómina y bienestar laboral.',
    experiencia: [ { empresa: 'Consultores Empresariales SAS', cargo: 'Coordinadora de Talento Humano', fechas: 'Enero 2020 a Actualidad' },
                   { empresa: 'Grupo Logístico Colombiano', cargo: 'Analista de Selección', fechas: 'Febrero 2016 a Diciembre 2019' } ],
    educacion: [ { nivel: 'Posgrado', titulo: 'Especialización en Gerencia del Talento Humano', institucion: 'Universidad del Rosario', anio: '2019' },
                 { nivel: 'Universitario', titulo: 'Psicología', institucion: 'Universidad Nacional de Colombia', anio: '2015' } ],
    habilidades: ['Selección de Personal', 'Nómina', 'Liderazgo'], idiomas: [['Español','Nativo'],['Inglés','B2 Intermedio']],
    certificaciones: [{ nombre: 'Diplomado en Legislación Laboral', institucion: 'Universidad Javeriana', anio: '2021' }],
    referencias: [{ nombre: 'Dra. Patricia Gómez', tipo: 'Laboral', telefono: '311 234 5678' }] },

  { id: 4, nombres: 'WILSON ANDRÉS', apellidos: 'PEÑA ROJAS', cedula: '1090345678', telefono: '316 778 9900',
    correo: 'wilson.pena@servicios.co', ciudad: 'Cúcuta, Norte de Santander', titular: 'Conductor de Vehículo de Carga',
    resumen: 'Conductor con licencia C2 y 11 años transportando carga a nivel nacional, sin comparendos ni siniestros.',
    experiencia: [ { empresa: 'Transportes del Oriente SAS', cargo: 'Conductor', fechas: 'Agosto 2016 a Presente' },
                   { empresa: 'Distribuidora La Frontera', cargo: 'Conductor Repartidor', fechas: 'Enero 2013 a Julio 2016' } ],
    educacion: [ { nivel: 'Bachiller', titulo: 'Bachiller Técnico', institucion: 'Institución Educativa Municipal Cúcuta', anio: '2011' } ],
    habilidades: ['Conducción de Camión', 'Mecánica Básica', 'Puntualidad'], idiomas: [['Español','Nativo']],
    certificaciones: [{ nombre: 'Manejo Defensivo', institucion: 'SENA', anio: '2020' }],
    referencias: [{ nombre: 'Carlos Rojas', tipo: 'Familiar', telefono: '315 667 8899' }],
    licencia: 'C2' },

  { id: 5, nombres: 'SANDRA MILENA', apellidos: 'VARGAS QUINTERO', cedula: '43567890', telefono: '304 556 7788',
    correo: 'sandra.vargas@contable.co', ciudad: 'Bucaramanga, Santander', titular: 'Auxiliar Contable',
    resumen: 'Auxiliar contable con 7 años en causación, conciliaciones bancarias y facturación electrónica. Manejo de SIIGO y Helisa.',
    experiencia: [ { empresa: 'Auditoría y Consultoría Santander SAS', cargo: 'Auxiliar Contable', fechas: 'Abril 2018 a Presente' },
                   { empresa: 'Ferretería Industrial del Norte', cargo: 'Asistente de Facturación', fechas: 'Junio 2015 a Marzo 2018' } ],
    educacion: [ { nivel: 'Tecnólogo', titulo: 'Contabilidad y Finanzas', institucion: 'SENA Regional Santander', anio: '2015' } ],
    habilidades: ['SIIGO', 'Helisa', 'Facturación Electrónica', 'Conciliaciones'], idiomas: [['Español','Nativo']],
    certificaciones: [{ nombre: 'Actualización en NIIF para Pymes', institucion: 'Cámara de Comercio de Bucaramanga', anio: '2022' }],
    referencias: [{ nombre: 'Cont. Rubén Díaz', tipo: 'Laboral', telefono: '318 223 4455' }] },

  { id: 6, nombres: 'JOSÉ MANUEL', apellidos: 'TORRES ARIZA', cedula: '1032456789', telefono: '320 445 6677',
    correo: 'jose.torres@mantenimiento.co', ciudad: 'Barranquilla, Atlántico', titular: 'Técnico de Mantenimiento Electromecánico',
    resumen: 'Técnico electromecánico con 10 años en mantenimiento preventivo y correctivo de plantas de procesamiento, compresores y sistemas de refrigeración.',
    experiencia: [ { empresa: 'Frigoríficos del Caribe SAS', cargo: 'Técnico de Mantenimiento', fechas: 'Febrero 2017 a Presente' },
                   { empresa: 'Industrias Metalmecánicas Atlántico', cargo: 'Auxiliar Electromecánico', fechas: 'Marzo 2013 a Enero 2017' } ],
    educacion: [ { nivel: 'Técnico', titulo: 'Mantenimiento Electromecánico Industrial', institucion: 'SENA Regional Atlántico', anio: '2012' } ],
    habilidades: ['Soldadura', 'Refrigeración Industrial', 'Sistemas Hidráulicos'], idiomas: [['Español','Nativo']],
    certificaciones: [{ nombre: 'Trabajo Seguro en Alturas Nivel Avanzado', institucion: 'SENA', anio: '2023' },
                      { nombre: 'Manejo de Calderas', institucion: 'SENA', anio: '2021' }],
    referencias: [{ nombre: 'Ing. Daniel Osorio', tipo: 'Laboral', telefono: '317 445 6677' }] },

  { id: 7, nombres: 'LAURA VALENTINA', apellidos: 'GIRALDO MEJÍA', cedula: '1001234567', telefono: '313 889 0011',
    correo: 'laura.giraldo@correo.com', ciudad: 'Pereira, Risaralda', titular: 'Auxiliar de Servicios Generales',
    resumen: 'Recién egresada del SENA, sin experiencia laboral formal. Interesada en el área de servicios generales y aseo institucional.',
    experiencia: [], educacion: [ { nivel: 'Técnico', titulo: 'Servicios Generales y Aseo Institucional', institucion: 'SENA Regional Risaralda', anio: '2024' } ],
    habilidades: ['Puntualidad', 'Responsabilidad'], idiomas: [['Español','Nativo']],
    certificaciones: [], referencias: [{ nombre: 'Marta Mejía', tipo: 'Familiar', telefono: '312 445 5566' }],
    sinExperiencia: true },

  { id: 8, nombres: 'RICARDO ALFONSO', apellidos: 'BELTRÁN NIÑO', cedula: '79456123', telefono: '311 667 8899',
    correo: 'ricardo.beltran@seguridad.co', ciudad: 'Villavicencio, Meta', titular: 'Supervisor de Seguridad',
    resumen: 'Supervisor de seguridad con 14 años de experiencia coordinando equipos de vigilancia en instalaciones industriales y comerciales.',
    experiencia: [ { empresa: 'Seguridad Privada Los Llanos Ltda.', cargo: 'Supervisor de Seguridad', fechas: 'Mayo 2014 a Presente' },
                   { empresa: 'Vigilancia Nacional SAS', cargo: 'Vigilante', fechas: 'Enero 2010 a Abril 2014' } ],
    educacion: [ { nivel: 'Bachiller', titulo: 'Bachiller Académico', institucion: 'Colegio Departamental del Meta', anio: '2008' } ],
    habilidades: ['Manejo de Personal', 'Control de Acceso', 'Primeros Auxilios'], idiomas: [['Español','Nativo']],
    certificaciones: [{ nombre: 'Curso de Supervisor de Seguridad', institucion: 'Superintendencia de Vigilancia', anio: '2019' }],
    referencias: [{ nombre: 'Cap. Nelson Ruiz', tipo: 'Laboral', telefono: '310 223 4455' }],
    libreta: 'Primera clase' },

  { id: 9, nombres: 'ANGÉLICA MARÍA', apellidos: 'RESTREPO LONDOÑO', cedula: '1017890123', telefono: '319 334 5566',
    correo: 'angelica.restrepo@ventas.com', ciudad: 'Cali, Valle del Cauca', titular: 'Asesora Comercial',
    resumen: 'Asesora comercial con 5 años de experiencia en venta consultiva, manejo de cartera de clientes y cumplimiento de metas mensuales.',
    experiencia: [ { empresa: 'Distribuciones del Pacífico SAS', cargo: 'Asesora Comercial', fechas: 'Julio 2020 a Presente' },
                   { empresa: 'Almacenes El Progreso', cargo: 'Vendedora', fechas: 'Marzo 2019 a Junio 2020' } ],
    educacion: [ { nivel: 'Tecnólogo', titulo: 'Gestión de Mercados', institucion: 'SENA Regional Valle', anio: '2018' } ],
    habilidades: ['Negociación', 'Atención al Cliente', 'Manejo de CRM'], idiomas: [['Español','Nativo'],['Inglés','A2 Básico']],
    certificaciones: [{ nombre: 'Diplomado en Ventas Consultivas', institucion: 'Cámara de Comercio de Cali', anio: '2022' }],
    referencias: [{ nombre: 'Ing. Marcela Londoño', tipo: 'Familiar', telefono: '316 778 9900' }] },

  { id: 10, nombres: 'FERNANDO JOSÉ', apellidos: 'MEDINA SUÁREZ', cedula: '1085432109', telefono: '302 556 7788',
    correo: 'fernando.medina@logistica.co', ciudad: 'Cartagena, Bolívar', titular: 'Coordinador Logístico',
    resumen: 'Coordinador logístico con 8 años administrando bodegas, inventarios y despachos para operaciones de distribución nacional.',
    experiencia: [ { empresa: 'Operadores Logísticos del Caribe SAS', cargo: 'Coordinador Logístico', fechas: 'Septiembre 2018 a Presente' },
                   { empresa: 'Almacenes Generales de Depósito', cargo: 'Auxiliar de Bodega', fechas: 'Febrero 2015 a Agosto 2018' } ],
    educacion: [ { nivel: 'Tecnólogo', titulo: 'Gestión Logística', institucion: 'SENA Regional Bolívar', anio: '2014' } ],
    habilidades: ['Inventarios', 'Manejo de WMS', 'Coordinación de Equipos'], idiomas: [['Español','Nativo']],
    certificaciones: [{ nombre: 'Certificación en Manejo de Montacargas', institucion: 'SENA', anio: '2019' }],
    referencias: [{ nombre: 'Adm. Julio Suárez', tipo: 'Familiar', telefono: '314 889 0011' }] },
];

/** Amplia el banco a 40 registros variando datos sobre la base de los 10 anteriores. */
const NOMBRES_EXTRA = [
  ['CLAUDIA PATRICIA','HERRERA MOSQUERA','Recepcionista'], ['ÓSCAR IVÁN','ZAPATA MORENO','Almacenista'],
  ['YENNIFER','CASTRO PALACIOS','Auxiliar de Enfermería'], ['HÉCTOR FABIO','LOAIZA GUTIÉRREZ','Electricista'],
  ['NUBIA ESTHER','PACHECO ROMERO','Secretaria Ejecutiva'], ['JAIRO ANTONIO','CUERVO SÁNCHEZ','Mensajero'],
  ['LEIDY JOHANA','ARANGO VELÁSQUEZ','Auxiliar de Nómina'], ['GERMÁN DARÍO','PULIDO ACOSTA','Jefe de Bodega'],
  ['MÓNICA ANDREA','SALAZAR TRIANA','Analista de Compras'], ['ÁLVARO ENRIQUE','BARRIOS FONSECA','Soldador'],
  ['PAOLA ANDREA','CÉSPEDES RUEDA','Auxiliar de Archivo'], ['EDWIN ALEXANDER','GALVIS MANTILLA','Operario de Aseo'],
  ['GLORIA INÉS','TAMAYO BOTERO','Cajera'], ['NÉSTOR JULIÁN','ACEVEDO PARRA','Supervisor de Producción'],
  ['MARÍA FERNANDA','DUARTE VILLAMIZAR','Asistente de Gerencia'], ['CÉSAR AUGUSTO','MONSALVE OTÁLORA','Auxiliar de Mantenimiento'],
  ['LUZ DARY','ESCOBAR CIFUENTES','Coordinadora de Calidad'], ['IVÁN CAMILO','NAVARRO BUITRAGO','Auxiliar Logístico'],
  ['ROSA ELVIRA','MENDOZA CALDERÓN','Servicios Generales'], ['ANDRÉS MAURICIO','GUZMÁN LEÓN','Técnico en Refrigeración'],
  ['SOR ÁNGELA','PRIETO VALENCIA','Auxiliar Contable'], ['JUAN SEBASTIÁN','ROMERO CANO','Conductor'],
  ['MARTHA CECILIA','BOHÓRQUEZ RINCÓN','Jefe de Personal'], ['DIEGO ARMANDO','LOZANO SEPÚLVEDA','Vigilante'],
  ['ADRIANA LUCÍA','FORERO CHAPARRO','Analista de Cartera'], ['LUIS EDUARDO','CANTOR PIÑEROS','Operario de Planta'],
  ['SANDRA JOHANA','ALVARADO NÚÑEZ','Auxiliar de Compras'], ['JORGE ENRIQUE','MOLINA TOVAR','Tecnólogo Industrial'],
  ['CARMEN ALICIA','SIERRA OSORIO','Auxiliar Administrativa'], ['FABIÁN RICARDO','CORREA JIMÉNEZ','Coordinador SST'],
];

const CIUDADES = ['Pamplona, Norte de Santander','Bucaramanga, Santander','Bogotá D.C.','Medellín, Antioquia',
  'Cali, Valle del Cauca','Cúcuta, Norte de Santander','Barranquilla, Atlántico','Pereira, Risaralda',
  'Ibagué, Tolima','Villavicencio, Meta','Manizales, Caldas','Neiva, Huila','Popayán, Cauca','Tunja, Boyacá','Montería, Córdoba'];

for (let i = 0; i < NOMBRES_EXTRA.length; i++) {
  const [nombres, apellidos, cargo] = NOMBRES_EXTRA[i];
  const base = HOJAS_DE_VIDA[i % 10];
  const n = 11 + i;
  HOJAS_DE_VIDA.push({
    ...base,
    id: n,
    nombres, apellidos, titular: cargo,
    cedula: String(1000000000 + n * 7654321).slice(0, 10),
    telefono: `3${(10 + (n % 20))} ${200 + n * 3} ${1000 + n * 17}`,
    correo: `${nombres.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')}.${apellidos.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')}@correo.com`,
    ciudad: CIUDADES[n % CIUDADES.length],
    resumen: `${cargo} con ${3 + (n % 12)} años de experiencia en el sector de servicios. ${base.resumen.split('. ').slice(1).join('. ')}`,
    experiencia: base.experiencia.map((e, k) => ({ ...e, cargo: k === 0 ? cargo : e.cargo })),
  });
}
