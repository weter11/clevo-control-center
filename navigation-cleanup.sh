#!/bin/bash

echo "=== Finding Navigation References ==="
echo ""

echo "1. Searching for Aquaris in navigation..."
grep -n "aquaris\|Aquaris" src/ng-app/app/main-gui/main-gui.component.ts
grep -n "aquaris\|Aquaris" src/ng-app/app/main-gui/main-gui.component.html

echo ""
echo "2. Searching for Tomte in settings..."
grep -n "tomte\|Tomte" src/ng-app/app/global-settings/global-settings.component.ts
grep -n "tomte\|Tomte" src/ng-app/app/global-settings/global-settings.component.html

echo ""
echo "3. Searching for language switcher..."
grep -n "buttonToggleLanguage\|buttonLanguageLabel" src/ng-app/app/main-gui/main-gui.component.ts

echo ""
echo "=== Files to Edit ==="
echo "- src/ng-app/app/main-gui/main-gui.component.ts"
echo "- src/ng-app/app/main-gui/main-gui.component.html"
echo "- src/ng-app/app/global-settings/global-settings.component.ts"
echo "- src/ng-app/app/global-settings/global-settings.component.html"
echo ""
echo "Run this to edit them:"
echo "nano src/ng-app/app/main-gui/main-gui.component.ts"
