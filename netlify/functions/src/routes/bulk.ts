import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { db } from '../db/index';
import { products, users, categories } from '../db/schema';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB limit
	},
	fileFilter: (req, file, cb) => {
		if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
			cb(null, true);
		} else {
			cb(new Error('Only CSV files are allowed'));
		}
	},
});

// Bulk upload endpoint
router.post('/upload-file', upload.single('file'), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({ error: 'No file uploaded' });
		}
		const type = req.body.type || req.query.type || 'product';
		const results: any[] = [];
		const errors: string[] = [];
		let lineNumber = 1;
		const stream = Readable.from(req.file.buffer);

		await new Promise((resolve, reject) => {
			stream
				.pipe(csv())
				.on('data', (data) => {
					lineNumber++;
					if (type === 'product') {
						// Validate required fields for product
						const requiredFields = ['name', 'brand', 'model', 'size', 'price', 'sku'];
						const missingFields = requiredFields.filter(field => !data[field] || data[field].trim() === '');
						if (missingFields.length > 0) {
							errors.push(`Line ${lineNumber}: Missing required fields: ${missingFields.join(', ')}`);
							return;
						}
						const productData = {
							name: data.name?.trim(),
							brand: data.brand?.trim(),
							model: data.model?.trim(),
							size: data.size?.trim(),
							price: parseFloat(data.price),
							comparePrice: data.comparePrice ? parseFloat(data.comparePrice) : null,
							stock: data.stock ? parseInt(data.stock) : 0,
							lowStockThreshold: data.lowStockThreshold ? parseInt(data.lowStockThreshold) : 10,
							sku: data.sku?.trim(),
							description: data.description?.trim() || null,
							status: data.status?.trim() || 'draft',
							featured: data.featured === 'true' || data.featured === '1',
							seoTitle: data.seoTitle?.trim() || null,
							seoDescription: data.seoDescription?.trim() || null,
							features: data.features ? JSON.parse(data.features) : null,
							specifications: data.specifications ? JSON.parse(data.specifications) : null,
							images: data.images ? JSON.parse(data.images) : null,
							tags: data.tags ? JSON.parse(data.tags) : null,
						};
						if (isNaN(productData.price) || productData.price <= 0) {
							errors.push(`Line ${lineNumber}: Invalid price value`);
							return;
						}
						if (!/^[A-Za-z0-9-_]+$/.test(productData.sku)) {
							errors.push(`Line ${lineNumber}: Invalid SKU format (only letters, numbers, hyphens, and underscores allowed)`);
							return;
						}
						results.push(productData);
					} else if (type === 'user') {
						// Validate required fields for user
						const requiredFields = ['name', 'email', 'password'];
						const missingFields = requiredFields.filter(field => !data[field] || data[field].trim() === '');
						if (missingFields.length > 0) {
							errors.push(`Line ${lineNumber}: Missing required fields: ${missingFields.join(', ')}`);
							return;
						}
						const userData = {
							name: data.name?.trim(),
							email: data.email?.trim(),
							password: data.password?.trim(),
							role: data.role?.trim() || 'user',
							phone: data.phone?.trim() || null,
							isActive: data.isActive === 'true' || data.isActive === '1',
						};
						results.push(userData);
					} else if (type === 'category') {
						// Validate required fields for category
						const requiredFields = ['name', 'slug'];
						const missingFields = requiredFields.filter(field => !data[field] || data[field].trim() === '');
						if (missingFields.length > 0) {
							errors.push(`Line ${lineNumber}: Missing required fields: ${missingFields.join(', ')}`);
							return;
						}
						const categoryData = {
							name: data.name?.trim(),
							slug: data.slug?.trim(),
							description: data.description?.trim() || null,
							icon: data.icon?.trim() || null,
							image: data.image?.trim() || null,
							isActive: data.isActive === 'true' || data.isActive === '1',
							sortOrder: data.sortOrder ? parseInt(data.sortOrder) : 0,
							parentId: data.parentId ? parseInt(data.parentId) : null,
						};
						results.push(categoryData);
					}
				})
				.on('end', () => {
					resolve(true);
				})
				.on('error', (error) => {
					reject(error);
				});
		});

		if (errors.length > 0) {
			return res.status(400).json({
				error: 'Validation errors found',
				errors: errors,
				totalRows: lineNumber - 1,
				validRows: results.length,
			});
		}

		// Insert into database
		const inserted = [];
		const dbErrors = [];
		for (let i = 0; i < results.length; i++) {
			try {
				let insertedRow;
				if (type === 'product') {
					[insertedRow] = await db.insert(products).values(results[i]).returning();
				} else if (type === 'user') {
					[insertedRow] = await db.insert(users).values(results[i]).returning();
				} else if (type === 'category') {
					[insertedRow] = await db.insert(categories).values(results[i]).returning();
				}
				inserted.push(insertedRow);
			} catch (dbError: any) {
				if (type === 'product' && dbError.code === '23505') {
					dbErrors.push(`SKU "${results[i].sku}" already exists`);
				} else if (type === 'user' && dbError.code === '23505') {
					dbErrors.push(`Email "${results[i].email}" already exists`);
				} else if (type === 'category' && dbError.code === '23505') {
					dbErrors.push(`Slug "${results[i].slug}" already exists`);
				} else {
					dbErrors.push(`Error inserting row: ${dbError.message}`);
				}
			}
		}

		res.json({
			message: 'Bulk upload completed',
			totalRows: results.length,
			successfulInserts: inserted.length,
			errors: dbErrors,
			inserted: inserted,
		});

	} catch (error: any) {
		console.error('Bulk upload error:', error);
		res.status(500).json({ error: 'Internal server error during bulk upload' });
	}
});

// Get CSV template
router.get('/template', (req, res) => {
	const csvHeader = `name,brand,model,size,price,comparePrice,stock,lowStockThreshold,sku,description,status,featured,seoTitle,seoDescription,features,specifications,images,tags\n"Sample Tire","Michelin","Pilot Sport","225/45R17",199.99,249.99,50,10,"MICH-PS-225-45R17","High-performance summer tire","published",true,"Michelin Pilot Sport 225/45R17","Premium summer tire for sports cars","[\\"High grip\\",\\"Low noise\\"]","{\\"compound\\":\\"Summer\\",\\"sidewall\\":\\"XL\\"}","[\\"https://example.com/tire1.jpg\\"]","[\\"summer\\",\\"performance\\"]"`;
  
	res.setHeader('Content-Type', 'text/csv');
	res.setHeader('Content-Disposition', 'attachment; filename="products_template.csv"');
	res.send(csvHeader);
});

export default router;
