function base64UrlEncode(buffer: ArrayBuffer | Uint8Array) {
    const bytes = buffer instanceof ArrayBuffer
      ? new Uint8Array(buffer)
      : buffer;
    let str = '';
    for (const byte of bytes) {
      str += String.fromCharCode(byte);
    }
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
  
  /**
   * Generate a random "code verifier" (43–128 chars of unreserved characters).
   */
  export function generateCodeVerifier() {
    const array = new Uint8Array(64);
    window.crypto.getRandomValues(array);
    return base64UrlEncode(array);
  }
  
  /**
   * Produce the SHA256 challenge from the verifier, then base64-url-encode it.
   */
  export async function generateCodeChallenge(verifier: string) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(digest);
  }
  