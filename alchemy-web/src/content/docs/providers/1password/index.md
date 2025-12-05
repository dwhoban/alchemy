---
title: 1Password
description: Securely manage secrets and credentials with 1Password
---

# 1Password

The 1Password provider allows you to create and manage items in [1Password](https://1password.com) vaults, enabling secure secret management in your infrastructure-as-code deployments.

## Installation

::: code-group

```sh [bun]
bun add @1password/sdk
```

```sh [npm]
npm install @1password/sdk
```

```sh [pnpm]
pnpm add @1password/sdk
```

```sh [yarn]
yarn add @1password/sdk
```

:::

## Authentication

The 1Password provider uses Service Account authentication. You'll need to:

1. [Create a Service Account](https://my.1password.com/developer-tools/infrastructure-secrets/serviceaccount/) in your 1Password account
2. Give the service account appropriate permissions in your vaults
3. Set the `OP_SERVICE_ACCOUNT_TOKEN` environment variable

```bash
export OP_SERVICE_ACCOUNT_TOKEN=<your-service-account-token>
```

## Resources

- [Item](./item.md) - Create and manage items (logins, secure notes, API credentials, etc.)

## Example Usage

```ts
import { Item } from "alchemy/1password";

// Create a secure note
const note = await Item("app-secrets", {
  vault: "vault-id",
  title: "Application Secrets",
  category: "SecureNote",
  notes: "Important configuration data",
  tags: ["production", "api"],
});

// Create a login item
const login = await Item("service-login", {
  vault: "vault-id",
  title: "Service Account",
  category: "Login",
  fields: [
    {
      id: "username",
      title: "Username",
      fieldType: "Text",
      value: "service@example.com",
    },
    {
      id: "password",
      title: "Password",
      fieldType: "Concealed",
      value: "secure-password",
    },
  ],
  websites: [
    {
      url: "https://app.example.com",
      label: "Application",
      autofillBehavior: "AnywhereOnWebsite",
    },
  ],
});

// Create an API credential
const apiKey = await Item("api-credentials", {
  vault: "vault-id",
  title: "Production API Key",
  category: "ApiCredentials",
  fields: [
    {
      id: "api-key",
      title: "API Key",
      fieldType: "Concealed",
      value: "sk_live_xxxxx",
      sectionId: "credentials",
    },
  ],
  sections: [
    {
      id: "credentials",
      title: "Credentials",
    },
  ],
});
```
