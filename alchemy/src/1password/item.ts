import type { Context } from "../context.ts";
import { Resource, ResourceKind } from "../resource.ts";
import { Secret } from "../secret.ts";
import {
  createOnePasswordClient,
  type OnePasswordApiOptions,
} from "./api.ts";

/**
 * Field types supported by 1Password items
 */
export type ItemFieldType =
  | "Text"
  | "Concealed"
  | "CreditCardType"
  | "CreditCardNumber"
  | "Phone"
  | "Url"
  | "Totp"
  | "Email"
  | "Reference"
  | "SshKey"
  | "Menu"
  | "MonthYear"
  | "Address"
  | "Date"
  | "Unsupported";

/**
 * Item categories supported by 1Password
 */
export type ItemCategory =
  | "Login"
  | "SecureNote"
  | "CreditCard"
  | "CryptoWallet"
  | "Identity"
  | "Password"
  | "Document"
  | "ApiCredentials"
  | "BankAccount"
  | "Database"
  | "DriverLicense"
  | "Email"
  | "MedicalRecord"
  | "Membership"
  | "OutdoorLicense"
  | "Passport"
  | "Rewards"
  | "Router"
  | "Server"
  | "SshKey"
  | "SocialSecurityNumber"
  | "SoftwareLicense"
  | "Person"
  | "Unsupported";

/**
 * A field within a 1Password item
 */
export interface ItemField {
  /**
   * The field's unique ID
   */
  id: string;

  /**
   * The field's title/label
   */
  title: string;

  /**
   * The ID of the section containing the field (optional)
   */
  sectionId?: string;

  /**
   * The field's type
   */
  fieldType: ItemFieldType;

  /**
   * The field's value
   */
  value: string;
}

/**
 * A section within a 1Password item
 */
export interface ItemSection {
  /**
   * The section's unique ID
   */
  id: string;

  /**
   * The section's title
   */
  title: string;
}

/**
 * Website configuration for autofill
 */
export interface ItemWebsite {
  /**
   * The website URL
   */
  url: string;

  /**
   * The label for the website
   */
  label: string;

  /**
   * The auto-fill behavior
   */
  autofillBehavior: "AnywhereOnWebsite" | "ExactDomain" | "Never";
}

/**
 * Properties for creating or updating a 1Password Item
 */
export interface ItemProps extends OnePasswordApiOptions {
  /**
   * The vault where the item should be stored.
   * Can be a vault ID or a Vault resource reference.
   */
  vault: string;

  /**
   * The item's title
   */
  title: string;

  /**
   * The item's category
   * @default "SecureNote"
   */
  category?: ItemCategory;

  /**
   * The item's fields
   */
  fields?: ItemField[];

  /**
   * The item's sections
   */
  sections?: ItemSection[];

  /**
   * Notes associated with the item
   */
  notes?: string;

  /**
   * Tags to categorize the item
   */
  tags?: string[];

  /**
   * Websites for autofill (Login and Password categories)
   */
  websites?: ItemWebsite[];

  /**
   * Whether to delete the item when removed from Alchemy.
   * @default true
   */
  delete?: boolean;
}

/**
 * Output returned after 1Password Item creation/update
 */
export type Item = Omit<ItemProps, "delete" | "serviceAccountToken"> & {
  /**
   * The item's unique ID assigned by 1Password
   */
  id: string;

  /**
   * The ID of the vault containing the item
   */
  vaultId: string;

  /**
   * The item's title
   */
  title: string;

  /**
   * The item's category
   */
  category: ItemCategory;

  /**
   * The item's fields
   */
  fields: ItemField[];

  /**
   * The item's sections
   */
  sections: ItemSection[];

  /**
   * Notes associated with the item
   */
  notes: string;

  /**
   * Tags associated with the item
   */
  tags: string[];

  /**
   * Websites for autofill
   */
  websites: ItemWebsite[];

  /**
   * The item's version number
   */
  version: number;

  /**
   * When the item was created
   */
  createdAt: Date;

  /**
   * When the item was last updated
   */
  updatedAt: Date;
};

/**
 * Type guard to check if a resource is a 1Password Item
 */
export function isItem(resource: unknown): resource is Item {
  return (
    typeof resource === "object" &&
    resource !== null &&
    (resource as Record<string | symbol, unknown>)[ResourceKind] ===
      "1password::Item"
  );
}

