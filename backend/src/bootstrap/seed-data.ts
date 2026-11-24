/**
 * Seed contract for US-01 (`specs/US-01-policyholder-vehicle-form.md` §3) and
 * US-02 (`specs/US-02-plan-list.md` §3).
 *
 * All copy is fictitious placeholder content in localized Spanish:
 * - `es-CO` for Colombia (`CO`)
 * - `es-CL` for Chile (`CL`)
 *
 * Technical identifiers stay in English (`AGENTS.md` §5).
 */

export type CountryCode = 'CO' | 'CL';

export type CurrencyCode = 'COP' | 'CLP';

export type CountryLocale = 'es-CO' | 'es-CL';

export type FormFieldType = 'text' | 'number' | 'select' | 'date' | 'checkbox';

export type FormFieldSection = 'policyholder' | 'vehicle';

export interface FormFieldOption {
  readonly value: string;
  readonly label: string;
}

/** Typed mirror of the Strapi `validations` JSON blob (US-01 §5.1). */
export type FormFieldValidations = Readonly<Record<string, unknown>>;

export interface CountryConfigSeed {
  readonly country: CountryCode;
  readonly countryName: string;
  readonly currency: CurrencyCode;
  readonly localeCode: CountryLocale;
  readonly termsAndConditions: string;
  readonly documentMaskVisibleEnd: number;
}

export interface FormFieldSeed {
  readonly key: string;
  readonly label: string;
  readonly type: FormFieldType;
  readonly required: boolean;
  readonly validations: FormFieldValidations;
  readonly options?: readonly FormFieldOption[];
  readonly helpText?: string;
  readonly errorMessage?: string;
  readonly order: number;
  readonly country: CountryCode;
  readonly section: FormFieldSection;
}

/** Typed mirror of one entry in the Strapi `coverages` JSON blob (US-02 §5.1). */
export interface PlanCoverageSeed {
  readonly name: string;
  readonly limit: number;
  readonly deductible: number | null;
}

/**
 * Typed mirror of an `insurance-plan` document (US-02 §4.1).
 *
 * `basePrice` is a numeric string because Strapi serialises `biginteger`
 * attributes as JSON strings (e.g. `"350000"`); values stay well below
 * `Number.MAX_SAFE_INTEGER` so the front end can coerce them with `Number()`.
 */
export interface InsurancePlanSeed {
  readonly key: string;
  readonly name: string;
  readonly shortDescription: string;
  readonly basePrice: string;
  readonly currency: CurrencyCode;
  readonly coverages: readonly PlanCoverageSeed[];
  readonly benefits: readonly string[];
  readonly order: number;
  readonly recommended: boolean;
  readonly active: boolean;
  readonly country: CountryCode;
}

/**
 * US-03 readiness placeholder only: these terms are never rendered in US-01 and
 * must be replaced with legal-approved text before US-03 sign-off.
 */
const TERMS_AND_CONDITIONS_CO =
  'TÉRMINOS Y CONDICIONES — TEXTO DE DEMOSTRACIÓN (PENDIENTE DE APROBACIÓN LEGAL). ' +
  'Esta cotización es simulada y no constituye una póliza de seguros. ' +
  'El texto definitivo para Colombia será configurado por el área legal en Strapi antes de la publicación del paso de resumen.';

const TERMS_AND_CONDITIONS_CL =
  'TÉRMINOS Y CONDICIONES — TEXTO DE DEMOSTRACIÓN (PENDIENTE DE APROBACIÓN LEGAL). ' +
  'Esta cotización es simulada y no constituye una póliza de seguros. ' +
  'El texto definitivo para Chile será configurado por el área legal en Strapi antes de la publicación del paso de resumen.';

export const countryConfigSeeds: readonly CountryConfigSeed[] = [
  {
    country: 'CO',
    countryName: 'Colombia',
    currency: 'COP',
    localeCode: 'es-CO',
    termsAndConditions: TERMS_AND_CONDITIONS_CO,
    documentMaskVisibleEnd: 4,
  },
  {
    country: 'CL',
    countryName: 'Chile',
    currency: 'CLP',
    localeCode: 'es-CL',
    termsAndConditions: TERMS_AND_CONDITIONS_CL,
    documentMaskVisibleEnd: 4,
  },
];

