const { db } = require('./dist/db');
const { products } = require('./dist/drizzle/schema');

async function debugSearchData() {
  try {
    console.log('🔍 Debugging search data...');
    
    // Get all products
    const allProducts = await db.select().from(products);
    console.log(`📊 Total products in database: ${allProducts.length}`);
    
    // Check for products with CSS classes or HTML entities
    const problematicProducts = allProducts.filter(product => {
      const fields = [product.name, product.brand, product.model, product.description];
      return fields.some(field => 
        field && typeof field === 'string' && (
          field.includes('&#') || 
          field.includes('<') || 
          field.includes('>') || 
          field.includes('class=') ||
          field.includes('className=') ||
          field.includes('.bg-') ||
          field.includes('.text-')
        )
      );
    });
    
    console.log(`🚨 Found ${problematicProducts.length} products with potential CSS/HTML content:`);
    
    problematicProducts.slice(0, 5).forEach((product, index) => {
      console.log(`\n${index + 1}. Product ID: ${product.id}`);
      console.log(`   Name: "${product.name}"`);
      console.log(`   Brand: "${product.brand}"`);
      console.log(`   Model: "${product.model}"`);
      console.log(`   Description: "${product.description}"`);
    });
    
    // Test search functionality
    console.log('\n🔍 Testing search for "Michelin"...');
    const searchQuery = 'Michelin';
    
    // Simulate the search process
    const searchResults = allProducts.filter(product => {
      const searchableFields = [
        product.name, 
        product.brand, 
        product.model, 
        product.sku, 
        product.size, 
        product.description
      ];
      
      return searchableFields.some(field => 
        field && typeof field === 'string' && 
        field.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
    
    console.log(`📋 Found ${searchResults.length} products matching "Michelin":`);
    
    searchResults.slice(0, 3).forEach((product, index) => {
      console.log(`\n${index + 1}. Product ID: ${product.id}`);
      console.log(`   Name: "${product.name}"`);
      console.log(`   Brand: "${product.brand}"`);
      console.log(`   Model: "${product.model}"`);
      console.log(`   Size: "${product.size}"`);
      
      // Check for HTML entities
      if (product.name && product.name.includes('&#')) {
        console.log(`   ⚠️  Name contains HTML entities: ${product.name}`);
      }
      if (product.brand && product.brand.includes('&#')) {
        console.log(`   ⚠️  Brand contains HTML entities: ${product.brand}`);
      }
    });
    
    // Test the cleaning function
    console.log('\n🧹 Testing data cleaning function...');
    
    const cleanProductData = (product) => {
      const cleaned = { ...product };
      
      const stringFields = ['name', 'brand', 'model', 'description', 'seasonType', 'tireType', 'loadIndex', 'speedRating', 'categoryName', 'categorySlug'];
      
      stringFields.forEach(field => {
        if (cleaned[field] && typeof cleaned[field] === 'string') {
          const original = cleaned[field];
          
          // Decode HTML entities first
          let cleanValue = cleaned[field]
            .replace(/&#x2F;/g, '/')
            .replace(/&#x2f;/g, '/')
            .replace(/&#47;/g, '/')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&apos;/g, "'");
          
          // Remove CSS classes and HTML content
          cleanValue = cleanValue
            .replace(/\.[a-zA-Z0-9_-]+/g, '')
            .replace(/[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, '')
            .replace(/class\s*=\s*["'][^"']*["']/g, '')
            .replace(/className\s*=\s*["'][^"']*["']/g, '')
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          
          cleaned[field] = cleanValue;
          
          if (original !== cleanValue) {
            console.log(`   🔄 Cleaned ${field}: "${original}" → "${cleanValue}"`);
          }
        }
      });
      
      return cleaned;
    };
    
    // Test cleaning on first few search results
    searchResults.slice(0, 2).forEach((product, index) => {
      console.log(`\n🧹 Cleaning product ${index + 1}:`);
      const cleaned = cleanProductData(product);
      console.log(`   Original name: "${product.name}"`);
      console.log(`   Cleaned name: "${cleaned.name}"`);
    });
    
  } catch (error) {
    console.error('❌ Error debugging search data:', error);
  } finally {
    process.exit(0);
  }
}

debugSearchData();
