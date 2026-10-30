/** The Portal only ever emails its owner, so the recipient is fixed here instead of coming from env or a request. */
export const DIGEST_TO = "danyaeldelacruz@gmail.com";
/** Resend's shared sender; it only delivers to the Resend account's own address until a domain is verified. */
export const DIGEST_FROM = "The Portal <onboarding@resend.dev>";
