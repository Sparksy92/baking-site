import { getProductBySlug, getProducts, getPublicSettings, getCategories } from './db-service';

export async function apiFetch<T>(path: string): Promise<T> {
  const url = new URL(path, 'http://localhost');
  const pathname = url.pathname;

  if (pathname.startsWith('/api/products/')) {
    const slug = pathname.replace('/api/products/', '');
    const product = await getProductBySlug(slug);
    if (!product) throw new Error(`Product not found: ${slug}`);
    return product as unknown as T;
  }

  if (pathname === '/api/products') {
    const category = url.searchParams.get('category');
    const limit = parseInt(url.searchParams.get('limit') || '48', 10);
    const sort = url.searchParams.get('sort');
    const featured = url.searchParams.get('featured') === 'true';
    const data = await getProducts(category, limit, sort, featured);
    return data as unknown as T;
  }

  if (pathname === '/api/categories') {
    const categories = await getCategories();
    return categories as unknown as T;
  }

  if (pathname === '/api/settings/public') {
    const settings = await getPublicSettings();
    return settings as unknown as T;
  }

  throw new Error(`apiFetch unsupported server path: ${path}`);
}
