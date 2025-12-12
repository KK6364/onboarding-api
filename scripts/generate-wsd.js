#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node scripts/generate-wsd.js <input.wsd> [output.png]');
    process.exit(2);
  }

  const inputPath = path.resolve(args[0]);
  const outputPath = path.resolve(args[1] || 'credit-check-diagram.png');

  if (!fs.existsSync(inputPath)) {
    console.error('Input file not found:', inputPath);
    process.exit(3);
  }

  const content = fs.readFileSync(inputPath, 'utf8');

  const form = new URLSearchParams();
  form.append('message', content);
  form.append('style', 'default');
  form.append('format', 'png');

  try {
    const res = await fetch('https://www.websequencediagrams.com/index.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form.toString()
    });

    if (!res.ok) {
      console.error('Failed to generate diagram:', res.status, res.statusText);
      process.exit(4);
    }

    const contentType = res.headers.get('content-type') || '';

    // If the response is already an image, save it
    if (contentType.startsWith('image/')) {
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(outputPath, buf);
      console.log('Saved diagram to', outputPath);
      return;
    }

    // Otherwise the service returns a small JS-like object with an img token or errors
    const text = await res.text();

    // If it contains an img token like ?img=msc12345, fetch the actual image
    const m = text.match(/\?img=([a-zA-Z0-9_\-]+)/);
    if (m) {
      const token = m[1];
      const imgUrl = `https://www.websequencediagrams.com/?img=${token}`;
      const imgRes = await fetch(imgUrl);
      if (!imgRes.ok) {
        console.error('Failed to fetch generated image:', imgRes.status, imgRes.statusText);
        console.error('Server response:', text);
        process.exit(6);
      }
      const buf = Buffer.from(await imgRes.arrayBuffer());
      fs.writeFileSync(outputPath, buf);
      console.log('Saved diagram to', outputPath);
      return;
    }

    // If there were errors, show them to the user
    const errMatch = text.match(/errors:\s*\[(.*?)\]/s);
    if (errMatch) {
      console.error('Diagram generator returned errors:', errMatch[1]);
      console.error('Server response:', text);
      process.exit(7);
    }

    // Fallback: write the raw text so the user can inspect it
    fs.writeFileSync(outputPath, Buffer.from(text));
    console.log('Saved text response to', outputPath);
    console.log('Server response:', text);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(5);
  }
}

main();
