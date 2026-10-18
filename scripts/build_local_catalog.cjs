/* Build the storefront's display-only local catalog without external packages.
 * Existing generated rows preserve each image's original filename on rebuilds.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PROJECT_ROOT = fs.realpathSync.native(path.resolve(__dirname, '..'));
const ASSETS_ROOT = fs.realpathSync.native(path.join(PROJECT_ROOT, 'frontend', 'assets'));
const assetsRelative = path.relative(PROJECT_ROOT, ASSETS_ROOT);
if (!assetsRelative || assetsRelative.startsWith('..' + path.sep) || path.isAbsolute(assetsRelative)) {
  throw new Error('The asset directory must resolve inside this project.');
}
const OUTPUT = path.join(ASSETS_ROOT, 'local-catalog.js');
const IMAGE_ASSIGNMENT = 'window.GNLocalCatalog = ';
const VIDEO_ASSIGNMENT = ';\nwindow.GNLocalVideos = ';
// These supplied editorial photos belong to the routine slider, not product listings.
const ROUTINE_IMAGES = new Set(['glownuture_morning.webp', 'glownuture_night.webp']);
const diskPath = value => path.toNamespacedPath(value);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;

// These names were verified against the supplied image contents.
const DESCRIPTIVE_NAMES = new Map([
  ['1110278114416234472.jpg', 'Golden Serum Dropper Bottle'],
  ['615374736628172211.jpg', 'Naturals Glow and Radiance Face Cream'],
  ['696580267366476138.jpg', 'CeraVe Foaming Facial Cleanser'],
  ['756534437408203458.jpg', 'La Roche-Posay Anthelios Invisible Fluid SPF50'],
  ['827747606555213686.jpg', 'Vince Vitamin C Serum'],
  ['833447474820249937.jpg', 'The Ordinary Niacinamide 10% + Zinc 1%'],
  ['999869554767996193.jpg', 'The Ordinary Body Care Collection'],
  ['₍⑅ᐢ_.ᐢ₎っᯓ🍥', 'Beauty of Joseon Matte Sun Stick'],
  ['@theordinary ✨.jpg', 'The Ordinary']
]);

// Keep the four supplied videos in the storefront's established playlist order.
const VIDEO_NAMES = [
  ['Skin Care Product example commercial.mp4', 'skincare-commercial.mp4'],
  ['LARS SKINCARE VIDEO.mp4', 'lars-skincare.mp4'],
  ['BEAUTY PRODUCT  ADVERTISEMENT _  MOTION GRAPHIC VIDEO.mp4', 'beauty-motion-graphic.mp4'],
  ['Skin that looks glow washed- Lakmé Blush _ Glow Vitamin C Serum Facewash _ Hindi.mp4', 'lakme-vitamin-c-facewash.mp4']
];

function assertWithinAssets(value) {
  const absolute = path.resolve(value);
  const relative = path.relative(ASSETS_ROOT, absolute);
  if (!relative || relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error('Asset operation escaped the intended directory: ' + absolute);
  }
  let existing = absolute;
  while (!fs.existsSync(diskPath(existing))) existing = path.dirname(existing);
  const actualRelative = path.relative(ASSETS_ROOT, fs.realpathSync.native(diskPath(existing)));
  if (actualRelative === '..' || actualRelative.startsWith('..' + path.sep) || path.isAbsolute(actualRelative)) {
    throw new Error('Asset operation follows a link outside the intended directory: ' + absolute);
  }
  return absolute;
}

function selectFolder(legacyName, currentName) {
  const legacy = assertWithinAssets(path.join(ASSETS_ROOT, legacyName));
  const current = assertWithinAssets(path.join(ASSETS_ROOT, currentName));
  if (fs.existsSync(diskPath(legacy)) && fs.existsSync(diskPath(current))) {
    throw new Error('Both ' + legacyName + ' and ' + currentName + ' exist; refusing to merge assets.');
  }
  const source = fs.existsSync(diskPath(current)) ? current : legacy;
  if (!fs.existsSync(diskPath(source)) || !fs.lstatSync(diskPath(source)).isDirectory() || fs.lstatSync(diskPath(source)).isSymbolicLink()) {
    throw new Error('Expected a regular asset directory: ' + source);
  }
  return { source, target: current };
}

function listFiles(folder) {
  return fs.readdirSync(diskPath(folder), { withFileTypes: true }).map(entry => {
    if (!entry.isFile()) throw new Error('Unexpected non-file asset: ' + entry.name);
    return entry.name;
  }).sort(compare);
}

function jpegDimensions(buffer, filename) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    throw new Error('Expected JPEG content, including files without an extension: ' + filename);
  }
  let offset = 2;
  while (offset + 1 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset++; continue; }
    while (offset < buffer.length && buffer[offset] === 0xff) offset++;
    const marker = buffer[offset++];
    if ([0xd8, 0xd9, 0x01].includes(marker) || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) break;
    const size = buffer.readUInt16BE(offset);
    if (size < 2 || offset + size > buffer.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (size < 7) break;
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      if (width && height) return { width, height };
      break;
    }
    offset += size;
  }
  throw new Error('Could not read JPEG dimensions: ' + filename);
}

function readableName(filename) {
  return DESCRIPTIVE_NAMES.get(filename) || filename.replace(/\.jpe?g$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function safeStem(name) {
  const stem = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, '').replace(/&/g, ' and ').replace(/\+/g, ' plus ')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (stem.slice(0, 76).replace(/-+$/g, '') || 'skincare-image');
}

function classify(name) {
  const normalized = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const brandRules = [
    [/\b(the\s*ordinary|ordinary)\b/, 'The Ordinary'], [/\bcerave\b/, 'CeraVe'],
    [/\bcosrx\b/, 'COSRX'], [/\banua\b/, 'Anua'], [/\bbeauty of joseon\b/, 'Beauty of Joseon'],
    [/\bla roche[- ]posay\b/, 'La Roche-Posay'], [/\bneutrogena\b/, 'Neutrogena'],
    [/\bl[’']?oreal\b/, "L'Oréal Paris"], [/\bmaybelline\b/, 'Maybelline New York'],
    [/\bskin\s*1004\b/, 'SKIN1004'], [/\bvince\b/, 'Vince'], [/\bnaturals\b/, 'Naturals']
  ];
  const brand = (brandRules.find(([pattern]) => pattern.test(normalized)) || [null, ''])[1];
  let category = 'skincare', sub = '';
  if (/\b(shampoo|conditioner|hair serum)\b/.test(normalized)) {
    category = 'haircare'; sub = /conditioner/.test(normalized) ? 'conditioner' : /shampoo/.test(normalized) ? 'shampoo' : 'hairserum';
  } else if (/\b(body wash|body lotion|body care|body milk)\b/.test(normalized)) {
    category = 'bodycare'; sub = /body wash/.test(normalized) ? 'bodywash' : /lotion|milk/.test(normalized) ? 'lotion' : '';
  } else if (/\b(gifts?|sets?|duo|pack)\b/.test(normalized)) {
    category = 'gift'; sub = 'combo';
  } else if (/\b(foundation|concealer|primer|mascara|lipstick|lip gloss|lip tint|teddy tint|matte ink|labios)\b/.test(normalized)) {
    category = 'cosmetics'; sub = /lipstick|lip gloss|lip tint|teddy tint|matte ink|labios/.test(normalized) ? 'lip' : /foundation|concealer/.test(normalized) ? 'facemakeup' : 'makeup';
  } else if (/\b(sunscreen|sun stick|sun serum|spf\s*\d|anthelios)/.test(normalized)) sub = 'sunscreen';
  else if (/\b(face wash|facewash)\b/.test(normalized)) sub = 'facewash';
  else if (/\b(cleanser|cleansing)\b/.test(normalized)) sub = 'cleanser';
  else if (/\b(serum|ampoule|essence|booster)\b/.test(normalized)) sub = 'serum';
  else if (/\b(moisturi[sz]\w*|cream|baume|water gel)\b/.test(normalized)) sub = 'moisturizer';
  else if (/\btoner\b/.test(normalized)) sub = 'toner';
  else if (/\b(mask|mascarilla)\b/.test(normalized)) sub = 'mask';
  return { category, sub, brand };
}

function previousCatalog() {
  if (!fs.existsSync(OUTPUT)) return [];
  const source = fs.readFileSync(OUTPUT, 'utf8');
  const start = source.indexOf(IMAGE_ASSIGNMENT);
  const end = source.indexOf(VIDEO_ASSIGNMENT, start);
  if (start < 0 || end < 0) throw new Error('Cannot preserve the original filename mapping in ' + OUTPUT);
  const rows = JSON.parse(source.slice(start + IMAGE_ASSIGNMENT.length, end));
  if (!Array.isArray(rows)) throw new Error('Expected an array in the existing local catalog.');
  return rows;
}

function planImages(folder) {
  const prior = new Map(previousCatalog().map(row => [path.posix.basename(row.image_url), row]));
  const files = listFiles(folder.source).filter(filename => !ROUTINE_IMAGES.has(filename.toLowerCase()));
  if (!files.length) throw new Error('The local image catalog is empty.');
  const reserved = new Set(files.map(name => name.toLowerCase()));
  const used = new Set();
  return files.map(filename => {
    const previous = prior.get(filename);
    const original = previous && previous.original_filename || filename;
    const name = readableName(original);
    const base = safeStem(name);
    let renamed = previous ? filename : base + '.jpg';
    const conflicts = candidate => used.has(candidate.toLowerCase()) ||
      (candidate.toLowerCase() !== filename.toLowerCase() && reserved.has(candidate.toLowerCase()));
    let suffix = 0;
    while (conflicts(renamed)) {
      renamed = base + '-' + hash(original + (suffix ? ':' + suffix : '')).slice(0, 8) + '.jpg';
      suffix++;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/.test(renamed) || used.has(renamed.toLowerCase())) {
      throw new Error('Unsafe or conflicting image filename: ' + renamed);
    }
    used.add(renamed.toLowerCase());
    const source = assertWithinAssets(path.join(folder.source, filename));
    assertWithinAssets(path.join(folder.target, renamed));
    const dimensions = jpegDimensions(fs.readFileSync(diskPath(source)), filename);
    const stem = renamed.slice(0, -4);
    const url = '/assets/image/' + renamed;
    return { filename, renamed, row: {
      id: 'local-' + hash(stem).slice(0, 12), slug: stem, name, en: name, short: name, description: name,
      image_url: url, images: [url], image_assets: [{ url, ...dimensions }],
      source: 'local', displayOnly: true, ...classify(name),
      tags: [], ingredients: [], skin: [], concerns: [], variants: [], original_filename: original
    } };
  }).sort((left, right) => compare(left.row.slug, right.row.slug));
}

function planVideos(folder) {
  const files = listFiles(folder.source);
  const planned = VIDEO_NAMES.map(([original, renamed]) => {
    const candidates = [original, renamed].filter(name => files.includes(name));
    if (candidates.length !== 1) throw new Error('Expected exactly one supplied video: ' + original);
    const filename = candidates[0];
    const source = assertWithinAssets(path.join(folder.source, filename));
    assertWithinAssets(path.join(folder.target, renamed));
    const buffer = fs.readFileSync(diskPath(source));
    if (buffer.length < 12 || buffer.toString('ascii', 4, 8) !== 'ftyp') throw new Error('Expected MP4 content: ' + filename);
    return { filename, renamed };
  });
  if (files.length !== planned.length) throw new Error('Unexpected extra video; add it to VIDEO_NAMES before rebuilding.');
  return planned;
}

function migrate(folder, planned) {
  // Check resolved absolute source and destination paths before moving a folder.
  assertWithinAssets(folder.source);
  assertWithinAssets(folder.target);
  if (folder.source !== folder.target) fs.renameSync(diskPath(folder.source), diskPath(folder.target));
  for (const { filename, renamed } of planned) {
    if (filename === renamed) continue;
    const source = assertWithinAssets(path.join(folder.target, filename));
    const target = assertWithinAssets(path.join(folder.target, renamed));
    if (fs.existsSync(diskPath(target))) throw new Error('Refusing to overwrite an asset: ' + target);
    fs.renameSync(diskPath(source), diskPath(target));
  }
}

const imageFolder = selectFolder('apk', 'image');
const videoFolder = selectFolder('video bg', 'videos');
const images = planImages(imageFolder);
const videos = planVideos(videoFolder);
const catalog = images.map(item => item.row);
if (new Set(catalog.map(row => row.id)).size !== catalog.length) throw new Error('Duplicate generated catalog IDs.');
const output = '/* Generated by scripts/build_local_catalog.cjs. Run npm run build:catalog after changing local assets. */\n' +
  IMAGE_ASSIGNMENT + JSON.stringify(catalog, null, 2) + VIDEO_ASSIGNMENT +
  JSON.stringify(videos.map(item => '/assets/videos/' + item.renamed), null, 2) + ';\n';
migrate(imageFolder, images);
migrate(videoFolder, videos);
fs.writeFileSync(assertWithinAssets(OUTPUT), output, 'utf8');
console.log('Built ' + catalog.length + ' local display-only images and ' + videos.length + ' videos.');
