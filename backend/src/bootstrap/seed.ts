/**
 * Idempotent bootstrap seeding for US-01 and US-02.
 *
 * Rules (see `.opencode/skills/strapi-multi-country/SKILL.md` §3,
 * `specs/US-01-policyholder-vehicle-form.md` §3 and
 * `specs/US-02-plan-list.md` §3):
 * - natural key for `country-config` is `country`;
 * - natural key for `form-field` is `(country, key)`;
 * - natural key for `insurance-plan` is `(country, key)`;
 * - an entry is only created when no draft AND no published version exists,
 *   so restarting the stack never duplicates or mutates business-edited rows;
 * - new entries are published immediately (`status: 'published'`).
 */
import type { Core } from '@strapi/strapi';

import {
  countryConfigSeeds,
  type CountryConfigSeed,
  formFieldSeeds,
  type FormFieldSeed,
  insurancePlanSeeds,
  type InsurancePlanSeed,
} from './seed-data';

type SeedStatus = 'draft' | 'published';

interface SeedDocumentService<TData extends object> {
  findMany(params: {
    filters: Record<string, unknown>;
    status: SeedStatus;
  }): Promise<ReadonlyArray<unknown>>;
  create(params: { data: TData; status: SeedStatus }): Promise<unknown>;
}

/**
 * Narrow, typed view over the Strapi 5 Document Service.
 *
 * The cast keeps the bootstrap independent from generated content-type typings
 * (`types/generated/contentTypes.d.ts`); payloads are still validated by the
 * Document Service itself at runtime.
 */
const documentService = <TData extends object>(
  strapi: Core.Strapi,
  uid: string
): SeedDocumentService<TData> =>
  strapi.documents(uid as never) as unknown as SeedDocumentService<TData>;

const existsWithStatus = async <TData extends object>(
  documents: SeedDocumentService<TData>,
  filters: Record<string, unknown>,
  status: SeedStatus
): Promise<boolean> => {
  const entries = await documents.findMany({ filters, status });
  return entries.length > 0;
};

/**
 * `findMany` defaults to the draft version in Strapi 5, so both statuses are
 * queried explicitly: a published document still has a draft counterpart, but
 * checking both guarantees an unpublished hand-made entry is never duplicated.
 */
const entryExists = async <TData extends object>(
  documents: SeedDocumentService<TData>,
  filters: Record<string, unknown>
): Promise<boolean> => {
  if (await existsWithStatus(documents, filters, 'draft')) {
    return true;
  }

  return existsWithStatus(documents, filters, 'published');
};

const seedCountryConfigs = async (strapi: Core.Strapi): Promise<void> => {
  const documents = documentService<CountryConfigSeed>(
    strapi,
    'api::country-config.country-config'
  );

  for (const config of countryConfigSeeds) {
    const exists = await entryExists(documents, { country: config.country });

    if (exists) {
      continue;
    }

    await documents.create({ data: config, status: 'published' });
    strapi.log.info(`[bootstrap] Seeded country-config for ${config.country}.`);
  }
};

const seedFormFields = async (strapi: Core.Strapi): Promise<void> => {
  const documents = documentService<FormFieldSeed>(strapi, 'api::form-field.form-field');

  for (const field of formFieldSeeds) {
    const exists = await entryExists(documents, {
      country: field.country,
      key: field.key,
    });

    if (exists) {
      continue;
    }

    await documents.create({ data: field, status: 'published' });
    strapi.log.info(`[bootstrap] Seeded form-field ${field.country}/${field.key}.`);
  }
};

const seedInsurancePlans = async (strapi: Core.Strapi): Promise<void> => {
  const documents = documentService<InsurancePlanSeed>(
    strapi,
    'api::insurance-plan.insurance-plan'
  );

  for (const plan of insurancePlanSeeds) {
    const exists = await entryExists(documents, {
      country: plan.country,
      key: plan.key,
    });

    if (exists) {
      continue;
    }

    await documents.create({ data: plan, status: 'published' });
    strapi.log.info(`[bootstrap] Seeded insurance-plan ${plan.country}/${plan.key}.`);
  }
};

export const seedContent = async (strapi: Core.Strapi): Promise<void> => {
  await seedCountryConfigs(strapi);
  await seedFormFields(strapi);
  await seedInsurancePlans(strapi);

  strapi.log.info(
    `[bootstrap] Seed verified: ${countryConfigSeeds.length} country configs, ` +
      `${formFieldSeeds.length} form fields and ${insurancePlanSeeds.length} insurance plans for CO/CL.`
  );
};
