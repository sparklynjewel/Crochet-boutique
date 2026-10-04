# CrochetStudio on a physical phone

The `preview` build is an installed app with its own CrochetStudio icon. It runs
without Expo Go or a development server and uses the same hosted backend as the
website: https://crochet-boutique-0si4.onrender.com.

Preparing these files does not build or install the app. Installation and the
phone recording still need to be completed.

## Install on the Galaxy J7 Prime (Android 8.1)

The app's React Native runtime supports Android 7 and newer, including this
phone's older ARM processor. Actual installation and performance still need to
be checked on the phone.

An Android APK can be installed without a paid Apple or Google developer
membership. The `preview` profile already produces an APK.

From the `mobile` folder:

```powershell
npx.cmd eas-cli@latest build --platform android --profile preview
```

Use the free Expo account and follow the build prompts. When the cloud build
finishes, open the build's installation link in Chrome on the Android phone,
download the APK, and install it. If Android asks for permission to install apps
from Chrome, grant that permission for this installation. CrochetStudio should
then appear in the phone's app list and can be added to the home screen.

For recording on Android 8.1, first check whether the phone has a built-in screen
recorder. If it does not, use an Android 8-compatible screen recorder or connect
the phone to a computer and record its screen there. Test the recording before
starting the assignment demonstration.

## Install on an iPhone from Windows

Expo's cloud build service (EAS Build) can build the iPhone app without a Mac.
Its usual internal distribution workflow requires:

- An Expo account.
- An active paid Apple Developer membership and permission to use its team.
- Registering the physical iPhone for the build.

Do not buy a membership before checking whether the course provides a developer
team. A Mac can also support a different local signing workflow; that requires
access to the Mac. An Android preview build has a different installation process
and does not require an Apple membership.

Once account access is available, run these commands in the `mobile` folder:

```powershell
npx.cmd eas-cli@latest login
npx.cmd eas-cli@latest device:create
npx.cmd eas-cli@latest build --platform ios --profile preview
```

Follow EAS's account and signing prompts. Register the iPhone using the link EAS
provides, and include that device in the build. If EAS asks to create/link an Expo
project, use the account intended for this assignment.

After the build completes, open the installation link in Safari on the registered
iPhone and install the app. Open CrochetStudio from its home screen icon.

## Google sign-in setup for the installed Android app

The updated source uses native Google sign-in and sends Google's ID token to the
same `/api/auth/google` endpoint as the website. It reads the website's web client
ID from `/api/config`. It does not sign a user in by accepting a typed email.
The previous APK (version 1.0.0) still has the email-entry form; a new APK must be
built and installed to use this change.

Register an Android OAuth client in the **same Google Cloud project** as the
website's web OAuth client (project number `1072336752393`):

- Name: `CrochetStudio Android`.
- Package name: `com.crochet.studio`.
- Signing certificate SHA-1: `93:69:14:B3:E2:23:F4:07:00:9A:CC:8C:61:63:43:B0:0B:29:27:20`.

Use Google Cloud Console → Google Auth Platform → Clients → Create client →
Android. The SHA-1 above was read from the successfully verified preview APK.
Continue to use the same EAS signing key for subsequent Android preview builds.
An Android client ID does not replace the web client ID on the backend.

Android uses the library's native autolinking and the Google Play services
dependency; this setup does not require Firebase. The native sign-in module
requires a rebuilt installed app. Expo Go can show the shop but cannot run this
native Google sign-in. iOS Google sign-in additionally needs its own client ID
and URL scheme before an iPhone build can be used for authentication.

This is not a complete API authorization redesign: existing cart/order endpoints
still identify users with `user_id`, and the backend retains its legacy email
login path. Do not describe the whole API as protected against impersonation.

## Screen recording checklist

1. Start on the iPhone home screen and tap the CrochetStudio icon.
2. Show the completed authentication flow and the signed-in account.
3. Sign into the website with the same email/account.
4. Add a product on the website. Wait a few seconds and show it in the phone cart.
5. Change the quantity on the phone. Show the website cart update.
6. Sign out and back in on the phone. Show the saved cart return.

iPhone Screen Recording captures only the iPhone screen. To show the website in
the same recording, switch to Safari on the phone and open the website, or record
the computer separately and combine the clips if the course permits editing.
Include a computer view as well if the assessor expects proof of desktop-to-phone
sync.

Use a test cart; no payment or actual order is needed to demonstrate cart syncing.
