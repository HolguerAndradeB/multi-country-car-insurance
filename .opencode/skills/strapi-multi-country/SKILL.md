---
name: strapi-multi-country
description: Patterns and procedures for Strapi 5+ multi-country content modeling, idempotent bootstrap seeding for Colombia and Chile, flattened Document Service APIs, and strict read-only Public role security. Use whenever creating or modifying Strapi schemas, seeds, permissions, or API queries.
license: MIT
compatibility: opencode
metadata:
  domain: backend
  stack: strapi-5
---

# Strapi 5+ Multi-Country Conventions

Use this skill for every Strapi 5+ schema, bootstrap seed, permission configuration, and API integration task in this repository.

## 1. Strapi 5 API & Document Service Rules

1. **Flattened REST Responses:** Strapi 5 returns flattened records without `.attributes`:
   ```json
   {
     "data": [
       {
         "id": 1,
         "documentId": "abc123xyz",
         "key": "licensePlate",
         "label": "Placa del vehículo",
         "country": "CO"
       }
     ],
     "meta": { "pagination": { "page": 1, "pageSize": 25, "total": 1 } }
   }
   ```
   Never write frontend adapters expecting Strapi v4 `{ id, attributes: { ... } }`.
2. **Document Service API (`strapi.documents`):** In Strapi 5 lifecycle/bootstrap code, use `strapi.documents('api::model.model')` instead of deprecated `strapi.entityService`.
   - Always pass `status: 'published'` when creating seed entries so public GET queries return them immediately (`draftAndPublish: true` lets business editors stage drafts without publishing).

## 2. Multi-Country Content Architecture (`CO` & `CL`)

All business-configurable items are scoped by a `country` enumeration (`CO`, `CL`):

1. **Form Fields (`form-field` collection type)**
   - Required attributes:
     - `key` (`string`, required): stable technical field identifier (e.g., `documentType`, `documentNumber`, `birthDate`, `licensePlate`, `vehicleMake`, `vehicleYear`, `city`, `acceptMarketing`)
     - `label` (`string`, required): localized user-facing label
     - `type` (`enumeration`: `text | number | select | date | checkbox`, required)
     - `required` (`boolean`, default `false`)
     - `validations` (`json`, optional): typed validation metadata (e.g., `{ "minLength": 5, "maxLength": 12, "pattern": "^[A-Z]{3}[0-9]{3}$", "rule": "vehicleYear" }`)
     - `options` (`json`, optional): array of `{ "value": "...", "label": "..." }` for `select` fields
     - `helpText` (`string`, optional)
     - `errorMessage` (`string`, optional): business-configured validation error message
     - `order` (`integer`, required)
     - `country` (`enumeration`: `CO | CL`, required)
     - `section` (`enumeration`: `policyholder | vehicle`, optional/recommended for grouping)

2. **Insurance Plans (`insurance-plan` collection type)**
   - Required attributes:
     - `name` (`string`, required)
     - `shortDescription` (`text`, required)
     - `basePrice` (`decimal` or `biginteger`, required)
     - `currency` (`enumeration`: `COP | CLP`, required)
     - `coverages` (`json`, required): list of coverage objects/labels
     - `benefits` (`json`, required): list of benefit strings
     - `order` (`integer`, required)
     - `recommended` (`boolean`, default `false`)
     - `active` (`boolean`, default `true`)
     - `country` (`enumeration`: `CO | CL`, required)

3. **Country Configuration / Legal (`country-config` collection type)**
   - Required attributes:
     - `country` (`enumeration`: `CO | CL`, unique, required)
     - `countryName` (`string`, required)
     - `currency` (`enumeration`: `COP | CLP`, required)
     - `locale` (`string`, required: `es-CO` / `es-CL`)
     - `termsAndConditions` (`richtext` or `text`, required)
     - `documentMaskVisibleEnd` (`integer`, default `4`)

## 3. Idempotent Bootstrap Seed Pattern

In `backend/src/index.ts` inside `async bootstrap({ strapi })`:
1. Check if entries already exist for each content type + country + unique key before inserting:
   ```ts
   const existing = await strapi.documents('api::form-field.form-field').findMany({
     filters: { country: item.country, key: item.key },
     status: 'published',
   });
   if (existing.length === 0) {
     await strapi.documents('api::form-field.form-field').create({
       data: item,
       status: 'published',
     });
   }
   ```
2. Running `docker compose up` multiple times must NEVER fail or create duplicate fields/plans/configs.
3. All seeded data must be 100% fictitious (no real personal data).

## 4. Minimal Public Role Security Pattern

Configure the `Public` users-permissions role programmatically in `bootstrap`:
1. Query `plugin::users-permissions.role` where `type = 'public'`.
2. Grant **ONLY** `find` and `findOne` actions for:
   - `api::form-field.form-field`
   - `api::insurance-plan.insurance-plan`
   - `api::country-config.country-config`
3. Explicitly ensure `create`, `update`, and `delete` actions are **NOT** enabled for `Public`.
4. Never create or pass any full-access or write API token to the Angular front end.

## 5. Verification Checklist

After starting Strapi, verify with `curl`:
- `GET /api/form-fields?filters[country][$eq]=CO&sort=order:asc` returns HTTP `200` with flattened `data[]`.
- `GET /api/insurance-plans?filters[country][$eq]=CL&filters[active][$eq]=true&sort=order:asc` returns HTTP `200`.
- `POST /api/form-fields` without auth returns HTTP `403` (or `401`), confirming write protection.
