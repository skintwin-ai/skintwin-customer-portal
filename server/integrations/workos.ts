import { WorkOS } from '@workos-inc/node';

let workosClient: WorkOS | null = null;

function getWorkOSClient(): WorkOS {
  if (!workosClient) {
    const apiKey = process.env.WORKOS_API_KEY;
    if (!apiKey) {
      throw new Error('WORKOS_API_KEY is not configured');
    }
    workosClient = new WorkOS(apiKey);
  }
  return workosClient;
}

// ============================================================================
// SSO (Single Sign-On)
// ============================================================================

export interface GetAuthorizationURLParams {
  clientId: string;
  redirectUri: string;
  provider?: string;
  connection?: string;
  organization?: string;
  state?: string;
  domainHint?: string;
  loginHint?: string;
}

export function getAuthorizationURL(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod?: 'S256';
  provider: string;
  state?: string;
  domainHint?: string;
  loginHint?: string;
}): string {
  const workos = getWorkOSClient();
  return workos.sso.getAuthorizationUrl({
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    provider: params.provider as any,
    state: params.state,
    domainHint: params.domainHint,
    loginHint: params.loginHint,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod || 'S256',
  });
}

export function getAuthorizationURLWithConnection(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod?: 'S256';
  connection: string;
  state?: string;
  domainHint?: string;
  loginHint?: string;
}): string {
  const workos = getWorkOSClient();
  return workos.sso.getAuthorizationUrl({
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    connection: params.connection,
    state: params.state,
    domainHint: params.domainHint,
    loginHint: params.loginHint,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod || 'S256',
  });
}

export function getAuthorizationURLWithOrganization(params: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod?: 'S256';
  organization: string;
  state?: string;
  domainHint?: string;
  loginHint?: string;
}): string {
  const workos = getWorkOSClient();
  return workos.sso.getAuthorizationUrl({
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    organization: params.organization,
    state: params.state,
    domainHint: params.domainHint,
    loginHint: params.loginHint,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod || 'S256',
  });
}

export interface AuthenticateWithCodeParams {
  clientId: string;
  code: string;
}

