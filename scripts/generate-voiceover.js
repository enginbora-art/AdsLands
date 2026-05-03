// AdsLands Voiceover Generator — ElevenLabs
//
// Kullanım:
//   Sesleri listele:
//     ELEVENLABS_API_KEY=xxx node scripts/generate-voiceover.js --list
//
//   Voiceover üret:
//     ELEVENLABS_API_KEY=xxx node scripts/generate-voiceover.js
//     ELEVENLABS_API_KEY=xxx ELEVENLABS_VOICE_ID=yyy node scripts/generate-voiceover.js
//
//   Test modu (ilk 2 cümle, belirtilen ses):
//     ELEVENLABS_API_KEY=xxx node scripts/generate-voiceover.js --test --voice <id> [--name label]
//
//   3 sesi karşılaştır:
//     ELEVENLABS_API_KEY=xxx node scripts/generate-voiceover.js --compare

const path = require('path');
const fs   = require('fs');

const EL_MOD = path.join(__dirname, '../node_modules/elevenlabs');
const { ElevenLabsClient } = require(EL_MOD);

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error('Hata: ELEVENLABS_API_KEY environment variable gereklidir.');
  process.exit(1);
}

const client = new ElevenLabsClient({ apiKey: API_KEY });

const SCRIPT_FULL = `Veriler orada. Soru şu: onları gerçekten görüyor musunuz?

AdsLands, tüm dijital reklam platformlarınızı ve ilgili verilerinizi tek ekranda toplar. Google Ads, Meta, TikTok, LinkedIn, Adform, Adjust, Appsflyer. Hepsi bir arada, ve gerçek zamanlı.

Kanal bazında bütçe planlamanızı yaparak; harcama, ROAS, CPA, CTR, impression, conversion verilerini anlık takip edin. KPI hedeflerinizi girin, platform size hedeflerinize ne kadar yakınsınız grafik ve görseller ile net bir şekilde göstersin.

Reklam harcamalarınızda bir anomali olduğunda, daha siz fark etmeden sistem sizi uyarsın. Böylelikle bütçe aşımlarının önüne geçerek bütçenizi en iyi şekilde yönetin.

Yapay zeka destekli kanal analizi ile verilerinizi sadece görmekle kalmayın, anlayın. Hangi kanalda ne yapmanız gerektiğini AI size söyler.

Tek tuşla PowerPoint raporunuz hazır. Toplantıya hazırlanmak için değil, toplantıya odaklanmak için detaylı infografiklerle desteklenmiş veri analizinize saniyeler içerisinde ulaşın.

Ayrıca, sektör benchmark verileriyle kendi performansınızı karşılaştırın. Ortalamanın neresinde olduğunuzu görün ve stratejinizi belirlemek için doğru kararı verin.

AdsLands. Verileriniz konuşuyor — AI dinliyor, siz karar veriyorsunuz.`;

const SCRIPT_TEST = `Veriler orada. Soru şu: onları gerçekten görüyor musunuz?`;

// Karşılaştırma için 3 ses
const COMPARE_VOICES = [
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'daniel' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'brian'  },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'eric'   },
];

// Türkçe (eleven_multilingual_v2) için varsayılan sesler
const DEFAULT_VOICES = [
  { id: 'pNInz6obpgDQGcFmaJgB', name: 'Adam'   },
  { id: 'ErXwobaYiN019PkySvjV', name: 'Antoni' },
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella'  },
  { id: 'AZnzlk1XvdvUeBnXmlld', name: 'Domi'   },
];

const VOICE_SETTINGS = {
  stability:        0.4,
  similarity_boost: 0.9,
  style:            0.35,
  use_speaker_boost: true,
};

async function tts(voiceId, text, outPath) {
  const audio = await client.textToSpeech.convert(voiceId, {
    text,
    model_id: 'eleven_multilingual_v2',
    output_format: 'mp3_44100_128',
    voice_settings: VOICE_SETTINGS,
  });

  const chunks = [];
  for await (const chunk of audio) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'binary') : chunk);
  }
  const buffer = Buffer.concat(chunks);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buffer);
  return buffer.length;
}

async function listVoices() {
  console.log('Mevcut sesler getiriliyor...\n');
  const res = await client.voices.getAll();
  const voices = res.voices || res;

  console.log(`${'İsim'.padEnd(30)} ${'Voice ID'.padEnd(25)} Kategori`);
  console.log('─'.repeat(75));
  voices.forEach(v => {
    const cat = v.category || '-';
    console.log(`${(v.name || '').padEnd(30)} ${(v.voice_id || '').padEnd(25)} ${cat}`);
  });
  console.log(`\nToplam: ${voices.length} ses`);
}

