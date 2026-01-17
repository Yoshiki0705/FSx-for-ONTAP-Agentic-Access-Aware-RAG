"use strict";
/**
 * 遅延読み込み対応NetAppブランドセクション
 * パフォーマンス最適化のための遅延読み込み実装
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = LazyNetAppBrandSection;
const react_1 = require("react");
// 遅延読み込み用のコンポーネント
const NetAppBrandSection = (0, react_1.lazy)(() => Promise.resolve().then(() => __importStar(require('./NetAppBrandSection'))));
function LazyNetAppBrandSection({ className }) {
    return (<react_1.Suspense fallback={<BrandSectionSkeleton />}>
      <NetAppBrandSection className={className}/>
    </react_1.Suspense>);
}
/**
 * ローディング中のスケルトンUI
 */
function BrandSectionSkeleton() {
    return (<div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-blue-800 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-800">
        <div className="absolute inset-0 bg-black bg-opacity-20"></div>
        <div className="relative z-10 flex flex-col justify-center items-center h-full text-white p-12">
          <div className="text-center">
            {/* ロゴスケルトン */}
            <div className="mb-8">
              <div className="w-32 h-32 mx-auto bg-white bg-opacity-20 rounded-full animate-pulse"></div>
            </div>
            
            {/* タイトルスケルトン */}
            <div className="mb-4 h-12 bg-white bg-opacity-20 rounded animate-pulse"></div>
            <div className="mb-6 h-8 bg-white bg-opacity-20 rounded animate-pulse"></div>
            
            {/* 説明スケルトン */}
            <div className="mb-8 h-6 bg-white bg-opacity-20 rounded animate-pulse max-w-md mx-auto"></div>
            
            {/* 技術ショーケーススケルトン */}
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (<div key={i} className="bg-white bg-opacity-10 rounded-lg p-4 animate-pulse">
                  <div className="h-8 bg-white bg-opacity-20 rounded mb-2"></div>
                  <div className="h-4 bg-white bg-opacity-20 rounded"></div>
                </div>))}
            </div>
          </div>
        </div>
      </div>
    </div>);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTGF6eU5ldEFwcEJyYW5kU2VjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIkxhenlOZXRBcHBCcmFuZFNlY3Rpb24udHN4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7O0dBR0c7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFXSCx5Q0FNQztBQWZELGlDQUF1QztBQUV2QyxrQkFBa0I7QUFDbEIsTUFBTSxrQkFBa0IsR0FBRyxJQUFBLFlBQUksRUFBQyxHQUFHLEVBQUUsbURBQVEsc0JBQXNCLEdBQUMsQ0FBQyxDQUFDO0FBTXRFLFNBQXdCLHNCQUFzQixDQUFDLEVBQUUsU0FBUyxFQUErQjtJQUN2RixPQUFPLENBQ0wsQ0FBQyxnQkFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsb0JBQW9CLENBQUMsQUFBRCxFQUFHLENBQUMsQ0FDM0M7TUFBQSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxFQUMzQztJQUFBLEVBQUUsZ0JBQVEsQ0FBQyxDQUNaLENBQUM7QUFDSixDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLG9CQUFvQjtJQUMzQixPQUFPLENBQ0wsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLDhGQUE4RixDQUMzRztNQUFBLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQywyRUFBMkUsQ0FDeEY7UUFBQSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMseUNBQXlDLENBQUMsRUFBRSxHQUFHLENBQzlEO1FBQUEsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGdGQUFnRixDQUM3RjtVQUFBLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQzFCO1lBQUEsQ0FBQyxhQUFhLENBQ2Q7WUFBQSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUNuQjtjQUFBLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxxRUFBcUUsQ0FBQyxFQUFFLEdBQUcsQ0FDNUY7WUFBQSxFQUFFLEdBQUcsQ0FFTDs7WUFBQSxDQUFDLGVBQWUsQ0FDaEI7WUFBQSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsd0RBQXdELENBQUMsRUFBRSxHQUFHLENBQzdFO1lBQUEsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLHVEQUF1RCxDQUFDLEVBQUUsR0FBRyxDQUU1RTs7WUFBQSxDQUFDLGFBQWEsQ0FDZDtZQUFBLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyx3RUFBd0UsQ0FBQyxFQUFFLEdBQUcsQ0FFN0Y7O1lBQUEsQ0FBQyxtQkFBbUIsQ0FDcEI7WUFBQSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsd0JBQXdCLENBQ3JDO2NBQUEsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUNwQixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMscURBQXFELENBQzFFO2tCQUFBLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyx5Q0FBeUMsQ0FBQyxFQUFFLEdBQUcsQ0FDOUQ7a0JBQUEsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLG9DQUFvQyxDQUFDLEVBQUUsR0FBRyxDQUMzRDtnQkFBQSxFQUFFLEdBQUcsQ0FBQyxDQUNQLENBQUMsQ0FDSjtZQUFBLEVBQUUsR0FBRyxDQUNQO1VBQUEsRUFBRSxHQUFHLENBQ1A7UUFBQSxFQUFFLEdBQUcsQ0FDUDtNQUFBLEVBQUUsR0FBRyxDQUNQO0lBQUEsRUFBRSxHQUFHLENBQUMsQ0FDUCxDQUFDO0FBQ0osQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICog6YGF5bu26Kqt44G/6L6844G/5a++5b+cTmV0QXBw44OW44Op44Oz44OJ44K744Kv44K344On44OzXG4gKiDjg5Hjg5Xjgqnjg7zjg57jg7PjgrnmnIDpganljJbjga7jgZ/jgoHjga7pgYXlu7boqq3jgb/ovrzjgb/lrp/oo4VcbiAqL1xuXG5pbXBvcnQgeyBsYXp5LCBTdXNwZW5zZSB9IGZyb20gJ3JlYWN0JztcblxuLy8g6YGF5bu26Kqt44G/6L6844G/55So44Gu44Kz44Oz44Od44O844ON44Oz44OIXG5jb25zdCBOZXRBcHBCcmFuZFNlY3Rpb24gPSBsYXp5KCgpID0+IGltcG9ydCgnLi9OZXRBcHBCcmFuZFNlY3Rpb24nKSk7XG5cbmludGVyZmFjZSBMYXp5TmV0QXBwQnJhbmRTZWN0aW9uUHJvcHMge1xuICBjbGFzc05hbWU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIExhenlOZXRBcHBCcmFuZFNlY3Rpb24oeyBjbGFzc05hbWUgfTogTGF6eU5ldEFwcEJyYW5kU2VjdGlvblByb3BzKSB7XG4gIHJldHVybiAoXG4gICAgPFN1c3BlbnNlIGZhbGxiYWNrPXs8QnJhbmRTZWN0aW9uU2tlbGV0b24gLz59PlxuICAgICAgPE5ldEFwcEJyYW5kU2VjdGlvbiBjbGFzc05hbWU9e2NsYXNzTmFtZX0gLz5cbiAgICA8L1N1c3BlbnNlPlxuICApO1xufVxuXG4vKipcbiAqIOODreODvOODh+OCo+ODs+OCsOS4reOBruOCueOCseODq+ODiOODs1VJXG4gKi9cbmZ1bmN0aW9uIEJyYW5kU2VjdGlvblNrZWxldG9uKCkge1xuICByZXR1cm4gKFxuICAgIDxkaXYgY2xhc3NOYW1lPVwiaGlkZGVuIGxnOmZsZXggbGc6dy0xLzIgYmctZ3JhZGllbnQtdG8tYnIgZnJvbS1ibHVlLTYwMCB0by1ibHVlLTgwMCByZWxhdGl2ZSBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYWJzb2x1dGUgaW5zZXQtMCBiZy1ncmFkaWVudC10by1iciBmcm9tLWJsdWUtNTAwIHZpYS1ibHVlLTYwMCB0by1ibHVlLTgwMFwiPlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImFic29sdXRlIGluc2V0LTAgYmctYmxhY2sgYmctb3BhY2l0eS0yMFwiPjwvZGl2PlxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInJlbGF0aXZlIHotMTAgZmxleCBmbGV4LWNvbCBqdXN0aWZ5LWNlbnRlciBpdGVtcy1jZW50ZXIgaC1mdWxsIHRleHQtd2hpdGUgcC0xMlwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1jZW50ZXJcIj5cbiAgICAgICAgICAgIHsvKiDjg63jgrTjgrnjgrHjg6vjg4jjg7MgKi99XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1iLThcIj5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LTMyIGgtMzIgbXgtYXV0byBiZy13aGl0ZSBiZy1vcGFjaXR5LTIwIHJvdW5kZWQtZnVsbCBhbmltYXRlLXB1bHNlXCI+PC9kaXY+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgey8qIOOCv+OCpOODiOODq+OCueOCseODq+ODiOODsyAqL31cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWItNCBoLTEyIGJnLXdoaXRlIGJnLW9wYWNpdHktMjAgcm91bmRlZCBhbmltYXRlLXB1bHNlXCI+PC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1iLTYgaC04IGJnLXdoaXRlIGJnLW9wYWNpdHktMjAgcm91bmRlZCBhbmltYXRlLXB1bHNlXCI+PC9kaXY+XG4gICAgICAgICAgICBcbiAgICAgICAgICAgIHsvKiDoqqzmmI7jgrnjgrHjg6vjg4jjg7MgKi99XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1iLTggaC02IGJnLXdoaXRlIGJnLW9wYWNpdHktMjAgcm91bmRlZCBhbmltYXRlLXB1bHNlIG1heC13LW1kIG14LWF1dG9cIj48L2Rpdj5cbiAgICAgICAgICAgIFxuICAgICAgICAgICAgey8qIOaKgOihk+OCt+ODp+ODvOOCseODvOOCueOCueOCseODq+ODiOODsyAqL31cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtMyBnYXAtNFwiPlxuICAgICAgICAgICAgICB7WzEsIDIsIDNdLm1hcCgoaSkgPT4gKFxuICAgICAgICAgICAgICAgIDxkaXYga2V5PXtpfSBjbGFzc05hbWU9XCJiZy13aGl0ZSBiZy1vcGFjaXR5LTEwIHJvdW5kZWQtbGcgcC00IGFuaW1hdGUtcHVsc2VcIj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiaC04IGJnLXdoaXRlIGJnLW9wYWNpdHktMjAgcm91bmRlZCBtYi0yXCI+PC9kaXY+XG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImgtNCBiZy13aGl0ZSBiZy1vcGFjaXR5LTIwIHJvdW5kZWRcIj48L2Rpdj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKTtcbn0iXX0=