# App Controller Agent

Android agent prototype for remote, permission-based device automation.

## Included
- Telegram Bot polling
- AccessibilityService for UI actions
- Device Admin lock-screen action
- Full-screen overlay for image/video placeholders
- Foreground audio service
- Modern glass-style control panel
- GitHub Actions APK build

## Important
This project requires the user to explicitly enable Android permissions/services.
It does not use root.

### Telegram setup
1. Create a bot with BotFather.
2. Put the bot token into the app's Settings screen.
3. Send `/start` to the bot and use the displayed chat ID.
4. Enable Telegram control.
5. Keep secrets out of GitHub source code.

### Build
Open the project in Android Studio or use GitHub Actions.

The workflow produces a debug APK artifact.

## Supported commands
/start
/help
/status
/lock
/unlock
/freeze
/unfreeze
/sound
/stop_sound
/overlay
/close_overlay
/back
/home
/recents
