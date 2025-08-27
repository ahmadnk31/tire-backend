/**
 * Generate a URL-friendly slug from a string
 * @param text - The text to convert to a slug
 * @returns A URL-friendly slug
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Generate a unique slug for a product
 * @param brand - Product brand
 * @param name - Product name
 * @param size - Product size
 * @param existingSlugs - Array of existing slugs to avoid conflicts
 * @returns A unique slug
 */
export function generateProductSlug(
  brand: string, 
  name: string, 
  size: string, 
  existingSlugs: string[] = []
): string {
  const baseSlug = generateSlug(`${brand}-${name}-${size}`);
  let slug = baseSlug;
  let counter = 1;

  // If slug already exists, append a number
  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}

/**
 * Validate if a slug is valid
 * @param slug - The slug to validate
 * @returns True if valid, false otherwise
 */
export function isValidSlug(slug: string): boolean {
  // Slug should be 3-255 characters, contain only lowercase letters, numbers, and hyphens
  const slugRegex = /^[a-z0-9-]{3,255}$/;
  return slugRegex.test(slug) && !slug.startsWith('-') && !slug.endsWith('-');
}
