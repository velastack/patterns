import type { CatalogEntry } from "../../../runtime/wuchale-catalog";

const AUTH = "src/routes/(public)/(auth)";
const APP = "src/routes/(app)";
const LOGIN = `${AUTH}/login/+page.svelte`;
const SIGNUP = `${AUTH}/signup/+page.svelte`;
const SETTINGS = `${APP}/settings/+page.svelte`;

/** The messages of one file, keyed by the text wuchale extracts. */
const messages = (
  reference: string,
  translations: Record<string, string>,
): CatalogEntry[] =>
  Object.entries(translations).map(([msgid, msgstr]) => ({
    reference,
    msgid,
    msgstr,
  }));

/**
 * Spanish for what enable-auth and enable-auth-remote write: the sign-in
 * pages, the signed-in shell and settings page, and the links they add to the
 * public navbar. Merged into `src/locales/es.po` by whichever of the auth
 * pattern and enable-i18n runs second (see `runtime/wuchale-catalog`).
 *
 * The keys are the messages as wuchale extracts them from the templates in
 * each pattern's `creates/`, so a template whose text changes needs its key
 * changed here: a
 * key that matches nothing is carried in the catalog and never shown. A
 * message used by several files is listed once, under the first.
 */
export const AUTH_TRANSLATIONS: CatalogEntry[] = [
  // The navbar links are in the root layout, which a project has with or
  // without auth, so they are filed under the page they lead to.
  ...messages(LOGIN, {
    Login: "Iniciar sesión",
    Logout: "Cerrar sesión",
    Settings: "Configuración",
    Dashboard: "Panel",

    "Choose a login method": "Elige cómo iniciar sesión",
    "Use your email to login": "Usa tu correo para iniciar sesión",
    "Welcome back": "Qué gusto verte de nuevo",
    "Login is disabled": "El inicio de sesión está desactivado",
    "Check back later for login options":
      "Vuelve más tarde para ver las opciones de inicio de sesión",
    "<0/> Login with {0}": "<0/> Iniciar sesión con {0}",
    "Or continue with": "O continúa con",
    Email: "Correo electrónico",
    Password: "Contraseña",
    "Forgot your password?": "¿Olvidaste tu contraseña?",
    "Use one-time code instead": "Usar un código de un solo uso",
    "Continue with password": "Continuar con contraseña",
    "Send one-time code": "Enviar código de un solo uso",
    "Don't have an account? <0>Sign up</0>":
      "¿No tienes una cuenta? <0>Regístrate</0>",
    "By clicking continue, you agree to our <0>Terms of Service</0> and <1>Privacy Policy</1>.":
      "Al continuar, aceptas nuestros <0>Términos del servicio</0> y nuestra <1>Política de privacidad</1>.",
  }),
  ...messages(`${AUTH}/login/+page.ts`, {
    "Log in": "Iniciar sesión",
  }),

  ...messages(SIGNUP, {
    "Choose a sign up method": "Elige cómo registrarte",
    "Use your email to sign up": "Usa tu correo para registrarte",
    "Create an account": "Crea una cuenta",
    "Signups are disabled": "El registro está desactivado",
    "Check back later for signup options":
      "Vuelve más tarde para ver las opciones de registro",
    "<0/> Sign up with {0}": "<0/> Registrarte con {0}",
    "Confirm Password": "Confirmar contraseña",
    "Create account": "Crear cuenta",
    "Already have an account? <0>Log in</0>":
      "¿Ya tienes una cuenta? <0>Inicia sesión</0>",
  }),
  ...messages(`${AUTH}/signup/+page.ts`, {
    "Sign up": "Crear cuenta",
  }),
  ...messages(`${AUTH}/signup/+page.server.ts`, {
    "Failed to send the code.": "No pudimos enviar el código.",
    "We sent a confirmation link to your email.":
      "Te enviamos un enlace de confirmación a tu correo.",
  }),

  ...messages(`${AUTH}/reset/+page.svelte`, {
    "Reset your password": "Restablece tu contraseña",
    "Enter your email to reset your password":
      "Escribe tu correo para restablecer tu contraseña",
    "Send reset link": "Enviar enlace",
    "Remembered your password? <0>Log in</0>":
      "¿Recordaste tu contraseña? <0>Inicia sesión</0>",
  }),
  ...messages(`${AUTH}/reset/+page.ts`, {
    "Reset password": "Restablecer contraseña",
  }),
  ...messages(`${AUTH}/reset/+page.server.ts`, {
    "We sent a password reset link to your email.":
      "Te enviamos un enlace a tu correo para restablecer tu contraseña.",
  }),

  ...messages(`${AUTH}/confirm-reset/[token]/+page.svelte`, {
    "Enter your new password": "Escribe tu nueva contraseña",
  }),
  ...messages(`${AUTH}/confirm-reset/[token]/+page.ts`, {
    "Confirm password reset": "Confirmar restablecimiento de contraseña",
  }),
  ...messages(`${AUTH}/confirm-reset/[token]/+page.server.ts`, {
    "Password reset successfully.":
      "Tu contraseña se restableció correctamente.",
  }),

  ...messages(`${AUTH}/confirm-email-change/[token]/+page.svelte`, {
    "Confirm email change": "Confirmar cambio de correo",
    "Confirm your email change": "Confirma el cambio de correo",
    "Enter your password to confirm your email change":
      "Escribe tu contraseña para confirmar el cambio de correo",
  }),
  ...messages(`${AUTH}/confirm-email-change/[token]/+page.server.ts`, {
    "Email changed successfully.": "Tu correo se cambió correctamente.",
  }),

  ...messages(`${AUTH}/otp/[token]/+page.svelte`, {
    "Verify code": "Verificar código",
    "Enter your OTP code": "Escribe tu código",
    "Enter the code sent to your email":
      "Escribe el código que enviamos a tu correo",
    "OTP code": "Código de un solo uso",
  }),

  ...messages(`${AUTH}/welcome/+page.svelte`, {
    "Welcome!": "¡Te damos la bienvenida!",
    "What should we call you?": "¿Cómo quieres que te llamemos?",
    Name: "Nombre",
    Continue: "Continuar",
    "Skip for now": "Omitir por ahora",
  }),
  ...messages(`${AUTH}/welcome/+page.ts`, {
    Welcome: "Bienvenida",
  }),

  ...messages(`${APP}/+layout.server.ts`, {
    Home: "Inicio",
  }),
  ...messages("src/lib/components/nav-user.svelte", {
    "<0/> Light mode": "<0/> Modo claro",
    "<0/> Dark mode": "<0/> Modo oscuro",
    "<0/> Log out": "<0/> Cerrar sesión",
  }),

  ...messages(SETTINGS, {
    Profile: "Perfil",
    "Your profile information.": "La información de tu perfil.",
    Avatar: "Avatar",
    "Upload a new avatar for your profile.":
      "Sube un nuevo avatar para tu perfil.",
    "Remove avatar": "Quitar avatar",
    "Upload new picture": "Subir nueva foto",
    "Display email publicly": "Mostrar mi correo públicamente",
    "By clicking this checkbox, your email will be displayed publicly.":
      "Al marcar esta casilla, tu correo se mostrará públicamente.",
    "Save changes": "Guardar cambios",
    "The email address associated with your account.":
      "El correo electrónico asociado a tu cuenta.",
    Verified: "Verificado",
    Unverified: "Sin verificar",
    "Resend verification email": "Reenviar correo de verificación",
    "Change email": "Cambiar correo",
    "Enter your new email address. You will receive a verification email.":
      "Escribe tu nuevo correo electrónico. Recibirás un correo de verificación.",
    "Your password is used to log in to your account.":
      "Tu contraseña se usa para iniciar sesión en tu cuenta.",
    "New password": "Nueva contraseña",
    "Confirm new password": "Confirmar nueva contraseña",
    "Update password": "Actualizar contraseña",
  }),
  ...messages(`${APP}/settings/+page.server.ts`, {
    "Profile updated successfully.": "Tu perfil se actualizó correctamente.",
    "We sent a confirmation link to your new email.":
      "Te enviamos un enlace de confirmación a tu nuevo correo.",
    "Password updated successfully.":
      "Tu contraseña se actualizó correctamente.",
    "Your account has no email.": "Tu cuenta no tiene correo.",
    "We sent a verification email to your email.":
      "Te enviamos un correo de verificación.",
  }),

  // enable-auth-remote writes the same pages at the same paths, so everything
  // above covers it. These are the messages only it has, filed under its
  // remote functions so a project with the form-action pages is not handed
  // them.
  ...messages(`${AUTH}/login/form.remote.ts`, {
    "Failed to authenticate.": "No pudimos iniciar tu sesión.",
  }),
  ...messages(`${AUTH}/signup/form.remote.ts`, {
    "Failed to create account.": "No pudimos crear tu cuenta.",
  }),
  ...messages(`${AUTH}/otp/[token]/form.remote.ts`, {
    "Failed to verify code.": "No pudimos verificar el código.",
  }),
  ...messages(`${APP}/settings/form.remote.ts`, {
    "Upload new picture <0/>": "Subir nueva foto <0/>",
  }),
];
