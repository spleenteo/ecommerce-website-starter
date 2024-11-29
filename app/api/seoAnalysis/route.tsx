import { buildClient } from '@datocms/cma-client-node';
import got from 'got';
import { JSDOM } from 'jsdom';
import type { NextRequest } from 'next/server';

const findSlugAndPermalink = async (
  item: any,
  itemTypeApiKey: string,
  locale: string,
) => {
  switch (itemTypeApiKey) {
    case 'home':
      return [item.slug, `/${locale}/`];
    case 'showcase':
      return [item.slug, `/${locale}/showcase`];
    case 'store':
      return [item.slug, `/${locale}/stores`];
    case 'product':
      return [item.slug, `/${locale}/product/${item.slug}`];
    default:
      return [null, null];
  }
};

const headers = {
  'Content-Type': 'text/html',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET',
};

export async function OPTIONS(request: NextRequest) {
  return new Response('ok', {
    status: 200,
    headers,
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const itemId = searchParams.get('itemId');
  const itemTypeId = searchParams.get('itemTypeId');
  const itemTypeApiKey = searchParams.get('itemTypeApiKey');
  const locale = searchParams.get('locale');
  const sandboxEnvironmentId = searchParams.get('sandboxEnvironmentId');
  const token = searchParams.get('token');

  if (token !== process.env.SEO_SECRET_TOKEN)
    return new Response('Invalid token token', { status: 401, headers });

  if (
    !itemId ||
    !itemTypeApiKey ||
    !itemTypeId ||
    !locale ||
    !sandboxEnvironmentId
  ) {
    return new Response('Missing required parameters!', {
      status: 422,
      headers,
    });
  }

  const client = buildClient({
    apiToken: process.env.DATOCMS_READONLY_API_TOKEN || '',
    environment: sandboxEnvironmentId,
  });
  const item = await client.items.find(itemId);

  const [slug, permalink] = await findSlugAndPermalink(
    item,
    itemTypeApiKey,
    locale,
  );

  if (!permalink) {
    return new Response(
      `Don\'t know which route corresponds to record #${itemId} (model: ${itemTypeApiKey})!`,
      {
        status: 422,
        headers,
      },
    );
  }

  const baseUrl = (
    process.env.VERCEL_BRANCH_URL
      ? `https://${process.env.VERCEL_BRANCH_URL}`
      : process.env.URL
  ) as string;

  const { body } = await got(new URL(permalink, baseUrl).toString());

  const { document } = new JSDOM(body).window;
  const contentEl = document.querySelector('body');
  if (!contentEl)
    return new Response('No content found', { status: 422, headers });
  const pageContent = contentEl.innerHTML;
  const pageLocale =
    document.querySelector('html')?.getAttribute('lang') || 'en';
  const pageTitle = document.querySelector('title')?.textContent;
  const pageDescription = document
    .querySelector('meta[name="description"]')
    ?.getAttribute('content');

  return new Response(
    JSON.stringify({
      locale: pageLocale,
      slug,
      permalink,
      title: pageTitle,
      description: pageDescription,
      content: pageContent,
    }),
    { status: 200, headers },
  );
}
