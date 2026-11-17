/**
 * Group names that grant the web app's administrator role (CDK context `adminGroupNames`,
 * comma-separated, default `admins`). The web app reads them as ADMIN_GROUP_NAMES and compares
 * them without case against the user's Cognito groups and, for federated users, the groups the
 * identity provider sent (docker/nextjs/src/lib/auth/roles.ts).
 *
 * The first name is also created as a Cognito user pool group, so an administrator is made with
 * `aws cognito-idp admin-add-user-to-group`. Later names are for groups that only a federated
 * provider sends, such as an AD group with a space in its name.
 */
import { Node } from 'constructs';

/** Cognito group names: no whitespace, at most 128 characters. */
const COGNITO_GROUP_NAME = /^[\p{L}\p{M}\p{S}\p{N}\p{P}]{1,128}$/u;

export function adminGroupNames(node: Node): string[] {
  const raw = node.tryGetContext('adminGroupNames') ?? 'admins';
  const names = String(raw).split(',').map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) {
    throw new Error('adminGroupNames must name at least one group (default: admins)');
  }
  if (!COGNITO_GROUP_NAME.test(names[0])) {
    throw new Error(
      `adminGroupNames: the first name "${names[0]}" becomes a Cognito group and must have no whitespace (max 128 characters)`,
    );
  }
  return names;
}
