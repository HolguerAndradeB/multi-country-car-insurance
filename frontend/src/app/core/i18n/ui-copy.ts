import type { FormFieldSection, WizardStep } from '../models';

/**
 * Shared, country-agnostic Spanish chrome copy (G18). Country-specific field
 * labels, help texts and errors always come from Strapi.
 */
export const UI_COPY = {
  brand: 'Ruta Segura',
  brandTagline: 'Cotiza tu seguro de auto',
  countryLabel: 'País',
  stepperLabel: 'Pasos del cotizador',
  steps: [
    { key: 'policyholder', index: 1, label: 'Tus datos', srLabel: 'Paso 1 de 3' },
    { key: 'plans', index: 2, label: 'Planes', srLabel: 'Paso 2 de 3' },
    { key: 'summary', index: 3, label: 'Resumen', srLabel: 'Paso 3 de 3' },
  ] as ReadonlyArray<{
    key: WizardStep;
    index: number;
    label: string;
    srLabel: string;
  }>,
  sectionLegends: {
    policyholder: 'Tus datos',
    vehicle: 'Datos del vehículo',
  } as Readonly<Record<FormFieldSection, string>>,
  step1Heading: 'Tus datos',
  step1Intro: 'Completa la información del tomador y del vehículo para continuar.',
  selectPlaceholder: 'Selecciona una opción',
  requiredMark: '*',
  continue: 'Continuar',
  backToData: 'Volver a mis datos',
  retry: 'Reintentar',
  loading: 'Cargando el formulario…',
  emptyTitle: 'No hay campos configurados para este país',
  emptyBody: 'Todavía no hay campos publicados para este país. Puedes reintentar o revisar el otro país.',
  errorTitle: 'No pudimos cargar el formulario.',
  errorBody: 'Revisa tu conexión e inténtalo de nuevo. Tus datos guardados no se han perdido.',
  fallbackValidation: 'Revisa este campo.',
  restoredDraft: 'Recuperamos tus datos guardados.',
  errorSummary: (count: number): string => `Revisa los campos marcados: ${count} errores.`,
  otherCountry: {
    CO: 'Ver cotización en Chile',
    CL: 'Ver cotización en Colombia',
  } as Readonly<Record<'CO' | 'CL', string>>,
  plansHeading: 'Planes',
  plansBody:
    'El catálogo de planes y coberturas estará disponible en el siguiente paso. Por ahora, tus datos ya están guardados y puedes volver para revisarlos.',
  plansIntro: 'Compara los planes disponibles para tu país y selecciona el que mejor te convenga.',
  planSelectLegend: 'Selecciona tu plan',
  recommendedBadge: 'Recomendado',
  selectedLabel: 'Seleccionado',
  plansLoading: 'Cargando los planes…',
  plansEmptyTitle: 'No hay planes disponibles para este país en este momento',
  plansEmptyBody:
    'Vuelve a intentarlo en unos minutos o revisa tus datos. Tus respuestas siguen guardadas.',
  plansErrorTitle: 'No pudimos cargar los planes.',
  plansErrorBody: 'Revisa tu conexión e inténtalo de nuevo. Tu selección no se ha perdido.',
  invalidSelectionNotice:
    'El plan que habías elegido ya no está disponible. Selecciona uno de los planes actuales para continuar.',
  restoredSelectionNotice: 'Recuperamos tu plan seleccionado.',
  simulatedFootnote: 'Los precios son simulados y no constituyen una oferta comercial.',
  finalPriceLabel: 'Precio final estimado',
  basePriceLabel: 'Precio base',
  adjustmentLabel: 'Ajuste simulado',
  noAdjustment: 'Sin ajuste simulado aplicado',
  coverageLimitLabel: 'Límite',
  coverageDeductibleLabel: 'Deducible',
  notApplicable: 'No aplica',
  summaryHeading: 'Resumen de tu cotización',
  summaryBody:
    'Esta es una vista de resumen. En el siguiente paso podrás revisar tus datos y el plan elegido antes de continuar.',
  backToPlans: 'Volver a planes',
  notFoundHeading: 'Página no encontrada',
  notFoundBody: 'La dirección que abriste no existe. Puedes volver al cotizador.',
  notFoundLink: 'Ir al cotizador',
} as const;
