// app.config.js — extends app.json; everything static still lives there.
//
// It exists for ONE conditional: Android push needs Firebase config (google-services.json) baked
// into the build, and that file is created in the Firebase console, not in this repo. Naming it
// unconditionally in app.json would fail every build until someone adds it; leaving it out would
// ship a build where push can never work. So it is wired in only when the file is present.
//
// To enable push on Android: create a Firebase project, add the Android app com.the3cedgeai.app,
// download google-services.json into this folder, and upload the FCM V1 service-account key to EAS
// (`eas credentials`). The in-app notification lists work either way.

const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const googleServices = path.join(__dirname, 'google-services.json');
  if (fs.existsSync(googleServices)) {
    config.android = { ...config.android, googleServicesFile: './google-services.json' };
  }
  return config;
};
