// Authentication module for MetaMask integration
class Auth {
    constructor(gun) {
        this.gun = gun;
        this.user = null;
        this.web3 = null;
    }

    async checkConnection() {
        try {
            if (!this.isMetaMaskAvailable()) {
                return null;
            }

            const accounts = await window.ethereum.request({ method: 'eth_accounts' });
            
            if (accounts.length > 0) {
                const address = accounts[0];
                return {
                    address: address,
                    shortAddress: this.formatAddress(address)
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error checking connection:', error);
            return null;
        }
    }

    async connectWallet() {
        try {
            if (!this.isMetaMaskAvailable()) {
                throw new Error('MetaMask is not installed. Please install MetaMask to continue.');
            }

            // Request account access
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });

            if (accounts.length === 0) {
                throw new Error('No accounts found. Please unlock MetaMask.');
            }

            const address = accounts[0];
            
            // Get network info
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            
            // Create user object
            const user = {
                address: address,
                shortAddress: this.formatAddress(address),
                chainId: chainId,
                connectedAt: Date.now()
            };

            // Sign a message to verify ownership
            const message = `Welcome to DecentralChat!\n\nAddress: ${address}\nTime: ${new Date().toISOString()}`;
            
            try {
                const signature = await this.signMessage(message, address);
                user.signature = signature;
                user.signedMessage = message;
            } catch (sigError) {
                console.warn('Message signing failed:', sigError);
                // Continue without signature for now
            }

            this.user = user;
            return user;

        } catch (error) {
            console.error('Wallet connection failed:', error);
            throw error;
        }
    }

    async signMessage(message, address) {
        try {
            const signature = await window.ethereum.request({
                method: 'personal_sign',
                params: [message, address]
            });
            return signature;
        } catch (error) {
            console.error('Message signing failed:', error);
            throw error;
        }
    }

    async signChatMessage(message, address) {
        try {
            const timestamp = Date.now();
            const messageToSign = `${message}|${timestamp}|${address}`;
            
            // Use a simple hash for automatic signing instead of MetaMask popup
            const signature = this.generateMessageHash(messageToSign);
            
            return {
                message: message,
                timestamp: timestamp,
                signature: signature,
                signedData: messageToSign
            };
        } catch (error) {
            console.error('Chat message signing failed:', error);
            throw error;
        }
    }

    // Generate a simple hash for message signing without MetaMask popup
    generateMessageHash(data) {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `auto_${Math.abs(hash).toString(16)}`;
    }

    async disconnect() {
        try {
            this.user = null;
            // Clear any stored data
            localStorage.removeItem('decentralchat_user');
            return true;
        } catch (error) {
            console.error('Disconnect failed:', error);
            throw error;
        }
    }

    isMetaMaskAvailable() {
        return typeof window.ethereum !== 'undefined' && window.ethereum.isMetaMask;
    }

    formatAddress(address) {
        if (!address) return '';
        return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
    }

    getCurrentUser() {
        return this.user;
    }

    async getBalance(address) {
        try {
            const balance = await window.ethereum.request({
                method: 'eth_getBalance',
                params: [address, 'latest']
            });
            
            // Convert from wei to ether
            const etherBalance = parseInt(balance, 16) / Math.pow(10, 18);
            return etherBalance;
        } catch (error) {
            console.error('Failed to get balance:', error);
            return 0;
        }
    }

    async getNetworkInfo() {
        try {
            const chainId = await window.ethereum.request({ method: 'eth_chainId' });
            const networkMap = {
                '0x1': 'Ethereum Mainnet',
                '0x3': 'Ropsten Testnet',
                '0x4': 'Rinkeby Testnet',
                '0x5': 'Goerli Testnet',
                '0x2a': 'Kovan Testnet',
                '0x89': 'Polygon Mainnet',
                '0x13881': 'Polygon Mumbai',
                '0x38': 'BSC Mainnet',
                '0x61': 'BSC Testnet'
            };
            
            return {
                chainId: chainId,
                networkName: networkMap[chainId] || 'Unknown Network'
            };
        } catch (error) {
            console.error('Failed to get network info:', error);
            return { chainId: null, networkName: 'Unknown' };
        }
    }

    // Verify a signed message
    async verifySignature(message, signature, address) {
        try {
            // This would typically be done on the server-side
            // For client-side verification, we can use a library like ethers.js
            // For now, we'll return true if signature exists
            return signature && signature.length > 0;
        } catch (error) {
            console.error('Signature verification failed:', error);
            return false;
        }
    }

    // Generate a simple hash for message signing without MetaMask popup
    generateMessageHash(data) {
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return `auto_${Math.abs(hash).toString(16)}`;
    }

    // Generate a unique user ID based on address
    generateUserId(address) {
        return `user_${address.toLowerCase().substring(2, 10)}`;
    }

    // Check if user has signed the welcome message
    hasValidSignature(user) {
        return user && user.signature && user.signedMessage;
    }

    // Get or set user nickname
    async getUserNickname(address) {
        try {
            const stored = Utils.getLocalStorage(`nickname_${address}`);
            return stored || this.formatAddress(address);
        } catch (error) {
            console.error('Failed to get nickname:', error);
            return this.formatAddress(address);
        }
    }

    async setUserNickname(address, nickname) {
        try {
            if (nickname && nickname.trim().length > 0) {
                Utils.setLocalStorage(`nickname_${address}`, nickname.trim());
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to set nickname:', error);
            return false;
        }
    }
}
