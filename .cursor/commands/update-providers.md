# update-providers

## **Goal**
Scan all packages whose directory names start with:
`packages/provider-xxxx`

## **Tasks**
1. Locate each package’s `package.json` file.  
2. Check if any dependencies have newer available versions (**minor** or **patch only**).  
   - ❌ Do **not** upgrade major versions, as they may introduce breaking changes.  
3. Place **special emphasis** on updates related to the following libraries:
   - `wppconnect-team/wppconnect`
   - `whatsapp-web.js`
   - `whaileys`
   - `venom-bot`
   - `whiskeysockets/baileys` (or any “baileys” fork)
   - Any other WhatsApp automation libraries  
4. Automatically upgrade each dependency to the latest allowed minor/patch version.  
5. Install all updated dependencies using the project’s package manager.  
6. Run the full test suite.  
7. Confirm that all tests pass successfully.  
8. If any update causes a test failure, report the error and revert only the failing update.

## **Expected Outcome**
All `packages/provider-*` packages are updated to their latest compatible minor/patch versions—especially for WhatsApp-related libraries—without introducing breaking changes and with all tests passing cleanly.
