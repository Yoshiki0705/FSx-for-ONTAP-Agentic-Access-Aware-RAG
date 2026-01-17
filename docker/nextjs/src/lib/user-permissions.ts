/**
 * UserPermissions
 * 
 * ユーザー権限を管理するクラス
 * DynamoDBからユーザー権限を取得し、モデルアクセス機能の利用可否を判定
 */

/**
 * ユーザー権限
 */
export interface UserPermissions {
  userId: string;
  role: 'admin' | 'user' | 'viewer';
  canEnableModels: boolean;
  canRequestAdmin: boolean;
}

/**
 * ユーザー権限マネージャー
 */
export class UserPermissionsManager {
  /**
   * ユーザー権限を取得
   * @param userId - ユーザーID
   * @returns ユーザー権限
   */
  static async getUserPermissions(userId: string): Promise<UserPermissions> {
    try {
      console.log(`🔐 ユーザー権限を取得中: ${userId}`);

      // TODO: DynamoDBからユーザー権限を取得
      // 現在は簡易実装として、ユーザーIDに基づいて権限を判定
      
      // admin権限: admin, testuser0
      if (userId === 'admin' || userId === 'testuser0') {
        console.log(`✅ admin権限: ${userId}`);
        return {
          userId,
          role: 'admin',
          canEnableModels: true,
          canRequestAdmin: true
        };
      }

      // user権限: testuser, testuser1-49
      if (userId === 'testuser' || /^testuser\d+$/.test(userId)) {
        console.log(`✅ user権限: ${userId}`);
        return {
          userId,
          role: 'user',
          canEnableModels: false,
          canRequestAdmin: true
        };
      }

      // viewer権限: その他
      console.log(`✅ viewer権限: ${userId}`);
      return {
        userId,
        role: 'viewer',
        canEnableModels: false,
        canRequestAdmin: false
      };
    } catch (error: any) {
      console.error(`❌ ユーザー権限取得エラー: ${userId}`, error);
      
      // エラー時はviewer権限を返す（安全側に倒す）
      return {
        userId,
        role: 'viewer',
        canEnableModels: false,
        canRequestAdmin: false
      };
    }
  }

  /**
   * ユーザーがモデル有効化権限を持つか確認
   * @param userId - ユーザーID
   * @returns モデル有効化権限の有無
   */
  static async canEnableModels(userId: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.canEnableModels;
  }

  /**
   * ユーザーが管理者依頼権限を持つか確認
   * @param userId - ユーザーID
   * @returns 管理者依頼権限の有無
   */
  static async canRequestAdmin(userId: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.canRequestAdmin;
  }
}
