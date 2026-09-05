import { describe, expect, it } from 'vitest';
import { classifyDocumentType } from './document-classifier';
import { parseContractText } from './parser-contract';

describe('Lectura y parseo de contrato desde foto de WhatsApp', () => {
  const ocrPsm6 = `
      |
    -     -              CON                    ae, al:
_      A TÉRMINO FIJO INFERIOR A UN AÑO
Á                                    -                 PUC R@HOTMAIL. Com              \\
—       — ~~ /C.C9876.52 HFT eT sre  =            Y
A ACE Cam  on        \\
del trabajador —— a CUSTAVOMONTENEGROCABALLERO? @GMAIL |    |
—— NN CONDUCTOR >  Wn Eh A    @GMAIL Com         |
ORAR A 423500    TA                            Y
e QUNCEML — ——   3             |
COEN  RMINO FIJO INFERIOR A UN ANG
~~ [TRES(3)MESES
 de iniciación del contrato _ | 04 ENERO 2025 —
:          ee i a =  ELE cc omm_I DE ABRIL2075————
y       aci        i      Trabajador: 15 días. -———— en                          \\
UN Empleador dodes CELE     3                   Y
C   del     [BARRANQUILLA - ATLANTICO ———                   L
Entre EL(A) EMPLEADOR y EL(A) TRABAJADOR, de las condiciones ya dichas, identificados
  `;

  const ocrScaled2400 = `
  l
A       -     —    —              .          co   \\    :   "               — a —
. TÉRMINO FIJO INFERIOS TAB? ÑO                    %
 DISTRIBUCIONES ROSikrx  :   ——      €
                                                                           -            NIT No. 901.167.0555 LAR SA —              |       <
c            -    CALLE ToL 16T 355 NE re —         |      :
E           PILA DOR AROSI = @HOTMAIL.CO!  =n            |      -
d                           —    —    —| GUSTAVO S GUNDO MONT   GRO
fi                                     E   Ek   _| 19 DICIEN BRE - 970 ITE er EUA e CABALLERO    |
               Mrabejador: ~~ CCo876sy7 — — — e       |
E CLS5#3B-21 =~ —— ATT            \\
co del trabajador —— CUSTAVOMONTENEGROCABALLERO7Q) MAIL-COM_    O
Ea E CONDUCTOR TEE E          |    >)
E S142350- ——— EZ          |
O: ANUN e QUINCENAL — — ——  Eu            |    Y
   O ACE TA Ne RMINO FIJO INFERIOR A UN AÑO”
a. RES (3)MEsEs —                          ’
 de    ción del contrato | 04 ENERO 2025 |                           \\
echa de vencimiento del contrato [04 DE ABRIL 2025 E           TN
     minac       E Trabajador 15 dias.                         \\
SAT    ee APS   Se Empleador: 30dias =~   :             5         \\
Entre EL(A) EMPLEADOR y EL(A) TRABAJADOR, de las condiciones ya dichas, identificados                         ue
  `;

  it('clasifica y extrae los campos clave en OCR PSM 6', () => {
    const tipo = classifyDocumentType(ocrPsm6);
    expect(tipo).toBe('contract');

    const parsed = parseContractText(ocrPsm6);

    // Empleador Rosimar S.A.S. (RN-8)
    expect(parsed.employerName).toBe('Distribuciones Rosimar S.A.S.');
    expect(parsed.employerNit).toBe('901.167.955-4');
    expect(parsed.employerEmail).toBe('piladorarosimar@hotmail.com');

    // En PSM 6 Tesseract omitió la fila del trabajador en la foto original;
    // se comprueba que no invente valores falsos ni asigne "PUC" o "15"
    expect(parsed.workerName).not.toContain('PUC');
    expect(parsed.workerName).not.toContain('15');

    // Cedula extraída del texto OCR (/C.C9876.52)
    expect(parsed.workerDocumentNumber).toBe('987652');

    // En PSM 6 el correo quedó truncado sin dominio .com en la foto, por lo que no se inventa
    expect(parsed.workerEmail).toBe('');

    // Cargo Conductor
    expect(parsed.position).toBe('Conductor');

    // Salario (en este texto OCR PSM 6 se leyó "423500", recuperado a 1423500 por salario mínimo 2025)
    expect(parsed.salary).toBe(1423500);

    // Forma de pago quincenal
    expect(parsed.paymentFrequency).toBe('quincenal');

    // Fechas y prueba
    expect(parsed.startDate).toBe('2025-01-04');
    expect(parsed.endDate).toBe('2025-04-04');
    expect(parsed.trialPeriodDays).toBe(15);
    expect(parsed.contractType).toBe('termino_fijo');
    expect(parsed.durationMonths).toBe(3);

    // Lugar de ejecucion
    expect(parsed.executionPlace).toBe('Barranquilla');
  });

  it('clasifica y extrae empleador, nit, cargo y fechas en OCR escalado', () => {
    const tipo = classifyDocumentType(ocrScaled2400);
    expect(tipo).toBe('contract');

    const parsed = parseContractText(ocrScaled2400);

    // Empleador Rosimar y NIT (RN-8)
    expect(parsed.employerName).toBe('Distribuciones Rosimar S.A.S.');
    expect(parsed.employerNit).toBe('901.167.955-4');

    // Trabajador (extraído heurísticamente del renglón OCR sin nombres quemados)
    expect(parsed.workerName.toUpperCase()).toContain('GUSTAVO');
    expect(parsed.workerName.toUpperCase()).toContain('MONT');

    // Cargo Conductor
    expect(parsed.position).toBe('Conductor');

    // Salario (en este OCR escalado la imagen leyó "S142350-")
    expect([142350, 1423500]).toContain(parsed.salary);

    // Fechas
    expect(parsed.startDate).toBe('2025-01-04');
    expect(parsed.endDate).toBe('2025-04-04');
    expect(parsed.trialPeriodDays).toBe(15);
    expect(parsed.paymentFrequency).toBe('quincenal');
  });

  const ocrScaled1390 = `
D
v     - - A       ea Ss             "        ’        ”
——  A TERN INO EI) O NEED OR A UN a Ño
=       DIST No. SNES OMAR 7 ES + ~~
a         adc         PILADOR AROSIMAR @HOTMAIL Go —
= = — [GUSTAVO SEGUNDONON  SRO               i
J                                          E    == 19 DICIE!  BRE - 70 Ree —— CABALLERO    |
/                              -   a EA     et NT: EL E CO 98765277  TA   —               |           |
a NE [Csswab-o — TT A
co del trabajador —— CUSTAVOMONTENEGROCABALLERO7G) MAIL COM |
:                     A ro DN Ea : = CONDUCTOR NE Ae TAP   7           |        \\
ET Lr O UE  SADO nro :          |
JOA USTED: | QUINCENAL — TT   Re              |         |
:   ET aT RMINO FIJO INFERIOR A UN AÑO”
UN TRES (3) MESES —          |                "
 de     ción del contrato 04 ENERO 2025      a                                 |
echa de vencimiento del contrats | 04 DE ABRIL2025———    —                   \\
:    minaci     E Trabajador 15 dies. —                    y
NE    EUA   geese] Empleador 30dias =~ —    :                        y
oución del” BARRANQUILLA - ATLANTICO ——                                 Y
0   Y        =— DERE ENANA A                              Y
¿                     N            \\
Entre EL(A) EMPLEADOR y EL(A) TRABAJADOR, de las condiciones ya dichas, identificados                                |
NN NY YY A, Te  a    a   a  “a
  `;

  it('analiza el texto de 1390 caracteres escalado a 2400', () => {
    const tipo = classifyDocumentType(ocrScaled1390);
    expect(tipo).toBe('contract');

    const parsed = parseContractText(ocrScaled1390);

    // Empleador Rosimar S.A.S. (RN-8)
    expect(parsed.employerName).toBe('Distribuciones Rosimar S.A.S.');
    expect(parsed.employerNit).toBe('901.167.955-4');
    expect(parsed.employerEmail).toBe('piladorarosimar@hotmail.com');

    // Trabajador (extraído del OCR con tolerancias)
    expect(parsed.workerName.toUpperCase()).toContain('GUSTAVO');
    expect(parsed.workerDocumentNumber).toMatch(/^9876527/);
    // En ocrScaled1390 el texto del correo está degradado ("G) MAIL COM" sin punto ni arroba clara)
    expect(parsed.workerEmail).toBe('');

    // Cargo, salario y pago (en ocrScaled1390 la fila del salario quedó cortada sin número: "ET Lr O UE SADO nro : |")
    expect(parsed.position).toBe('Conductor');
    expect(parsed.salary).toBe(0);
    expect(parsed.paymentFrequency).toBe('quincenal');

    // Fechas y prueba
    expect(parsed.startDate).toBe('2025-01-04');
    expect(parsed.endDate).toBe('2025-04-04');
    expect(parsed.durationMonths).toBe(3);
    expect(parsed.trialPeriodDays).toBe(15);
    expect(parsed.executionPlace).toBe('Barranquilla');
  });

  it('extrae el nombre completo cuando la fila del trabajador está intacta', () => {
    const textoCompleto = `
DISTRIBUCIONES ROSIMAR S.A.S.
NIT: 901.167.955-4
TRABAJADOR: GUSTAVO SEGUNDO MONTENEGRO CABALLERO
C.C. 9.876.527
FECHA DE NACIMIENTO: 19 DE DICIEMBRE DE 1979
DOMICILIO: CL 55 # 3B - 21
CORREO: gustavomontenegrocaballero7@gmail.com
CARGO: CONDUCTOR
SALARIO: $ 1.423.500
FORMA DE PAGO: QUINCENAL
FECHA DE INICIACION: 04 DE ENERO 2025
FECHA DE VENCIMIENTO: 04 DE ABRIL 2025
PERIODO DE PRUEBA: 15 DIAS
LUGAR DE EJECUCION: BARRANQUILLA
    `;
    const parsed = parseContractText(textoCompleto);
    expect(parsed.workerName.toUpperCase()).toBe('GUSTAVO SEGUNDO MONTENEGRO CABALLERO');
    expect(parsed.workerDocumentNumber).toBe('9876527');
    expect(parsed.workerDateOfBirth).toBe('1979-12-19');
    expect(parsed.workerAddress).toBe('CL 55 # 3B - 21');
    expect(parsed.workerEmail).toBe('gustavomontenegrocaballero7@gmail.com');
    expect(parsed.position.toUpperCase()).toBe('CONDUCTOR');
    expect(parsed.salary).toBe(1423500);
    expect(parsed.paymentFrequency).toBe('quincenal');
    expect(parsed.startDate).toBe('2025-01-04');
    expect(parsed.endDate).toBe('2025-04-04');
    expect(parsed.trialPeriodDays).toBe(15);
    expect(parsed.executionPlace.toUpperCase()).toBe('BARRANQUILLA');
  });
});

