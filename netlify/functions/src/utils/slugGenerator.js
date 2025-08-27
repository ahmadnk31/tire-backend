"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSlug = generateSlug;
exports.generateProductSlug = generateProductSlug;
exports.isValidSlug = isValidSlug;
function generateSlug(text) {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function generateProductSlug(brand, name, size, existingSlugs = []) {
    const baseSlug = generateSlug(`${brand}-${name}-${size}`);
    let slug = baseSlug;
    let counter = 1;
    while (existingSlugs.includes(slug)) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }
    return slug;
}
function isValidSlug(slug) {
    const slugRegex = /^[a-z0-9-]{3,255}$/;
    return slugRegex.test(slug) && !slug.startsWith('-') && !slug.endsWith('-');
}
