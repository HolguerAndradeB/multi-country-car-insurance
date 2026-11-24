/**
 * form-field router.
 *
 * Exposes the default Strapi 5 REST routes (`/api/form-fields`, `/api/form-fields/:id`).
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreRouter('api::form-field.form-field');