/**
 * Creates and manages a 1Password item.
 *
 * 1Password items store sensitive information like passwords, API keys,
 * and other secrets in a secure vault.
 *
 * @example
 * ## Create a Login Item
 *
 * Create a login item with username and password fields:
 *
 * ```ts
 * import { Item } from "alchemy/1password";
 *
 * const login = await Item("my-login", {
 *   vault: "vault-id",
 *   title: "My App Login",
 *   category: "Login",
 *   fields: [
 *     {
 *       id: "username",
 *       title: "Username",
 *       fieldType: "Text",
 *       value: "myuser@example.com",
 *     },
 *     {
 *       id: "password",
 *       title: "Password",
 *       fieldType: "Concealed",
 *       value: "my-secret-password",
 *     },
 *   ],
 *   websites: [
 *     {
 *       url: "https://example.com",
 *       label: "Website",
 *       autofillBehavior: "AnywhereOnWebsite",
 *     },
 *   ],
 * });
 * ```
 *
 * @example
 * ## Create a Secure Note
 *
 * Create a secure note to store sensitive information:
 *
 * ```ts
 * import { Item } from "alchemy/1password";
 *
 * const note = await Item("my-note", {
 *   vault: "vault-id",
 *   title: "API Configuration",
 *   category: "SecureNote",
 *   notes: "This is my secret configuration data",
 *   tags: ["api", "config"],
 * });
 * ```
 *
 * @example
 * ## Create an API Credential
 *
 * Create an API credential item with custom fields:
 *
 * ```ts
 * import { Item } from "alchemy/1password";
 *
 * const apiCred = await Item("my-api-key", {
 *   vault: "vault-id",
 *   title: "Production API Key",
 *   category: "ApiCredentials",
 *   fields: [
 *     {
 *       id: "api-key",
 *       title: "API Key",
 *       fieldType: "Concealed",
 *       value: "sk_live_xxxxx",
 *     },
 *     {
 *       id: "api-url",
 *       title: "API URL",
 *       fieldType: "Url",
 *       value: "https://api.example.com/v1",
 *     },
 *   ],
 *   sections: [
 *     {
 *       id: "credentials",
 *       title: "Credentials",
 *     },
 *   ],
 * });
 * ```
 */
export const Item = Resource(
  "1password::Item",
  async function (
    this: Context<Item>,
    id: string,
    props: ItemProps,
  ): Promise<Item> {
    const client = await createOnePasswordClient(props);
    const sdk = await import("@1password/sdk");

    const vaultId = props.vault;
    const title = props.title;
    const category = props.category ?? "SecureNote";

    if (this.phase === "delete") {
      if (props.delete !== false && this.output?.id) {
        try {
          await client.items.delete(this.output.vaultId, this.output.id);
        } catch (error: unknown) {
          // Ignore 404 errors - item may already be deleted
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (!errorMessage.includes("not found")) {
            throw error;
          }
        }
      }
      return this.destroy();
    }

    // Map category to SDK enum
    const sdkCategory = sdk.ItemCategory[category] ?? sdk.ItemCategory.SecureNote;

    // Map field types to SDK enum
    const mapFieldType = (fieldType: ItemFieldType) => {
      return sdk.ItemFieldType[fieldType] ?? sdk.ItemFieldType.Text;
    };

    // Map autofill behavior to SDK enum
    const mapAutofillBehavior = (behavior: string) => {
      switch (behavior) {
        case "ExactDomain":
          return sdk.AutofillBehavior.ExactDomain;
        case "Never":
          return sdk.AutofillBehavior.Never;
        default:
          return sdk.AutofillBehavior.AnywhereOnWebsite;
      }
    };

    let result: Awaited<ReturnType<typeof client.items.get>>;

    if (this.phase === "update" && this.output?.id) {
      // Get the existing item to update
      const existingItem = await client.items.get(
        this.output.vaultId,
        this.output.id,
      );

      // Update the item fields
      const updatedItem = {
        ...existingItem,
        title,
        category: sdkCategory,
        fields:
          props.fields?.map((f) => ({
            id: f.id,
            title: f.title,
            sectionId: f.sectionId,
            fieldType: mapFieldType(f.fieldType),
            value: f.value,
          })) ?? existingItem.fields,
        sections:
          props.sections?.map((s) => ({
            id: s.id,
            title: s.title,
          })) ?? existingItem.sections,
        notes: props.notes ?? existingItem.notes,
        tags: props.tags ?? existingItem.tags,
        websites:
          props.websites?.map((w) => ({
            url: w.url,
            label: w.label,
            autofillBehavior: mapAutofillBehavior(w.autofillBehavior),
          })) ?? existingItem.websites,
      };

      result = await client.items.put(updatedItem);
    } else {
      // Create new item
      result = await client.items.create({
        vaultId,
        title,
        category: sdkCategory,
        fields: props.fields?.map((f) => ({
          id: f.id,
          title: f.title,
          sectionId: f.sectionId,
          fieldType: mapFieldType(f.fieldType),
          value: f.value,
        })),
        sections: props.sections?.map((s) => ({
          id: s.id,
          title: s.title,
        })),
        notes: props.notes,
        tags: props.tags,
        websites: props.websites?.map((w) => ({
          url: w.url,
          label: w.label,
          autofillBehavior: mapAutofillBehavior(w.autofillBehavior),
        })),
      });
    }

    // Map the result back to our output format
    return {
      id: result.id,
      vault: vaultId,
      vaultId: result.vaultId,
      title: result.title,
      category: result.category as ItemCategory,
      fields: result.fields.map((f) => ({
        id: f.id,
        title: f.title,
        sectionId: f.sectionId,
        fieldType: f.fieldType as ItemFieldType,
        value: f.value,
      })),
      sections: result.sections.map((s) => ({
        id: s.id,
        title: s.title,
      })),
      notes: result.notes,
      tags: result.tags,
      websites: result.websites.map((w) => ({
        url: w.url,
        label: w.label,
        autofillBehavior: w.autofillBehavior as ItemWebsite["autofillBehavior"],
      })),
      version: result.version,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      integrationName: props.integrationName,
      integrationVersion: props.integrationVersion,
    };
  },
);