/** Colombia: 9 fields — `policyholder` orders 1–6, `vehicle` orders 7–9. */
const COLOMBIA_FORM_FIELDS: readonly FormFieldSeed[] = [
  {
    key: 'documentType',
    label: 'Tipo de documento',
    type: 'select',
    required: true,
    validations: {},
    options: [
      { value: 'CC', label: 'Cédula de ciudadanía' },
      { value: 'CE', label: 'Cédula de extranjería' },
    ],
    helpText: 'Selecciona el documento con el que te identificas.',
    errorMessage: 'Selecciona un tipo de documento válido.',
    order: 1,
    country: 'CO',
    section: 'policyholder',
  },
  {
    key: 'documentNumber',
    label: 'Número de documento',
    type: 'text',
    required: true,
    validations: {
      minLength: 6,
      maxLength: 12,
      pattern: '^[0-9]+$',
      rule: 'coDocumentNumber',
      transform: 'trim',
    },
    helpText: 'Ingresa solo números, sin puntos ni espacios.',
    errorMessage: 'El número de documento no es válido para el tipo seleccionado.',
    order: 2,
    country: 'CO',
    section: 'policyholder',
  },
  {
    key: 'fullName',
    label: 'Nombre completo',
    type: 'text',
    required: true,
    validations: {
      minLength: 3,
      maxLength: 80,
      pattern: "^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' ]+$",
      transform: 'trim',
    },
    helpText: 'Escríbelo tal como aparece en tu documento.',
    errorMessage: 'Ingresa tu nombre completo (mínimo 3 caracteres).',
    order: 3,
    country: 'CO',
    section: 'policyholder',
  },
  {
    key: 'birthDate',
    label: 'Fecha de nacimiento',
    type: 'date',
    required: true,
    validations: {
      rule: 'legalAge',
      minDate: '1900-01-01',
    },
    helpText: 'Debes ser mayor de 18 años para cotizar.',
    errorMessage: 'Debes ser mayor de 18 años para continuar.',
    order: 4,
    country: 'CO',
    section: 'policyholder',
  },
  {
    key: 'city',
    label: 'Ciudad de residencia',
    type: 'select',
    required: true,
    validations: {},
    options: [
      { value: 'BOG', label: 'Bogotá D.C.' },
      { value: 'MDE', label: 'Medellín' },
      { value: 'CLO', label: 'Cali' },
      { value: 'BAQ', label: 'Barranquilla' },
      { value: 'BGA', label: 'Bucaramanga' },
    ],
    helpText: 'Selecciona la ciudad donde resides.',
    errorMessage: 'Selecciona una ciudad válida.',
    order: 5,
    country: 'CO',
    section: 'policyholder',
  },
  {
    key: 'acceptMarketing',
    label: 'Acepto recibir información comercial',
    type: 'checkbox',
    required: false,
    validations: {},
    helpText: 'Puedes cambiar esta preferencia más adelante.',
    order: 6,
    country: 'CO',
    section: 'policyholder',
  },
  {
    key: 'licensePlate',
    label: 'Placa del vehículo',
    type: 'text',
    required: true,
    validations: {
      minLength: 6,
      maxLength: 6,
      pattern: '^[A-Z]{3}[0-9]{3}$',
      rule: 'coPlate',
      transform: 'uppercase',
    },
    helpText: 'Formato ABC123, sin espacios ni guiones.',
    errorMessage: 'La placa debe tener el formato ABC123.',
    order: 7,
    country: 'CO',
    section: 'vehicle',
  },
  {
    key: 'vehicleMake',
    label: 'Marca del vehículo',
    type: 'select',
    required: true,
    validations: {},
    options: [
      { value: 'RENAULT', label: 'Renault' },
      { value: 'CHEVROLET', label: 'Chevrolet' },
      { value: 'MAZDA', label: 'Mazda' },
      { value: 'TOYOTA', label: 'Toyota' },
      { value: 'KIA', label: 'Kia' },
      { value: 'NISSAN', label: 'Nissan' },
      { value: 'OTHER', label: 'Otra marca' },
    ],
    helpText: 'Selecciona la marca de tu vehículo.',
    errorMessage: 'Selecciona una marca válida.',
    order: 8,
    country: 'CO',
    section: 'vehicle',
  },
  {
    key: 'vehicleYear',
    label: 'Año del vehículo',
    type: 'number',
    required: true,
    validations: {
      rule: 'vehicleYear',
      integer: true,
    },
    helpText: 'Aceptamos vehículos de los últimos 20 años o del próximo año.',
    errorMessage:
      'El año del vehículo no está dentro del rango permitido (últimos 20 años o el próximo año).',
    order: 9,
    country: 'CO',
    section: 'vehicle',
  },
];