async function testVoice() {
  const argIdx = process.argv.indexOf('--voice');
  const nameIdx = process.argv.indexOf('--name');

  let voiceId = argIdx !== -1 && process.argv[argIdx + 1] ? process.argv[argIdx + 1] : COMPARE_VOICES[0].id;
  let label   = nameIdx !== -1 && process.argv[nameIdx + 1] ? process.argv[nameIdx + 1] : 'test';

  const outPath = path.join(__dirname, `../video/out/voiceover-${label}.mp3`);

  console.log(`Test modu — ses: ${label} (${voiceId})`);
  console.log(`Metin  : "${SCRIPT_TEST}"`);
  console.log(`Karakter: ${SCRIPT_TEST.length}`);
  console.log(`Çıktı  : video/out/voiceover-${label}.mp3\n`);
  console.log('Üretiliyor...');

  const bytes = await tts(voiceId, SCRIPT_TEST, outPath);
  const kb = (bytes / 1024).toFixed(0);
  console.log(`✅ Kaydedildi: video/out/voiceover-${label}.mp3  (${kb} KB)`);
  console.log(`\nDinlemek için: open ${outPath}`);
}

async function compareVoices() {
  console.log('3 ses karşılaştırma testi başlıyor...\n');
  console.log(`Metin: "${SCRIPT_TEST}"\n`);
  console.log('─'.repeat(60));

  for (const v of COMPARE_VOICES) {
    const outPath = path.join(__dirname, `../video/out/voiceover-${v.name}.mp3`);
    process.stdout.write(`[${v.name.toUpperCase().padEnd(8)}] (${v.id}) üretiliyor... `);
    const bytes = await tts(v.id, SCRIPT_TEST, outPath);
    const kb = (bytes / 1024).toFixed(0);
    console.log(`✅ ${kb} KB → video/out/voiceover-${v.name}.mp3`);
  }

  console.log('\n─'.repeat(60));
  console.log('\nDinlemek için:');
  COMPARE_VOICES.forEach(v => {
    console.log(`  open video/out/voiceover-${v.name}.mp3   # ${v.name}`);
  });
  console.log('\nBeğendiğin sesi seçtikten sonra tam voiceover üret:');
  console.log('  ELEVENLABS_API_KEY=xxx ELEVENLABS_VOICE_ID=<id> node scripts/generate-voiceover.js');
}

async function generateVoiceover() {
  let voiceId   = process.env.ELEVENLABS_VOICE_ID;
  let voiceName = '';

  if (!voiceId) {
    const argIdx = process.argv.indexOf('--voice');
    if (argIdx !== -1 && process.argv[argIdx + 1]) {
      voiceId = process.argv[argIdx + 1];
    }
  }

  if (!voiceId) {
    const def = DEFAULT_VOICES[0];
    voiceId   = def.id;
    voiceName = def.name;
    console.log(`ELEVENLABS_VOICE_ID tanımlı değil — varsayılan: ${voiceName} (${voiceId})`);
    console.log('Farklı ses için: ELEVENLABS_VOICE_ID=<id> veya --voice <id>\n');
    console.log('Hazır ses seçenekleri:');
    DEFAULT_VOICES.forEach(v => console.log(`  ${v.name.padEnd(10)} ${v.id}`));
    console.log('');
  }

  const outPath = path.join(__dirname, '../video/out/voiceover.mp3');

  console.log(`Ses ID   : ${voiceId}`);
  console.log(`Model    : eleven_multilingual_v2`);
  console.log(`Format   : mp3_44100_128`);
  console.log(`Karakter : ${SCRIPT_FULL.length}`);
  console.log('\nVoiceover üretiliyor...');

  const bytes = await tts(voiceId, SCRIPT_FULL, outPath);
  const kb = (bytes / 1024).toFixed(0);
  console.log(`\n✅ Voiceover kaydedildi: video/out/voiceover.mp3  (${kb} KB)`);
  console.log('\nSonraki adım — video ile birleştir:');
  console.log('  ffmpeg -i video/out/adslands-promo.mp4 -i video/out/voiceover.mp3 \\');
  console.log('    -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 128k -shortest \\');
  console.log('    video/out/adslands-final.mp4 -y');
}

const args = process.argv;
if (args.includes('--list')) {
  listVoices().catch(err => { console.error('Hata:', err.message); process.exit(1); });
} else if (args.includes('--compare')) {
  compareVoices().catch(err => { console.error('Hata:', err.message); process.exit(1); });
} else if (args.includes('--test')) {
  testVoice().catch(err => { console.error('Hata:', err.message); process.exit(1); });
} else {
  generateVoiceover().catch(err => { console.error('Hata:', err.message); process.exit(1); });
}
