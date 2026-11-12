const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
let status = 200, calls = 0, owner = 'owner@gmail.com';
let identity = { sub: 'google-subject', email: owner, email_verified: true };
const context = vm.createContext({
  Utilities: { DigestAlgorithm: {SHA_256:"sha256"}, computeDigest: (_, value) => crypto.createHash("sha256").update(value).digest() },
  Session: { getEffectiveUser: () => ({ getEmail: () => owner }) },
  UrlFetchApp: { fetch(url, options) {
    calls++;
    assert.equal(url, 'https://openidconnect.googleapis.com/v1/userinfo');
    assert.equal(options.headers.Authorization, 'Bearer valid-token');
    assert.equal(options.muteHttpExceptions, true);
    return { getResponseCode: () => status, getContentText: () => JSON.stringify(identity) };
  } }
});
vm.runInContext(fs.readFileSync('google-apps-script/History.gs', 'utf8').replace(/const HISTORY_ALLOWED_ACCOUNT_HASH = [^;]+;/, 'const HISTORY_ALLOWED_ACCOUNT_HASH = '+JSON.stringify(crypto.createHash('sha256').update('owner@gmail.com').digest('hex'))+';'), context);
const authorize = payload => context.authorizeHistory(payload);
assert.throws(() => authorize({}), /Google/);
assert.throws(() => authorize({ accessCode: 'old-private-code' }), /Google/);
assert.throws(() => authorize({ googleAccessToken: 'bad\r\nheader' }), /Google/);
assert.equal(calls, 0, 'Refuser avant tout appel les jetons absents ou malformés');
assert.doesNotThrow(() => authorize({ googleAccessToken: 'valid-token', email: 'attacker@gmail.com' }));
status = 401;
assert.throws(() => authorize({ googleAccessToken: 'valid-token' }), /expirée/);
status = 200;
identity.email = 'attacker@gmail.com';
assert.throws(() => authorize({ googleAccessToken: 'valid-token', email: owner }), /pas accès/);
identity.email = owner; identity.email_verified = false;
assert.throws(() => authorize({ googleAccessToken: 'valid-token' }), /pas accès/);
identity.email_verified = true; delete identity.sub;
assert.throws(() => authorize({ googleAccessToken: 'valid-token' }), /pas accès/);
identity.sub = 'google-subject'; identity.email = '';
assert.throws(() => authorize({ googleAccessToken: 'valid-token' }), /pas accès/);

// Le jeton est exclu de l'identité persistante de soumission.
const form = fs.readFileSync('assets/js/form.js', 'utf8');
assert.match(form, /delete identity\.googleAccessToken/);
const browser = fs.readFileSync('assets/js/history.js', 'utf8');
assert.doesNotMatch(browser, /localStorage\.setItem/);
assert.match(browser, /scope: "openid email"/);
assert.match(browser, /googleToken = ""; expiresAt = 0; outfits = \[\]/);
console.log('OK : OAuth absent/expiré, identité Google vérifiée, autre compte refusé et aucun jeton persistant.');
