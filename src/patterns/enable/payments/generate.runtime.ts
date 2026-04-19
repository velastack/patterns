import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import dedent from "dedent";
import type { File, Options, Result } from "../../../core/types";
import { languageFromPath } from "../../../core/util";
import {
  getMigrationFile,
  migrationDelay,
  withPocketbase,
} from "../../../runtime/pocketbase";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyNavUser } from "./modifies/modify-nav-user";
import { modifyUserSignup } from "./modifies/modify-user-signup";
import { modifyEnv, type EnvEdit } from "./modifies/modify-env";
import { createTestProductAndPrice } from "./runtime/stripe";

async function pushMigrationCreates(
  creates: File[],
  collectionName: string,
  action: "created" | "updated",
  options: Options,
) {
  await migrationDelay();
  const migrationFile = getMigrationFile(collectionName, action, options);
  if (!migrationFile) return;
  creates.push({
    path: migrationFile,
    language: languageFromPath(migrationFile),
    content: fs.readFileSync(migrationFile, "utf8"),
    status: "success",
  });
}

function paymentPageSnippet(priceId: string): string {
  return dedent`
    <script lang="ts">
      import PaymentButton from '$lib/components/payments/payment-button.svelte';
    </script>

    <section data-role="content">
      <PaymentButton priceId="${priceId}" />
    </section>
  `;
}

