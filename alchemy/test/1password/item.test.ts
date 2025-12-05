import { describe, expect } from "vitest";
import { alchemy } from "../../src/alchemy.ts";
import { destroy } from "../../src/destroy.ts";
import { createOnePasswordClient } from "../../src/1password/api.ts";
import { Item, ItemRef, isItem } from "../../src/1password/item.ts";
import { BRANCH_PREFIX } from "../util.ts";
// must import this or else alchemy.test won't exist
import "../../src/test/vitest.ts";

const test = alchemy.test(import.meta, {
  prefix: BRANCH_PREFIX,
});

// Get vault ID from environment
const vaultId = process.env.OP_VAULT_ID;

describe("1Password Item Resource", () => {
  // Use BRANCH_PREFIX for deterministic, non-colliding resource names
  const testId = `${BRANCH_PREFIX}-test-1password-item`;

  test.skipIf(!process.env.OP_SERVICE_ACCOUNT_TOKEN || !vaultId)(
    "create, update, and delete 1password item",
    async (scope) => {
      let item: Item | undefined;
      // Create client once and reuse
      const client = await createOnePasswordClient();
      try {
        // Create a test 1Password item - Secure Note
        const itemTitle = `Test Item ${testId}`;
        item = await Item(testId, {
          vault: vaultId!,
          title: itemTitle,
          category: "SecureNote",
          notes: "This is a test note",
          tags: ["test", "alchemy"],
        });

        expect(item.id).toBeTruthy();
        expect(item.title).toEqual(itemTitle);
        expect(item.category).toEqual("SecureNote");
        expect(item.notes).toEqual("This is a test note");
        expect(item.tags).toContain("test");
        expect(item.tags).toContain("alchemy");
        expect(item.vaultId).toEqual(vaultId);
        expect(item.createdAt).toBeInstanceOf(Date);
        expect(item.updatedAt).toBeInstanceOf(Date);

        // Test type guard
        expect(isItem(item)).toBe(true);
        expect(isItem({})).toBe(false);
        expect(isItem(null)).toBe(false);

        // Verify item was created by querying the API directly
        const fetchedItem = await client.items.get(item.vaultId, item.id);
        expect(fetchedItem.title).toEqual(itemTitle);

        // Update the item
        const updatedTitle = `${itemTitle} Updated`;
        item = await Item(testId, {
          vault: vaultId!,
          title: updatedTitle,
          category: "SecureNote",
          notes: "This is an updated test note",
          tags: ["test", "alchemy", "updated"],
        });

        expect(item.id).toBeTruthy();
        expect(item.title).toEqual(updatedTitle);
        expect(item.notes).toEqual("This is an updated test note");
        expect(item.tags).toContain("updated");

        // Verify item was updated
        const updatedFetchedItem = await client.items.get(
          item.vaultId,
          item.id,
        );
        expect(updatedFetchedItem.title).toEqual(updatedTitle);
      } finally {
        // Always clean up, even if test assertions fail
        await destroy(scope);

        // Verify item was deleted
        if (item?.id) {
          try {
            await client.items.get(item.vaultId, item.id);
            // If we get here, the item wasn't deleted
            expect.fail("Item should have been deleted");
          } catch (error: unknown) {
            // Expected - item should not exist
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            expect(errorMessage).toMatch(/not found|does not exist/i);
          }
        }
      }
    },
  );

  test.skipIf(!process.env.OP_SERVICE_ACCOUNT_TOKEN || !vaultId)(
    "create login item with fields",
    async (scope) => {
      let item: Item | undefined;
      try {
        const itemTitle = `Test Login ${testId}`;
        item = await Item(`${testId}-login`, {
          vault: vaultId!,
          title: itemTitle,
          category: "Login",
          fields: [
            {
              id: "username",
              title: "Username",
              fieldType: "Text",
              value: "testuser@example.com",
            },
            {
              id: "password",
              title: "Password",
              fieldType: "Concealed",
              value: "test-password-123",
            },
          ],
          websites: [
            {
              url: "https://example.com",
              label: "Website",
              autofillBehavior: "AnywhereOnWebsite",
            },
          ],
        });

        expect(item.id).toBeTruthy();
        expect(item.title).toEqual(itemTitle);
        expect(item.category).toEqual("Login");
        expect(item.fields).toHaveLength(2);

        const usernameField = item.fields.find((f) => f.id === "username");
        expect(usernameField?.value).toEqual("testuser@example.com");

        const passwordField = item.fields.find((f) => f.id === "password");
        expect(passwordField?.fieldType).toEqual("Concealed");

        expect(item.websites).toHaveLength(1);
        expect(item.websites[0].url).toEqual("https://example.com");
      } finally {
        await destroy(scope);
      }
    },
  );

  test.skipIf(!process.env.OP_SERVICE_ACCOUNT_TOKEN || !vaultId)(
    "does not delete item when delete is false",
    async (scope) => {
      let item: Item | undefined;
      // Create client once and reuse
      const client = await createOnePasswordClient();
      try {
        const itemTitle = `Test No Delete ${testId}`;
        item = await Item(`${testId}-no-delete`, {
          vault: vaultId!,
          title: itemTitle,
          category: "SecureNote",
          delete: false,
        });

        expect(item.id).toBeTruthy();
      } finally {
        await destroy(scope);

        if (item?.id) {
          // Verify item still exists
          const fetchedItem = await client.items.get(item.vaultId, item.id);
          expect(fetchedItem.id).toEqual(item.id);

          // Manually delete the item for cleanup
          await client.items.delete(item.vaultId, item.id);
        }
      }
    },
  );
});

