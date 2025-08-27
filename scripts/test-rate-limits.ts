import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';

async function testRateLimits() {
  console.log('🧪 Testing Rate Limits...\n');

  // Test 1: General API rate limit
  console.log('1️⃣ Testing General API Rate Limit:');
  let successCount = 0;
  let blockedCount = 0;
  
  for (let i = 0; i < 25; i++) {
    try {
      const response = await fetch(`${API_BASE}/products`);
      if (response.status === 200) {
        successCount++;
        process.stdout.write('.');
      } else if (response.status === 429) {
        blockedCount++;
        process.stdout.write('X');
      }
    } catch (error) {
      console.error('Error:', error);
    }
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
  }
  
  console.log(`\n   ✅ Successful requests: ${successCount}`);
  console.log(`   ❌ Blocked requests: ${blockedCount}\n`);

  // Test 2: Auth rate limit
  console.log('2️⃣ Testing Auth Rate Limit:');
  successCount = 0;
  blockedCount = 0;
  
  for (let i = 0; i < 15; i++) {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: 'wrong' })
      });
      if (response.status === 401) {
        successCount++;
        process.stdout.write('.');
      } else if (response.status === 429) {
        blockedCount++;
        process.stdout.write('X');
      }
    } catch (error) {
      console.error('Error:', error);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n   ✅ Successful requests: ${successCount}`);
  console.log(`   ❌ Blocked requests: ${blockedCount}\n`);

  // Test 3: Payment rate limit
  console.log('3️⃣ Testing Payment Rate Limit:');
  successCount = 0;
  blockedCount = 0;
  
  for (let i = 0; i < 15; i++) {
    try {
      const response = await fetch(`${API_BASE}/stripe/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cart: [] })
      });
      if (response.status === 400) {
        successCount++;
        process.stdout.write('.');
      } else if (response.status === 429) {
        blockedCount++;
        process.stdout.write('X');
      }
    } catch (error) {
      console.error('Error:', error);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n   ✅ Successful requests: ${successCount}`);
  console.log(`   ❌ Blocked requests: ${blockedCount}\n`);

  console.log('🎉 Rate limit testing completed!');
  console.log('\n💡 To see the effects of changing rate limits:');
  console.log('   1. Go to your admin dashboard');
  console.log('   2. Navigate to "Rate Limits"');
  console.log('   3. Change the settings');
  console.log('   4. Run this test again');
}

testRateLimits().catch(console.error);
