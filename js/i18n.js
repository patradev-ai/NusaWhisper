// Internationalization (i18n) system
class I18n {
  constructor() {
    this.currentLanguage =
      this.getStoredLanguage() || this.getBrowserLanguage();
    this.translations = {};
    this.supportedLanguages = ["en", "id"];

    this.init();
  }

  async init() {
    await this.loadTranslations();
    this.applyTranslations();
  }

  getStoredLanguage() {
    return localStorage.getItem("language");
  }

  getBrowserLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    const langCode = browserLang.split("-")[0];
    return this.supportedLanguages.includes(langCode) ? langCode : "en";
  }

  async loadTranslations() {
    try {
      const response = await fetch(`lang/${this.currentLanguage}.json`);
      this.translations = await response.json();
    } catch (error) {
      console.error("Failed to load translations:", error);
      // Fallback to English if current language fails
      if (this.currentLanguage !== "en") {
        try {
          const response = await fetch("lang/en.json");
          this.translations = await response.json();
        } catch (fallbackError) {
          console.error("Failed to load fallback translations:", fallbackError);
        }
      }
    }
  }

  t(key, params = {}) {
    const keys = key.split(".");
    let value = this.translations;

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        return key; // Return key if translation not found
      }
    }

    // Replace parameters in the translation
    if (typeof value === "string" && Object.keys(params).length > 0) {
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
    localStorage.setItem("language", language);

    await this.loadTranslations();
    this.applyTranslations();

    return true;
  }

  applyTranslations() {
    // Apply translations to elements with data-i18n attribute
    document.querySelectorAll("[data-i18n]").forEach((element) => {
      const key = element.getAttribute("data-i18n");
      const translation = this.t(key);

      if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
        if (element.getAttribute("placeholder") !== null) {
          element.placeholder = translation;
        } else {
          element.value = translation;
        }
      } else {
        element.textContent = translation;
      }
    });

    // Apply translations to elements with data-i18n-title attribute
    document.querySelectorAll("[data-i18n-title]").forEach((element) => {
      const key = element.getAttribute("data-i18n-title");
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