/**
 * Chile: 8 fields — `policyholder` orders 1–5, `vehicle` orders 6–8.
 *
 * There is deliberately no `documentType` field: `documentNumber` carries the
 * Chilean RUT semantics, proving a genuinely different per-country field set.
 */
const CHILE_FORM_FIELDS: readonly FormFieldSeed[] = [
  {
    key: 'documentNumber',
    label: 'RUT',
    type: 'text',
    required: true,
    validations: {
      minLength: 8,
      maxLength: 12,
      pattern: '^[0-9kK.\\-]+$',
      rule: 'clRut',
      transform: 'trim',
    },
    helpText: 'Ingresa tu RUT con o sin puntos y guion. Ejemplo: 12.345.678-9.',
    errorMessage: 'El RUT ingresado no es válido.',
    order: 1,
    country: 'CL',
    section: 'policyholder',
  },
  {
    key: 'fullName',
    label: 'Nombre completo',
    type: 'text',
    required: true,
    validations: {
      minLength: 3,
      maxLength: 80,
      pattern: "^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' ]+$",
      transform: 'trim',
    },
    helpText: 'Escríbelo tal como aparece en tu documento.',
    errorMessage: 'Ingresa tu nombre completo (mínimo 3 caracteres).',
    order: 2,
    country: 'CL',
    section: 'policyholder',
  },
  {
    key: 'birthDate',
    label: 'Fecha de nacimiento',
    type: 'date',
    required: true,
    validations: {
      rule: 'legalAge',
      minDate: '1900-01-01',
    },
    helpText: 'Debes ser mayor de 18 años para cotizar.',
    errorMessage: 'Debes ser mayor de 18 años para continuar.',
    order: 3,
    country: 'CL',
    section: 'policyholder',
  },
  {
    key: 'city',
    label: 'Ciudad de residencia',
    type: 'select',
    required: true,
    validations: {},
    options: [
      { value: 'SCL', label: 'Santiago' },
      { value: 'VAP', label: 'Valparaíso' },
      { value: 'CCP', label: 'Concepción' },
      { value: 'ANT', label: 'Antofagasta' },
      { value: 'LSC', label: 'La Serena' },
    ],
    helpText: 'Selecciona la ciudad donde resides.',
    errorMessage: 'Selecciona una ciudad válida.',
    order: 4,
    country: 'CL',
    section: 'policyholder',
  },
  {
    key: 'acceptMarketing',
    label: 'Acepto recibir información comercial',
    type: 'checkbox',
    required: false,
    validations: {},
    helpText: 'Puedes cambiar esta preferencia más adelante.',
    order: 5,
    country: 'CL',
    section: 'policyholder',
  },
  {
    key: 'licensePlate',
    label: 'Patente del vehículo',
    type: 'text',
    required: true,
    validations: {
      minLength: 6,
      maxLength: 6,
      pattern: '^(?:[A-Z]{4}[0-9]{2}|[A-Z]{2}[0-9]{4})$',
      rule: 'clPlate',
      transform: 'uppercase',
    },
    helpText: 'Formatos aceptados: ABCD12 o AA1234, sin espacios ni guiones.',
    errorMessage: 'La patente debe tener el formato ABCD12 o AA1234.',
    order: 6,
    country: 'CL',
    section: 'vehicle',
  },
  {
    key: 'vehicleMake',
    label: 'Marca del vehículo',
    type: 'select',
    required: true,
    validations: {},
    options: [
      { value: 'TOYOTA', label: 'Toyota' },
      { value: 'CHEVROLET', label: 'Chevrolet' },
      { value: 'NISSAN', label: 'Nissan' },
      { value: 'HYUNDAI', label: 'Hyundai' },
      { value: 'KIA', label: 'Kia' },
      { value: 'PEUGEOT', label: 'Peugeot' },
      { value: 'OTHER', label: 'Otra marca' },
    ],
    helpText: 'Selecciona la marca de tu vehículo.',
    errorMessage: 'Selecciona una marca válida.',
    order: 7,
    country: 'CL',
    section: 'vehicle',
  },
  {
    key: 'vehicleYear',
    label: 'Año del vehículo',
    type: 'number',
    required: true,
    validations: {
      rule: 'vehicleYear',
      integer: true,
    },
    helpText: 'Aceptamos vehículos de los últimos 20 años o del próximo año.',
    errorMessage:
      'El año del vehículo no está dentro del rango permitido (últimos 20 años o el próximo año).',
    order: 8,
    country: 'CL',
    section: 'vehicle',
  },
];

