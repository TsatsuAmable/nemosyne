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
echo -e "${BLUE}          Nemosyne Developer Setup for macOS / MacBook          ${NC}"
echo -e "${BLUE}================================================================${NC}"

# 1. Xcode Command Line Tools Check
echo -e "\n${YELLOW}[1/7] Checking Xcode Command Line Tools...${NC}"
if xcode-select -p &>/dev/null; then
    echo -e "${GREEN}✓ Xcode Command Line Tools are already installed.${NC}"
else
    echo -e "${YELLOW}Xcode Command Line Tools are missing. Launching installation...${NC}"
    xcode-select --install
    echo -e "${RED}Please complete the Xcode Command Line Tools installation dialog, then run this script again.${NC}"
    exit 1
fi

# 2. Homebrew Check & Optional Setup
echo -e "\n${YELLOW}[2/7] Checking Homebrew...${NC}"
if command -v brew &>/dev/null; then
    echo -e "${GREEN}✓ Homebrew is installed at $(which brew)${NC}"
else
    echo -e "${YELLOW}Homebrew not found. You can install it by running:${NC}"
    echo -e "  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo -e "Would you like this script to install Homebrew for you? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        # Add brew to path for the current session
        if [[ -f /opt/homebrew/bin/brew ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [[ -f /usr/local/bin/brew ]]; then
            eval "$(/usr/local/bin/brew shellenv)"
        fi
    else
        echo -e "${RED}Please install Homebrew and re-run this script to continue auto-setup.${NC}"
        exit 1
    fi
fi

# 3. Node.js Check and Dependency Install
echo -e "\n${YELLOW}[3/7] Checking Node.js...${NC}"
if command -v node &>/dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 20 ]; then
        echo -e "${GREEN}✓ Node.js $(node -v) is installed.${NC}"
    else
        echo -e "${YELLOW}Your Node.js version $(node -v) is older than 20. Updating via Homebrew...${NC}"
        brew install node
    fi
else
    echo -e "${YELLOW}Node.js not found. Installing via Homebrew...${NC}"
    brew install node
fi

echo -e "\n${YELLOW}Installing npm dependencies...${NC}"
npm install

# 4. Rust, rustup, and WebAssembly Target Setup
echo -e "\n${YELLOW}[4/7] Checking Rust and WebAssembly Toolchain...${NC}"
if command -v rustup &>/dev/null; then
    echo -e "${GREEN}✓ rustup is installed.${NC}"
else
    echo -e "${YELLOW}Rust toolchain manager (rustup) not found. Installing...${NC}"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    # Source cargo env for current script run
    source "$HOME/.cargo/env"
fi

# Ensure cargo is in PATH for this script session
export PATH="$HOME/.cargo/bin:$PATH"

if command -v cargo &>/dev/null; then
    echo -e "${GREEN}✓ Cargo/Rust $(rustc --version) is ready.${NC}"
else
    echo -e "${RED}Error: Rust/Cargo installation failed or is not in PATH. Please run 'source \$HOME/.cargo/env' and try again.${NC}"
    exit 1
fi

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
echo -e "\nTo start developing on your MacBook:"
echo -e "1. Start the Vite development server with WASM compilation enabled:"
echo -e "   ${BLUE}npm run dev:wasm${NC}"
echo -e "2. Find your MacBook's IP address (e.g. 192.168.1.50) in the dev output."
echo -e "3. Open your Meta Quest or local browser and navigate to:"
echo -e "   ${BLUE}https://<your-macbook-ip>:5173${NC}"
echo -e "4. Accept the self-signed HTTPS certificate warning and enter VR!"
