#!/usr/bin/env bash
# build.sh — Build all CPU scheduling WASM modules (Linux/macOS/WSL)
# Usage: ./build.sh
# Prerequisite: Emscripten SDK activated (source ./emsdk/emsdk_env.sh)

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Colors ─────────────────────────────────────────────────
CYAN='\033[0;36m'; GREEN='\033[0;32m'; RED='\033[0;31m'
YELLOW='\033[1;33m'; GRAY='\033[0;37m'; MAGENTA='\033[0;35m'; NC='\033[0m'

step()  { echo -e "${CYAN}  ▶  $1${NC}"; }
ok()    { echo -e "${GREEN}  ✓  $1${NC}"; }
fail()  { echo -e "${RED}  ✗  $1${NC}"; }
info()  { echo -e "${GRAY}     $1${NC}"; }

echo ""
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}  CPU Scheduling Simulator — WASM Build Script  ${NC}"
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ── Check emcc ─────────────────────────────────────────────
step "Checking Emscripten (emcc)..."
if ! command -v emcc &> /dev/null; then
    fail "emcc not found on PATH."
    info "Install Emscripten SDK:"
    info "  git clone https://github.com/emscripten-core/emsdk.git"
    info "  cd emsdk && ./emsdk install latest && ./emsdk activate latest"
    info "  source ./emsdk_env.sh"
    exit 1
fi
ok "Found: $(emcc --version | head -1)"

# ── Fetch nlohmann/json if missing ─────────────────────────
JSON_HEADER="$SCRIPT_DIR/third_party/nlohmann/json.hpp"
if [ ! -f "$JSON_HEADER" ]; then
    step "Downloading nlohmann/json single header..."
    mkdir -p "$(dirname "$JSON_HEADER")"
    curl -L -o "$JSON_HEADER" \
        "https://github.com/nlohmann/json/releases/download/v3.11.3/json.hpp" \
        --progress-bar
    ok "nlohmann/json downloaded to third_party/nlohmann/json.hpp"
else
    ok "nlohmann/json already present."
fi

INCLUDE_PATH="$SCRIPT_DIR/third_party"
ALGORITHMS_DIR="$SCRIPT_DIR/algorithms"

# ── Algorithm definitions: name|dir|source|export ──────────
declare -A ALGO_DIRS=( [fcfs]=fcfs [sjf]=sjf [srtf]=srtf [round_robin]=round_robin [priority]=priority )
declare -A ALGO_SRCS=( [fcfs]=fcfs.cpp [sjf]=sjf.cpp [srtf]=srtf.cpp [round_robin]=round_robin.cpp [priority]=priority.cpp )
declare -A ALGO_EXPORTS=( [fcfs]=FCFSModule [sjf]=SJFModule [srtf]=SRTFModule [round_robin]=RoundRobinModule [priority]=PriorityModule )
ALGO_ORDER=(fcfs sjf srtf round_robin priority)

SUCCESS=0; FAILED=0

echo ""
echo -e "${YELLOW}Building algorithms...${NC}"
echo ""

for algo in "${ALGO_ORDER[@]}"; do
    dir="${ALGO_DIRS[$algo]}"
    src="${ALGO_SRCS[$algo]}"
    export_name="${ALGO_EXPORTS[$algo]}"

    algo_dir="$ALGORITHMS_DIR/$dir"
    source_file="$algo_dir/$src"
    output_js="$algo_dir/$dir.js"

    step "Compiling $algo ($src)..."

    if [ ! -f "$source_file" ]; then
        fail "Source not found: $source_file"
        (( FAILED++ )) || true
        continue
    fi

    if emcc "$source_file" \
        -o "$output_js" \
        -s MODULARIZE=1 \
        -s "EXPORT_NAME=\"$export_name\"" \
        -s "EXPORTED_RUNTIME_METHODS=[\"ccall\",\"cwrap\"]" \
        -s ENVIRONMENT=web \
        -s ALLOW_MEMORY_GROWTH=1 \
        -I "$INCLUDE_PATH" \
        -std=c++17 \
        -O2 2>&1; then
        ok "$algo → $dir.js + $dir.wasm"
        (( SUCCESS++ )) || true
    else
        fail "$algo compilation failed"
        (( FAILED++ )) || true
    fi
done

# ── Summary ────────────────────────────────────────────────
echo ""
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${MAGENTA}  Build Summary: ${GREEN}${SUCCESS} succeeded${MAGENTA}, ${RED}${FAILED} failed${NC}"
echo -e "${MAGENTA}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}  All modules compiled! Serve with:${NC}"
    echo -e "${CYAN}    python3 -m http.server 8080${NC}"
    echo -e "${CYAN}  Then open: http://localhost:8080${NC}"
    echo ""
fi

[ "$FAILED" -eq 0 ] || exit 1