describe("1Password ItemRef Function", () => {
  // Use BRANCH_PREFIX for deterministic, non-colliding resource names
  const testId = `${BRANCH_PREFIX}-test-1password-itemref`;

  test.skipIf(!process.env.OP_SERVICE_ACCOUNT_TOKEN || !vaultId)(
    "fetch existing item by vault ID and item ID",
    async () => {
      // Create client to create an item directly via API
      const client = await createOnePasswordClient();
      const sdk = await import("@1password/sdk");

      // Create a test item via the API directly
      const itemTitle = `Test ItemRef ${testId}`;
      const createdItem = await client.items.create({
        vaultId: vaultId!,
        title: itemTitle,
        category: sdk.ItemCategory.SecureNote,
        notes: "This is a test note for ItemRef",
        tags: ["test", "itemref"],
      });

      try {
        // Use ItemRef to fetch the existing item
        const fetchedItem = await ItemRef({
          vaultId: vaultId!,
          itemId: createdItem.id,
        });

        // Verify the fetched item matches the created item
        expect(fetchedItem.id).toEqual(createdItem.id);
        expect(fetchedItem.vaultId).toEqual(vaultId);
        expect(fetchedItem.title).toEqual(itemTitle);
        expect(fetchedItem.category).toEqual("SecureNote");
        expect(fetchedItem.notes).toEqual("This is a test note for ItemRef");
        expect(fetchedItem.tags).toContain("test");
        expect(fetchedItem.tags).toContain("itemref");
        expect(fetchedItem.version).toBeTruthy();
        expect(fetchedItem.createdAt).toBeInstanceOf(Date);
        expect(fetchedItem.updatedAt).toBeInstanceOf(Date);

        // Verify arrays are returned correctly
        expect(fetchedItem.fields).toBeInstanceOf(Array);
        expect(fetchedItem.sections).toBeInstanceOf(Array);
        expect(fetchedItem.websites).toBeInstanceOf(Array);
      } finally {
        // Clean up - delete the item we created
        await client.items.delete(vaultId!, createdItem.id);
      }
    },
  );

  test.skipIf(!process.env.OP_SERVICE_ACCOUNT_TOKEN || !vaultId)(
    "fetch login item with fields and websites",
    async () => {
      // Create client to create an item directly via API
      const client = await createOnePasswordClient();
      const sdk = await import("@1password/sdk");

      // Create a login item via the API directly
      const itemTitle = `Test Login ItemRef ${testId}`;
      const createdItem = await client.items.create({
        vaultId: vaultId!,
        title: itemTitle,
        category: sdk.ItemCategory.Login,
        fields: [
          {
            id: "username",
            title: "Username",
            fieldType: sdk.ItemFieldType.Text,
            value: "testuser@example.com",
          },
          {
            id: "password",
            title: "Password",
            fieldType: sdk.ItemFieldType.Concealed,
            value: "test-password-456",
          },
        ],
        websites: [
          {
            url: "https://test.example.com",
            label: "Test Site",
            autofillBehavior: sdk.AutofillBehavior.AnywhereOnWebsite,
          },
        ],
      });

      try {
        // Use ItemRef to fetch the existing item
        const fetchedItem = await ItemRef({
          vaultId: vaultId!,
          itemId: createdItem.id,
        });

        // Verify the fetched item matches the created item
        expect(fetchedItem.id).toEqual(createdItem.id);
        expect(fetchedItem.title).toEqual(itemTitle);
        expect(fetchedItem.category).toEqual("Login");

        // Verify fields were fetched correctly
        expect(fetchedItem.fields.length).toBeGreaterThanOrEqual(2);
        const usernameField = fetchedItem.fields.find(
          (f) => f.id === "username",
        );
        expect(usernameField?.value).toEqual("testuser@example.com");
        expect(usernameField?.fieldType).toEqual("Text");

        const passwordField = fetchedItem.fields.find(
          (f) => f.id === "password",
        );
        expect(passwordField?.fieldType).toEqual("Concealed");

        // Verify websites were fetched correctly
        expect(fetchedItem.websites.length).toBeGreaterThanOrEqual(1);
        const website = fetchedItem.websites.find(
          (w) => w.url === "https://test.example.com",
        );
        expect(website?.label).toEqual("Test Site");
        expect(website?.autofillBehavior).toEqual("AnywhereOnWebsite");
      } finally {
        // Clean up - delete the item we created
        await client.items.delete(vaultId!, createdItem.id);
      }
    },
  );
});
