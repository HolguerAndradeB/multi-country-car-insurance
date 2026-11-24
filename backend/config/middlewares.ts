import type { Core } from '@strapi/strapi';

const parseOrigins = (raw: string): string[] =>
  raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Middlewares => {
  const configuredOrigins = parseOrigins(
    env('CORS_ORIGIN', 'http://localhost:4200,http://127.0.0.1:4200')
  );
  const adminOrigin = env('STRAPI_ADMIN_ORIGIN', 'http://localhost:1337');
  const allowedOrigins = Array.from(new Set([...configuredOrigins, adminOrigin]));

  return [
    'strapi::logger',
    'strapi::errors',
    'strapi::security',
    {
      name: 'strapi::cors',
      config: {
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
        headers: ['Content-Type', 'Authorization', 'Origin', 'Accept'],
        keepHeaderOnError: true,
      },
    },
    'strapi::poweredBy',
    'strapi::query',
    'strapi::body',
    'strapi::session',
    'strapi::favicon',
    'strapi::public',
  ];
};

export default config;
