export interface AppEnvironment {
  readonly production: boolean;
  readonly strapiBaseUrl: string;
}

export const environment: AppEnvironment = {
  production: false,
  strapiBaseUrl: 'http://localhost:1337',
};
