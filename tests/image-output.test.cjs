'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { prepareImageOutput } = require('../app/image-output.cjs');
test('share JPEG preserves the encoded preview bytes exactly', async () => {
  const bytes = await sharp({create:{width:64,height:40,channels:3,background:'#98765a'}}).jpeg({quality:80}).toBuffer();
  const output = await prepareImageOutput('data:image/jpeg;base64,'+bytes.toString('base64'), {preserveEncoding:true});
  assert.deepEqual(output,bytes);
});
test('preserve rejects format mismatch, PNG target and truncated image', async () => {
  const png = await sharp({create:{width:20,height:20,channels:3,background:'red'}}).png().toBuffer();
  await assert.rejects(prepareImageOutput('data:image/jpeg;base64,'+png.toString('base64'),{preserveEncoding:true}));
  await assert.rejects(prepareImageOutput('data:image/png;base64,'+png.toString('base64'),{preserveEncoding:true,png:true}));
  await assert.rejects(prepareImageOutput('data:image/jpeg;base64,/9j/2Q==',{preserveEncoding:true}));
});
