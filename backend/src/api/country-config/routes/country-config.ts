/**
 * country-config router.
 *
 * Exposes the default Strapi 5 REST routes (`/api/country-configs`, `/api/country-configs/:id`).
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::country-config.country-config');