export async function authenticateWithCode(params: AuthenticateWithCodeParams) {
  const workos = getWorkOSClient();
  return workos.sso.getProfileAndToken({
    clientId: params.clientId,
    code: params.code,
  });
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export interface CreateUserParams {
  email: string;
  firstName?: string;
  lastName?: string;
  emailVerified?: boolean;
  password?: string;
  passwordHash?: string;
  passwordHashType?: 'bcrypt' | 'firebase-scrypt' | 'ssha';
}

export async function createUser(params: CreateUserParams) {
  const workos = getWorkOSClient();
  return workos.userManagement.createUser(params);
}

export async function getUser(userId: string) {
  const workos = getWorkOSClient();
  return workos.userManagement.getUser(userId);
}

export async function updateUser(userId: string, params: Partial<CreateUserParams>) {
  const workos = getWorkOSClient();
  return workos.userManagement.updateUser({ userId, ...params });
}

export async function deleteUser(userId: string) {
  const workos = getWorkOSClient();
  return workos.userManagement.deleteUser(userId);
}

export async function listUsers(params: {
  email?: string;
  organizationId?: string;
  limit?: number;
  before?: string;
  after?: string;
  order?: 'asc' | 'desc';
} = {}) {
  const workos = getWorkOSClient();
  return workos.userManagement.listUsers(params);
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

export async function authenticateWithPassword(params: {
  clientId: string;
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const workos = getWorkOSClient();
  return workos.userManagement.authenticateWithPassword(params);
}

export async function authenticateWithMagicAuth(params: {
  clientId: string;
  code: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const workos = getWorkOSClient();
  return workos.userManagement.authenticateWithMagicAuth(params);
}

export async function authenticateWithEmailVerification(params: {
  clientId: string;
  code: string;
  pendingAuthenticationToken: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const workos = getWorkOSClient();
  return workos.userManagement.authenticateWithEmailVerification(params);
}

export async function authenticateWithTotp(params: {
  clientId: string;
  code: string;
  authenticationChallengeId: string;
  pendingAuthenticationToken: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  const workos = getWorkOSClient();
  return workos.userManagement.authenticateWithTotp(params);
}

// ============================================================================
// MAGIC AUTH
// ============================================================================

// Note: Magic auth code sending is handled via the hosted AuthKit UI
// Use getAuthorizationURL with appropriate parameters for magic link flows

// ============================================================================
// PASSWORD RESET
// ============================================================================

// Note: Password reset emails are handled via the hosted AuthKit UI
// Use getAuthorizationURL with appropriate parameters for password reset flows

export async function resetPassword(params: {
  token: string;
  newPassword: string;
}) {
  const workos = getWorkOSClient();
  return workos.userManagement.resetPassword(params);
}

// ============================================================================
// EMAIL VERIFICATION
// ============================================================================

export async function sendVerificationEmail(params: {
  userId: string;
}) {
  const workos = getWorkOSClient();
  return workos.userManagement.sendVerificationEmail(params);
}

export async function verifyEmail(params: {
  userId: string;
  code: string;
}) {
  const workos = getWorkOSClient();
  return workos.userManagement.verifyEmail(params);
}

// ============================================================================
// ORGANIZATIONS
// ============================================================================

export async function createOrganization(params: {
  name: string;
  allowProfilesOutsideOrganization?: boolean;
  domains?: string[];
}) {
  const workos = getWorkOSClient();
  return workos.organizations.createOrganization(params);
}

export async function getOrganization(organizationId: string) {
  const workos = getWorkOSClient();
  return workos.organizations.getOrganization(organizationId);
}

export async function updateOrganization(organizationId: string, params: {
  name?: string;
  allowProfilesOutsideOrganization?: boolean;
  domains?: string[];
}) {
  const workos = getWorkOSClient();
  return workos.organizations.updateOrganization({ organization: organizationId, ...params });
}

export async function deleteOrganization(organizationId: string) {
  const workos = getWorkOSClient();
  return workos.organizations.deleteOrganization(organizationId);
}

export async function listOrganizations(params: {
  domains?: string[];
  limit?: number;
  before?: string;
  after?: string;
  order?: 'asc' | 'desc';
} = {}) {
  const workos = getWorkOSClient();
  return workos.organizations.listOrganizations(params);
}

// ============================================================================
// ORGANIZATION MEMBERSHIPS
// ============================================================================

export async function createOrganizationMembership(params: {
  userId: string;
  organizationId: string;
  roleSlug?: string;
}) {
  const workos = getWorkOSClient();
  return workos.userManagement.createOrganizationMembership(params);
}

export async function getOrganizationMembership(membershipId: string) {
  const workos = getWorkOSClient();
  return workos.userManagement.getOrganizationMembership(membershipId);
}

export async function deleteOrganizationMembership(membershipId: string) {
  const workos = getWorkOSClient();
  return workos.userManagement.deleteOrganizationMembership(membershipId);
}

export async function listOrganizationMemberships(params: {
  userId: string;
  organizationId?: string;
  limit?: number;
  before?: string;
  after?: string;
  order?: 'asc' | 'desc';
}) {
  const workos = getWorkOSClient();
  return workos.userManagement.listOrganizationMemberships(params);
}

// ============================================================================
// INVITATIONS
// ============================================================================

export async function sendInvitation(params: {
  email: string;
  organizationId?: string;
  expiresInDays?: number;
  inviterUserId?: string;
  roleSlug?: string;
}) {
  const workos = getWorkOSClient();
  return workos.userManagement.sendInvitation(params);
}

export async function getInvitation(invitationId: string) {
  const workos = getWorkOSClient();
  return workos.userManagement.getInvitation(invitationId);
}

export async function revokeInvitation(invitationId: string) {
  const workos = getWorkOSClient();
  return workos.userManagement.revokeInvitation(invitationId);
}

export async function listInvitations(params: {
  email?: string;
  organizationId?: string;
  limit?: number;
  before?: string;
  after?: string;
  order?: 'asc' | 'desc';
} = {}) {
  const workos = getWorkOSClient();
  return workos.userManagement.listInvitations(params);
}

// ============================================================================
// SESSIONS
// ============================================================================

export async function getJwksUrl(clientId: string): Promise<string> {
  return `https://api.workos.com/sso/jwks/${clientId}`;
}

export async function revokeSession(sessionId: string) {
  const workos = getWorkOSClient();
  return workos.userManagement.revokeSession({ sessionId });
}

// ============================================================================
// DIRECTORY SYNC
// ============================================================================

export async function listDirectories(params: {
  organizationId?: string;
  search?: string;
  limit?: number;
  before?: string;
  after?: string;
  order?: 'asc' | 'desc';
} = {}) {
  const workos = getWorkOSClient();
  return workos.directorySync.listDirectories(params);
}

export async function getDirectory(directoryId: string) {
  const workos = getWorkOSClient();
  return workos.directorySync.getDirectory(directoryId);
}

export async function listDirectoryUsers(params: {
  directory?: string;
  group?: string;
  limit?: number;
  before?: string;
  after?: string;
  order?: 'asc' | 'desc';
}) {
  const workos = getWorkOSClient();
  return workos.directorySync.listUsers(params);
}

export async function listDirectoryGroups(params: {
  directory?: string;
  user?: string;
  limit?: number;
  before?: string;
  after?: string;
  order?: 'asc' | 'desc';
}) {
  const workos = getWorkOSClient();
  return workos.directorySync.listGroups(params);
}

// ============================================================================
// WEBHOOKS
// ============================================================================

export async function constructWebhookEvent(payload: string | Buffer, signature: string, secret: string) {
  const workos = getWorkOSClient();
  return workos.webhooks.verifyHeader({
    payload: typeof payload === 'string' ? payload : payload.toString(),
    sigHeader: signature,
    secret,
  });
}

// ============================================================================
// AUDIT LOGS
// ============================================================================

export async function createAuditLogEvent(
  organizationId: string,
  event: {
    action: string;
    occurredAt: Date;
    actor: { type: string; id: string; name?: string };
    targets: { type: string; id: string; name?: string }[];
    context: { location: string; userAgent?: string };
    metadata?: Record<string, any>;
  },
  options?: { idempotencyKey?: string }
) {
  const workos = getWorkOSClient();
  return workos.auditLogs.createEvent(organizationId, event, options);
}

export async function createAuditLogExport(params: {
  organizationId: string;
  rangeStart: Date;
  rangeEnd: Date;
  actions?: string[];
  actorNames?: string[];
  actorIds?: string[];
  targets?: string[];
}) {
  const workos = getWorkOSClient();
  return workos.auditLogs.createExport(params);
}

export async function getAuditLogExport(exportId: string) {
  const workos = getWorkOSClient();
  return workos.auditLogs.getExport(exportId);
}
