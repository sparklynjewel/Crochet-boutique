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

## Authentication still to finish

The mobile app currently submits an email to the same backend used by the web
app. This restores the same user's cart, but entering an email does not verify
ownership of the account. The website uses Google sign-in. Proper mobile Google
sign-in and its client/redirect settings still need to be completed before claiming
equivalent authentication in the assignment demonstration.

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
