// .env.eas.local は npm scripts（build:ios:* / submit:ios）が source する
// シェルスクリプトで、JS モジュールではない。Metro のファイルクロールに
// 拾われると babel が構文エラーで落ちるため、バンドル対象から除外する。
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const envEasLocal = /\.env\.eas\.local$/;
config.resolver.blockList = Array.isArray(config.resolver.blockList)
  ? [...config.resolver.blockList, envEasLocal]
  : config.resolver.blockList
    ? [config.resolver.blockList, envEasLocal]
    : [envEasLocal];

module.exports = config;
