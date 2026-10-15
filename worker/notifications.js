// Server-only login notifications. The recipient cannot be supplied by a visitor.
const LOGIN_NOTIFICATION_TO = 'percival@wiseway.ai';
const LOGIN_NOTIFICATION_CC = 'jerry.lu@wiseway.ai';
function notificationConfigured(env) {
  return Boolean(env.RESEND_API_KEY && env.LOGIN_NOTIFICATION_FROM);
}
async function notifyLogin(env, visit) {
  async function status(state, emailId = '', errorCode = '') {
    await env.DB.prepare('UPDATE visits SET notification_status=?, notification_email_id=?, notification_error=? WHERE id=?')
      .bind(state, emailId, errorCode, visit.id).run();
  }
  try {
    if (!notificationConfigured(env)) {
      await status('not_configured');
      return;
    }
    const location = [visit.city, visit.region, visit.country].filter(Boolean).join(', ') || 'Unavailable / 暂无';
    const localTime = new Date(visit.started_at).toLocaleString('en-AU', {
      timeZone: 'Australia/Melbourne', dateStyle: 'medium', timeStyle: 'long',
    });
    const payload = JSON.stringify({
      from: env.LOGIN_NOTIFICATION_FROM,
      to: [LOGIN_NOTIFICATION_TO],
      cc: [LOGIN_NOTIFICATION_CC],
      subject: 'E3 Showcase · New login / 新访客登录 · ' + visit.name,
      text: [
        'A visitor signed in to E3 Showcase. / 有访客登录 E3 Showcase。', '',
        'Name / 姓名: ' + visit.name,
        'Login time / 登录时间 (Australia/Melbourne): ' + localTime,
        'Login time / 登录时间 (UTC): ' + visit.started_at,
        'IP address / IP 地址: ' + visit.ip_address,
        'Approximate location / 大致位置: ' + location,
        'Visitor timezone / 访客时区: ' + (visit.timezone || 'Unavailable / 暂无'),
        'Session ID / 访问编号: ' + visit.id, '',
        'Name is self-declared. IP location is approximate and may reflect a VPN or network gateway.',
        '姓名由访客自填。IP 位置仅为大致地区，可能显示 VPN 或网络出口。',
      ].join('\n'),
    });
    let errorCode = 'network_error';
    // A stable key prevents a retry after a timeout from sending a duplicate.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { authorization: 'Bearer ' + env.RESEND_API_KEY,
            'content-type': 'application/json', 'idempotency-key': 'e3-login/' + visit.id },
          body: payload,
          signal: AbortSignal.timeout(8000),
        });
        if (result.ok) {
          const data = await result.json();
          if (typeof data.id !== 'string' || !data.id) {
            errorCode = 'invalid_response';
            break;
          }
          // Accepted by Resend is not a guarantee of delivery to the inbox.
          await status('accepted', data.id);
          return;
        }
        errorCode = 'resend_http_' + result.status;
        if (result.status < 500) break;
        await result.body?.cancel();
      } catch {
        errorCode = 'network_error_or_timeout';
      }
    }
    await status('failed', '', errorCode);
  } catch {
    // Never leak credentials, email payloads or provider response bodies to logs.
    console.error('E3 login notification could not be completed.');
  }
}
