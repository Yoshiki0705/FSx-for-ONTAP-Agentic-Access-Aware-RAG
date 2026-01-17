'use client';
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Navigation = Navigation;
const link_1 = __importDefault(require("next/link"));
const navigation_1 = require("next/navigation");
const lucide_react_1 = require("lucide-react");
const navigation = [
    { name: 'ダッシュボード', href: '/', icon: lucide_react_1.Home },
    { name: '検索', href: '/search', icon: lucide_react_1.Search },
    { name: '文書管理', href: '/documents', icon: lucide_react_1.FileText },
    { name: '権限管理', href: '/permissions', icon: lucide_react_1.Users },
    { name: 'メトリクス', href: '/metrics', icon: lucide_react_1.BarChart3 },
    { name: 'ログ', href: '/logs', icon: lucide_react_1.Activity },
    { name: '設定', href: '/settings', icon: lucide_react_1.Settings },
];
function Navigation() {
    const pathname = (0, navigation_1.usePathname)();
    return (<nav className="w-64 bg-white shadow-sm border-r border-gray-200">
      <div className="p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (<li key={item.name}>
                <link_1.default href={item.href} className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                    ? 'bg-netapp-blue text-white'
                    : 'text-gray-700 hover:bg-gray-100'}`}>
                  <item.icon className="mr-3 h-5 w-5"/>
                  {item.name}
                </link_1.default>
              </li>);
        })}
        </ul>
      </div>
    </nav>);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTmF2aWdhdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIk5hdmlnYXRpb24udHN4Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLFlBQVksQ0FBQzs7Ozs7O0FBd0JiLGdDQTZCQztBQW5ERCxxREFBNkI7QUFDN0IsZ0RBQThDO0FBQzlDLCtDQVFzQjtBQUV0QixNQUFNLFVBQVUsR0FBRztJQUNqQixFQUFFLElBQUksRUFBRSxTQUFTLEVBQUUsSUFBSSxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsbUJBQUksRUFBRTtJQUMxQyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUscUJBQU0sRUFBRTtJQUM3QyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLFlBQVksRUFBRSxJQUFJLEVBQUUsdUJBQVEsRUFBRTtJQUNwRCxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUUsb0JBQUssRUFBRTtJQUNuRCxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsd0JBQVMsRUFBRTtJQUNwRCxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsdUJBQVEsRUFBRTtJQUM3QyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUUsdUJBQVEsRUFBRTtDQUNsRCxDQUFDO0FBRUYsU0FBZ0IsVUFBVTtJQUN4QixNQUFNLFFBQVEsR0FBRyxJQUFBLHdCQUFXLEdBQUUsQ0FBQztJQUUvQixPQUFPLENBQ0wsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLGtEQUFrRCxDQUMvRDtNQUFBLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQ2xCO1FBQUEsQ0FBQyxFQUFFLENBQUMsU0FBUyxDQUFDLFdBQVcsQ0FDdkI7VUFBQSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLEVBQUUsRUFBRTtZQUN2QixNQUFNLFFBQVEsR0FBRyxRQUFRLEtBQUssSUFBSSxDQUFDLElBQUksQ0FBQztZQUN4QyxPQUFPLENBQ0wsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUNqQjtnQkFBQSxDQUFDLGNBQUksQ0FDSCxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQ2hCLFNBQVMsQ0FBQyxDQUFDLGdGQUNULFFBQVE7b0JBQ04sQ0FBQyxDQUFDLDJCQUEyQjtvQkFDN0IsQ0FBQyxDQUFDLGlDQUNOLEVBQUUsQ0FBQyxDQUVIO2tCQUFBLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUNuQztrQkFBQSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQ1o7Z0JBQUEsRUFBRSxjQUFJLENBQ1I7Y0FBQSxFQUFFLEVBQUUsQ0FBQyxDQUNOLENBQUM7UUFDSixDQUFDLENBQUMsQ0FDSjtRQUFBLEVBQUUsRUFBRSxDQUNOO01BQUEsRUFBRSxHQUFHLENBQ1A7SUFBQSxFQUFFLEdBQUcsQ0FBQyxDQUNQLENBQUM7QUFDSixDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBjbGllbnQnO1xuXG5pbXBvcnQgTGluayBmcm9tICduZXh0L2xpbmsnO1xuaW1wb3J0IHsgdXNlUGF0aG5hbWUgfSBmcm9tICduZXh0L25hdmlnYXRpb24nO1xuaW1wb3J0IHsgXG4gIEhvbWUsIFxuICBTZWFyY2gsIFxuICBGaWxlVGV4dCwgXG4gIFVzZXJzLCBcbiAgQmFyQ2hhcnQzLCBcbiAgU2V0dGluZ3MsXG4gIEFjdGl2aXR5XG59IGZyb20gJ2x1Y2lkZS1yZWFjdCc7XG5cbmNvbnN0IG5hdmlnYXRpb24gPSBbXG4gIHsgbmFtZTogJ+ODgOODg+OCt+ODpeODnOODvOODiScsIGhyZWY6ICcvJywgaWNvbjogSG9tZSB9LFxuICB7IG5hbWU6ICfmpJzntKInLCBocmVmOiAnL3NlYXJjaCcsIGljb246IFNlYXJjaCB9LFxuICB7IG5hbWU6ICfmlofmm7jnrqHnkIYnLCBocmVmOiAnL2RvY3VtZW50cycsIGljb246IEZpbGVUZXh0IH0sXG4gIHsgbmFtZTogJ+aoqemZkOeuoeeQhicsIGhyZWY6ICcvcGVybWlzc2lvbnMnLCBpY29uOiBVc2VycyB9LFxuICB7IG5hbWU6ICfjg6Hjg4jjg6rjgq/jgrknLCBocmVmOiAnL21ldHJpY3MnLCBpY29uOiBCYXJDaGFydDMgfSxcbiAgeyBuYW1lOiAn44Ot44KwJywgaHJlZjogJy9sb2dzJywgaWNvbjogQWN0aXZpdHkgfSxcbiAgeyBuYW1lOiAn6Kit5a6aJywgaHJlZjogJy9zZXR0aW5ncycsIGljb246IFNldHRpbmdzIH0sXG5dO1xuXG5leHBvcnQgZnVuY3Rpb24gTmF2aWdhdGlvbigpIHtcbiAgY29uc3QgcGF0aG5hbWUgPSB1c2VQYXRobmFtZSgpO1xuXG4gIHJldHVybiAoXG4gICAgPG5hdiBjbGFzc05hbWU9XCJ3LTY0IGJnLXdoaXRlIHNoYWRvdy1zbSBib3JkZXItciBib3JkZXItZ3JheS0yMDBcIj5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwicC00XCI+XG4gICAgICAgIDx1bCBjbGFzc05hbWU9XCJzcGFjZS15LTJcIj5cbiAgICAgICAgICB7bmF2aWdhdGlvbi5tYXAoKGl0ZW0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGlzQWN0aXZlID0gcGF0aG5hbWUgPT09IGl0ZW0uaHJlZjtcbiAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgIDxsaSBrZXk9e2l0ZW0ubmFtZX0+XG4gICAgICAgICAgICAgICAgPExpbmtcbiAgICAgICAgICAgICAgICAgIGhyZWY9e2l0ZW0uaHJlZn1cbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17YGZsZXggaXRlbXMtY2VudGVyIHB4LTMgcHktMiByb3VuZGVkLW1kIHRleHQtc20gZm9udC1tZWRpdW0gdHJhbnNpdGlvbi1jb2xvcnMgJHtcbiAgICAgICAgICAgICAgICAgICAgaXNBY3RpdmVcbiAgICAgICAgICAgICAgICAgICAgICA/ICdiZy1uZXRhcHAtYmx1ZSB0ZXh0LXdoaXRlJ1xuICAgICAgICAgICAgICAgICAgICAgIDogJ3RleHQtZ3JheS03MDAgaG92ZXI6YmctZ3JheS0xMDAnXG4gICAgICAgICAgICAgICAgICB9YH1cbiAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICA8aXRlbS5pY29uIGNsYXNzTmFtZT1cIm1yLTMgaC01IHctNVwiIC8+XG4gICAgICAgICAgICAgICAgICB7aXRlbS5uYW1lfVxuICAgICAgICAgICAgICAgIDwvTGluaz5cbiAgICAgICAgICAgICAgPC9saT5cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfSl9XG4gICAgICAgIDwvdWw+XG4gICAgICA8L2Rpdj5cbiAgICA8L25hdj5cbiAgKTtcbn1cbiJdfQ==