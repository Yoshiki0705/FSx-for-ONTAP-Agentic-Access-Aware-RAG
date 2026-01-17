"use strict";
/**
 * Security Module
 * セキュリティ統合モジュール
 *
 * 機能:
 * - ユーザー認証システム（Cognito）
 * - ロールベース認可（IAM）
 * - Web Application Firewall（WAF）
 * - 暗号化設定（KMS）
 * - アクセス監査システム
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
__exportStar(require("./constructs"), exports);
__exportStar(require("./interfaces"), exports);
// // export * from './policies';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7R0FVRzs7Ozs7Ozs7Ozs7Ozs7OztBQUVILCtDQUE2QjtBQUM3QiwrQ0FBNkI7QUFDN0IsaUNBQWlDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBTZWN1cml0eSBNb2R1bGVcbiAqIOOCu+OCreODpeODquODhuOCo+e1seWQiOODouOCuOODpeODvOODq1xuICogXG4gKiDmqZ/og706XG4gKiAtIOODpuODvOOCtuODvOiqjeiovOOCt+OCueODhuODoO+8iENvZ25pdG/vvIlcbiAqIC0g44Ot44O844Or44OZ44O844K56KqN5Y+v77yISUFN77yJXG4gKiAtIFdlYiBBcHBsaWNhdGlvbiBGaXJld2FsbO+8iFdBRu+8iVxuICogLSDmmpflj7fljJboqK3lrprvvIhLTVPvvIlcbiAqIC0g44Ki44Kv44K744K555uj5p+744K344K544OG44OgXG4gKi9cblxuZXhwb3J0ICogZnJvbSAnLi9jb25zdHJ1Y3RzJztcbmV4cG9ydCAqIGZyb20gJy4vaW50ZXJmYWNlcyc7XG4vLyAvLyBleHBvcnQgKiBmcm9tICcuL3BvbGljaWVzJzsiXX0=