export async function generate(options: Options) {
  const { stripeSecretKey, stripePublishableKey, stripeWebhookSecret } =
    options.input as {
      stripeSecretKey: string;
      stripePublishableKey: string;
      stripeWebhookSecret: string;
    };

  const isAppMode = options.features.auth;
  const creates: File[] = [];
  const modifies: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  const internalJobSecret = randomBytes(16).toString("hex");
  const envEdits: EnvEdit[] = [
    { type: "comment", key: "Stripe credentials" },
    { type: "var", key: "STRIPE_SECRET_KEY", value: stripeSecretKey },
    {
      type: "var",
      key: "PUBLIC_STRIPE_PUBLISHABLE_KEY",
      value: stripePublishableKey,
    },
    { type: "var", key: "STRIPE_WEBHOOK_SECRET", value: stripeWebhookSecret },
    { type: "var", key: "INTERNAL_JOB_SECRET", value: internalJobSecret },
  ];

  const envPath = path.join(options.root, ".env");
  pushResult(modifyOutcomeToFile(envPath, modifyEnv(envPath, envEdits)));

  await withPocketbase(options.root, async (pb) => {
    await pb.collections.create({
      name: "stripe_products",
      type: "base",
      fields: [
        {
          name: "id",
          pattern: "^[a-zA-Z0-9_]+$",
          primaryKey: true,
          required: true,
          system: true,
          type: "text",
        },
        { name: "name", required: false, type: "text" },
        { name: "active", required: false, type: "text" },
        { name: "default_price", required: false, type: "text" },
        { name: "created", onCreate: true, onUpdate: false, type: "autodate" },
        { name: "updated", onCreate: true, onUpdate: true, type: "autodate" },
      ],
    });
    await pushMigrationCreates(creates, "stripe_products", "created", options);

    await pb.collections.create({
      name: "stripe_prices",
      type: "base",
      fields: [
        {
          name: "id",
          pattern: "^[a-zA-Z0-9_]+$",
          primaryKey: true,
          required: true,
          system: true,
          type: "text",
        },
        { name: "billing_scheme", required: false, type: "text" },
        { name: "currency", required: false, type: "text" },
        { name: "product", required: false, type: "text" },
        { name: "recurring", required: false, type: "text" },
        { name: "type", required: false, type: "text" },
        { name: "unit_amount", required: false, type: "number" },
        { name: "active", required: false, type: "bool" },
        { name: "created", onCreate: true, onUpdate: false, type: "autodate" },
        { name: "updated", onCreate: true, onUpdate: true, type: "autodate" },
      ],
    });
    await pushMigrationCreates(creates, "stripe_prices", "created", options);

    if (isAppMode) {
      const stripeCustomersCollection = await pb.collections.create({
        name: "stripe_customers",
        type: "base",
        fields: [
          {
            name: "id",
            pattern: "^[a-zA-Z0-9_]+$",
            primaryKey: true,
            required: true,
            system: true,
            type: "text",
          },
          {
            collectionId: "_pb_users_auth_",
            maxSelect: 1,
            minSelect: 0,
            name: "user",
            required: true,
            type: "relation",
          },
          {
            name: "created",
            onCreate: true,
            onUpdate: false,
            type: "autodate",
          },
          {
            name: "updated",
            onCreate: true,
            onUpdate: true,
            type: "autodate",
          },
        ],
      });
      await pushMigrationCreates(
        creates,
        "stripe_customers",
        "created",
        options,
      );

      const stripePaymentMethodsCollection = await pb.collections.create({
        name: "stripe_payment_methods",
        type: "base",
        fields: [
          {
            name: "id",
            pattern: "^[a-zA-Z0-9_]+$",
            primaryKey: true,
            required: true,
            system: true,
            type: "text",
          },
          { name: "brand", required: true, type: "text" },
          { name: "last4", required: true, type: "text" },
          { name: "exp_month", required: true, type: "number" },
          { name: "exp_year", required: true, type: "number" },
          {
            collectionId: stripeCustomersCollection.id,
            maxSelect: 1,
            minSelect: 0,
            name: "customer",
            required: true,
            type: "relation",
            cascadeDelete: true,
          },
          {
            name: "created",
            onCreate: true,
            onUpdate: false,
            type: "autodate",
          },
          {
            name: "updated",
            onCreate: true,
            onUpdate: true,
            type: "autodate",
          },
        ],
      });
      await pushMigrationCreates(
        creates,
        "stripe_payment_methods",
        "created",
        options,
      );

      await pb.collections.update("stripe_customers", {
        fields: [
          {
            name: "id",
            pattern: "^[a-zA-Z0-9_]+$",
            primaryKey: true,
            required: true,
            system: true,
            type: "text",
          },
          {
            collectionId: "_pb_users_auth_",
            maxSelect: 1,
            minSelect: 0,
            name: "user",
            required: true,
            type: "relation",
          },
          {
            collectionId: stripePaymentMethodsCollection.id,
            maxSelect: 1,
            minSelect: 0,
            name: "default_payment_method",
            required: false,
            type: "relation",
          },
          {
            name: "created",
            onCreate: true,
            onUpdate: false,
            type: "autodate",
          },
          {
            name: "updated",
            onCreate: true,
            onUpdate: true,
            type: "autodate",
          },
        ],
      });
      await pushMigrationCreates(
        creates,
        "stripe_customers",
        "updated",
        options,
      );

      await pb.collections.create({
        name: "transactions",
        type: "base",
        fields: [
          {
            autogeneratePattern: "[a-z0-9]{15}",
            max: 15,
            min: 15,
            name: "id",
            pattern: "^[a-z0-9]+$",
            primaryKey: true,
            required: true,
            system: true,
            type: "text",
          },
          { name: "stripe_payment_intent", required: true, type: "text" },
          { name: "amount", required: true, type: "number" },
          { name: "currency", required: true, type: "text" },
          { name: "last4", required: true, type: "text" },
          { name: "brand", required: true, type: "text" },
          { name: "created", required: true, type: "date" },
          { name: "stripe_charge", required: true, type: "text" },
          { name: "stripe_customer", required: true, type: "text" },
          {
            collectionId: "_pb_users_auth_",
            maxSelect: 1,
            minSelect: 0,
            name: "user",
            required: true,
            type: "relation",
          },
          { name: "receipt_url", required: true, type: "url" },
        ],
      });
      await pushMigrationCreates(creates, "transactions", "created", options);
    }
  });

  const { product, price } = await createTestProductAndPrice(stripeSecretKey);

  await withPocketbase(options.root, async (pb) => {
    await pb.collection("stripe_products").create({
      id: product.id,
      name: product.name,
      active: product.active,
      default_price: product.default_price,
    });

    await pb.collection("stripe_prices").create({
      id: price.id,
      billing_scheme: price.billing_scheme,
      currency: price.currency,
      product: price.product,
      recurring: price.recurring,
      type: price.type,
      unit_amount: price.unit_amount,
      active: price.active,
    });
  });

  creates.push({
    path: "src/routes/(public)/payment/+page.svelte",
    language: "svelte",
    content: paymentPageSnippet(price.id),
    status: "success",
  });

  if (isAppMode) {
    const navUserPath = path.join(
      options.root,
      "src",
      "lib",
      "components",
      "nav-user.svelte",
    );
    pushResult(modifyOutcomeToFile(navUserPath, modifyNavUser(navUserPath)));

    const userSignupPath = path.join(
      options.root,
      "src",
      "routes",
      "(public)",
      "signup",
      "+page.server.ts",
    );
    pushResult(
      modifyOutcomeToFile(userSignupPath, modifyUserSignup(userSignupPath)),
    );
  }

  return {
    creates,
    modifies,
    deletes: [],
    components: [],
    packages: [],
    collections: [],
    collectionPatches: [],
  } satisfies Result;
}
