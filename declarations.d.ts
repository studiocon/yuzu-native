// @expo-google-fonts パッケージのバレル（index.js）経由だと、使わないウェイトの
// フォントファイルまで Metro のバンドルに全部含まれてしまう（CJS require が
// tree-shake されないため）。個別ウェイトのパスから直接 import するための宣言。
declare module "*.ttf";
