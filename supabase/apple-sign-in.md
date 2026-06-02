# Apple Sign In Setup

Supabase project: `prrtdkjapjqmddnhwgit`

## Supabase Callback URL

Use this callback URL in Apple Developer when configuring the Services ID:

```text
https://prrtdkjapjqmddnhwgit.supabase.co/auth/v1/callback
```

Use this domain:

```text
prrtdkjapjqmddnhwgit.supabase.co
```

## Values Needed From Apple Developer

To enable Apple in Supabase Auth, collect:

- Team ID
- Services ID, also called the Apple OAuth client ID
- Key ID
- Generated Apple client secret

The Apple client secret is generated from the `.p8` signing key and expires. Rotate it at least every 6 months.

## Supabase Dashboard

In Supabase Dashboard:

1. Open `void-tech`.
2. Go to Authentication > Sign In / Providers.
3. Enable Apple.
4. Set Client ID to the Apple Services ID.
5. Set Secret Key to the generated Apple client secret.
6. Save.

The website admin page already has a `Sign In with Apple` button that calls Supabase OAuth once the provider is enabled.
