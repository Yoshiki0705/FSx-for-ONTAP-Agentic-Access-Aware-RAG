export default {
  // Common
  common: {
    appName: "RAGアプリケーション",
    welcome: "ようこそ",
    signOut: "サインアウト",
    loading: "読み込み中...",
    error: "エラー",
    success: "成功",
    cancel: "キャンセル",
    save: "保存",
    delete: "削除",
    edit: "編集",
    create: "作成",
    update: "更新",
    confirm: "確認",
    back: "戻る",
    next: "次へ",
    previous: "前へ",
    close: "閉じる",
    open: "開く",
    yes: "はい",
    no: "いいえ"
  },

  // Authentication
  auth: {
    brandTitle: "RAGアプリケーション",
    username: "ユーザー名",
    usernameLabel: "ユーザー名",
    password: "パスワード",
    passwordLabel: "パスワード",
    signIn: "サインイン",
    signOut: "サインアウト",
    signUp: "サインアップ",
    forgotPassword: "パスワードを忘れましたか？",
    rememberMe: "ログイン状態を保持",
    invalidCredentials: "ユーザー名またはパスワードが正しくありません",
    sessionExpired: "セッションが期限切れです。再度サインインしてください。"
  },

  // Navigation
  nav: {
    home: "ホーム",
    chatbot: "チャットボット",
    settings: "設定",
    profile: "プロフィール",
    dashboard: "ダッシュボード"
  },

  // Sidebar
  sidebar: {
    settingsPanel: "設定パネル",
    userInfo: "ユーザー情報",
    accessPermissions: "アクセス権限",
    modelSelection: "モデル選択",
    chatHistory: "チャット履歴",
    newChat: "新しいチャット",
    agentMode: "エージェントモード",
    kbMode: "KBモード",
    saveHistory: "履歴を保存",
    clearHistory: "履歴をクリア"
  },

  // Chat
  chat: {
    newChat: "新しいチャット",
    send: "送信",
    sending: "送信中...",
    placeholder: "メッセージを入力...",
    noMessages: "メッセージがありません",
    errorSending: "メッセージの送信エラー",
    sessionHistory: "セッション履歴",
    clearHistory: "履歴をクリア",
    exportHistory: "履歴をエクスポート"
  },

  // Chatbot specific
  chatbot: {
    send: "送信",
    sending: "送信中...",
    placeholder: "メッセージを入力...",
    agentMode: "エージェントモード",
    kbMode: "KBモード",
    switchToAgent: "エージェントモードに切り替え",
    switchToKB: "KBモードに切り替え",
    modelSelector: "モデル選択",
    tracePanel: "トレースパネル",
    sessionHistory: "セッション履歴"
  },

  // Errors
  error: {
    generic: "エラーが発生しました",
    network: "ネットワークエラー",
    timeout: "リクエストタイムアウト",
    unauthorized: "認証されていません",
    forbidden: "アクセスが禁止されています",
    notFound: "見つかりません",
    serverError: "サーバーエラー",
    validationError: "検証エラー"
  },

  // Region Selector
  regionSelector: {
    bedrockRegion: "Bedrockリージョン",
    selectRegion: "リージョンを選択",
    currentRegion: "現在のリージョン",
    availableRegions: "利用可能なリージョン"
  },

  // Agent
  agent: {
    createAgent: "エージェント作成",
    agentName: "エージェント名",
    agentDescription: "エージェントの説明",
    agentInstructions: "エージェントの指示",
    agentModel: "エージェントモデル",
    createNew: "新しいエージェントを作成",
    editAgent: "エージェントを編集",
    deleteAgent: "エージェントを削除",
    agentCreated: "エージェントが正常に作成されました",
    agentUpdated: "エージェントが正常に更新されました",
    agentDeleted: "エージェントが正常に削除されました"
  },

  // Models
  models: {
    selectModel: "モデルを選択",
    currentModel: "現在のモデル",
    availableModels: "利用可能なモデル",
    modelLoading: "モデル読み込み中...",
    modelError: "モデル読み込みエラー"
  },

  // Settings
  settings: {
    general: "一般設定",
    appearance: "外観",
    language: "言語",
    theme: "テーマ",
    notifications: "通知",
    privacy: "プライバシー",
    security: "セキュリティ"
  },

  // Theme
  theme: {
    light: "ライト",
    dark: "ダーク",
    system: "システム",
    auto: "自動"
  }
} as const;
