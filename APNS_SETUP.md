# APNs Setup Guide

## 1. Create APNs Key in Apple Developer Console

1. Go to [Apple Developer Console](https://developer.apple.com/account/)
2. Navigate to **Keys** → **All**
3. Click **+** to create a new key
4. Select **Apple Push Notifications service (APNs)**
5. Choose your App ID (e.g., `com.yourcompany.skillify`)
6. Download the `.p8` file
7. Note the **Key ID** and **Team ID**

## 2. Add Key to Project

1. Place the `.p8` file in your project root directory
2. Add environment variables to your `.env` file:

```env
# APNs Configuration
APNS_KEY_PATH=./AuthKey_XXXXXXXXXX.p8
APNS_KEY_ID=XXXXXXXXXX
APNS_TEAM_ID=XXXXXXXXXX
APNS_BUNDLE_ID=com.yourcompany.skillify
```

## 3. Environment Variables

- `APNS_KEY_PATH`: Path to your `.p8` key file
- `APNS_KEY_ID`: The Key ID from Apple Developer Console
- `APNS_TEAM_ID`: Your Team ID from Apple Developer Console
- `APNS_BUNDLE_ID`: Your app's bundle identifier

## 4. Test Push Notifications

1. Deploy the backend with APNs configuration
2. Launch the iOS app and authenticate
3. Send a message in a chat
4. Check if other participants receive push notifications

## Troubleshooting

- Ensure the `.p8` file is accessible and readable
- Verify the Key ID and Team ID are correct
- Check that the Bundle ID matches your iOS app
- For development, use sandbox environment
- For production, set `NODE_ENV=production`
