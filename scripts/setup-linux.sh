#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# ANSI escape codes for coloring output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}================================================================${NC}"
echo -e "${BLUE}          Nemosyne Developer Setup for Linux                    ${NC}"
echo -e "${BLUE}================================================================${NC}"

# 1. System Package Manager & Build Essentials Check
echo -e "\n${YELLOW}[1/7] Checking build dependencies and C compiler...${NC}"
if ! command -v gcc &>/dev/null && ! command -v clang &>/dev/null; then
    echo -e "${YELLOW}C compiler (gcc/clang) not found. Attempting to install build essentials...${NC}"
    if command -v apt-get &>/dev/null; then
        sudo apt-get update && sudo apt-get install -y build-essential pkg-config libssl-dev curl git openssl
    elif command -v dnf &>/dev/null; then
        sudo dnf groupinstall -y "Development Tools" && sudo dnf install -y openssl-devel pkgconfig curl git openssl
    elif command -v pacman &>/dev/null; then
        sudo pacman -Sy --needed base-devel openssl pkg-config curl git
    elif command -v zypper &>/dev/null; then
        sudo zypper install -t pattern devel_basis && sudo zypper install -y libopenssl-devel pkg-config curl git openssl
    elif command -v apk &>/dev/null; then
        sudo apk add build-base openssl-dev pkgconfig curl git openssl
    else
        echo -e "${RED}Unknown package manager. Please manually install gcc, pkg-config, openssl, curl, and git.${NC}"
    fi
else
    echo -e "${GREEN}✓ Build essentials / C compiler detected.${NC}"
fi

# 2. Node.js Check and Dependency Install
echo -e "\n${YELLOW}[2/7] Checking Node.js (v20+ required)...${NC}"
if command -v node &>/dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 20 ]; then
        echo -e "${GREEN}✓ Node.js $(node -v) is installed.${NC}"
    else
        echo -e "${RED}Your Node.js version $(node -v) is older than 20. Please update Node.js to v20 or later.${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}Node.js not found. Installing via NodeSource (Node 22 LTS)...${NC}"
    if command -v apt-get &>/dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif command -v dnf &>/dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
        sudo dnf install -y nodejs
    else
        echo -e "${RED}Please install Node.js v20+ using your package manager (e.g. nvm, fnm, or official package).${NC}"
        exit 1
    fi
fi

# 3. NPM Dependencies
echo -e "\n${YELLOW}[3/7] Installing npm dependencies...${NC}"
npm install

# 4. Rust, rustup, and WebAssembly Target Setup
echo -e "\n${YELLOW}[4/7] Checking Rust and WebAssembly Toolchain...${NC}"
if [ -f "$HOME/.cargo/env" ]; then
    # shellcheck disable=SC1091
    source "$HOME/.cargo/env"
fi

if command -v rustup &>/dev/null; then
    echo -e "${GREEN}✓ rustup is installed.${NC}"
else
    echo -e "${YELLOW}Rust toolchain manager (rustup) not found. Installing...${NC}"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    if [ -f "$HOME/.cargo/env" ]; then
        # shellcheck disable=SC1091
        source "$HOME/.cargo/env"
    fi
fi

export PATH="$HOME/.cargo/bin:$PATH"

if command -v cargo &>/dev/null; then
    echo -e "${GREEN}✓ Cargo/Rust $(rustc --version) is ready.${NC}"
else
    echo -e "${RED}Error: Rust/Cargo installation failed or is not in PATH.${NC}"
    exit 1
fi

# Ensure cargo env is in user shell profile
for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
    if [ -f "$rc" ] && ! grep -q "\.cargo/env" "$rc"; then
        echo 'source "$HOME/.cargo/env"' >> "$rc"
    fi
done

echo -e "Ensuring WebAssembly (wasm32-unknown-unknown) target is installed..."
rustup target add wasm32-unknown-unknown

# 5. wasm-pack Setup
echo -e "\n${YELLOW}[5/7] Checking wasm-pack...${NC}"
if command -v wasm-pack &>/dev/null; then
    echo -e "${GREEN}✓ wasm-pack is installed at $(which wasm-pack)${NC}"
else
    echo -e "${YELLOW}wasm-pack not found. Installing via official script...${NC}"
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# 6. Generate Self-Signed TLS Certificates (WebXR requirement)
echo -e "\n${YELLOW}[6/7] Setting up secure local development certificates (WebXR requirement)...${NC}"
if [ -f "certs/key.pem" ] && [ -f "certs/cert.pem" ]; then
    echo -e "${GREEN}✓ Secure certificates found in certs/ directory.${NC}"
else
    echo -e "${YELLOW}Generating self-signed certificates using OpenSSL...${NC}"
    mkdir -p certs
    openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem -subj "/CN=localhost" -nodes
    echo -e "${GREEN}✓ Generated certs/key.pem and certs/cert.pem${NC}"
fi

# 7. Compile the WebAssembly Analytical Kernel and Verify Build
echo -e "\n${YELLOW}[7/7] Compiling the WebAssembly Analytical Kernel...${NC}"
npm run wasm:dev

echo -e "\n${YELLOW}Running the test suite to verify everything is fully green...${NC}"
npm run test:all

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}         Setup Completed Successfully! Nemosyne is ready!        ${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "\nTo start developing on Linux:"
echo -e "1. Start the Vite development server with WASM compilation enabled:"
echo -e "   ${BLUE}npm run dev:wasm${NC}"
echo -e "2. Find your local IP address in the dev server output."
echo -e "3. Open your Meta Quest or local browser and navigate to:"
echo -e "   ${BLUE}https://<your-ip>:5173${NC}"
echo -e "4. Accept the self-signed HTTPS certificate warning and enter VR!"
