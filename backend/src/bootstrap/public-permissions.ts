/**
 * Programmatic Public-role hardening (ADR-002, US-01 §4.5).
 *
 * The Angular application is fully anonymous and read-only: it never sends an
 * `Authorization` header and no API token exists. The only browser access path
 * is therefore the users-permissions `Public` role, which must keep exactly the
 * read-only actions listed below and nothing else.
 *
 * The configuration is a full replacement, not an addition: any other
 * permission attached to `Public` (including `api::*`, `plugin::users-permissions.*`
 * and `plugin::upload.*` entries) is revoked, so the default is denial.
 */
import type { Core } from '@strapi/strapi';

export const PUBLIC_READ_ACTIONS = [
  'api::form-field.form-field.find',
  'api::form-field.form-field.findOne',
  'api::country-config.country-config.find',
  'api::country-config.country-config.findOne',
] as const;

interface RoleRecord {
  readonly id: number;
  readonly type: string | null;
}

interface PermissionRecord {
  readonly id: number;
  readonly action: string;
}

const PUBLIC_ROLE_TYPE = 'public';

export const configurePublicRolePermissions = async (strapi: Core.Strapi): Promise<void> => {
  const publicRole = (await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: PUBLIC_ROLE_TYPE },
  })) as RoleRecord | null;

  if (!publicRole) {
    // Fail closed: without the Public role the read-only posture cannot be verified.
    throw new Error(
      '[bootstrap] users-permissions Public role was not found; refusing to start with an unverified permission set.'
    );
  }

  const permissionStore = strapi.db.query('plugin::users-permissions.permission');

  const currentPermissions = (await permissionStore.findMany({
    where: { role: { id: publicRole.id } },
  })) as PermissionRecord[];

  const allowlist = new Set<string>(PUBLIC_READ_ACTIONS);
  const keptActions = new Set<string>();
  const permissionsToRevoke: PermissionRecord[] = [];

  for (const permission of currentPermissions) {
    // Keep the first record per allowed action; revoke everything else,
    // including duplicates of an allowed action.
    if (!allowlist.has(permission.action) || keptActions.has(permission.action)) {
      permissionsToRevoke.push(permission);
      continue;
    }

    keptActions.add(permission.action);
  }

  for (const permission of permissionsToRevoke) {
    await permissionStore.delete({ where: { id: permission.id } });
  }

  const permissionsToGrant = PUBLIC_READ_ACTIONS.filter((action) => !keptActions.has(action));

  for (const action of permissionsToGrant) {
    await permissionStore.create({ data: { action, role: publicRole.id } });
  }

  strapi.log.info(
    `[bootstrap] Public role locked to ${PUBLIC_READ_ACTIONS.length} read-only actions ` +
      `(revoked: ${permissionsToRevoke.length}, granted: ${permissionsToGrant.length}).`
  );
};
