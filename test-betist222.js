import { HttpResolver } from './dist/httpResolver.js';
import { loadConfig } from './dist/config.js';

async function test() {
  const config = await loadConfig();
  const resolver = new HttpResolver(config);
  
  const url = 'https://betist222tv.live';
  const probeText = ['const BASE_URL'];
  
  console.log('Testing:', url);
  console.log('Probe text:', probeText);
  console.log('---');
  
  try {
    const result = await resolver.resolve(url, true, undefined, probeText);
    
    console.log('Success:', result.success);
    console.log('Status:', result.statusCode);
    console.log('Final URL:', result.finalUrl);
    console.log('Final Host:', result.finalHost);
    console.log('Antibot:', result.antibotDetected);
    console.log('Error:', result.error);
    console.log('Body length:', result.finalBody?.length || 0);
    console.log('Has const BASE_URL:', result.finalBody?.includes('const BASE_URL') || false);
    
    if (result.finalBody) {
      const match = result.finalBody.match(/const BASE_URL[^;]+/);
      if (match) {
        console.log('Found:', match[0]);
      }
    }
    
    console.log('---');
    console.log('Redirect chain:', resolver.formatRedirectChain(result.redirectChain));
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

test();
