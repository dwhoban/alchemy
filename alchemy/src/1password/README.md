# 1Password Provider

This provider enables management of 1Password items through the [1Password JavaScript SDK](https://github.com/1Password/onepassword-sdk-js).

## Resources

### Item

The `Item` resource creates and manages items in 1Password vaults.

**File**: `item.ts`

**Features**:
- Create items in any vault
- Support for all item categories (Login, SecureNote, ApiCredentials, etc.)
- Custom fields with various field types
- Section organization
- Tags and notes
- Website autofill configuration
- Lifecycle management (create, update, delete)

## API Client

**File**: `api.ts`

The API client wraps the 1Password SDK's `createClient` function with sensible defaults and environment variable support.

### Authentication

The provider uses 1Password Service Account authentication:

1. Create a [Service Account](https://my.1password.com/developer-tools/infrastructure-secrets/serviceaccount/)
2. Set the `OP_SERVICE_ACCOUNT_TOKEN` environment variable
3. Or pass `serviceAccountToken` as a prop

### Client Options

| Option | Environment Variable | Description |
|--------|---------------------|-------------|
| `serviceAccountToken` | `OP_SERVICE_ACCOUNT_TOKEN` | Service Account Token for authentication |
| `integrationName` | - | Name to identify your integration (default: "Alchemy Integration") |
| `integrationVersion` | - | Version of your integration (default: "v1.0.0") |

## Usage Examples

### Basic Secure Note

```ts
import { Item } from "alchemy/1password";

const note = await Item("my-note", {
  vault: "vault-id",
  title: "My Secure Note",
  category: "SecureNote",
  notes: "Secret content",
});
```

### Login with Fields

```ts
import { Item } from "alchemy/1password";

const login = await Item("app-login", {
  vault: "vault-id",
  title: "Application Login",
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
      value: "secret-password",
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

### API Credential with Sections

```ts
import { Item } from "alchemy/1password";

const apiKey = await Item("api-key", {
  vault: "vault-id",
  title: "API Credentials",
  category: "ApiCredentials",
  fields: [
    {
      id: "api-key",
      title: "API Key",
      fieldType: "Concealed",
      value: "sk_live_xxx",
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

## Supported Item Categories

- Login
- SecureNote
- ApiCredentials
- Password
- CreditCard
- CryptoWallet
- Identity
- Document
- BankAccount
- Database
- DriverLicense
- Email
- MedicalRecord
- Membership
- OutdoorLicense
- Passport
- Rewards
- Router
- Server
- SshKey
- SocialSecurityNumber
- SoftwareLicense
- Person

## Supported Field Types

- Text - Plain text value
- Concealed - Hidden/password value
- Url - URL value
- Email - Email address
- Phone - Phone number
- Totp - One-time password
- Date - Date value
- MonthYear - Month/Year value
- Address - Address with components
- CreditCardType - Credit card type
- CreditCardNumber - Credit card number
- Reference - Reference to another item
- SshKey - SSH key
- Menu - Menu selection

## Links

- [1Password JavaScript SDK](https://github.com/1Password/onepassword-sdk-js)
- [1Password SDK Documentation](https://developer.1password.com/docs/sdks/)
- [Service Account Setup](https://developer.1password.com/docs/service-accounts/get-started/)
