"use strict";
/**
 * Networking Module
 * ネットワーク基盤モジュール
 *
 * 機能:
 * - VPC設定とサブネット管理
 * - セキュリティグループ設定
 * - ロードバランサー設定
 * - CloudFront CDN設定
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
__exportStar(require("./constructs/networking-construct"), exports);
__exportStar(require("./interfaces/networking-config"), exports);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7OztHQVNHOzs7Ozs7Ozs7Ozs7Ozs7O0FBRUgsb0VBQWtEO0FBQ2xELGlFQUErQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogTmV0d29ya2luZyBNb2R1bGVcbiAqIOODjeODg+ODiOODr+ODvOOCr+WfuuebpOODouOCuOODpeODvOODq1xuICogXG4gKiDmqZ/og706XG4gKiAtIFZQQ+ioreWumuOBqOOCteODluODjeODg+ODiOeuoeeQhlxuICogLSDjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5foqK3lrppcbiAqIC0g44Ot44O844OJ44OQ44Op44Oz44K144O86Kit5a6aXG4gKiAtIENsb3VkRnJvbnQgQ0RO6Kit5a6aXG4gKi9cblxuZXhwb3J0ICogZnJvbSAnLi9jb25zdHJ1Y3RzL25ldHdvcmtpbmctY29uc3RydWN0JztcbmV4cG9ydCAqIGZyb20gJy4vaW50ZXJmYWNlcy9uZXR3b3JraW5nLWNvbmZpZyc7Il19