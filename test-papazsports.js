import { HttpResolver } from './dist/httpResolver.js';
import { readFileSync } from 'fs';
import { loadConfig } from './dist/config.js';

const config = loadConfig();
const resolver = new HttpResolver(config);

async function testPapazSports() {
  console.log('Testing: https://www.papazsports948.pro');
  console.log('Probe text: ["We don\'t use this website, yet!"]');
  console.log('---');
  
  const result = await resolver.resolve(
    'https://www.papazsports948.pro',
    false,
    {
      last_known_mirror: 'www.papazsports948.pro',
      accept_antibot: true
    },
    ["We don't use this website, yet!"]
  );
  
  console.log('Success:', result.success);
  console.log('Status:', result.statusCode);
  console.log('Final URL:', result.finalUrl);
  console.log('Final Host:', result.finalHost);
  console.log('Antibot:', result.antibotDetected);
  console.log('Error:', result.error);
  console.log('Skipped by:', result.skippedByText);
  console.log('Body length:', result.finalBody?.length || 0);
  
  if (result.finalBody) {
    const hasSkipText = result.finalBody.includes("We don't use this website, yet!");
    console.log('Has "We don\'t use this website, yet!":', hasSkipText);
    
    // Show first few lines of body
    const lines = result.finalBody.split('\n').slice(0, 10);
    console.log('---');
    console.log('First 10 lines:');
    lines.forEach((line, i) => console.log(`${i+1}: ${line.substring(0, 100)}`));
  }
  
  console.log('---');
  console.log('Redirect chain:');
  result.redirectChain.forEach(entry => {
    console.log(`${entry.url} (${entry.statusCode})`);
  });
}

testPapazSports().catch(console.error);
