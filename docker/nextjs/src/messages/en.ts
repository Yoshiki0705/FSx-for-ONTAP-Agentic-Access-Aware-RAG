export default {
  // Common
  common: {
    appName: "RAG Application",
    welcome: "Welcome",
    signOut: "Sign Out",
    loading: "Loading...",
    error: "Error",
    success: "Success",
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    edit: "Edit",
    create: "Create",
    update: "Update",
    confirm: "Confirm",
    back: "Back",
    next: "Next",
    previous: "Previous",
    close: "Close",
    open: "Open",
    yes: "Yes",
    no: "No"
  },

  // Authentication
  auth: {
    brandTitle: "RAG Application",
    username: "Username",
    usernameLabel: "Username",
    password: "Password",
    passwordLabel: "Password",
    signIn: "Sign In",
    signOut: "Sign Out",
    signUp: "Sign Up",
    forgotPassword: "Forgot Password?",
    rememberMe: "Remember me",
    invalidCredentials: "Invalid username or password",
    sessionExpired: "Your session has expired. Please sign in again."
  },

  // Navigation
  nav: {
    home: "Home",
    chatbot: "Chatbot",
    settings: "Settings",
    profile: "Profile",
    dashboard: "Dashboard"
  },

  // Sidebar
  sidebar: {
    settingsPanel: "Settings Panel",
    userInfo: "User Information",
    accessPermissions: "Access Permissions",
    modelSelection: "Model Selection",
    chatHistory: "Chat History",
    newChat: "New Chat",
    agentMode: "Agent Mode",
    kbMode: "KB Mode",
    saveHistory: "Save History",
    clearHistory: "Clear History"
  },

  // Chat
  chat: {
    newChat: "New Chat",
    send: "Send",
    sending: "Sending...",
    placeholder: "Type your message...",
    noMessages: "No messages yet",
    errorSending: "Error sending message",
    sessionHistory: "Session History",
    clearHistory: "Clear History",
    exportHistory: "Export History"
  },

  // Chatbot specific
  chatbot: {
    send: "Send",
    sending: "Sending...",
    placeholder: "Type your message...",
    agentMode: "Agent Mode",
    kbMode: "KB Mode",
    switchToAgent: "Switch to Agent Mode",
    switchToKB: "Switch to KB Mode",
    modelSelector: "Select Model",
    tracePanel: "Trace Panel",
    sessionHistory: "Session History"
  },

  // Errors
  error: {
    generic: "An error occurred",
    network: "Network error",
    timeout: "Request timeout",
    unauthorized: "Unauthorized access",
    forbidden: "Access forbidden",
    notFound: "Not found",
    serverError: "Server error",
    validationError: "Validation error"
  },

  // Region Selector
  regionSelector: {
    bedrockRegion: "Bedrock Region",
    selectRegion: "Select Region",
    currentRegion: "Current Region",
    availableRegions: "Available Regions"
  },

  // Agent
  agent: {
    createAgent: "Create Agent",
    agentName: "Agent Name",
    agentDescription: "Agent Description",
    agentInstructions: "Agent Instructions",
    agentModel: "Agent Model",
    createNew: "Create New Agent",
    editAgent: "Edit Agent",
    deleteAgent: "Delete Agent",
    agentCreated: "Agent created successfully",
    agentUpdated: "Agent updated successfully",
    agentDeleted: "Agent deleted successfully"
  },

  // Models
  models: {
    selectModel: "Select Model",
    currentModel: "Current Model",
    availableModels: "Available Models",
    modelLoading: "Loading models...",
    modelError: "Error loading models"
  },

  // Settings
  settings: {
    general: "General Settings",
    appearance: "Appearance",
    language: "Language",
    theme: "Theme",
    notifications: "Notifications",
    privacy: "Privacy",
    security: "Security"
  },

  // Theme
  theme: {
    light: "Light",
    dark: "Dark",
    system: "System",
    auto: "Auto"
  }
} as const;
