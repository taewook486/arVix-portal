// Test environment variables
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set (length: ' + process.env.OPENAI_API_KEY.length + ')' : 'NOT SET');
console.log('OPENAI_BASE_URL:', process.env.OPENAI_BASE_URL || 'NOT SET');

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

console.log('\nAfter dotenv:');
console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'Set (length: ' + process.env.OPENAI_API_KEY.length + ')' : 'NOT SET');
console.log('OPENAI_BASE_URL:', process.env.OPENAI_BASE_URL || 'NOT SET');