/** 17 published `form-field` records: 9 for `CO` and 8 for `CL` (US-01 §3.4). */
export const formFieldSeeds: readonly FormFieldSeed[] = [
  ...COLOMBIA_FORM_FIELDS,
  ...CHILE_FORM_FIELDS,
];

/** Colombia: 3 active plans (orders 1–3) + 1 inactive published plan (US-02 §3.1). */
const COLOMBIA_INSURANCE_PLANS: readonly InsurancePlanSeed[] = [
  {
    key: 'basico',
    name: 'Plan Básico',
    shortDescription:
      'Protección esencial para tu vehículo: daños a terceros y asistencia vial básica.',
    basePrice: '350000',
    currency: 'COP',
    coverages: [
      { name: 'Responsabilidad civil extracontractual', limit: 100000000, deductible: null },
      { name: 'Asistencia vial', limit: 2000000, deductible: null },
    ],
    benefits: [
      'Asistencia vial 24 horas',
      'Trámite de siniestros en línea',
      'Cobertura en todo el territorio nacional',
    ],
    order: 1,
    recommended: false,
    active: true,
    country: 'CO',
  },
  {
    key: 'estandar',
    name: 'Plan Estándar',
    shortDescription:
      'Equilibrio entre cobertura y precio, con protección ante robo y daños propios.',
    basePrice: '620000',
    currency: 'COP',
    coverages: [
      { name: 'Responsabilidad civil extracontractual', limit: 200000000, deductible: null },
      { name: 'Daños propios y robo', limit: 40000000, deductible: 1500000 },
      { name: 'Asistencia vial', limit: 5000000, deductible: null },
    ],
    benefits: [
      'Asistencia vial 24 horas',
      'Auto reemplazo por 5 días',
      'Descuento en talleres aliados',
      'Reporte de siniestros desde la app',
    ],
    order: 2,
    recommended: true,
    active: true,
    country: 'CO',
  },
  {
    key: 'todo-riesgo',
    name: 'Plan Todo Riesgo',
    shortDescription:
      'Máxima tranquilidad: cobertura amplia sin deducible para daños propios.',
    basePrice: '1150000',
    currency: 'COP',
    coverages: [
      { name: 'Responsabilidad civil extracontractual', limit: 400000000, deductible: null },
      { name: 'Daños propios, robo e incendio', limit: 90000000, deductible: 0 },
      { name: 'Asistencia vial premium', limit: 10000000, deductible: null },
    ],
    benefits: [
      'Asistencia vial 24 horas sin límite de eventos',
      'Vehículo de reemplazo por 15 días',
      'Cobertura de cristales y espejos',
      'Atención prioritaria de siniestros',
    ],
    order: 3,
    recommended: false,
    active: true,
    country: 'CO',
  },
  {
    key: 'basico-ahorro-inactivo',
    name: 'Plan Básico Ahorro',
    shortDescription:
      'Plan de demostración retirado del catálogo: cobertura limitada a asistencia vial.',
    basePrice: '240000',
    currency: 'COP',
    coverages: [{ name: 'Asistencia vial', limit: 1000000, deductible: null }],
    benefits: ['Asistencia telefónica 24 horas'],
    order: 4,
    recommended: false,
    active: false,
    country: 'CO',
  },
];

