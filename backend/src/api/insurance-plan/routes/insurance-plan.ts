/**
 * insurance-plan router.
 *
 * Exposes the default Strapi 5 REST routes (`/api/insurance-plans`,
 * `/api/insurance-plans/:id`).
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::insurance-plan.insurance-plan');
