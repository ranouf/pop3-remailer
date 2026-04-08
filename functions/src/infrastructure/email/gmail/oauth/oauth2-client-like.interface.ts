export interface OAuth2ClientLikeInterface {
  credentials: {
    readonly refresh_token?: string | null;
  };
  setCredentials(credentials: { readonly refresh_token: string }): void;
}
