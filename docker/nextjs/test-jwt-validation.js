#!/usr/bin/env node

// Test JWT validation with both secrets to identify the issue
// Date: 2026-01-12

const { SignJWT, jwtVerify } = require('jose');

const OLD_SECRET = 'your-super-secret-jwt-key-change-in-production-2024';
const NEW_SECRET = 'your-super-secret-jwt-key-change-in-production';

// Sample JWT token from the network request
const TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uSWQiOiJzZXNzXzE3NjgyMDk2NTQ4OTNfNXRwcWVrZ2NkbmoiLCJ1c2VySWQiOiJ0ZXN0dXNlciIsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3NjgyMDk2NTUsImV4cCI6MTc2ODI5NjA1NH0.zB58eVLjmBBWEqWw7ZgwncLMHeJFhdN2cqvYfUOSqlY';

async function testJWTValidation() {
  console.log('🔍 Testing JWT validation with different secrets...\n');
  
  // Test with OLD secret (session API was using this)
  console.log('1. Testing with OLD secret (session API):');
  console.log(`   Secret: "${OLD_SECRET}"`);
  try {
    const oldSecretBytes = new TextEncoder().encode(OLD_SECRET);
    const { payload } = await jwtVerify(TOKEN, oldSecretBytes);
    console.log('   ✅ SUCCESS - Token is valid with OLD secret');
    console.log('   Payload:', payload);
  } catch (error) {
    console.log('   ❌ FAILED - Token is invalid with OLD secret');
    console.log('   Error:', error.message);
  }
  
  console.log('\n2. Testing with NEW secret (session manager):');
  console.log(`   Secret: "${NEW_SECRET}"`);
  try {
    const newSecretBytes = new TextEncoder().encode(NEW_SECRET);
    const { payload } = await jwtVerify(TOKEN, newSecretBytes);
    console.log('   ✅ SUCCESS - Token is valid with NEW secret');
    console.log('   Payload:', payload);
  } catch (error) {
    console.log('   ❌ FAILED - Token is invalid with NEW secret');
    console.log('   Error:', error.message);
  }
  
  console.log('\n📋 Analysis:');
  console.log('- The signin API (session manager) creates tokens with NEW secret');
  console.log('- The session API should validate tokens with the SAME secret');
  console.log('- If token is valid with NEW secret but session API fails,');
  console.log('  it means the session API is still using the OLD secret');
  console.log('- This indicates the deployment did not update the session API code');
}

testJWTValidation().catch(console.error);