/** Chile: 3 active plans (orders 1–3) + 1 inactive published plan (US-02 §3.2). */
const CHILE_INSURANCE_PLANS: readonly InsurancePlanSeed[] = [
  {
    key: 'basico',
    name: 'Plan Básico',
    shortDescription:
      'Cobertura esencial de responsabilidad civil y asistencia en carretera.',
    basePrice: '280000',
    currency: 'CLP',
    coverages: [
      { name: 'Responsabilidad civil', limit: 60000000, deductible: null },
      { name: 'Asistencia en carretera', limit: 1500000, deductible: null },
    ],
    benefits: [
      'Asistencia en carretera 24 horas',
      'Trámite de siniestros en línea',
      'Cobertura en todo Chile',
    ],
    order: 1,
    recommended: false,
    active: true,
    country: 'CL',
  },
  {
    key: 'estandar',
    name: 'Plan Estándar',
    shortDescription:
      'Protección equilibrada frente a robo, daños propios y asistencia ampliada.',
    basePrice: '490000',
    currency: 'CLP',
    coverages: [
      { name: 'Responsabilidad civil', limit: 120000000, deductible: null },
      { name: 'Robo y daños propios', limit: 30000000, deductible: 1000000 },
      { name: 'Asistencia en carretera', limit: 4000000, deductible: null },
    ],
    benefits: [
      'Asistencia en carretera 24 horas',
      'Vehículo reemplazo por 5 días',
      'Descuento en talleres convenidos',
      'Seguimiento de siniestro en línea',
    ],
    order: 2,
    recommended: true,
    active: true,
    country: 'CL',
  },
  {
    key: 'full',
    name: 'Plan Full',
    shortDescription:
      'Cobertura completa con asistencia premium y sin deducible en daños propios.',
    basePrice: '890000',
    currency: 'CLP',
    coverages: [
      { name: 'Responsabilidad civil', limit: 250000000, deductible: null },
      { name: 'Daños propios, robo e incendio', limit: 70000000, deductible: 0 },
      { name: 'Asistencia en carretera premium', limit: 8000000, deductible: null },
    ],
    benefits: [
      'Asistencia en carretera 24 horas sin límite de eventos',
      'Vehículo de reemplazo por 15 días',
      'Cobertura de vidrios y espejos',
      'Atención prioritaria de siniestros',
    ],
    order: 3,
    recommended: false,
    active: true,
    country: 'CL',
  },
  {
    key: 'basico-economico-inactivo',
    name: 'Plan Básico Económico',
    shortDescription:
      'Plan de demostración retirado del catálogo: solo asistencia en carretera.',
    basePrice: '190000',
    currency: 'CLP',
    coverages: [{ name: 'Asistencia en carretera', limit: 800000, deductible: null }],
    benefits: ['Asistencia telefónica 24 horas'],
    order: 4,
    recommended: false,
    active: false,
    country: 'CL',
  },
];

/**
 * 8 published `insurance-plan` records (4 per country, US-02 §3.3):
 * 3 active + 1 inactive per country, exactly one recommended active plan each.
 */
export const insurancePlanSeeds: readonly InsurancePlanSeed[] = [
  ...COLOMBIA_INSURANCE_PLANS,
  ...CHILE_INSURANCE_PLANS,
];
