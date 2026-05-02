// AdsLands Voiceover Generator — ElevenLabs
//
// Kullanım:
//   Sesleri listele:
//     ELEVENLABS_API_KEY=xxx node scripts/generate-voiceover.js --list
//
//   Voiceover üret:
//     ELEVENLABS_API_KEY=xxx node scripts/generate-voiceover.js
//     ELEVENLABS_API_KEY=xxx ELEVENLABS_VOICE_ID=yyy node scripts/generate-voiceover.js

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

const SCRIPT = `Reklam bütçenizin nereye gittiğini gerçekten biliyor musunuz? AdsLands biliyor.

AdsLands, tüm dijital reklam platformlarınızı tek ekranda toplar. Google Ads, Meta, TikTok, LinkedIn, Adform. Hepsi bir arada, gerçek zamanlı.

Kanal bazında harcama, ROAS, CPA ve CTR verilerini anlık takip edin. KPI hedeflerinizi girin, platform size söylesin, hedefe ne kadar yakınsınız.

Sektör benchmark verileriyle kendi performansınızı karşılaştırın. Ortalamanın neresinde olduğunuzu görün, doğru kararı verin.

Bütçe planlamanızı platform üzerinden yapın. Harcama aniden saptığında, daha siz fark etmeden sistem sizi uyarır.

Yapay zeka destekli kanal analizi ile verilerinizi sadece görmekle kalmayın, anlayın. Hangi kanalda ne yapmanız gerektiğini AI size söyler.

Tek tuşla hazır PowerPoint raporu. Toplantıya hazırlanmak için değil, toplantıya odaklanmak için.

AdsLands. Reklam verilerinizin kontrolü artık sizde.`;

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
  console.log('\nTürkçe için önerilen model: eleven_multilingual_v2');
  console.log('Kullanmak istediğin Voice ID\'yi seçip şu komutla çalıştır:');
  console.log('  ELEVENLABS_API_KEY=xxx ELEVENLABS_VOICE_ID=<id> node scripts/generate-voiceover.js');
}

async function generateVoiceover() {
  // Ses seçimi: env var yoksa ilk sesi kullan
  let voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!voiceId) {
    console.log('ELEVENLABS_VOICE_ID tanımlı değil, sesler listeleniyor...');
    const res = await client.voices.getAll();
    const voices = res.voices || res;
    voiceId = voices[0]?.voice_id;
    if (!voiceId) { console.error('Ses bulunamadı.'); process.exit(1); }
    console.log(`İlk ses seçildi: ${voices[0].name} (${voiceId})\n`);
  }

  console.log(`Ses ID   : ${voiceId}`);
  console.log(`Model    : eleven_multilingual_v2`);
  console.log(`Format   : mp3_44100_128`);
  console.log(`Karakter : ${SCRIPT.length}`);
  console.log('\nVoiceover üretiliyor...');

  const audio = await client.textToSpeech.convert(voiceId, {
    text: SCRIPT,
    model_id: 'eleven_multilingual_v2',
    output_format: 'mp3_44100_128',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.8,
      style: 0.2,
      use_speaker_boost: true,
    },
  });

  // Stream → Buffer
  const chunks = [];
  for await (const chunk of audio) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk, 'binary') : chunk);
  }
  const buffer = Buffer.concat(chunks);

  const outDir  = path.join(__dirname, '../video/out');
  const outPath = path.join(outDir, 'voiceover.mp3');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, buffer);

  const kb = (buffer.length / 1024).toFixed(0);
  console.log(`\n✅ Voiceover kaydedildi: video/out/voiceover.mp3  (${kb} KB)`);
  console.log('\nSonraki adım — video ile birleştir:');
  console.log('  ffmpeg -i video/out/adslands-promo.mp4 -i video/out/voiceover.mp3 \\');
  console.log('    -c:v copy -c:a aac -shortest video/out/adslands-final.mp4');
}

// --list flag'i varsa sesleri listele, yoksa üret
if (process.argv.includes('--list')) {
  listVoices().catch(err => { console.error('Hata:', err.message); process.exit(1); });
} else {
  generateVoiceover().catch(err => { console.error('Hata:', err.message); process.exit(1); });
}
