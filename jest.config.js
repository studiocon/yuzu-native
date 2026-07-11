module.exports = {
  preset: "jest-expo",
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  // AsyncStorage はネイティブモジュールなので jest 環境では公式モックに差し替える。
  // 未設定だと「NativeModule: AsyncStorage is null.」で AsyncStorage を import するテストが全滅する。
  moduleNameMapper: {
    "^@react-native-async-storage/async-storage$":
      "@react-native-async-storage/async-storage/jest/async-storage-mock",
  },
};
