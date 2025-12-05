#!/bin/bash

echo "=== TUXEDO Control Center Structure Analysis ==="
echo ""
echo "Angular App Directory Structure:"
echo "================================"
tree -L 3 src/ng-app/app 2>/dev/null || find src/ng-app/app -type d -maxdepth 3

echo ""
echo "Component Count:"
echo "================"
find src/ng-app -name "*.component.ts" | wc -l

echo ""
echo "All Angular Components:"
echo "======================"
find src/ng-app -name "*.component.ts" -o -name "*.module.ts" | sort

echo ""
echo "Service App Structure:"
echo "====================="
tree -L 2 src/service-app 2>/dev/null || find src/service-app -type d -maxdepth 2

echo ""
echo "File Sizes by Component:"
echo "======================="
du -sh src/ng-app/app/*/ 2>/dev/null | sort -rh