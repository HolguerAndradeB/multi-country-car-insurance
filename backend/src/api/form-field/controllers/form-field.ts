/**
 * form-field controller.
 *
 * The core controller is intentionally left unextended: the Public role is
 * restricted to read-only `find`/`findOne` in `src/bootstrap/public-permissions.ts`.
 */
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::form-field.form-field');
