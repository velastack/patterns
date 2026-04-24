import { getBlogPosts } from "$lib/content";

export const prerender = true;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const GET = async ({ locals }) => {
  const { appName, appURL } = locals.meta;
  const posts = getBlogPosts();
  const siteURL = appURL.replace(/\/$/, "");
  const feedURL = `${siteURL}/blog/rss.xml`;
  const lastBuild = (
    posts[0]?.updatedDate ??
    posts[0]?.createdDate ??
    new Date()
  ).toUTCString();

  const items = posts
    .map((post) => {
      const link = `${siteURL}/blog/${post.slug}`;
      const pubDate = post.createdDate.toUTCString();
      const categories = (post.tags ?? [])
        .map((tag) => `    <category>${escapeXml(tag)}</category>`)
        .join("\n");
      const creator = post.author
        ? `    <dc:creator>${escapeXml(post.author.name)}</dc:creator>`
        : "";

      return [
        "  <item>",
        `    <title>${escapeXml(post.title)}</title>`,
        `    <link>${escapeXml(link)}</link>`,
        `    <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `    <description>${escapeXml(post.description)}</description>`,
        `    <pubDate>${pubDate}</pubDate>`,
        creator,
        categories,
        "  </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>${escapeXml(appName)}</title>
  <link>${escapeXml(`${siteURL}/blog`)}</link>
  <atom:link href="${escapeXml(feedURL)}" rel="self" type="application/rss+xml" />
  <description>${escapeXml(`Latest posts from ${appName}.`)}</description>
  <language>en</language>
  <lastBuildDate>${lastBuild}</lastBuildDate>
${items}
</channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "max-age=0, s-maxage=3600",
    },
  });
};
