#!/bin/bash
cd "$(dirname "$0")"
PORT=${PORT:-8084}
echo "Drag Race 3D dev server: http://localhost:$PORT"
python3 -m http.server "$PORT"
