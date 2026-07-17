import AsyncStorage from "@react-native-async-storage/async-storage";
import * as aesjs from "aes-js";
import * as SecureStore from "expo-secure-store";

// expo-secure-store（iOS Keychain）は1エントリ ~2048byte 制限があり、
// Supabase の session オブジェクト（access/refresh token + user）はこれを超えることがある。
// Secure Store には AES 鍵だけを置き、暗号化した本体は AsyncStorage に置く
// （Supabase 公式の React Native ガイド推奨パターン）。
//
// lib/supabase.ts から切り出したのは、env var チェックや createClient の副作用込みの
// supabase.ts を import せずに decrypt のガード（#13）を単体でテストするため。
export class LargeSecureStore {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = crypto.getRandomValues(new Uint8Array(32));
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    try {
      const encryptionKeyHex = await SecureStore.getItemAsync(key);
      if (!encryptionKeyHex) return null;
      const cipher = new aesjs.ModeOfOperation.ctr(
        aesjs.utils.hex.toBytes(encryptionKeyHex),
        new aesjs.Counter(1),
      );
      const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
      return aesjs.utils.utf8.fromBytes(decryptedBytes);
    } catch {
      // 壊れた blob（不正な hex・破損した暗号文で utf8 に変換できない復号結果等）をガード無しで
      // throw させると、Supabase SDK の getSession() がここで reject し続け、以降の
      // トークンリフレッシュ待ちの apiFetch も巻き添えで全滅する（#13）。壊れたエントリは
      // 破棄し、null（＝該当キー無し。呼び出し側は未ログイン相当として扱う）を返して
      // 以降の起動・API 呼び出しを継続させる。
      await this.removeItem(key).catch(() => {});
      return null;
    }
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    return this.decrypt(key, encrypted);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }
}
