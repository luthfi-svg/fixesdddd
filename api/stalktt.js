/**
 * TikTok Stalker
 * Base URL : https://www.tiktok.com
 * Method   : Scrape HTML, No API
 */

const axios = require('axios');
const cheerio = require('cheerio');

const USER_AGENT =
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36';

function normalizeUsername(username) {
    if (!username) return '';

    username = String(username).trim();

    // Kalau user memasukkan URL profil TikTok
    try {
        if (/^https?:\/\//i.test(username)) {
            const parsed = new URL(username);

            if (!/tiktok\.com$/i.test(parsed.hostname) &&
                !/\.tiktok\.com$/i.test(parsed.hostname)) {
                return '';
            }

            const match = parsed.pathname.match(/\/@([^/?#]+)/i);

            if (match) {
                return match[1];
            }

            return '';
        }
    } catch {
        return '';
    }

    return username.replace(/^@/, '').trim();
}

function isValidUsername(username) {
    return /^[a-zA-Z0-9._-]{2,50}$/.test(username);
}

async function stalkTikTok(username) {
    const cleanUsername = normalizeUsername(username);

    if (!cleanUsername) {
        return {
            status: false,
            message: 'Username TikTok tidak boleh kosong.'
        };
    }

    if (!isValidUsername(cleanUsername)) {
        return {
            status: false,
            message: 'Username TikTok tidak valid.'
        };
    }

    const profileUrl = `https://www.tiktok.com/@${cleanUsername}`;

    try {
        const response = await axios.get(profileUrl, {
            headers: {
                'User-Agent': USER_AGENT,
                'Accept':
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            timeout: 30000,
            maxRedirects: 5,
            validateStatus: status => status >= 200 && status < 400
        });

        const $ = cheerio.load(response.data);

        const scriptData = $('#__UNIVERSAL_DATA_FOR_REHYDRATION__').text();

        if (!scriptData) {
            return {
                status: false,
                message:
                    'Gagal memproses data: Data rehydration tidak ditemukan. TikTok mungkin memblokir request atau mengubah struktur halaman.'
            };
        }

        let data;

        try {
            data = JSON.parse(scriptData);
        } catch (error) {
            return {
                status: false,
                message: 'Gagal membaca data profil TikTok.'
            };
        }

        const defaultScope = data?.['__DEFAULT_SCOPE__'];

        const userDetail = defaultScope?.['webapp.user-detail'];

        if (!userDetail) {
            return {
                status: false,
                message:
                    'Data user tidak ditemukan. Pastikan username TikTok yang dimasukkan benar.'
            };
        }

        if (
            userDetail.statusCode !== 0 ||
            !userDetail.userInfo
        ) {
            return {
                status: false,
                message:
                    'User tidak ditemukan atau informasi akun tidak dapat diakses.'
            };
        }

        const user = userDetail.userInfo.user;
        const stats = userDetail.userInfo.stats || {};

        if (!user) {
            return {
                status: false,
                message: 'Data profil TikTok tidak ditemukan.'
            };
        }

        return {
            status: true,
            data: {
                username: user.uniqueId || cleanUsername,
                nickname: user.nickname || '',
                avatar:
                    user.avatarLarger ||
                    user.avatarMedium ||
                    user.avatarThumb ||
                    null,

                signature: user.signature || '',
                verified: Boolean(user.verified),

                stats: {
                    followers: Number(stats.followerCount || 0),
                    following: Number(stats.followingCount || 0),
                    video_upload: Number(stats.videoCount || 0),
                    likes: Number(stats.heartCount || 0),
                    friends: Number(stats.friendCount || 0)
                },

                profile_url: profileUrl
            }
        };
    } catch (error) {
        console.error('[STALK TIKTOK]', error.message);

        if (error.response?.status === 404) {
            return {
                status: false,
                message: 'Username TikTok tidak ditemukan.'
            };
        }

        if (error.response?.status === 403) {
            return {
                status: false,
                message:
                    'Request ke TikTok ditolak. Kemungkinan TikTok sedang memblokir request.'
            };
        }

        if (error.code === 'ECONNABORTED') {
            return {
                status: false,
                message: 'Request ke TikTok timeout.'
            };
        }

        return {
            status: false,
            message: `Gagal memproses data: ${error.message}`
        };
    }
}


/*
|--------------------------------------------------------------------------
| VERCEL API HANDLER
|--------------------------------------------------------------------------
*/

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader(
        'Access-Control-Allow-Methods',
        'POST, OPTIONS'
    );
    res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type'
    );

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({
            status: false,
            message: 'Method tidak diizinkan. Gunakan POST.'
        });
    }

    try {
        const body =
            typeof req.body === 'string'
                ? JSON.parse(req.body || '{}')
                : req.body || {};

        const username =
            body.username ||
            body.user ||
            body.url ||
            body.tiktokUrl;

        if (!username) {
            return res.status(400).json({
                status: false,
                message: 'Username TikTok wajib diisi.'
            });
        }

        const result = await stalkTikTok(username);

        return res
            .status(result.status ? 200 : 400)
            .json(result);
    } catch (error) {
        console.error('[STALKTT API]', error);

        return res.status(500).json({
            status: false,
            message:
                error.message ||
                'Terjadi kesalahan pada server.'
        });
    }
};


// Export scraper juga kalau ingin digunakan dari file lain
module.exports.stalkTikTok = stalkTikTok;


// CLI
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(
            '❌ Penggunaan: node stalktt.js <username>'
        );

        console.log(
            '💡 Contoh: node stalktt.js asololepisanwan'
        );

        process.exit(1);
    }

    const username = args[0];

    stalkTikTok(username)
        .then(result => {
            console.log(
                JSON.stringify(result, null, 2)
            );
        })
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
