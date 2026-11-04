// ECDH P-256 + AES-GCM com WebCrypto. Exige contexto seguro (https ou localhost).
const subtle = globalThis.crypto?.subtle;
const ECDH = { name: 'ECDH', namedCurve: 'P-256' };

export function cryptoAvailable() { return !!subtle; }

export async function generateKeys() {
  const kp = await subtle.generateKey(ECDH, true, ['deriveKey']);
  return {
    pub: await subtle.exportKey('jwk', kp.publicKey),
    priv: await subtle.exportKey('jwk', kp.privateKey),
  };
}

export const sameKey = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y;
export const pubOnly = ({ kty, crv, x, y }) => ({ kty, crv, x, y });

export async function deriveShared(privJwk, pubJwk) {
  const priv = await subtle.importKey('jwk', privJwk, ECDH, false, ['deriveKey']);
  const pub = await subtle.importKey('jwk', pubOnly(pubJwk), ECDH, false, []);
  return subtle.deriveKey({ name: 'ECDH', public: pub }, priv, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

const b64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function seal(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { iv: b64(iv), ct: b64(ct) };
}

export async function open(key, { iv, ct }) {
  const pt = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
