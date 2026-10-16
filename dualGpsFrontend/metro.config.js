const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// Native Fiber uses require(), while GLTFLoader uses import. Both must share
// one Three.js instance so loaders, materials, and cameras use the same classes.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "three") {
    return { type: "sourceFile", filePath: require.resolve("three") };
  }
  return context.resolveRequest(context, moduleName, platform);
};

for (const extension of ["glb", "gltf", "bin"]) {
  if (!config.resolver.assetExts.includes(extension)) {
    config.resolver.assetExts.push(extension);
  }
}

module.exports = config;
