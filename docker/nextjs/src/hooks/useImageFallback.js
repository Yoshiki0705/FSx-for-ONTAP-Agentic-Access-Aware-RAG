"use strict";
/**
 * 画像フォールバック処理カスタムフック
 *
 * 画像読み込みエラー時の処理を抽象化
 * 改善: 状態管理の統一、DOM操作の排除、型安全性の向上
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.useImageFallback = useImageFallback;
const react_1 = require("react");
function useImageFallback(config = {}) {
    const [imageState, setImageState] = (0, react_1.useState)('loading');
    const handleImageError = (0, react_1.useCallback)((event) => {
        // DOM操作を排除し、状態管理のみで制御
        setImageState('error');
        // カスタムエラーハンドラーを実行
        if (config.onError) {
            config.onError(event.nativeEvent);
        }
    }, [config.onError]);
    const handleImageLoad = (0, react_1.useCallback)(() => {
        setImageState('loaded');
        // カスタムロードハンドラーを実行
        if (config.onLoad) {
            config.onLoad();
        }
    }, [config.onLoad]);
    const resetState = (0, react_1.useCallback)(() => {
        setImageState('loading');
    }, []);
    return {
        imageState,
        isLoading: imageState === 'loading',
        isLoaded: imageState === 'loaded',
        hasError: imageState === 'error',
        showImage: imageState !== 'error',
        handleImageError,
        handleImageLoad,
        resetState,
    };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXNlSW1hZ2VGYWxsYmFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInVzZUltYWdlRmFsbGJhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7OztHQUtHOztBQXVCSCw0Q0FvQ0M7QUF6REQsaUNBQThDO0FBcUI5QyxTQUFnQixnQkFBZ0IsQ0FBQyxTQUE4QixFQUFFO0lBQy9ELE1BQU0sQ0FBQyxVQUFVLEVBQUUsYUFBYSxDQUFDLEdBQUcsSUFBQSxnQkFBUSxFQUFpQixTQUFTLENBQUMsQ0FBQztJQUV4RSxNQUFNLGdCQUFnQixHQUFHLElBQUEsbUJBQVcsRUFBQyxDQUFDLEtBQTZDLEVBQUUsRUFBRTtRQUNyRixzQkFBc0I7UUFDdEIsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBRXZCLGtCQUFrQjtRQUNsQixJQUFJLE1BQU0sQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNuQixNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUNwQyxDQUFDO0lBQ0gsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7SUFFckIsTUFBTSxlQUFlLEdBQUcsSUFBQSxtQkFBVyxFQUFDLEdBQUcsRUFBRTtRQUN2QyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUM7UUFFeEIsa0JBQWtCO1FBQ2xCLElBQUksTUFBTSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ2xCLE1BQU0sQ0FBQyxNQUFNLEVBQUUsQ0FBQztRQUNsQixDQUFDO0lBQ0gsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFFcEIsTUFBTSxVQUFVLEdBQUcsSUFBQSxtQkFBVyxFQUFDLEdBQUcsRUFBRTtRQUNsQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDM0IsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBRVAsT0FBTztRQUNMLFVBQVU7UUFDVixTQUFTLEVBQUUsVUFBVSxLQUFLLFNBQVM7UUFDbkMsUUFBUSxFQUFFLFVBQVUsS0FBSyxRQUFRO1FBQ2pDLFFBQVEsRUFBRSxVQUFVLEtBQUssT0FBTztRQUNoQyxTQUFTLEVBQUUsVUFBVSxLQUFLLE9BQU87UUFDakMsZ0JBQWdCO1FBQ2hCLGVBQWU7UUFDZixVQUFVO0tBQ1gsQ0FBQztBQUNKLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIOeUu+WDj+ODleOCqeODvOODq+ODkOODg+OCr+WHpueQhuOCq+OCueOCv+ODoOODleODg+OCr1xuICogXG4gKiDnlLvlg4/oqq3jgb/ovrzjgb/jgqjjg6njg7zmmYLjga7lh6bnkIbjgpLmir3osaHljJZcbiAqIOaUueWWhDog54q25oWL566h55CG44Gu57Wx5LiA44CBRE9N5pON5L2c44Gu5o6S6Zmk44CB5Z6L5a6J5YWo5oCn44Gu5ZCR5LiKXG4gKi9cblxuaW1wb3J0IHsgdXNlQ2FsbGJhY2ssIHVzZVN0YXRlIH0gZnJvbSAncmVhY3QnO1xuXG5leHBvcnQgdHlwZSBJbWFnZUxvYWRTdGF0ZSA9ICdsb2FkaW5nJyB8ICdsb2FkZWQnIHwgJ2Vycm9yJztcblxuaW50ZXJmYWNlIEltYWdlRmFsbGJhY2tDb25maWcge1xuICBmYWxsYmFja0NsYXNzTmFtZT86IHN0cmluZztcbiAgb25FcnJvcj86IChlcnJvcjogRXZlbnQpID0+IHZvaWQ7XG4gIG9uTG9hZD86ICgpID0+IHZvaWQ7XG59XG5cbmludGVyZmFjZSBJbWFnZUZhbGxiYWNrUmV0dXJuIHtcbiAgaW1hZ2VTdGF0ZTogSW1hZ2VMb2FkU3RhdGU7XG4gIGlzTG9hZGluZzogYm9vbGVhbjtcbiAgaXNMb2FkZWQ6IGJvb2xlYW47XG4gIGhhc0Vycm9yOiBib29sZWFuO1xuICBzaG93SW1hZ2U6IGJvb2xlYW47XG4gIGhhbmRsZUltYWdlRXJyb3I6IChldmVudDogUmVhY3QuU3ludGhldGljRXZlbnQ8SFRNTEltYWdlRWxlbWVudD4pID0+IHZvaWQ7XG4gIGhhbmRsZUltYWdlTG9hZDogKCkgPT4gdm9pZDtcbiAgcmVzZXRTdGF0ZTogKCkgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVzZUltYWdlRmFsbGJhY2soY29uZmlnOiBJbWFnZUZhbGxiYWNrQ29uZmlnID0ge30pOiBJbWFnZUZhbGxiYWNrUmV0dXJuIHtcbiAgY29uc3QgW2ltYWdlU3RhdGUsIHNldEltYWdlU3RhdGVdID0gdXNlU3RhdGU8SW1hZ2VMb2FkU3RhdGU+KCdsb2FkaW5nJyk7XG5cbiAgY29uc3QgaGFuZGxlSW1hZ2VFcnJvciA9IHVzZUNhbGxiYWNrKChldmVudDogUmVhY3QuU3ludGhldGljRXZlbnQ8SFRNTEltYWdlRWxlbWVudD4pID0+IHtcbiAgICAvLyBET03mk43kvZzjgpLmjpLpmaTjgZfjgIHnirbmhYvnrqHnkIbjga7jgb/jgafliLblvqFcbiAgICBzZXRJbWFnZVN0YXRlKCdlcnJvcicpO1xuICAgIFxuICAgIC8vIOOCq+OCueOCv+ODoOOCqOODqeODvOODj+ODs+ODieODqeODvOOCkuWun+ihjFxuICAgIGlmIChjb25maWcub25FcnJvcikge1xuICAgICAgY29uZmlnLm9uRXJyb3IoZXZlbnQubmF0aXZlRXZlbnQpO1xuICAgIH1cbiAgfSwgW2NvbmZpZy5vbkVycm9yXSk7XG5cbiAgY29uc3QgaGFuZGxlSW1hZ2VMb2FkID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xuICAgIHNldEltYWdlU3RhdGUoJ2xvYWRlZCcpO1xuICAgIFxuICAgIC8vIOOCq+OCueOCv+ODoOODreODvOODieODj+ODs+ODieODqeODvOOCkuWun+ihjFxuICAgIGlmIChjb25maWcub25Mb2FkKSB7XG4gICAgICBjb25maWcub25Mb2FkKCk7XG4gICAgfVxuICB9LCBbY29uZmlnLm9uTG9hZF0pO1xuXG4gIGNvbnN0IHJlc2V0U3RhdGUgPSB1c2VDYWxsYmFjaygoKSA9PiB7XG4gICAgc2V0SW1hZ2VTdGF0ZSgnbG9hZGluZycpO1xuICB9LCBbXSk7XG5cbiAgcmV0dXJuIHtcbiAgICBpbWFnZVN0YXRlLFxuICAgIGlzTG9hZGluZzogaW1hZ2VTdGF0ZSA9PT0gJ2xvYWRpbmcnLFxuICAgIGlzTG9hZGVkOiBpbWFnZVN0YXRlID09PSAnbG9hZGVkJyxcbiAgICBoYXNFcnJvcjogaW1hZ2VTdGF0ZSA9PT0gJ2Vycm9yJyxcbiAgICBzaG93SW1hZ2U6IGltYWdlU3RhdGUgIT09ICdlcnJvcicsXG4gICAgaGFuZGxlSW1hZ2VFcnJvcixcbiAgICBoYW5kbGVJbWFnZUxvYWQsXG4gICAgcmVzZXRTdGF0ZSxcbiAgfTtcbn0iXX0=