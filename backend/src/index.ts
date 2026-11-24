import type { Core } from '@strapi/strapi';

import { configurePublicRolePermissions } from './bootstrap/public-permissions';
import { seedContent } from './bootstrap/seed';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   */
  register() {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * Runs after all plugin bootstraps (so the users-permissions Public role
   * already exists), then:
   * 1. replaces the Public role permission set with the read-only allowlist
   *    (`ADR-002`), and
   * 2. seeds the `CO`/`CL` content idempotently (`US-01` §3, `US-02` §3).
   */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await configurePublicRolePermissions(strapi);
    await seedContent(strapi);
  },
};
