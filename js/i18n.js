// Internationalization (i18n) system
class I18n {
  constructor() {
    this.currentLanguage = 'en'; // Start with safe default
    this.translations = {};
    this.supportedLanguages = ['en', 'id'];
    
    try {
      this.currentLanguage = this.getStoredLanguage() || this.getBrowserLanguage();
    } catch (error) {
      console.warn('Failed to determine language, using English:', error);
      this.currentLanguage = 'en';
    }
  }

  async init() {
    try {
      await this.loadTranslations();
      this.applyTranslations();
    } catch (error) {
      console.error('Failed to initialize i18n, using fallback:', error);
      this.setFallbackTranslations();
    }
  }

  getStoredLanguage() {
    return localStorage.getItem('language');
  }

  getBrowserLanguage() {
    try {
      const browserLang = navigator.language || navigator.userLanguage || 'en';
      const langCode = browserLang.split('-')[0];
      return this.supportedLanguages.includes(langCode) ? langCode : 'en';
    } catch (error) {
      console.warn('Failed to detect browser language:', error);
      return 'en';
    }
  }

  async loadTranslations() {
    try {
      const response = await fetch(`lang/${this.currentLanguage}.json`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      this.translations = await response.json();
    } catch (error) {
      console.error('Failed to load translations:', error);
      // Fallback to English if current language fails
      if (this.currentLanguage !== 'en') {
        try {
          const response = await fetch('lang/en.json');
          if (response.ok) {
            this.translations = await response.json();
          } else {
            this.setFallbackTranslations();
          }
        } catch (fallbackError) {
          console.error('Failed to load fallback translations:', fallbackError);
          this.setFallbackTranslations();
        }
      } else {
        this.setFallbackTranslations();
      }
    }
  }

  setFallbackTranslations() {
    // Basic fallback translations to prevent errors
    this.translations = {
      app: {
        title: "NusaWhisper",
        subtitle: "Web3 Chat"
      },
      auth: {
        welcome: "Welcome to NusaWhisper",
        connectWallet: "Connect MetaMask"
      },
      navigation: {
        rooms: "Rooms",
        contacts: "Contacts",
        onlineUsers: "Online Users"
      },
      actions: {
        createRoom: "Create Room",
        sendMessage: "Send Message"
      },
      messages: {
        directChatStarted: "Direct chat started",
        failedStartChat: "Failed to start direct chat",
        enterWalletAddress: "Please enter a wallet address",
        invalidWalletAddress: "Invalid wallet address"
      }
    };
  }

  t(key, params = {}) {
    const keys = key.split('.');
    let value = this.translations;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }
    
    // Replace parameters in the translation
    if (typeof value === 'string' && Object.keys(params).length > 0) {
      return value.replace(/\{(\w+)\}/g, (match, param) => {
        return params[param] || match;
      });
    }
    
    return value;
  }

  async setLanguage(language) {
    if (!this.supportedLanguages.includes(language)) {
      return false;
    }
    
    this.currentLanguage = language;
    localStorage.setItem('language', language);
    
    await this.loadTranslations();
    this.applyTranslations();
    
    return true;
  }

  applyTranslations() {
    // Apply translations to elements with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = this.t(key);
      
      if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
        if (element.getAttribute('placeholder') !== null) {
          element.placeholder = translation;
        } else {
          element.value = translation;
        }
      } else {
        element.textContent = translation;
      }
    });

    // Apply translations to elements with data-i18n-title attribute
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      element.title = this.t(key);
    });
  }

  getCurrentLanguage() {
    return this.currentLanguage;
  }

  getSupportedLanguages() {
    return this.supportedLanguages;
  }
}

// Export for global use
window.I18n = I18n;