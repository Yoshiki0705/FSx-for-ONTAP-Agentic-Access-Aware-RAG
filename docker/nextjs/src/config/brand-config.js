"use strict";
/**
 * ブランド設定管理
 *
 * 画像パス・フォールバック設定の一元管理
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BRAND_CONFIG = void 0;
exports.getBrandConfig = getBrandConfig;
/**
 * デフォルトブランド設定
 */
exports.DEFAULT_BRAND_CONFIG = {
    mainImage: {
        src: '/images/main-image.jpg',
        alt: 'NetApp Permission-aware RAG System',
        fallbackClassName: 'bg-gradient-to-br from-blue-500 via-blue-600 to-blue-800',
    },
};
/**
 * 環境別ブランド設定取得
 */
function getBrandConfig() {
    // 環境変数による設定上書き
    const customImageSrc = process.env.NEXT_PUBLIC_BRAND_IMAGE_SRC;
    if (customImageSrc) {
        return {
            ...exports.DEFAULT_BRAND_CONFIG,
            mainImage: {
                ...exports.DEFAULT_BRAND_CONFIG.mainImage,
                src: customImageSrc,
            },
        };
    }
    return exports.DEFAULT_BRAND_CONFIG;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnJhbmQtY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiYnJhbmQtY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOzs7QUEyQkgsd0NBZUM7QUE3QkQ7O0dBRUc7QUFDVSxRQUFBLG9CQUFvQixHQUFnQjtJQUMvQyxTQUFTLEVBQUU7UUFDVCxHQUFHLEVBQUUsd0JBQXdCO1FBQzdCLEdBQUcsRUFBRSxvQ0FBb0M7UUFDekMsaUJBQWlCLEVBQUUsMERBQTBEO0tBQzlFO0NBQ0YsQ0FBQztBQUVGOztHQUVHO0FBQ0gsU0FBZ0IsY0FBYztJQUM1QixlQUFlO0lBQ2YsTUFBTSxjQUFjLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQywyQkFBMkIsQ0FBQztJQUUvRCxJQUFJLGNBQWMsRUFBRSxDQUFDO1FBQ25CLE9BQU87WUFDTCxHQUFHLDRCQUFvQjtZQUN2QixTQUFTLEVBQUU7Z0JBQ1QsR0FBRyw0QkFBb0IsQ0FBQyxTQUFTO2dCQUNqQyxHQUFHLEVBQUUsY0FBYzthQUNwQjtTQUNGLENBQUM7SUFDSixDQUFDO0lBRUQsT0FBTyw0QkFBb0IsQ0FBQztBQUM5QixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiDjg5bjg6njg7Pjg4noqK3lrprnrqHnkIZcbiAqIFxuICog55S75YOP44OR44K544O744OV44Kp44O844Or44OQ44OD44Kv6Kit5a6a44Gu5LiA5YWD566h55CGXG4gKi9cblxuZXhwb3J0IGludGVyZmFjZSBCcmFuZEltYWdlQ29uZmlnIHtcbiAgc3JjOiBzdHJpbmc7XG4gIGFsdDogc3RyaW5nO1xuICBmYWxsYmFja0NsYXNzTmFtZTogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEJyYW5kQ29uZmlnIHtcbiAgbWFpbkltYWdlOiBCcmFuZEltYWdlQ29uZmlnO1xuICBsb2dvPzogQnJhbmRJbWFnZUNvbmZpZztcbn1cblxuLyoqXG4gKiDjg4fjg5Xjgqnjg6vjg4jjg5bjg6njg7Pjg4noqK3lrppcbiAqL1xuZXhwb3J0IGNvbnN0IERFRkFVTFRfQlJBTkRfQ09ORklHOiBCcmFuZENvbmZpZyA9IHtcbiAgbWFpbkltYWdlOiB7XG4gICAgc3JjOiAnL2ltYWdlcy9tYWluLWltYWdlLmpwZycsXG4gICAgYWx0OiAnTmV0QXBwIFBlcm1pc3Npb24tYXdhcmUgUkFHIFN5c3RlbScsXG4gICAgZmFsbGJhY2tDbGFzc05hbWU6ICdiZy1ncmFkaWVudC10by1iciBmcm9tLWJsdWUtNTAwIHZpYS1ibHVlLTYwMCB0by1ibHVlLTgwMCcsXG4gIH0sXG59O1xuXG4vKipcbiAqIOeSsOWig+WIpeODluODqeODs+ODieioreWumuWPluW+l1xuICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0QnJhbmRDb25maWcoKTogQnJhbmRDb25maWcge1xuICAvLyDnkrDlooPlpInmlbDjgavjgojjgovoqK3lrprkuIrmm7jjgY1cbiAgY29uc3QgY3VzdG9tSW1hZ2VTcmMgPSBwcm9jZXNzLmVudi5ORVhUX1BVQkxJQ19CUkFORF9JTUFHRV9TUkM7XG4gIFxuICBpZiAoY3VzdG9tSW1hZ2VTcmMpIHtcbiAgICByZXR1cm4ge1xuICAgICAgLi4uREVGQVVMVF9CUkFORF9DT05GSUcsXG4gICAgICBtYWluSW1hZ2U6IHtcbiAgICAgICAgLi4uREVGQVVMVF9CUkFORF9DT05GSUcubWFpbkltYWdlLFxuICAgICAgICBzcmM6IGN1c3RvbUltYWdlU3JjLFxuICAgICAgfSxcbiAgICB9O1xuICB9XG4gIFxuICByZXR1cm4gREVGQVVMVF9CUkFORF9DT05GSUc7XG59Il19