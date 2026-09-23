/**
 * 微信 JS-SDK 签名接口（服务端）
 * ============================================================
 * 作用：给微信内打开的页面签发 wx.config 需要的签名。
 * 前端会用 wx.config({ appId, timestamp, nonceStr, signature, jsApiList: [...] })，
 * 微信校验通过后，页面才被允许「预设」右上角转发时的标题 / 描述 / 封面图。
 *
 * ⚠️ 重要认知（微信官方限制，任何网页都一样）：
 *    JS-SDK 不能主动弹出「选择好友 / 朋友圈」界面，它只能预设文案，
 *    真正的转发必须用户自己点右上角 ···。
 *    所以这个接口的价值 = 让右上角转发出来的卡片带正确的标题/描述/图。
 *
 * ------------------------------------------------------------
 * 需要准备：
 *   1) 一个**已认证**的公众号（服务号；认证订阅号部分接口可用）—— 未认证的没有这份权限
 *   2) 公众号后台 → 设置与开发 → 基本配置 → 拿到 AppID / AppSecret
 *   3) 公众号后台 → 公众号设置 → 功能设置 → **JS 接口安全域名** 填你的域名，
 *      例如 pqn.funsun.cn（不带 https:// 和路径）。它会让你下载一个校验文件，
 *      放到网站根目录能被访问即可。
 *   4) 把这个文件部署到任意能跑 Node 的地方（云函数 / 一台小服务器）
 *      —— 七牛云 Kodo 是纯静态托管，跑不了它，需要另找地方。
 *
 * 环境变量（不要写死在代码里）：
 *   WX_APPID   公众号 AppID
 *   WX_SECRET  公众号 AppSecret
 *
 * 调用方式（GET 或 POST 都支持）：
 *   GET https://你的接口地址/?url=<当前页面的完整地址，不含 #>
 *   返回 { code:0, appId, timestamp, nonceStr, signature }
 *
 * 部署示例见文件末尾。
 */

'use strict';

const crypto = require('crypto');
const https = require('https');

const APPID = process.env.WX_APPID || '';
const SECRET = process.env.WX_SECRET || '';

/* jsapi_ticket 有效期 7200 秒且有调用频率限制，必须缓存。
   这里用进程内缓存：同一实例被复用时不重复请求。
   （云函数每次冷启动会重新取一次，可接受；要更稳可换 Redis。） */
let cache = { ticket: '', exp: 0 };

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error('bad json: ' + body.slice(0, 200)));
        }
      });
    }).on('error', reject);
  });
}

async function getJsapiTicket() {
  if (cache.ticket && Date.now() < cache.exp) return cache.ticket;

  const tokUrl = 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential'
    + '&appid=' + encodeURIComponent(APPID) + '&secret=' + encodeURIComponent(SECRET);
  const tok = await httpGetJson(tokUrl);
  if (!tok.access_token) throw new Error('取 access_token 失败：' + JSON.stringify(tok));

  const tkUrl = 'https://api.weixin.qq.com/cgi-bin/ticket/getticket?access_token='
    + encodeURIComponent(tok.access_token) + '&type=jsapi';
  const tk = await httpGetJson(tkUrl);
  if (!tk.ticket) throw new Error('取 jsapi_ticket 失败：' + JSON.stringify(tk));

  cache = { ticket: tk.ticket, exp: Date.now() + (Number(tk.expires_in) - 300) * 1000 };
  return tk.ticket;
}

/**
 * 核心处理：传入页面地址，返回签名。
 * @param {string} pageUrl 当前页面的完整地址（不含 # 后面）—— 必须与微信里打开的地址一致
 */
async function sign(pageUrl) {
  if (!APPID || !SECRET) throw new Error('缺少环境变量 WX_APPID / WX_SECRET');
  if (!pageUrl) throw new Error('缺少 url 参数');

  const url = String(pageUrl).split('#')[0];   // 微信要求不带 #，且要含 query
  const ticket = await getJsapiTicket();

  const nonceStr = crypto.randomBytes(8).toString('hex');
  const timestamp = Math.floor(Date.now() / 1000);
  // 字段顺序必须是 jsapi_ticket、noncestr、timestamp、url —— 微信按这个顺序做 SHA1
  const raw = 'jsapi_ticket=' + ticket
    + '&noncestr=' + nonceStr
    + '&timestamp=' + timestamp
    + '&url=' + url;
  const signature = crypto.createHash('sha1').update(raw).digest('hex');

  return { code: 0, appId: APPID, timestamp: timestamp, nonceStr: nonceStr, signature: signature };
}

/* ------------------------------------------------------------
 * 部署方式一：腾讯云函数 SCF（推荐，和公众号同一生态）
 *   把下面 exports.main 作为入口；再配一个「API 网关」触发器拿到 https 地址，
 *   并在 API 网关开启 CORS（允许你的页面域名），前端才能跨域调用。
 * ------------------------------------------------------------ */
exports.main = async (event) => {
  let url = '';
  if (event && event.queryString && event.queryString.url) url = event.queryString.url;
  else if (event && event.url) url = event.url;
  else if (event && event.body) {
    try {
      const b = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      url = (b && b.url) || '';
    } catch (e) { /* ignore */ }
  }
  try {
    const r = await sign(url);
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(r)
    };
  } catch (e) {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ code: 1, msg: String((e && e.message) || e) })
    };
  }
};

/* ------------------------------------------------------------
 * 部署方式二：一台小服务器上直接跑（node wx-sign.js）
 *   然后用 nginx 反代到 https。注意这个接口最好和页面同域名
 *   （挂在 /wxsign 路径下），否则要么再配一个 JS 接口安全域名。
 * ------------------------------------------------------------ */
if (require.main === module) {
  const http = require('http');
  const PORT = process.env.PORT || 3000;
  http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
    let url = '';
    const q = req.url.split('?')[1];
    if (q) {
      q.split('&').forEach((kv) => {
        const i = kv.indexOf('=');
        if (i > 0 && decodeURIComponent(kv.slice(0, i)) === 'url') {
          url = decodeURIComponent(kv.slice(i + 1));
        }
      });
    }
    try {
      res.end(JSON.stringify(await sign(url)));
    } catch (e) {
      res.end(JSON.stringify({ code: 1, msg: String((e && e.message) || e) }));
    }
  }).listen(PORT, () => console.log('wx sign server on :' + PORT));
}

exports.sign = sign;
