---
title: Item
description: Create and manage 1Password items including logins, secure notes, and API credentials
---

The Item resource lets you create and manage items in [1Password](https://1password.com) vaults, including logins, secure notes, API credentials, and more.

## Minimal Example

Create a basic secure note:

```ts
import { Item } from "alchemy/1password";

const note = await Item("my-note", {
  vault: "vault-id",
  title: "My Secure Note",
});
```

## Login Item

Create a login item with username, password, and website for autofill:

```ts
import { Item } from "alchemy/1password";

const login = await Item("app-login", {
  vault: "vault-id",
  title: "My App Login",
  category: "Login",
  fields: [
    {
      id: "username",
      title: "Username",
      fieldType: "Text",
      value: "user@example.com",
    },
    {
      id: "password",
      title: "Password",
      fieldType: "Concealed",
      value: "my-secret-password",
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
```

## API Credential

Create an API credential with custom sections:

```ts
import { Item } from "alchemy/1password";

const apiCred = await Item("api-key", {
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
    {
      id: "api-url",
      title: "API URL",
      fieldType: "Url",
      value: "https://api.example.com/v1",
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

## Secure Note with Tags

Create a secure note with tags for organization:

```ts
import { Item } from "alchemy/1password";

const note = await Item("config-note", {
  vault: "vault-id",
  title: "Configuration Notes",
  category: "SecureNote",
  notes: "Important configuration details for production environment",
  tags: ["production", "config", "sensitive"],
});
```

## Prevent Deletion

Create an item that won't be deleted when removed from Alchemy:

```ts
import { Item } from "alchemy/1password";

const persistentItem = await Item("permanent-secret", {
  vault: "vault-id",
  title: "Permanent Secret",
  category: "SecureNote",
  notes: "This item will remain even after Alchemy cleanup",
  delete: false,
});
```

:::caution
When `delete: false` is set, the item will remain in 1Password after your Alchemy stack is destroyed. You'll need to manually delete it from 1Password if you no longer need it.
:::

## Custom Service Account Token

Use a specific service account token instead of the environment variable:

```ts
import { Item } from "alchemy/1password";

const item = await Item("custom-auth-item", {
  vault: "vault-id",
  title: "Custom Auth Item",
  serviceAccountToken: alchemy.secret(process.env.CUSTOM_OP_TOKEN),
});
```

## Field Types

The following field types are supported:

| Field Type | Description |
|------------|-------------|
| `Text` | Plain text value |
| `Concealed` | Hidden/password value |
| `Url` | URL value |
| `Email` | Email address |
| `Phone` | Phone number |
| `Totp` | One-time password |
| `Date` | Date value |
| `MonthYear` | Month/Year value |
| `Address` | Address with components |
| `CreditCardType` | Credit card type |
| `CreditCardNumber` | Credit card number |
| `Reference` | Reference to another item |
| `SshKey` | SSH key |
| `Menu` | Menu selection |

## Item Categories

The following item categories are supported:

| Category | Description |
|----------|-------------|
| `Login` | Website login credentials |
| `SecureNote` | Secure text notes |
| `ApiCredentials` | API keys and tokens |
| `Password` | Standalone password |
| `CreditCard` | Credit card information |
| `Identity` | Personal identity information |
| `Database` | Database credentials |
| `Server` | Server access credentials |
| `SshKey` | SSH key pairs |
| `Document` | Document storage |
| `BankAccount` | Bank account details |
| And more... | See 1Password documentation |
