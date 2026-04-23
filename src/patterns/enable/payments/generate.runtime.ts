import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import dedent from "dedent";
import type { File, Options, Result } from "../../../core/types";
import { getLogger } from "../../../core/logger";
import { languageFromPath } from "../../../core/util";
import {
  getMigrationFile,
  migrationDelay,
  withPocketbase,
} from "../../../runtime/pocketbase";
import { createCollectionIdempotent } from "../../../runtime/collections";
import { modifyOutcomeToFile } from "../../../runtime/modify-file";
import { modifyNavUser } from "./modifies/modify-nav-user";
import { modifyUserSignup } from "./modifies/modify-user-signup";
import { modifyEnv, type EnvEdit } from "./modifies/modify-env";
import {
  createTestProductAndPrice,
  getProductAndPriceById,
  syncUsersToStripeCustomers,
} from "./runtime/stripe";

async function pushMigrationCreates(
  creates: File[],
  collectionName: string,
  action: "created" | "updated",
  options: Options,
  created = true,
) {
  if (!created) return;
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
  const {
    stripeSecretKey,
    stripePublishableKey,
    stripeWebhookSecret,
    stripePriceId,
  } = options.input as {
    stripeSecretKey: string;
    stripePublishableKey: string;
    stripeWebhookSecret: string;
    stripePriceId?: string;
  };

  const isAppMode = options.features.auth;
  const logger = getLogger(options);
  const creates: File[] = [];
  const modifies: File[] = [];
  const pushResult = (file: File | null) => {
    if (file) modifies.push(file);
  };

  logger.info("Writing Stripe credentials to .env");
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
    const create = (spec: Parameters<typeof createCollectionIdempotent>[1]) =>
      createCollectionIdempotent(pb, spec, logger);

    logger.info("Creating stripe_products collection");
    const productsResult = await create({
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
    await pushMigrationCreates(
      creates,
      "stripe_products",
      "created",
      options,
      productsResult.created,
    );

    logger.info("Creating stripe_prices collection");
    const pricesResult = await create({
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
        { name: "recurring", required: false, type: "json" },
        { name: "type", required: false, type: "text" },
        { name: "unit_amount", required: false, type: "number" },
        { name: "active", required: false, type: "bool" },
        { name: "created", onCreate: true, onUpdate: false, type: "autodate" },
        { name: "updated", onCreate: true, onUpdate: true, type: "autodate" },
      ],
    });
    await pushMigrationCreates(
      creates,
      "stripe_prices",
      "created",
      options,
      pricesResult.created,
    );

    if (isAppMode) {
      logger.info("Creating stripe_customers collection");
      const customersResult = await create({
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
      const stripeCustomersCollection = customersResult.collection;
      await pushMigrationCreates(
        creates,
        "stripe_customers",
        "created",
        options,
        customersResult.created,
      );

      logger.info("Creating stripe_payment_methods collection");
      const paymentMethodsResult = await create({
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
      const stripePaymentMethodsCollection = paymentMethodsResult.collection;
      await pushMigrationCreates(
        creates,
        "stripe_payment_methods",
        "created",
        options,
        paymentMethodsResult.created,
      );

      logger.info("Linking default_payment_method on stripe_customers");
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

      logger.info("Creating transactions collection");
      const transactionsResult = await create({
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
      await pushMigrationCreates(
        creates,
        "transactions",
        "created",
        options,
        transactionsResult.created,
      );

      logger.info("Syncing existing PocketBase users to Stripe customers");
      const syncResult = await syncUsersToStripeCustomers(
        pb,
        stripeSecretKey,
        logger,
      );
      logger.info(
        `Synced ${syncResult.total} users (created ${syncResult.created}, reused ${syncResult.reused}, skipped ${syncResult.skipped})`,
      );
    }
  });

  if (stripePriceId) {
    logger.info(`Fetching Stripe product/price ${stripePriceId}`);
  } else {
    logger.info("Creating test Stripe product and price");
  }
  const { product, price, existing } = stripePriceId
    ? await getProductAndPriceById(stripeSecretKey, stripePriceId)
    : await createTestProductAndPrice(stripeSecretKey);

  if (existing) {
    logger.info("Stripe product/price already exists, skipping creation");
  }

  logger.info("Seeding Stripe product/price records");
  await withPocketbase(options.root, async (pb) => {
    try {
      await pb.collection("stripe_products").getOne(product.id);
    } catch (error) {
      await pb.collection("stripe_products").create({
        id: product.id,
        name: product.name,
        active: product.active,
        default_price: product.default_price,
      });
    }

    try {
      await pb.collection("stripe_prices").getOne(price.id);
    } catch (error) {
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
    }
  });

  logger.info("Creating payment +page.svelte");
  creates.push({
    path: "src/routes/(public)/payment/+page.svelte",
    language: "svelte",
    content: paymentPageSnippet(price.id),
    status: "success",
  });

  if (isAppMode) {
    logger.info("Modifying nav-user.svelte");
    const navUserPath = path.join(
      options.root,
      "src",
      "lib",
      "components",
      "nav-user.svelte",
    );
    pushResult(modifyOutcomeToFile(navUserPath, modifyNavUser(navUserPath)));

    logger.info("Modifying signup +page.server.ts");
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
    collectionDrops: [],
  } satisfies Result;
}
