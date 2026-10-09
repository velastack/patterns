/**
 * The fields that say who a user is. Accounts made with a phone number may
 * have no email, and nobody has a name until they add one.
 */
export type UserIdentity = {
  name?: string;
  email?: string;
  phone?: string;
};

/** The name, else the email, else the phone number. */
export function displayName(user: UserIdentity): string | undefined {
  return user.name?.trim() || user.email || user.phone || undefined;
}

/**
 * The avatar letter, from the name, else the email. A phone number has no
 * useful one ("+"), so it gets `null` and the avatar shows an icon instead.
 */
export function userInitial(user: UserIdentity): string | null {
  const source = user.name?.trim() || user.email;
  return source ? Array.from(source)[0].toUpperCase() : null;
}
