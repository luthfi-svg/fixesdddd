const axios = require('axios');

async function fetchAsInstagram(url) {
  try {
    const apiUrl = `https://api-faa.my.id/faa/aio?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(apiUrl);

    if (!data.status) throw new Error('API gagal');

    const r = data.result;
    const video = r.downloads.find(d => d.type === 'video');
    const audio = r.downloads.find(d => d.type === 'audio');

    // Format mirip Instagram Reels
    return {
      platform: 'Instagram',
      type: 'reel',
      username: '@instagram_user',
      caption: r.title,
      thumbnail: r.thumbnail,
      duration: r.duration,
      media: [
        {
          type: 'video',
          url: video?.url,
          quality: video?.quality
        },
        {
          type: 'audio',
          url: audio?.url
        }
      ],
      source_url: url
    };
  } catch (err) {
    console.error('Error:', err.message);
    throw err;
  }
}

(async () => {
  const ig = await fetchAsInstagram('https://vt.tiktok.com/ZSqx9yypU');
  console.log(JSON.stringify(ig, null, 2));
})();
