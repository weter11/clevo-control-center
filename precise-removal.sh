#!/bin/bash

echo "=== Removing Components (Phase 1 - Water cooling & Support only) ==="
echo ""

# Water cooling
echo "1. Removing Aquaris water cooling control..."
rm -rf src/ng-app/app/aquaris-control/

# Support/Tomte
echo "2. Removing Tomte support assistant..."
rm -rf src/ng-app/app/tomte-gui/
rm -rf src/ng-app/app/support/

# Encryption password change
echo "3. Removing disk encryption password changer..."
rm -rf src/ng-app/app/change-crypt-password/

# Shutdown timer (optional)
echo "4. Removing shutdown timer..."
rm -rf src/ng-app/app/shutdown-timer/

echo ""
echo "=== Components removed! ==="
echo "Total removed: ~156KB of Angular components"
echo ""
echo "KEPT for later simplification:"
echo "  - webcam-settings / webcam-preview"
echo "  - prime-dialog / prime-select"
echo ""
echo "Next steps:"
echo "1. Check src/ng-app/app/tools/ to see if it's needed"
echo "2. Modify app-routing.module.ts"
echo "3. Modify app.module.ts"
echo "4. Test build with: npm run build"