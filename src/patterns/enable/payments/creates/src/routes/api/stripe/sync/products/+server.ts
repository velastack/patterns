import { json } from "@sveltejs/kit";
import stripe from "$lib/stripe";
import { env } from "$env/dynamic/private";

export const POST = async ({ request, locals }) => {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${env.INTERNAL_JOB_SECRET}`) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const products = await stripe.products.list();

  for (const product of products.data) {
    try {
      await locals.admin
        .collection("stripe_products")
        .getFirstListItem(`id = "${product.id}"`);
      continue;
    } catch {}

    await locals.admin.collection("stripe_products").create({
      id: product.id,
      name: product.name,
      active: product.active,
      default_price: product.default_price,
    });
  }

  console.log("Products synced");
  return json({ message: "Products synced" });
};
