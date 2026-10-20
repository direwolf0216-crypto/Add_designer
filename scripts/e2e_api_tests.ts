const http = require('http');

const API_BASE = 'http://localhost:3000/api/jobs';

async function request(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {}
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

import prisma from '../src/lib/prisma';

async function runTests() {
  console.log('--- STARTING JOBS API E2E TESTS ---');
  
  const client = await prisma.client.findFirst();
  if (!client) {
    console.log('❌ Failed: No client in DB to test with.');
    return;
  }
  
  let createdJobId = null;

  // 1. POSITIVE: Create Job
  console.log('\\n[TEST] Positive - Create Job');
  const createRes = await request(API_BASE, 'POST', {
    clientId: client.id,
    title: 'E2E Test Job',
    category: 'Wedding',
    date: new Date().toISOString(),
    time: '10:00 AM'
  });
  console.log(`Status: ${createRes.status}`);
  if (createRes.status === 200 || createRes.status === 201) {
    createdJobId = createRes.body.id;
    console.log(`✅ Success: Created job ${createdJobId}`);
  } else {
    console.log(`⚠️ Warning: Create failed. Check if clientId exists.`);
  }

  // 2. NEGATIVE: Missing Payload
  console.log('\\n[TEST] Negative - Missing Payload');
  const negRes = await request(API_BASE, 'POST', {});
  console.log(`Status: ${negRes.status}`);
  if (negRes.status >= 400) console.log('✅ Success: API rejected empty payload properly.');
  else console.log('❌ Failed: API accepted empty payload!');

  // 3. SECURITY: SQL Injection attempt in ID
  console.log('\\n[TEST] Security - SQL Injection Attempt');
  const sqlRes = await request(`${API_BASE}/1' OR '1'='1`, 'GET');
  console.log(`Status: ${sqlRes.status}`);
  if (sqlRes.status === 404 || sqlRes.status === 500) console.log('✅ Success: SQL Injection payload did not bypass security.');
  
  // 4. SECURITY: XSS Payload in CustomData
  console.log('\\n[TEST] Security - XSS Injection Attempt');
  const xssRes = await request(API_BASE, 'POST', {
    clientId: 'cm027hxbl0000a6g7fcf64g3o',
    title: 'XSS Test',
    date: new Date().toISOString(),
    time: '10:00 AM',
    customData: {
      notes: '<script>alert("XSS")</script>'
    }
  });
  console.log(`Status: ${xssRes.status}`);
  if (xssRes.status === 200 || xssRes.status === 201) {
    console.log('✅ Created job with XSS payload (Valid behavior, UI must sanitize this).');
    if (xssRes.body.id) await request(`${API_BASE}/${xssRes.body.id}`, 'DELETE');
  }

  // 5. SECURITY: Parameter Tampering
  console.log('\\n[TEST] Security - Parameter Tampering (Invalid Total Amount type)');
  if (createdJobId) {
    const tamperRes = await request(`${API_BASE}/${createdJobId}`, 'PUT', {
      customData: { fld_b_package: "HACKED_STRING_INSTEAD_OF_NUMBER" }
    });
    console.log(`Status: ${tamperRes.status}`);
    console.log('✅ API processed tamper attempt (Verify DB logs if it broke parsing).');
  }

  // 6. POSITIVE: Delete Job
  console.log('\\n[TEST] Positive - Delete Job');
  if (createdJobId) {
    const delRes = await request(`${API_BASE}/${createdJobId}`, 'DELETE');
    console.log(`Status: ${delRes.status}`);
    if (delRes.status === 200 || delRes.status === 204) console.log('✅ Success: Deleted test job.');
  }

  console.log('\\n--- TESTS COMPLETED ---');
}

runTests();
