const {
  withAndroidManifest,
  withDangerousMod,
  withProjectBuildGradle,
  withGradleProperties,
} = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const vector = `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
<path android:fillColor="#F8F6F0" android:pathData="M0,0h108v108h-108z"/>
<path android:fillColor="#A44F3D" android:pathData="M30,25h48v58h-48z"/>
<path android:fillColor="#F8F6F0" android:pathData="M41,38h26v3h-26zM41,49h26v3h-26zM41,60h17v3h-17z"/>
</vector>`;
module.exports = (config) => {
  config = withGradleProperties(config, c => {
    for (const key of ['android.enableMinifyInReleaseBuilds', 'android.enableShrinkResourcesInReleaseBuilds']) {
      c.modResults = c.modResults.filter(p => p.key !== key);
      c.modResults.push({ type: 'property', key, value: 'true' });
    }
    return c;
  });
  config = withProjectBuildGradle(config, (c) => {
    if (!c.modResults.contents.includes('zixuNdkVersion'))
      c.modResults.contents =
        '// Optional local toolchain override; Expo default is retained otherwise.\nif (findProperty("zixuNdkVersion")) { ext.ndkVersion = findProperty("zixuNdkVersion") }\n' +
        c.modResults.contents;
    return c;
  });
  config = withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application[0];
    app.$['android:icon'] = '@drawable/ic_zixu';
    app.$['android:roundIcon'] = '@drawable/ic_zixu';
    return c;
  });
  return withDangerousMod(config, [
    'android',
    async (c) => {
      const folder = path.join(c.modRequest.platformProjectRoot, 'app/src/main/res/drawable');
      fs.mkdirSync(folder, { recursive: true });
      const source = path.join(c.modRequest.projectRoot, 'assets/say2.png');
      if (!fs.existsSync(source)) throw new Error('Missing assets/say2.png');
      fs.copyFileSync(source, path.join(folder, 'ic_zixu.png'));
      return c;
    },
  ]);
};
